/**
 * Tenant M-Pesa Configuration Factory
 * Creates tenant-specific M-Pesa configurations from retrieved credentials
 * 
 * Requirements: 4.1, 4.4
 */

import { ServiceConfig, MpesaCredentials, MpesaEnvironment, MpesaError } from '../types';
import { TenantInfo } from './tab-resolution';
import { Logger, ConsoleLogger } from './base';

/**
 * Extended service configuration that includes tenant information
 */
export interface TenantMpesaConfig extends ServiceConfig {
  tenantId: string;
  barName: string;
  barId: string;
  credentials: MpesaCredentials; // Keep credentials object for backward compatibility
}

/**
 * Configuration options for the factory
 */
export interface TenantConfigFactoryOptions {
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;
  /** Default retry attempts */
  defaultRetryAttempts?: number;
  /** Default rate limit per minute */
  defaultRateLimitPerMinute?: number;
  /** Supabase URL for database operations */
  supabaseUrl?: string;
  /** Supabase service key for database operations */
  supabaseServiceKey?: string;
  /** Logger instance for warnings and errors */
  logger?: Logger;
  /** Whether to allow production environment without explicit configuration */
  allowProductionWithoutExplicitConfig?: boolean;
}

/**
 * Factory for creating tenant-specific M-Pesa service configurations
 */
export class TenantMpesaConfigFactory {
  private logger: Logger;
  private options: Required<Omit<TenantConfigFactoryOptions, 'logger' | 'allowProductionWithoutExplicitConfig'>> & 
    Pick<TenantConfigFactoryOptions, 'allowProductionWithoutExplicitConfig'>;

  constructor(options: TenantConfigFactoryOptions = {}) {
    this.logger = options.logger || new ConsoleLogger();
    this.options = {
      defaultTimeoutMs: options.defaultTimeoutMs || 30000,
      defaultRetryAttempts: options.defaultRetryAttempts || 3,
      defaultRateLimitPerMinute: options.defaultRateLimitPerMinute || 60,
      supabaseUrl: options.supabaseUrl || '',
      supabaseServiceKey: options.supabaseServiceKey || '',
      allowProductionWithoutExplicitConfig: options.allowProductionWithoutExplicitConfig
    };
  }

