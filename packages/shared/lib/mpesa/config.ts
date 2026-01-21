/**
 * Environment configuration management for M-PESA integration
 * Handles sandbox/production environment switching and validation
 */

import { 
  MpesaEnvironment, 
  EnvironmentConfig, 
  MpesaCredentials, 
  MPESA_URLS,
  ValidationResult,
  MpesaValidationError
} from './types';

/**
 * Environment configuration manager
 * Provides environment-specific settings and validation
 */
export class EnvironmentConfigManager {
  private static instance: EnvironmentConfigManager;
  private currentEnvironment: MpesaEnvironment = 'sandbox';
  private configurations: Map<MpesaEnvironment, EnvironmentConfig> = new Map();

  private constructor() {}

  public static getInstance(): EnvironmentConfigManager {
    if (!EnvironmentConfigManager.instance) {
      EnvironmentConfigManager.instance = new EnvironmentConfigManager();
    }
    return EnvironmentConfigManager.instance;
  }

  /**
   * Set the current environment configuration
   */
  public setEnvironmentConfig(environment: MpesaEnvironment, credentials: MpesaCredentials): void {
    const config: EnvironmentConfig = {
      environment,
      urls: MPESA_URLS[environment],
      credentials,
      isProduction: environment === 'production',
      validationRules: this.getValidationRules(environment)
    };

    // Validate configuration before setting
    const validation = this.validateEnvironmentConfig(config);
    if (!validation.isValid) {
      throw new MpesaValidationError(
        `Invalid environment configuration for ${environment}`,
        validation.errors
      );
    }

    this.configurations.set(environment, config);
    this.currentEnvironment = environment;
  }

  /**
   * Get current environment configuration
   */
  public getCurrentConfig(): EnvironmentConfig {
    const config = this.configurations.get(this.currentEnvironment);
    if (!config) {
      throw new Error(`No configuration found for environment: ${this.currentEnvironment}`);
    }
    return config;
  }

  /**
   * Get configuration for specific environment
   */
  public getConfig(environment: MpesaEnvironment): EnvironmentConfig {
    const config = this.configurations.get(environment);
    if (!config) {
      throw new Error(`No configuration found for environment: ${environment}`);
    }
    return config;
  }

  /**
   * Switch to different environment
   */
  public switchEnvironment(environment: MpesaEnvironment): void {
    if (!this.configurations.has(environment)) {
      throw new Error(`Environment ${environment} is not configured`);
    }
    this.currentEnvironment = environment;
  }

  /**
   * Get current environment
   */
  public getCurrentEnvironment(): MpesaEnvironment {
    return this.currentEnvironment;
  }

  /**
   * Check if current environment is production
   */
  public isProduction(): boolean {
    return this.currentEnvironment === 'production';
  }

  /**
   * Validate environment configuration
   */
  public validateEnvironmentConfig(config: EnvironmentConfig): ValidationResult {
    const errors: string[] = [];

    // Validate environment
    if (!['sandbox', 'production'].includes(config.environment)) {
      errors.push('Environment must be either "sandbox" or "production"');
    }

    // Validate URLs
    if (!config.urls.oauth || !this.isValidUrl(config.urls.oauth)) {
      errors.push('Invalid OAuth URL');
    }
    if (!config.urls.stkPush || !this.isValidUrl(config.urls.stkPush)) {
      errors.push('Invalid STK Push URL');
    }
    if (!config.urls.stkQuery || !this.isValidUrl(config.urls.stkQuery)) {
      errors.push('Invalid STK Query URL');
    }

    // Validate credentials
    const credentialValidation = this.validateCredentials(config.credentials);
    if (!credentialValidation.isValid) {
      errors.push(...credentialValidation.errors);
    }

    // Environment-specific validations
    if (config.environment === 'production') {
      // Production-specific validations
      if (config.urls.oauth.includes('sandbox')) {
        errors.push('Production environment cannot use sandbox URLs');
      }
      if (!config.credentials.callbackUrl.startsWith('https://')) {
        errors.push('Production environment requires HTTPS callback URL');
      }
    } else {
      // Sandbox-specific validations
      if (!config.urls.oauth.includes('sandbox')) {
        errors.push('Sandbox environment must use sandbox URLs');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate M-PESA credentials
   */
  public validateCredentials(credentials: MpesaCredentials): ValidationResult {
    const errors: string[] = [];

    // Validate business shortcode (PayBill format)
    if (!/^\d{5,7}$/.test(credentials.businessShortCode)) {
      errors.push('Business shortcode must be 5-7 digits');
    }

    // Block Till numbers (common pattern starting with 5, but allow 500000 for testing)
    if (credentials.businessShortCode.length === 6 && 
        credentials.businessShortCode.startsWith('5') && 
        credentials.businessShortCode !== '500000') {
      errors.push('Till numbers are not supported for STK Push. Use PayBill or link Till to shortcode.');
    }

    // Validate consumer key
    if (!credentials.consumerKey || credentials.consumerKey.trim().length < 10) {
      errors.push('Consumer key is required and must be at least 10 characters');
    }

    // Validate consumer secret
    if (!credentials.consumerSecret || credentials.consumerSecret.trim().length < 10) {
      errors.push('Consumer secret is required and must be at least 10 characters');
    }

    // Validate passkey
    if (!credentials.passkey || credentials.passkey.trim().length < 10) {
      errors.push('Passkey is required and must be at least 10 characters');
    }

    // Validate callback URL
    if (!credentials.callbackUrl || !this.isValidUrl(credentials.callbackUrl)) {
      errors.push('Valid callback URL is required');
    }

    // Validate environment consistency
    if (!['sandbox', 'production'].includes(credentials.environment)) {
      errors.push('Credentials environment must be either "sandbox" or "production"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get validation rules for environment
   */
  private getValidationRules(environment: MpesaEnvironment) {
    if (environment === 'sandbox') {
      return {
        maxAmount: 1000, // KES 1,000 max for sandbox
        minAmount: 1,    // KES 1 minimum
        allowedPhoneNumbers: [
          '254708374149', // Official Safaricom test number
          '254711XXXXXX'  // Pattern for test numbers
        ]
      };
    } else {
      return {
        maxAmount: 70000, // KES 70,000 max for production
        minAmount: 1      // KES 1 minimum
      };
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get environment-specific URLs
   */
  public getUrls(environment?: MpesaEnvironment) {
    const env = environment || this.currentEnvironment;
    return MPESA_URLS[env];
  }

  /**
   * Reset all configurations (useful for testing)
   */
  public reset(): void {
    this.configurations.clear();
    this.currentEnvironment = 'sandbox';
  }

  /**
   * Check if environment is configured
   */
  public isConfigured(environment?: MpesaEnvironment): boolean {
    const env = environment || this.currentEnvironment;
    return this.configurations.has(env);
  }

  /**
   * Get all configured environments
   */
  public getConfiguredEnvironments(): MpesaEnvironment[] {
    return Array.from(this.configurations.keys());
  }
}