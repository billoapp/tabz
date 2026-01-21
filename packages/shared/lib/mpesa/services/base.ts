/**
 * Base service classes with dependency injection for M-PESA integration
 * Provides common functionality and interfaces for all M-PESA services
 */

import { 
  MpesaEnvironment, 
  ServiceConfig, 
  MpesaCredentials,
  MpesaError,
  MpesaNetworkError
} from '../types';
import { EnvironmentConfigManager } from '../config';

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}

/**
 * HTTP client interface for dependency injection
 */
export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<any>;
  post(url: string, data: any, headers?: Record<string, string>): Promise<any>;
}

/**
 * Default fetch-based HTTP client implementation
 */
export class FetchHttpClient implements HttpClient {
  constructor(private timeoutMs: number = 30000) {}

  async get(url: string, headers?: Record<string, string>): Promise<any> {
    return this.request('GET', url, undefined, headers);
  }

  async post(url: string, data: any, headers?: Record<string, string>): Promise<any> {
    return this.request('POST', url, data, headers);
  }

  private async request(
    method: string, 
    url: string, 
    data?: any, 
    headers?: Record<string, string>
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new MpesaNetworkError(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
          { status: response.status, statusText: response.statusText, body: errorText }
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof MpesaNetworkError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MpesaNetworkError(`Request timeout after ${this.timeoutMs}ms`, error);
      }
      
      throw new MpesaNetworkError('Network request failed', error);
    }
  }
}

/**
 * Credential store interface for dependency injection
 */
export interface CredentialStore {
  getCredentials(environment: MpesaEnvironment): Promise<MpesaCredentials>;
  saveCredentials(credentials: MpesaCredentials, environment: MpesaEnvironment): Promise<void>;
  validateCredentials(credentials: MpesaCredentials): Promise<boolean>;
  rotateCredentials(environment: MpesaEnvironment): Promise<void>;
}

/**
 * Base service class with common functionality
 */
export abstract class BaseService {
  protected logger: Logger;
  protected httpClient: HttpClient;
  protected configManager: EnvironmentConfigManager;
  protected config: ServiceConfig;

  constructor(
    config: ServiceConfig,
    logger?: Logger,
    httpClient?: HttpClient
  ) {
    this.config = config;
    this.logger = logger || new ConsoleLogger();
    this.httpClient = httpClient || new FetchHttpClient(config.timeoutMs);
    this.configManager = EnvironmentConfigManager.getInstance();
    
    // Set up environment configuration
    this.configManager.setEnvironmentConfig(config.environment, config.credentials);
  }

  /**
   * Get current environment configuration
   */
  protected getCurrentConfig() {
    return this.configManager.getCurrentConfig();
  }

  /**
   * Check if current environment is production
   */
  protected isProduction(): boolean {
    return this.configManager.isProduction();
  }

  /**
   * Log with environment context
   */
  protected logWithContext(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: any) {
    const contextMeta = {
      environment: this.config.environment,
      timestamp: new Date().toISOString(),
      ...meta
    };
    this.logger[level](message, contextMeta);
  }

  /**
   * Handle errors with proper logging and context
   */
  protected handleError(error: any, context: string): never {
    const errorMessage = `${context}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    this.logWithContext('error', errorMessage, {
      error: error instanceof Error ? error.stack : error,
      context
    });

    if (error instanceof MpesaError) {
      throw error;
    }

    throw new MpesaError(errorMessage, 'INTERNAL_ERROR', undefined, error);
  }

  /**
   * Validate service configuration
   */
  protected validateConfig(): void {
    if (!this.config.credentials) {
      throw new MpesaError('Credentials are required', 'CONFIG_ERROR');
    }

    if (!['sandbox', 'production'].includes(this.config.environment)) {
      throw new MpesaError('Invalid environment', 'CONFIG_ERROR');
    }

    if (this.config.timeoutMs <= 0) {
      throw new MpesaError('Timeout must be positive', 'CONFIG_ERROR');
    }

    if (this.config.retryAttempts < 0) {
      throw new MpesaError('Retry attempts cannot be negative', 'CONFIG_ERROR');
    }

    if (this.config.rateLimitPerMinute <= 0) {
      throw new MpesaError('Rate limit must be positive', 'CONFIG_ERROR');
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    context: string,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || this.config.retryAttempts;
    let lastError: any;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === attempts) {
          break;
        }

        // Don't retry authentication errors
        if (error instanceof MpesaError && error.code === 'AUTHENTICATION_ERROR') {
          break;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
        this.logWithContext('warn', `${context} failed, retrying in ${delay}ms`, {
          attempt,
          maxAttempts: attempts,
          error: error instanceof Error ? error.message : error
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.handleError(lastError, `${context} failed after ${attempts} attempts`);
  }

  /**
   * Rate limiting check (basic implementation)
   */
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  protected checkRateLimit(key: string): void {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const limit = this.config.rateLimitPerMinute;

    const current = this.requestCounts.get(key);
    
    if (!current || now > current.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return;
    }

    if (current.count >= limit) {
      throw new MpesaError(
        `Rate limit exceeded: ${limit} requests per minute`,
        'RATE_LIMIT_ERROR',
        429
      );
    }

    current.count++;
  }

  /**
   * Clean up expired rate limit entries
   */
  protected cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, data] of this.requestCounts.entries()) {
      if (now > data.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }
}

/**
 * Service factory for creating configured services
 */
export class ServiceFactory {
  private static defaultConfig: Partial<ServiceConfig> = {
    timeoutMs: 30000,
    retryAttempts: 3,
    rateLimitPerMinute: 60
  };

  static createServiceConfig(
    environment: MpesaEnvironment,
    credentials: MpesaCredentials,
    overrides?: Partial<ServiceConfig>
  ): ServiceConfig {
    return {
      environment,
      credentials,
      ...this.defaultConfig,
      ...overrides
    } as ServiceConfig;
  }

  static createLogger(enableDebug: boolean = false): Logger {
    return new ConsoleLogger();
  }

  static createHttpClient(timeoutMs: number = 30000): HttpClient {
    return new FetchHttpClient(timeoutMs);
  }
}