  /**
   * Create a tenant-specific M-Pesa service configuration
   * @param tenantInfo - Information about the tenant/bar
   * @param credentials - Decrypted M-Pesa credentials for the tenant
   * @param overrides - Optional configuration overrides
   * @returns TenantMpesaConfig with tenant-specific settings
   * @throws MpesaError if configuration is invalid
   */
  createTenantConfig(
    tenantInfo: TenantInfo,
    credentials: MpesaCredentials,
    overrides?: Partial<ServiceConfig>
  ): TenantMpesaConfig {
    try {
      // Validate inputs
      this.validateTenantInfo(tenantInfo);
      this.validateCredentials(credentials);

      // Determine environment with fallback to sandbox
      const environment = this.determineEnvironment(credentials, tenantInfo);

      // Log environment determination
      this.logEnvironmentDetermination(tenantInfo, credentials.environment, environment);

      // Create base service configuration
      const baseConfig: ServiceConfig = {
        environment,
        consumerKey: credentials.consumerKey,
        consumerSecret: credentials.consumerSecret,
        businessShortCode: credentials.businessShortCode,
        passkey: credentials.passkey,
        callbackUrl: credentials.callbackUrl,
        timeoutMs: overrides?.timeoutMs || this.options.defaultTimeoutMs,
        retryAttempts: overrides?.retryAttempts || this.options.defaultRetryAttempts,
        rateLimitPerMinute: overrides?.rateLimitPerMinute || this.options.defaultRateLimitPerMinute
      };

      // Create tenant-specific configuration
      const tenantConfig: TenantMpesaConfig = {
        ...baseConfig,
        tenantId: tenantInfo.tenantId,
        barName: tenantInfo.barName,
        barId: tenantInfo.barId,
        credentials: {
          ...credentials,
          environment // Ensure environment consistency
        }
      };

      // Validate final configuration
      this.validateFinalConfiguration(tenantConfig);

      this.logger.info(`Created tenant M-Pesa configuration`, {
        tenantId: tenantInfo.tenantId,
        barName: tenantInfo.barName,
        environment: tenantConfig.environment,
        timeoutMs: tenantConfig.timeoutMs,
        retryAttempts: tenantConfig.retryAttempts
      });

      return tenantConfig;

    } catch (error) {
      if (error instanceof MpesaError) {
        throw error;
      }

      throw new MpesaError(
        `Failed to create tenant configuration for ${tenantInfo.tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TENANT_CONFIG_CREATION_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Create multiple tenant configurations in batch
   * @param tenantCredentialPairs - Array of tenant info and credential pairs
   * @param overrides - Optional configuration overrides applied to all configs
   * @returns Array of TenantMpesaConfig objects
   * @throws MpesaError if any configuration fails
   */
  createBatchTenantConfigs(
    tenantCredentialPairs: Array<{ tenantInfo: TenantInfo; credentials: MpesaCredentials }>,
    overrides?: Partial<ServiceConfig>
  ): TenantMpesaConfig[] {
    const configs: TenantMpesaConfig[] = [];
    const errors: Array<{ tenantId: string; error: Error }> = [];

    for (const { tenantInfo, credentials } of tenantCredentialPairs) {
      try {
        const config = this.createTenantConfig(tenantInfo, credentials, overrides);
        configs.push(config);
      } catch (error) {
        errors.push({
          tenantId: tenantInfo.tenantId,
          error: error instanceof Error ? error : new Error('Unknown error')
        });
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Failed to create configurations for ${errors.length} tenants: ${
        errors.map(e => `${e.tenantId}: ${e.error.message}`).join(', ')
      }`;
      
      throw new MpesaError(
        errorMessage,
        'BATCH_TENANT_CONFIG_ERROR',
        500,
        errors
      );
    }

    this.logger.info(`Successfully created ${configs.length} tenant configurations`);
    return configs;
  }

  /**
   * Validate tenant information
   * @param tenantInfo - Tenant information to validate
   * @throws MpesaError if tenant info is invalid
   */
  private validateTenantInfo(tenantInfo: TenantInfo): void {
    if (!tenantInfo) {
      throw new MpesaError(
        'Tenant information is required',
        'INVALID_TENANT_INFO',
        400
      );
    }

    if (!tenantInfo.tenantId || tenantInfo.tenantId.trim().length === 0) {
      throw new MpesaError(
        'Tenant ID is required and cannot be empty',
        'INVALID_TENANT_ID',
        400
      );
    }

    if (!tenantInfo.barId || tenantInfo.barId.trim().length === 0) {
      throw new MpesaError(
        'Bar ID is required and cannot be empty',
        'INVALID_BAR_ID',
        400
      );
    }

    if (!tenantInfo.barName || tenantInfo.barName.trim().length === 0) {
      throw new MpesaError(
        'Bar name is required and cannot be empty',
        'INVALID_BAR_NAME',
        400
      );
    }

    if (typeof tenantInfo.isActive !== 'boolean') {
      throw new MpesaError(
        'Tenant active status must be a boolean',
        'INVALID_TENANT_STATUS',
        400
      );
    }

    if (!tenantInfo.isActive) {
      throw new MpesaError(
        `Tenant ${tenantInfo.tenantId} (${tenantInfo.barName}) is not active`,
        'INACTIVE_TENANT',
        403
      );
    }
  }

  /**
   * Validate M-Pesa credentials
   * @param credentials - Credentials to validate
   * @throws MpesaError if credentials are invalid
   */
  private validateCredentials(credentials: MpesaCredentials): void {
    if (!credentials) {
      throw new MpesaError(
        'M-Pesa credentials are required',
        'INVALID_CREDENTIALS',
        400
      );
    }

    const requiredFields = [
      'consumerKey',
      'consumerSecret',
      'businessShortCode',
      'passkey',
      'callbackUrl',
      'environment'
    ];

    for (const field of requiredFields) {
      const value = credentials[field as keyof MpesaCredentials];
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        throw new MpesaError(
          `M-Pesa credential field '${field}' is required and cannot be empty`,
          'INCOMPLETE_CREDENTIALS',
          400
        );
      }
    }

    if (!['sandbox', 'production'].includes(credentials.environment)) {
      throw new MpesaError(
        `Invalid M-Pesa environment: ${credentials.environment}. Must be 'sandbox' or 'production'`,
        'INVALID_ENVIRONMENT',
        400
      );
    }

    // Validate URL formats
    try {
      new URL(credentials.callbackUrl);
    } catch {
      throw new MpesaError(
        'Invalid callback URL format',
        'INVALID_CALLBACK_URL',
        400
      );
    }

    if (credentials.timeoutUrl) {
      try {
        new URL(credentials.timeoutUrl);
      } catch {
        throw new MpesaError(
          'Invalid timeout URL format',
          'INVALID_TIMEOUT_URL',
          400
        );
      }
    }
  }

