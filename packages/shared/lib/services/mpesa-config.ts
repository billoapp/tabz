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
  if (!barData.mpesa_callback_url) missingFields.push('mpesa_callback_url');

  // Validate environment
  const environment = validateEnvironment(barData.mpesa_environment);

  // For sandbox environment, use standard Safaricom test credentials if not provided
  if (environment === 'sandbox') {
    return loadSandboxConfig(barData, missingFields);
  }

  // For production, all credentials are required
  if (!barData.mpesa_business_shortcode) missingFields.push('mpesa_business_shortcode');
  if (!barData.mpesa_consumer_key_encrypted) missingFields.push('mpesa_consumer_key_encrypted');
  if (!barData.mpesa_consumer_secret_encrypted) missingFields.push('mpesa_consumer_secret_encrypted');
  if (!barData.mpesa_passkey_encrypted) missingFields.push('mpesa_passkey_encrypted');

  // Requirement 4.4: Return clear error messages for missing configuration
  if (missingFields.length > 0) {
    throw new MpesaConfigurationError(
      `Missing required M-Pesa configuration: ${missingFields.join(', ')}`,
      missingFields
    );
  }

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
 * Load sandbox configuration with standard Safaricom test credentials
 * For sandbox: Business shortcode and passkey are standard (shared)
 * Consumer key and secret are individual per tenant (from Safaricom Developer Portal)
 * 
 * IMPORTANT: Even though sandbox credentials are "standard", they must be stored
 * encrypted in the database to pass validation. Empty values will cause errors.
 */
function loadSandboxConfig(barData: BarMpesaData, missingFields: string[]): MpesaConfig {
  // For sandbox, we need individual consumer key and secret, but can use standard business shortcode and passkey
  const sandboxMissingFields: string[] = [];
  
  if (!barData.mpesa_consumer_key_encrypted) sandboxMissingFields.push('mpesa_consumer_key_encrypted');
  if (!barData.mpesa_consumer_secret_encrypted) sandboxMissingFields.push('mpesa_consumer_secret_encrypted');
  
  // Add any other missing fields from the original check
  sandboxMissingFields.push(...missingFields);

  // Requirement 4.4: Return clear error messages for missing configuration
  if (sandboxMissingFields.length > 0) {
    throw new MpesaConfigurationError(
      `Missing required M-Pesa sandbox configuration: ${sandboxMissingFields.join(', ')}. ` +
      `For sandbox testing, you need your own Consumer Key and Consumer Secret from https://developer.safaricom.co.ke/MyApps`,
      sandboxMissingFields
    );
  }

  // Standard Safaricom sandbox credentials (shared across all tenants)
  const SANDBOX_SHARED_CREDENTIALS = {
    businessShortcode: '174379', // Standard sandbox business shortcode
    passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919' // Standard sandbox passkey
  };

  // Decrypt individual tenant credentials
  const kmsKey = process.env.MPESA_KMS_KEY;
  if (!kmsKey) {
    throw new MpesaConfigurationError('MPESA_KMS_KEY environment variable is required for decryption');
  }

  let consumerKey: string;
  let consumerSecret: string;

  try {
    consumerKey = decryptCredential(barData.mpesa_consumer_key_encrypted, kmsKey);
    consumerSecret = decryptCredential(barData.mpesa_consumer_secret_encrypted, kmsKey);
  } catch (error) {
    throw new MpesaConfigurationError(
      `Failed to decrypt M-Pesa sandbox credentials: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Please ensure your Consumer Key and Consumer Secret are properly configured.`
    );
  }

  // Use custom business shortcode if provided, otherwise use sandbox standard
  const businessShortcode = barData.mpesa_business_shortcode || SANDBOX_SHARED_CREDENTIALS.businessShortcode;
  
  // Use custom passkey if provided, otherwise use sandbox standard
  let passkey: string;
  if (barData.mpesa_passkey_encrypted) {
    try {
      passkey = decryptCredential(barData.mpesa_passkey_encrypted, kmsKey);
    } catch (error) {
      // If decryption fails, fall back to standard sandbox passkey
      passkey = SANDBOX_SHARED_CREDENTIALS.passkey;
    }
  } else {
    passkey = SANDBOX_SHARED_CREDENTIALS.passkey;
  }

  // Get sandbox URLs
  const urls = getEnvironmentUrls('sandbox');

  const config: MpesaConfig = {
    environment: 'sandbox',
    consumerKey: consumerKey, // Individual per tenant
    consumerSecret: consumerSecret, // Individual per tenant
    businessShortcode: businessShortcode, // Standard sandbox or custom
    passkey: passkey, // Standard sandbox or custom
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
    oauth: `${baseUrl}/oauth/v1/generate`,
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
 * Get standard Safaricom sandbox test phone numbers
 * These are the official test numbers provided by Safaricom for sandbox testing
 */
export function getSandboxTestPhoneNumbers(): string[] {
  return [
    '254708374149', // Standard test number 1
    '254711040400', // Standard test number 2  
    '254711040401', // Standard test number 3
    '254711040402', // Standard test number 4
    '254711040403', // Standard test number 5
  ];
}

/**
 * Check if a phone number is a valid sandbox test number
 */
export function isSandboxTestPhoneNumber(phoneNumber: string): boolean {
  const testNumbers = getSandboxTestPhoneNumbers();
  return testNumbers.includes(phoneNumber);
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
 * Get sandbox configuration info for display in UI
 */
export function getSandboxConfigInfo() {
  return {
    businessShortcode: '174379',
    passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    testPhoneNumbers: getSandboxTestPhoneNumbers(),
    instructions: {
      consumerKey: 'Get your individual Consumer Key from https://developer.safaricom.co.ke/MyApps',
      consumerSecret: 'Get your individual Consumer Secret from https://developer.safaricom.co.ke/MyApps',
      businessShortcode: 'Leave empty - system auto-fills 174379 on save',
      passkey: 'Leave empty - system auto-fills sandbox passkey on save',
      testNumbers: 'Use any of the provided test phone numbers for testing'
    }
  };
}

/**
 * Auto-fill sandbox credentials for UI save operations
 * This ensures empty sandbox fields get the standard values before database save
 */
export function autoFillSandboxCredentials(settings: {
  mpesa_environment: string;
  mpesa_business_shortcode: string;
  mpesa_passkey: string;
}) {
  if (settings.mpesa_environment === 'sandbox') {
    const sandboxInfo = getSandboxConfigInfo();
    
    return {
      ...settings,
      mpesa_business_shortcode: settings.mpesa_business_shortcode || sandboxInfo.businessShortcode,
      mpesa_passkey: settings.mpesa_passkey || sandboxInfo.passkey
    };
  }
  
  return settings;
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