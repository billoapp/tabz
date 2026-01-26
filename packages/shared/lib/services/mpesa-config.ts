/**
 * Simple M-Pesa Configuration Loader
 * Loads M-Pesa credentials from database per bar (multi-tenant)
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */

export type MpesaEnvironment = 'sandbox' | 'production';

export interface MpesaConfig {
  environment: MpesaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  businessShortcode: string;
  passkey: string;
  callbackUrl: string;
  oauthUrl: string;
  stkPushUrl: string;
  stkQueryUrl: string;
}

export interface BarMpesaData {
  mpesa_enabled: boolean;
  mpesa_environment: string;
  mpesa_business_shortcode: string;
  mpesa_consumer_key_encrypted: string;
  mpesa_consumer_secret_encrypted: string;
  mpesa_passkey_encrypted: string;
  mpesa_callback_url: string;
}

export class MpesaConfigurationError extends Error {
  constructor(message: string, public missingFields?: string[]) {
    super(message);
    this.name = 'MpesaConfigurationError';
  }
}

/**
 * Load and validate M-Pesa configuration from bar database record
 * Requirement 4.1: THE System SHALL read M-Pesa credentials from database per bar
 * Requirement 4.2: THE System SHALL support both sandbox and production environments via configuration
 * Requirement 4.4: WHEN configuration is missing, THE System SHALL return clear configuration error messages
 * Requirement 4.5: THE System SHALL validate all required M-Pesa configuration
 */