  /**
   * Determine the environment to use, with fallback to sandbox
   * @param credentials - M-Pesa credentials
   * @param tenantInfo - Tenant information
   * @returns The environment to use
   */
  private determineEnvironment(credentials: MpesaCredentials, tenantInfo: TenantInfo): MpesaEnvironment {
    const credentialEnvironment = credentials.environment;

    // If credentials specify production but we don't allow production without explicit config
    if (credentialEnvironment === 'production' && !this.options.allowProductionWithoutExplicitConfig) {
      this.logger.warn(`Production environment requested for tenant ${tenantInfo.tenantId} but not explicitly allowed. Defaulting to sandbox.`, {
        tenantId: tenantInfo.tenantId,
        barName: tenantInfo.barName,
        requestedEnvironment: credentialEnvironment,
        fallbackEnvironment: 'sandbox'
      });
      return 'sandbox';
    }

    // Use the environment from credentials
    return credentialEnvironment;
  }

  /**
   * Log environment determination for audit purposes
   * @param tenantInfo - Tenant information
   * @param originalEnvironment - Original environment from credentials
   * @param finalEnvironment - Final environment being used
   */
  private logEnvironmentDetermination(
    tenantInfo: TenantInfo,
    originalEnvironment: MpesaEnvironment,
    finalEnvironment: MpesaEnvironment
  ): void {
    if (originalEnvironment !== finalEnvironment) {
      this.logger.warn(`Environment override applied for tenant ${tenantInfo.tenantId}`, {
        tenantId: tenantInfo.tenantId,
        barName: tenantInfo.barName,
        originalEnvironment,
        finalEnvironment,
        reason: 'Production environment not explicitly allowed'
      });
    } else {
      this.logger.info(`Using environment ${finalEnvironment} for tenant ${tenantInfo.tenantId}`, {
        tenantId: tenantInfo.tenantId,
        barName: tenantInfo.barName,
        environment: finalEnvironment
      });
    }
  }

