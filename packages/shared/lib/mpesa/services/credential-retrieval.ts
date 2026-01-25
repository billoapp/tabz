/**
 * Credential Retrieval Service
 * Fetches and decrypts tenant-specific M-Pesa credentials from the database
 * 
 * Requirements: 1.2, 3.1, 5.1, 5.2, 5.3
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MpesaCredentials, MpesaEnvironment, MpesaError, MPESA_URLS } from '../types';
import { decryptCredential } from './encryption';
import { 
  TenantCredentialErrorHandler, 
  createTenantCredentialErrorHandler,
  withTenantErrorHandling 
} from './error-handling';
import { Logger, ConsoleLogger } from './base';

export interface EncryptedCredentialRecord {
  id: string;
  tenant_id: string;
  environment: MpesaEnvironment;
  consumer_key_enc: Buffer;
  consumer_secret_enc: Buffer;
  business_shortcode: string; // This field is NOT encrypted
  passkey_enc: Buffer;
  callback_url: string;
  timeout_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CredentialRetrievalService {
  getTenantCredentials(tenantId: string, environment: MpesaEnvironment): Promise<MpesaCredentials>;
  validateCredentials(credentials: MpesaCredentials): Promise<boolean>;
}

export class DatabaseCredentialRetrievalService implements CredentialRetrievalService {
  private supabase: SupabaseClient;
  private errorHandler: TenantCredentialErrorHandler;
  private logger: Logger;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    logger?: Logger
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.logger = logger || new ConsoleLogger();
    this.errorHandler = createTenantCredentialErrorHandler(this.logger, 'sandbox'); // Default to sandbox
  }

  /**
   * Retrieve and decrypt tenant-specific M-Pesa credentials
   * @param tenantId - The tenant/bar ID to fetch credentials for
   * @param environment - The M-Pesa environment (sandbox/production)
   * @returns Decrypted MpesaCredentials
   * @throws MpesaError if credentials not found, inactive, or decryption fails
   */
  async getTenantCredentials(tenantId: string, environment: MpesaEnvironment): Promise<MpesaCredentials> {
    return withTenantErrorHandling(
      async () => {
        // Query encrypted credentials from database
        const { data: credentialRecord, error: queryError } = await this.supabase
          .from('mpesa_credentials')
          .select(`
            id,
            tenant_id,
            environment,
            consumer_key_enc,
            consumer_secret_enc,
            business_shortcode,
            passkey_enc,
            callback_url,
            timeout_url,
            is_active,
            created_at,
            updated_at
          `)
          .eq('tenant_id', tenantId)
          .eq('environment', environment)
          .maybeSingle();

        if (queryError) {
          throw new MpesaError(
            `Database query failed for tenant ${tenantId}: ${queryError.message}`,
            'DATABASE_ERROR',
            500,
            queryError
          );
        }

        if (!credentialRecord) {
          throw new MpesaError(
            `No M-Pesa credentials found for tenant ${tenantId} in ${environment} environment`,
            'CREDENTIALS_NOT_FOUND',
            404
          );
        }

        // Check if credentials are active
        if (!credentialRecord.is_active) {
          throw new MpesaError(
            `M-Pesa credentials for tenant ${tenantId} are inactive`,
            'CREDENTIALS_INACTIVE',
            403
          );
        }

        // Validate that all required encrypted fields are present
        if (!credentialRecord.consumer_key_enc || 
            !credentialRecord.consumer_secret_enc || 
            !credentialRecord.business_shortcode || 
            !credentialRecord.passkey_enc) {
          throw new MpesaError(
            `Incomplete M-Pesa credentials for tenant ${tenantId}`,
            'CREDENTIALS_INCOMPLETE',
            500
          );
        }

        // Decrypt credentials
        let decryptedCredentials: MpesaCredentials;
        try {
          const consumerKey = decryptCredential(this.parseStoredBuffer(credentialRecord.consumer_key_enc));
          const consumerSecret = decryptCredential(this.parseStoredBuffer(credentialRecord.consumer_secret_enc));
          const businessShortCode = credentialRecord.business_shortcode; // Not encrypted
          const passkey = decryptCredential(this.parseStoredBuffer(credentialRecord.passkey_enc));

          decryptedCredentials = {
            consumerKey,
            consumerSecret,
            businessShortCode,
            passkey,
            environment,
            callbackUrl: credentialRecord.callback_url,
            timeoutUrl: credentialRecord.timeout_url,
            encryptedAt: new Date(credentialRecord.created_at),
            lastValidated: new Date(credentialRecord.updated_at)
          };

        } catch (decryptionError) {
          throw new MpesaError(
            `Failed to decrypt credentials for tenant ${tenantId}: ${decryptionError instanceof Error ? decryptionError.message : 'Unknown decryption error'}`,
            'DECRYPTION_ERROR',
            500,
            decryptionError
          );
        }

        // Validate decrypted credentials
        const isValid = await this.validateCredentials(decryptedCredentials);
        if (!isValid) {
          throw new MpesaError(
            `Invalid credential format for tenant ${tenantId}`,
            'CREDENTIALS_INVALID',
            500
          );
        }

        return decryptedCredentials;
      },
      this.errorHandler,
      {
        tenantId,
        environment,
        operation: 'getTenantCredentials'
      }
    );
  }

  /**
   * Parse stored buffer data from Supabase
   * Handles both raw Buffer and JSON-encoded Buffer formats
   * @param storedData - Data retrieved from Supabase bytea column
   * @returns Buffer ready for decryption
   */
  private parseStoredBuffer(storedData: any): Buffer {
    // If it's already a Buffer, return as-is
    if (Buffer.isBuffer(storedData)) {
      return storedData;
    }
    
    // If it's a string (PostgreSQL bytea hex format)
    if (typeof storedData === 'string') {
      if (storedData.startsWith('\\x')) {
        // PostgreSQL bytea hex format
        const hexData = storedData.slice(2); // Remove \\x prefix
        const buffer = Buffer.from(hexData, 'hex');
        
        // Check if this is a JSON-encoded Buffer
        try {
          const jsonStr = buffer.toString('utf8');
          const parsed = JSON.parse(jsonStr);
          
          if (parsed.type === 'Buffer' && Array.isArray(parsed.data)) {
            // This is a JSON representation of a Buffer
            return Buffer.from(parsed.data);
          }
        } catch (e) {
          // Not JSON, treat as raw buffer
        }
        
        return buffer;
      }
    }
    
    // Try to convert whatever we have to a Buffer
    return Buffer.from(storedData);
  }

  /**
   * Validate that credentials have all required fields and proper format
   * @param credentials - The credentials to validate
   * @returns boolean indicating if credentials are valid
   */
  async validateCredentials(credentials: MpesaCredentials): Promise<boolean> {
    try {
      // Check required fields are present and non-empty
      if (!credentials.consumerKey || credentials.consumerKey.trim().length === 0) {
        return false;
      }

      if (!credentials.consumerSecret || credentials.consumerSecret.trim().length === 0) {
        return false;
      }

      if (!credentials.businessShortCode || credentials.businessShortCode.trim().length === 0) {
        return false;
      }

      if (!credentials.passkey || credentials.passkey.trim().length === 0) {
        return false;
      }

      if (!credentials.callbackUrl || credentials.callbackUrl.trim().length === 0) {
        return false;
      }

      if (!credentials.environment || !['sandbox', 'production'].includes(credentials.environment)) {
        return false;
      }

      // Validate callback URL format
      try {
        const url = new URL(credentials.callbackUrl);
        // Ensure HTTPS for production
        if (credentials.environment === 'production' && url.protocol !== 'https:') {
          return false;
        }
      } catch {
        return false;
      }

      // Validate timeout URL format if provided
      if (credentials.timeoutUrl) {
        try {
          const url = new URL(credentials.timeoutUrl);
          // Ensure HTTPS for production
          if (credentials.environment === 'production' && url.protocol !== 'https:') {
            return false;
          }
        } catch {
          return false;
        }
      }

      // Validate business short code format (should be numeric)
      if (!/^\d+$/.test(credentials.businessShortCode)) {
        return false;
      }

      // Validate consumer key format (should be alphanumeric)
      if (!/^[A-Za-z0-9]+$/.test(credentials.consumerKey)) {
        return false;
      }

      // Validate credential field lengths and formats
      if (!this.validateCredentialFormats(credentials)) {
        return false;
      }

      // Validate environment-endpoint consistency
      if (!this.validateEnvironmentConsistency(credentials)) {
        return false;
      }

      return true;

    } catch (error) {
      // If validation itself fails, consider credentials invalid
      return false;
    }
  }

  /**
   * Validate credentials with detailed error reporting
   * @param credentials - The credentials to validate
   * @returns ValidationResult with detailed error information
   */
  async validateCredentialsWithDetails(credentials: MpesaCredentials): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check required fields are present and non-empty
      if (!credentials.consumerKey || credentials.consumerKey.trim().length === 0) {
        errors.push('Consumer key is required and cannot be empty');
      }

      if (!credentials.consumerSecret || credentials.consumerSecret.trim().length === 0) {
        errors.push('Consumer secret is required and cannot be empty');
      }

      if (!credentials.businessShortCode || credentials.businessShortCode.trim().length === 0) {
        errors.push('Business short code is required and cannot be empty');
      }

      if (!credentials.passkey || credentials.passkey.trim().length === 0) {
        errors.push('Passkey is required and cannot be empty');
      }

      if (!credentials.callbackUrl || credentials.callbackUrl.trim().length === 0) {
        errors.push('Callback URL is required and cannot be empty');
      }

      if (!credentials.environment || !['sandbox', 'production'].includes(credentials.environment)) {
        errors.push('Environment must be either "sandbox" or "production"');
      }

      // Validate callback URL format
      if (credentials.callbackUrl) {
        try {
          const url = new URL(credentials.callbackUrl);
          // Ensure HTTPS for production
          if (credentials.environment === 'production' && url.protocol !== 'https:') {
            errors.push('Production environment requires HTTPS callback URL');
          }
        } catch {
          errors.push('Callback URL must be a valid URL');
        }
      }

      // Validate timeout URL format if provided
      if (credentials.timeoutUrl) {
        try {
          const url = new URL(credentials.timeoutUrl);
          // Ensure HTTPS for production
          if (credentials.environment === 'production' && url.protocol !== 'https:') {
            errors.push('Production environment requires HTTPS timeout URL');
          }
        } catch {
          errors.push('Timeout URL must be a valid URL');
        }
      }

      // Validate business short code format (should be numeric)
      if (credentials.businessShortCode && !/^\d+$/.test(credentials.businessShortCode)) {
        errors.push('Business short code must contain only digits');
      }

      // Validate consumer key format (should be alphanumeric)
      if (credentials.consumerKey && !/^[A-Za-z0-9]+$/.test(credentials.consumerKey)) {
        errors.push('Consumer key must contain only alphanumeric characters');
      }

      // Validate credential field lengths and formats
      const formatErrors = this.validateCredentialFormatsWithDetails(credentials);
      errors.push(...formatErrors);

      // Validate environment-endpoint consistency
      const consistencyErrors = this.validateEnvironmentConsistencyWithDetails(credentials);
      errors.push(...consistencyErrors);

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Validate credential field formats and lengths
   * @param credentials - The credentials to validate
   * @returns boolean indicating if formats are valid
   */
  private validateCredentialFormats(credentials: MpesaCredentials): boolean {
    // Consumer key should be between 10-80 characters, alphanumeric (increased limit for M-Pesa)
    if (credentials.consumerKey.length < 10 || credentials.consumerKey.length > 80) {
      return false;
    }

    // Consumer secret should be between 10-80 characters, alphanumeric (increased limit for M-Pesa)
    if (credentials.consumerSecret.length < 10 || credentials.consumerSecret.length > 80) {
      return false;
    }
    if (!/^[A-Za-z0-9]+$/.test(credentials.consumerSecret)) {
      return false;
    }

    // Business short code should be 5-10 digits
    if (credentials.businessShortCode.length < 5 || credentials.businessShortCode.length > 10) {
      return false;
    }

    // Passkey should be at least 20 characters for security
    if (credentials.passkey.length < 20) {
      return false;
    }

    // Validate passkey contains only valid characters (base64-like)
    if (!/^[A-Za-z0-9+/=]+$/.test(credentials.passkey)) {
      return false;
    }

    return true;
  }

  /**
   * Validate credential field formats and lengths with detailed errors
   * @param credentials - The credentials to validate
   * @returns array of error messages
   */
  private validateCredentialFormatsWithDetails(credentials: MpesaCredentials): string[] {
    const errors: string[] = [];

    // Consumer key should be between 10-80 characters, alphanumeric (increased limit for M-Pesa)
    if (credentials.consumerKey && (credentials.consumerKey.length < 10 || credentials.consumerKey.length > 80)) {
      errors.push('Consumer key must be between 10-80 characters');
    }

    // Consumer secret should be between 10-80 characters, alphanumeric (increased limit for M-Pesa)
    if (credentials.consumerSecret) {
      if (credentials.consumerSecret.length < 10 || credentials.consumerSecret.length > 80) {
        errors.push('Consumer secret must be between 10-80 characters');
      }
      if (!/^[A-Za-z0-9]+$/.test(credentials.consumerSecret)) {
        errors.push('Consumer secret must contain only alphanumeric characters');
      }
    }

    // Business short code should be 5-10 digits
    if (credentials.businessShortCode && (credentials.businessShortCode.length < 5 || credentials.businessShortCode.length > 10)) {
      errors.push('Business short code must be between 5-10 digits');
    }

    // Passkey should be at least 20 characters for security
    if (credentials.passkey && credentials.passkey.length < 20) {
      errors.push('Passkey must be at least 20 characters for security');
    }

    // Validate passkey contains only valid characters (base64-like)
    if (credentials.passkey && !/^[A-Za-z0-9+/=]+$/.test(credentials.passkey)) {
      errors.push('Passkey must contain only valid base64 characters (A-Z, a-z, 0-9, +, /, =)');
    }

    return errors;
  }

  /**
   * Validate environment-endpoint consistency
   * Ensures sandbox credentials are not used with production endpoints and vice versa
   * @param credentials - The credentials to validate
   * @returns boolean indicating if environment is consistent
   */
  private validateEnvironmentConsistency(credentials: MpesaCredentials): boolean {
    const { environment, callbackUrl, timeoutUrl } = credentials;

    // For production environment, ensure all URLs use HTTPS
    if (environment === 'production') {
      try {
        const callbackUrlObj = new URL(callbackUrl);
        if (callbackUrlObj.protocol !== 'https:') {
          return false;
        }

        if (timeoutUrl) {
          const timeoutUrlObj = new URL(timeoutUrl);
          if (timeoutUrlObj.protocol !== 'https:') {
            return false;
          }
        }

        // Production callback URLs should not point to localhost or test domains
        const hostname = callbackUrlObj.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname.includes('127.0.0.1') || 
            hostname.includes('test') || 
            hostname.includes('staging') ||
            hostname.includes('dev')) {
          return false;
        }

      } catch {
        return false;
      }
    }

    // For sandbox environment, allow more flexible URL patterns but still validate format
    if (environment === 'sandbox') {
      try {
        new URL(callbackUrl);
        if (timeoutUrl) {
          new URL(timeoutUrl);
        }
      } catch {
        return false;
      }
    }

    // Validate business short code patterns by environment
    // Production short codes are typically 6 digits, sandbox can vary
    if (environment === 'production') {
      // Production business short codes should be exactly 6 digits
      if (!/^\d{6}$/.test(credentials.businessShortCode)) {
        return false;
      }
    } else if (environment === 'sandbox') {
      // Sandbox short codes can be 5-10 digits, commonly 6
      if (!/^\d{5,10}$/.test(credentials.businessShortCode)) {
        return false;
      }
    }

    // Validate that the environment matches expected M-Pesa endpoint patterns
    if (!this.validateMpesaEndpointConsistency(credentials)) {
      return false;
    }

    return true;
  }

  /**
   * Validate environment-endpoint consistency with detailed errors
   * @param credentials - The credentials to validate
   * @returns array of error messages
   */
  private validateEnvironmentConsistencyWithDetails(credentials: MpesaCredentials): string[] {
    const errors: string[] = [];
    const { environment, callbackUrl, timeoutUrl } = credentials;

    // For production environment, ensure all URLs use HTTPS
    if (environment === 'production') {
      try {
        const callbackUrlObj = new URL(callbackUrl);
        if (callbackUrlObj.protocol !== 'https:') {
          errors.push('Production environment requires HTTPS callback URL');
        }

        if (timeoutUrl) {
          const timeoutUrlObj = new URL(timeoutUrl);
          if (timeoutUrlObj.protocol !== 'https:') {
            errors.push('Production environment requires HTTPS timeout URL');
          }
        }

        // Production callback URLs should not point to localhost or test domains
        const hostname = callbackUrlObj.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname.includes('127.0.0.1') || 
            hostname.includes('test') || 
            hostname.includes('staging') ||
            hostname.includes('dev')) {
          errors.push('Production environment should not use localhost, test, staging, or dev domains for callback URLs');
        }

      } catch (error) {
        errors.push('Invalid callback URL format for production environment');
      }
    }

    // For sandbox environment, allow more flexible URL patterns but still validate format
    if (environment === 'sandbox') {
      try {
        new URL(callbackUrl);
        if (timeoutUrl) {
          new URL(timeoutUrl);
        }
      } catch {
        errors.push('Invalid URL format for sandbox environment');
      }
    }

    // Validate business short code patterns by environment
    if (environment === 'production') {
      // Production business short codes should be exactly 6 digits
      if (credentials.businessShortCode && !/^\d{6}$/.test(credentials.businessShortCode)) {
        errors.push('Production environment requires business short code to be exactly 6 digits');
      }
    } else if (environment === 'sandbox') {
      // Sandbox short codes can be 5-10 digits, commonly 6
      if (credentials.businessShortCode && !/^\d{5,10}$/.test(credentials.businessShortCode)) {
        errors.push('Sandbox environment requires business short code to be 5-10 digits');
      }
    }

    // Validate that the environment matches expected M-Pesa endpoint patterns
    const endpointErrors = this.validateMpesaEndpointConsistencyWithDetails(credentials);
    errors.push(...endpointErrors);

    return errors;
  }

  /**
   * Validate that credentials are consistent with M-Pesa endpoint expectations
   * @param credentials - The credentials to validate
   * @returns boolean indicating if credentials match endpoint expectations
   */
  private validateMpesaEndpointConsistency(credentials: MpesaCredentials): boolean {
    const { environment } = credentials;
    
    // Get expected URLs for the environment
    const expectedUrls = MPESA_URLS[environment];
    
    // Validate that we have the expected URL structure for this environment
    if (!expectedUrls || !expectedUrls.oauth || !expectedUrls.stkPush || !expectedUrls.stkQuery) {
      return false;
    }

    // For production, ensure URLs point to api.safaricom.co.ke
    if (environment === 'production') {
      const productionDomain = 'api.safaricom.co.ke';
      if (!expectedUrls.oauth.includes(productionDomain) ||
          !expectedUrls.stkPush.includes(productionDomain) ||
          !expectedUrls.stkQuery.includes(productionDomain)) {
        return false;
      }
    }

    // For sandbox, ensure URLs point to sandbox.safaricom.co.ke
    if (environment === 'sandbox') {
      const sandboxDomain = 'sandbox.safaricom.co.ke';
      if (!expectedUrls.oauth.includes(sandboxDomain) ||
          !expectedUrls.stkPush.includes(sandboxDomain) ||
          !expectedUrls.stkQuery.includes(sandboxDomain)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate that credentials are consistent with M-Pesa endpoint expectations with detailed errors
   * @param credentials - The credentials to validate
   * @returns array of error messages
   */
  private validateMpesaEndpointConsistencyWithDetails(credentials: MpesaCredentials): string[] {
    const errors: string[] = [];
    const { environment } = credentials;
    
    // Get expected URLs for the environment
    const expectedUrls = MPESA_URLS[environment];
    
    // Validate that we have the expected URL structure for this environment
    if (!expectedUrls || !expectedUrls.oauth || !expectedUrls.stkPush || !expectedUrls.stkQuery) {
      errors.push(`Invalid or missing M-Pesa endpoint configuration for ${environment} environment`);
      return errors;
    }

    // For production, ensure URLs point to api.safaricom.co.ke
    if (environment === 'production') {
      const productionDomain = 'api.safaricom.co.ke';
      if (!expectedUrls.oauth.includes(productionDomain)) {
        errors.push('Production OAuth endpoint must use api.safaricom.co.ke domain');
      }
      if (!expectedUrls.stkPush.includes(productionDomain)) {
        errors.push('Production STK Push endpoint must use api.safaricom.co.ke domain');
      }
      if (!expectedUrls.stkQuery.includes(productionDomain)) {
        errors.push('Production STK Query endpoint must use api.safaricom.co.ke domain');
      }
    }

    // For sandbox, ensure URLs point to sandbox.safaricom.co.ke
    if (environment === 'sandbox') {
      const sandboxDomain = 'sandbox.safaricom.co.ke';
      if (!expectedUrls.oauth.includes(sandboxDomain)) {
        errors.push('Sandbox OAuth endpoint must use sandbox.safaricom.co.ke domain');
      }
      if (!expectedUrls.stkPush.includes(sandboxDomain)) {
        errors.push('Sandbox STK Push endpoint must use sandbox.safaricom.co.ke domain');
      }
      if (!expectedUrls.stkQuery.includes(sandboxDomain)) {
        errors.push('Sandbox STK Query endpoint must use sandbox.safaricom.co.ke domain');
      }
    }

    return errors;
  }
}

/**
 * Factory function to create CredentialRetrievalService instance
 * @param supabaseUrl - Supabase project URL
 * @param supabaseServiceKey - Supabase service role key
 * @param logger - Optional logger instance
 * @returns CredentialRetrievalService instance
 */
export function createCredentialRetrievalService(
  supabaseUrl: string,
  supabaseServiceKey: string,
  logger?: Logger
): CredentialRetrievalService {
  return new DatabaseCredentialRetrievalService(supabaseUrl, supabaseServiceKey, logger);
}

/**
 * Error types specific to credential retrieval
 */
export class CredentialRetrievalError extends MpesaError {
  constructor(message: string, code: string, tenantId?: string, environment?: MpesaEnvironment) {
    super(message, code, 500);
    this.name = 'CredentialRetrievalError';
    if (tenantId || environment) {
      this.originalError = { tenantId, environment };
    }
  }
}

export class CredentialsNotFoundError extends CredentialRetrievalError {
  constructor(tenantId: string, environment: MpesaEnvironment) {
    super(
      `No M-Pesa credentials found for tenant ${tenantId} in ${environment} environment`,
      'CREDENTIALS_NOT_FOUND',
      tenantId,
      environment
    );
    this.name = 'CredentialsNotFoundError';
    this.statusCode = 404;
  }
}

export class CredentialsInactiveError extends CredentialRetrievalError {
  constructor(tenantId: string, environment: MpesaEnvironment) {
    super(
      `M-Pesa credentials for tenant ${tenantId} are inactive`,
      'CREDENTIALS_INACTIVE',
      tenantId,
      environment
    );
    this.name = 'CredentialsInactiveError';
    this.statusCode = 403;
  }
}

export class CredentialDecryptionError extends CredentialRetrievalError {
  constructor(tenantId: string, environment: MpesaEnvironment, originalError?: any) {
    super(
      `Failed to decrypt credentials for tenant ${tenantId}`,
      'DECRYPTION_ERROR',
      tenantId,
      environment
    );
    this.name = 'CredentialDecryptionError';
    this.originalError = originalError;
  }
}