export function loadMpesaConfigFromBar(barData: BarMpesaData): MpesaConfig {
  // Check if M-Pesa is enabled for this bar
  if (!barData.mpesa_enabled) {
    throw new MpesaConfigurationError('M-Pesa is not enabled for this bar');
  }

  const missingFields: string[] = [];
  
  // Check for missing required fields
  if (!barData.mpesa_environment) missingFields.push('mpesa_environment');
  if (!barData.mpesa_business_shortcode) missingFields.push('mpesa_business_shortcode');
  if (!barData.mpesa_consumer_key_encrypted) missingFields.push('mpesa_consumer_key_encrypted');
  if (!barData.mpesa_consumer_secret_encrypted) missingFields.push('mpesa_consumer_secret_encrypted');
  if (!barData.mpesa_passkey_encrypted) missingFields.push('mpesa_passkey_encrypted');
  if (!barData.mpesa_callback_url) missingFields.push('mpesa_callback_url');

  // Requirement 4.4: Return clear error messages for missing configuration
  if (missingFields.length > 0) {
    throw new MpesaConfigurationError(
      `Missing required M-Pesa configuration: ${missingFields.join(', ')}`,
      missingFields
    );
  }

  // Validate environment
  const environment = validateEnvironment(barData.mpesa_environment);

  // Decrypt credentials using KMS key
  const kmsKey = process.env.MPESA_KMS_KEY;
  if (!kmsKey) {
    throw new MpesaConfigurationError('MPESA_KMS_KEY environment variable is required for decryption');
  }

  let consumerKey: string;
  let consumerSecret: string;
  let passkey: string;

  try {
    consumerKey = decryptCredential(barData.mpesa_consumer_key_encrypted, kmsKey);
    consumerSecret = decryptCredential(barData.mpesa_consumer_secret_encrypted, kmsKey);
    passkey = decryptCredential(barData.mpesa_passkey_encrypted, kmsKey);
  } catch (error) {
    throw new MpesaConfigurationError(
      `Failed to decrypt M-Pesa credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Get environment-specific URLs
  const urls = getEnvironmentUrls(environment);

  const config: MpesaConfig = {
    environment,
    consumerKey,
    consumerSecret,
    businessShortcode: barData.mpesa_business_shortcode,
    passkey,
    callbackUrl: barData.mpesa_callback_url,
    oauthUrl: urls.oauth,
    stkPushUrl: urls.stkPush,
    stkQueryUrl: urls.stkQuery,
  };

  // Requirement 4.5: Validate all required configuration
  validateConfig(config);

  return config;
}

/**
 * Get and validate M-Pesa environment from bar data
 * Requirement 4.2: Support both sandbox and production environments
 */
function validateEnvironment(env: string): MpesaEnvironment {
  if (!env) {
    throw new MpesaConfigurationError(
      'Missing mpesa_environment in bar configuration'
    );
  }

  const normalizedEnv = env.toLowerCase();
  if (normalizedEnv !== 'sandbox' && normalizedEnv !== 'production') {
    throw new MpesaConfigurationError(
      `Invalid mpesa_environment: "${env}". Must be "sandbox" or "production"`
    );
  }

  return normalizedEnv as MpesaEnvironment;
}

/**
 * Decrypt M-Pesa credential using KMS key
 * Handles bytea data from database using AES-256-GCM decryption
 */
function decryptCredential(encryptedValue: string, kmsKey: string): string {
  try {
    // Handle test values for development
    if (encryptedValue === 'test_encrypted_value') {
      throw new Error(
        'Test M-Pesa credentials detected. Please configure real Safaricom sandbox credentials in the database. ' +
        'Get credentials from: https://developer.safaricom.co.ke/MyApps'
      );
    }
    
    // The encrypted value from database is a bytea hex string (e.g., "\\x1234abcd...")
    // Convert hex string to Buffer
    let encryptedBuffer: Buffer;
    
    if (encryptedValue.startsWith('\\x')) {
      // PostgreSQL bytea hex format
      encryptedBuffer = Buffer.from(encryptedValue.slice(2), 'hex');
    } else {
      // Try base64 format as fallback
      encryptedBuffer = Buffer.from(encryptedValue, 'base64');
    }
    
    if (encryptedBuffer.length < 28) { // 12 (IV) + 16 (AuthTag) = 28 minimum
      throw new Error('Invalid encrypted data: too short');
    }
    
    // Extract components (same as staff app)
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    // Create decipher using Node.js crypto
    const crypto = require('crypto');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(kmsKey, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get environment-specific API URLs
 */
function getEnvironmentUrls(environment: MpesaEnvironment) {
  const baseUrl = environment === 'sandbox' 
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke';

  return {
    oauth: `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    stkPush: `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    stkQuery: `${baseUrl}/mpesa/stkpushquery/v1/query`,
  };
}

/**
 * Validate M-Pesa configuration
 * Requirement 4.5: Validate all required configuration on startup
 */
function validateConfig(config: MpesaConfig): void {
  const errors: string[] = [];

  // Validate business shortcode format (5-7 digits)
  if (!/^\d{5,7}$/.test(config.businessShortcode)) {
    errors.push('MPESA_BUSINESS_SHORTCODE must be 5-7 digits');
  }

  // Validate consumer key length
  if (config.consumerKey.length < 10) {
    errors.push('MPESA_CONSUMER_KEY must be at least 10 characters');
  }

  // Validate consumer secret length
  if (config.consumerSecret.length < 10) {
    errors.push('MPESA_CONSUMER_SECRET must be at least 10 characters');
  }

  // Validate passkey length
  if (config.passkey.length < 10) {
    errors.push('MPESA_PASSKEY must be at least 10 characters');
  }

  // Validate callback URL format
  try {
    const url = new URL(config.callbackUrl);
    if (config.environment === 'production' && url.protocol !== 'https:') {
      errors.push('MPESA_CALLBACK_URL must use HTTPS in production environment');
    }
  } catch {
    errors.push('MPESA_CALLBACK_URL must be a valid URL');
  }

  // Environment-specific validations
  if (config.environment === 'production') {
    if (config.oauthUrl.includes('sandbox')) {
      errors.push('Production environment cannot use sandbox URLs');
    }
  } else {
    if (!config.oauthUrl.includes('sandbox')) {
      errors.push('Sandbox environment must use sandbox URLs');
    }
  }

  if (errors.length > 0) {
    throw new MpesaConfigurationError(
      `Invalid M-Pesa configuration: ${errors.join(', ')}`
    );
  }
}

/**
 * Check if M-Pesa is configured for a specific bar
 * Useful for conditional feature enablement
 */
export function isMpesaConfiguredForBar(barData: BarMpesaData): boolean {
  try {
    loadMpesaConfigFromBar(barData);
    return true;
  } catch {
    return false;
  }
}

/**
 * Legacy function for environment variable configuration (for testing)
 * @deprecated Use loadMpesaConfigFromBar for multi-tenant setup
 */
export function loadMpesaConfig(): MpesaConfig {
  const environment = getEnvironmentFromEnvVars();
  const missingVariables: string[] = [];
  
  // Required environment variables
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const businessShortcode = process.env.MPESA_BUSINESS_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  // Check for missing required variables
  if (!consumerKey) missingVariables.push('MPESA_CONSUMER_KEY');
  if (!consumerSecret) missingVariables.push('MPESA_CONSUMER_SECRET');
  if (!businessShortcode) missingVariables.push('MPESA_BUSINESS_SHORTCODE');
  if (!passkey) missingVariables.push('MPESA_PASSKEY');
  if (!callbackUrl) missingVariables.push('MPESA_CALLBACK_URL');

  if (missingVariables.length > 0) {
    throw new MpesaConfigurationError(
      `Missing required M-Pesa environment variables: ${missingVariables.join(', ')}`,
      missingVariables
    );
  }

  const urls = getEnvironmentUrls(environment);

  const config: MpesaConfig = {
    environment,
    consumerKey: consumerKey!,
    consumerSecret: consumerSecret!,
    businessShortcode: businessShortcode!,
    passkey: passkey!,
    callbackUrl: callbackUrl!,
    oauthUrl: urls.oauth,
    stkPushUrl: urls.stkPush,
    stkQueryUrl: urls.stkQuery,
  };

  validateConfig(config);
  return config;
}

/**
 * Legacy environment variable check (for testing)
 * @deprecated Use isMpesaConfiguredForBar for multi-tenant setup
 */
export function isMpesaConfigured(): boolean {
  try {
    loadMpesaConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get environment from environment variables (legacy)
 */
function getEnvironmentFromEnvVars(): MpesaEnvironment {
  const env = process.env.MPESA_ENVIRONMENT?.toLowerCase();
  
  if (!env) {
    throw new MpesaConfigurationError(
      'Missing required environment variable: MPESA_ENVIRONMENT (must be "sandbox" or "production")'
    );
  }

  if (env !== 'sandbox' && env !== 'production') {
    throw new MpesaConfigurationError(
      `Invalid MPESA_ENVIRONMENT: "${env}". Must be "sandbox" or "production"`
    );
  }

  return env as MpesaEnvironment;
}