  /**
   * Validate the final configuration before returning
   * @param config - Configuration to validate
   * @throws MpesaError if configuration is invalid
   */
  private validateFinalConfiguration(config: TenantMpesaConfig): void {
    // Validate timeout settings
    if (config.timeoutMs <= 0) {
      throw new MpesaError(
        'Timeout must be greater than 0',
        'INVALID_TIMEOUT',
        400
      );
    }

    if (config.timeoutMs > 300000) { // 5 minutes max
      this.logger.warn(`Very high timeout configured: ${config.timeoutMs}ms for tenant ${config.tenantId}`);
    }

    // Validate retry settings
    if (config.retryAttempts < 0) {
      throw new MpesaError(
        'Retry attempts cannot be negative',
        'INVALID_RETRY_ATTEMPTS',
        400
      );
    }

    if (config.retryAttempts > 10) {
      this.logger.warn(`High retry attempts configured: ${config.retryAttempts} for tenant ${config.tenantId}`);
    }

    // Validate rate limiting
    if (config.rateLimitPerMinute <= 0) {
      throw new MpesaError(
        'Rate limit must be greater than 0',
        'INVALID_RATE_LIMIT',
        400
      );
    }

    // Validate environment-specific requirements
    if (config.environment === 'production') {
      // Production should use HTTPS for callbacks
      if (!config.credentials.callbackUrl.startsWith('https://')) {
        throw new MpesaError(
          'Production environment requires HTTPS callback URL',
          'PRODUCTION_REQUIRES_HTTPS',
          400
        );
      }

      if (config.credentials.timeoutUrl && !config.credentials.timeoutUrl.startsWith('https://')) {
        throw new MpesaError(
          'Production environment requires HTTPS timeout URL',
          'PRODUCTION_REQUIRES_HTTPS',
          400
        );
      }

      // Warn about production usage
      this.logger.warn(`Production M-Pesa configuration created for tenant ${config.tenantId}`, {
        tenantId: config.tenantId,
        barName: config.barName,
        environment: config.environment
      });
    }

    // Validate Supabase configuration if provided in options
    if (this.options.supabaseUrl && this.options.supabaseUrl.trim().length > 0) {
      try {
        new URL(this.options.supabaseUrl);
      } catch {
        throw new MpesaError(
          'Invalid Supabase URL format',
          'INVALID_SUPABASE_URL',
          400
        );
      }
    }

    if (this.options.supabaseServiceKey && this.options.supabaseServiceKey.trim().length > 0) {
      // Basic validation - service keys should be reasonably long
      if (this.options.supabaseServiceKey.length < 50) {
        this.logger.warn(`Supabase service key seems too short for tenant ${config.tenantId}`);
      }
    }
  }

  /**
   * Update factory options
   * @param newOptions - New options to merge with existing ones
   */
  updateOptions(newOptions: Partial<TenantConfigFactoryOptions>): void {
    if (newOptions.logger) {
      this.logger = newOptions.logger;
    }

    // Extract logger from newOptions to avoid type issues
    const { logger, ...optionsWithoutLogger } = newOptions;

    this.options = {
      ...this.options,
      ...optionsWithoutLogger
    };

    this.logger.info('Updated tenant config factory options', optionsWithoutLogger);
  }

  /**
   * Get current factory options (excluding logger)
   * @returns Current factory options
   */
  getOptions(): Omit<TenantConfigFactoryOptions, 'logger'> {
    return { ...this.options };
  }
}

/**
 * Factory function to create TenantMpesaConfigFactory instance
 * @param options - Configuration options for the factory
 * @returns TenantMpesaConfigFactory instance
 */
export function createTenantMpesaConfigFactory(
  options?: TenantConfigFactoryOptions
): TenantMpesaConfigFactory {
  return new TenantMpesaConfigFactory(options);
}

/**
 * Error types specific to tenant configuration
 */
export class TenantConfigError extends MpesaError {
  constructor(message: string, code: string, tenantId?: string) {
    super(message, code, 400);
    this.name = 'TenantConfigError';
    if (tenantId) {
      this.originalError = { tenantId };
    }
  }
}

export class InvalidTenantInfoError extends TenantConfigError {
  constructor(message: string, tenantId?: string) {
    super(message, 'INVALID_TENANT_INFO', tenantId);
    this.name = 'InvalidTenantInfoError';
  }
}

export class InvalidCredentialsError extends TenantConfigError {
  constructor(message: string, tenantId?: string) {
    super(message, 'INVALID_CREDENTIALS', tenantId);
    this.name = 'InvalidCredentialsError';
  }
}

export class EnvironmentConfigError extends TenantConfigError {
  constructor(message: string, tenantId?: string) {
    super(message, 'ENVIRONMENT_CONFIG_ERROR', tenantId);
    this.name = 'EnvironmentConfigError';
  }
}