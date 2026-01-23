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

// Import tenant-specific types and services for integration
import type { TenantMpesaConfig, TenantMpesaConfigFactory } from './tenant-config-factory';
import type { TabResolutionService } from './tab-resolution';
import type { CredentialRetrievalService } from './credential-retrieval';

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
    
    // Create credentials object from individual fields for environment configuration
    const credentials: MpesaCredentials = {
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      businessShortCode: config.businessShortCode,
      passkey: config.passkey,
      callbackUrl: config.callbackUrl,
      environment: config.environment,
      encryptedAt: new Date(),
      lastValidated: new Date()
    };
    
    // Set up environment configuration
    this.configManager.setEnvironmentConfig(config.environment, credentials);
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
    if (!this.config.consumerKey || !this.config.consumerSecret || 
        !this.config.businessShortCode || !this.config.passkey) {
      throw new MpesaError('All credential fields are required', 'CONFIG_ERROR');
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

  /**
   * Create service configuration from environment variables (legacy method)
   * @deprecated Use createTenantServiceConfig for tenant-specific credentials
   */
  static createServiceConfig(
    environment: MpesaEnvironment,
    credentials: MpesaCredentials,
    overrides?: Partial<ServiceConfig>
  ): ServiceConfig {
    return {
      environment,
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      businessShortCode: credentials.businessShortCode,
      passkey: credentials.passkey,
      callbackUrl: credentials.callbackUrl,
      ...this.defaultConfig,
      ...overrides
    } as ServiceConfig;
  }

  /**
   * Create service configuration from tenant-specific credentials
   * This is the preferred method for multi-tenant applications
   * @param tenantConfig - Tenant-specific M-Pesa configuration
   * @param overrides - Optional configuration overrides
   * @returns ServiceConfig with tenant-specific settings
   * @throws MpesaError if configuration is invalid
   */
  static createTenantServiceConfig(
    tenantConfig: TenantMpesaConfig,
    overrides?: Partial<ServiceConfig>
  ): ServiceConfig {
    try {
      // Validate tenant configuration
      ServiceFactory.validateTenantConfig(tenantConfig);

      // Create service configuration from tenant config
      const serviceConfig: ServiceConfig = {
        environment: tenantConfig.environment,
        consumerKey: tenantConfig.consumerKey,
        consumerSecret: tenantConfig.consumerSecret,
        businessShortCode: tenantConfig.businessShortCode,
        passkey: tenantConfig.passkey,
        callbackUrl: tenantConfig.callbackUrl,
        timeoutMs: overrides?.timeoutMs || tenantConfig.timeoutMs,
        retryAttempts: overrides?.retryAttempts || tenantConfig.retryAttempts,
        rateLimitPerMinute: overrides?.rateLimitPerMinute || tenantConfig.rateLimitPerMinute
      };

      return serviceConfig;

    } catch (error) {
      if (error instanceof MpesaError) {
        throw error;
      }

      throw new MpesaError(
        `Failed to create service configuration for tenant ${tenantConfig.tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVICE_CONFIG_CREATION_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Create service configuration with automatic tenant resolution
   * This method handles the complete flow from tab ID to service configuration
   * @param tabId - Tab ID to resolve to tenant
   * @param tabResolutionService - Service to resolve tab to tenant
   * @param credentialRetrievalService - Service to retrieve tenant credentials
   * @param tenantConfigFactory - Factory to create tenant configuration
   * @param overrides - Optional configuration overrides
   * @returns ServiceConfig with tenant-specific settings
   * @throws MpesaError if any step in the resolution fails
   */
  static async createServiceConfigFromTab(
    tabId: string,
    tabResolutionService: TabResolutionService,
    credentialRetrievalService: CredentialRetrievalService,
    tenantConfigFactory: TenantMpesaConfigFactory,
    overrides?: Partial<ServiceConfig>
  ): Promise<ServiceConfig> {
    try {
      // Step 1: Resolve tab to tenant
      const tenantInfo = await tabResolutionService.resolveTabToTenant(tabId);

      // Step 2: Retrieve tenant credentials
      // Default to sandbox environment if not specified in overrides
      const environment = (overrides?.environment as MpesaEnvironment) || 'sandbox';
      const credentials = await credentialRetrievalService.getTenantCredentials(tenantInfo.tenantId, environment);

      // Step 3: Create tenant configuration
      const tenantConfig = tenantConfigFactory.createTenantConfig(tenantInfo, credentials, overrides);

      // Step 4: Create service configuration
      return ServiceFactory.createTenantServiceConfig(tenantConfig, overrides);

    } catch (error) {
      if (error instanceof MpesaError) {
        throw error;
      }

      throw new MpesaError(
        `Failed to create service configuration from tab ${tabId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TAB_SERVICE_CONFIG_CREATION_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Create service configuration with automatic tenant resolution from customer context
   * This method handles the complete flow from customer context to service configuration
   * @param barId - Bar ID where the customer has a tab
   * @param customerIdentifier - Customer's device-based identifier
   * @param tabResolutionService - Service to resolve customer tab to tenant
   * @param credentialRetrievalService - Service to retrieve tenant credentials
   * @param tenantConfigFactory - Factory to create tenant configuration
   * @param overrides - Optional configuration overrides
   * @returns ServiceConfig with tenant-specific settings
   * @throws MpesaError if any step in the resolution fails
   */
  static async createServiceConfigFromCustomerContext(
    barId: string,
    customerIdentifier: string,
    tabResolutionService: TabResolutionService,
    credentialRetrievalService: CredentialRetrievalService,
    tenantConfigFactory: TenantMpesaConfigFactory,
    overrides?: Partial<ServiceConfig>
  ): Promise<ServiceConfig> {
    try {
      // Step 1: Resolve customer context to tenant
      const tenantInfo = await tabResolutionService.resolveCustomerTabToTenant(barId, customerIdentifier);

      // Step 2: Retrieve tenant credentials
      // Default to sandbox environment if not specified in overrides
      const environment = (overrides?.environment as MpesaEnvironment) || 'sandbox';
      const credentials = await credentialRetrievalService.getTenantCredentials(tenantInfo.tenantId, environment);

      // Step 3: Create tenant configuration
      const tenantConfig = tenantConfigFactory.createTenantConfig(tenantInfo, credentials, overrides);

      // Step 4: Create service configuration
      return ServiceFactory.createTenantServiceConfig(tenantConfig, overrides);

    } catch (error) {
      if (error instanceof MpesaError) {
        throw error;
      }

      throw new MpesaError(
        `Failed to create service configuration from customer context (bar: ${barId}, customer: ${customerIdentifier}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CUSTOMER_SERVICE_CONFIG_CREATION_ERROR',
        500,
        error
      );
    }
  }
  static createBatchServiceConfigs(
    tenantConfigs: TenantMpesaConfig[],
    overrides?: Partial<ServiceConfig>
  ): ServiceConfig[] {
    const configs: ServiceConfig[] = [];
    const errors: Array<{ tenantId: string; error: Error }> = [];

    for (const tenantConfig of tenantConfigs) {
      try {
        const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig, overrides);
        configs.push(serviceConfig);
      } catch (error) {
        errors.push({
          tenantId: tenantConfig.tenantId,
          error: error instanceof Error ? error : new Error('Unknown error')
        });
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Failed to create service configurations for ${errors.length} tenants: ${
        errors.map(e => `${e.tenantId}: ${e.error.message}`).join(', ')
      }`;
      
      throw new MpesaError(
        errorMessage,
        'BATCH_SERVICE_CONFIG_ERROR',
        500,
        errors
      );
    }

    return configs;
  }

  /**
   * Validate tenant configuration
   * @param tenantConfig - Tenant configuration to validate
   * @throws MpesaError if configuration is invalid
   */
  private static validateTenantConfig(tenantConfig: TenantMpesaConfig): void {
    if (!tenantConfig) {
      throw new MpesaError(
        'Tenant configuration is required',
        'INVALID_TENANT_CONFIG',
        400
      );
    }

    if (!tenantConfig.tenantId || tenantConfig.tenantId.trim().length === 0) {
      throw new MpesaError(
        'Tenant ID is required in configuration',
        'INVALID_TENANT_ID',
        400
      );
    }

    if (!tenantConfig.barId || tenantConfig.barId.trim().length === 0) {
      throw new MpesaError(
        'Bar ID is required in configuration',
        'INVALID_BAR_ID',
        400
      );
    }

    if (!tenantConfig.barName || tenantConfig.barName.trim().length === 0) {
      throw new MpesaError(
        'Bar name is required in configuration',
        'INVALID_BAR_NAME',
        400
      );
    }

    if (!tenantConfig.environment || !['sandbox', 'production'].includes(tenantConfig.environment)) {
      throw new MpesaError(
        'Valid environment (sandbox/production) is required in configuration',
        'INVALID_ENVIRONMENT',
        400
      );
    }

    if (!tenantConfig.credentials) {
      throw new MpesaError(
        'Credentials are required in tenant configuration',
        'MISSING_CREDENTIALS',
        400
      );
    }

    // Validate basic service config properties
    if (tenantConfig.timeoutMs <= 0) {
      throw new MpesaError(
        'Timeout must be greater than 0',
        'INVALID_TIMEOUT',
        400
      );
    }

    if (tenantConfig.retryAttempts < 0) {
      throw new MpesaError(
        'Retry attempts cannot be negative',
        'INVALID_RETRY_ATTEMPTS',
        400
      );
    }

    if (tenantConfig.rateLimitPerMinute <= 0) {
      throw new MpesaError(
        'Rate limit must be greater than 0',
        'INVALID_RATE_LIMIT',
        400
      );
    }
  }

  static createLogger(enableDebug: boolean = false): Logger {
    return new ConsoleLogger();
  }

  static createHttpClient(timeoutMs: number = 30000): HttpClient {
    return new FetchHttpClient(timeoutMs);
  }
}