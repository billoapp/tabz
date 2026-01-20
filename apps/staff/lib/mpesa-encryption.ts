// Production-grade M-Pesa credential encryption utilities
// Uses AES-256-GCM envelope encryption with master key

import crypto from 'crypto';

// Master key from environment (server-side only)
const MASTER_KEY = process.env.MPESA_KMS_KEY;

if (!MASTER_KEY) {
  throw new Error('MPESA_KMS_KEY environment variable is required');
}

if (MASTER_KEY.length !== 32) {
  throw new Error('MPESA_KMS_KEY must be exactly 32 bytes');
}

// Ensure MASTER_KEY is defined for TypeScript
const ENCRYPTION_KEY: string = MASTER_KEY;

/**
 * Encrypt a credential using AES-256-GCM
 * Returns bytea-compatible Buffer for database storage
 */
export function encryptCredential(plaintext: string): Buffer {
  try {
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine: IV (12) + AuthTag (16) + Encrypted Data
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a credential from bytea Buffer
 * Returns plaintext string
 */
export function decryptCredential(encryptedBuffer: Buffer): string {
  try {
    if (encryptedBuffer.length < 28) { // 12 (IV) + 16 (AuthTag) = 28 minimum
      throw new Error('Invalid encrypted data: too short');
    }
    
    // Extract components
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate M-Pesa credentials format
 */
export function validateMpesaCredentials(credentials: {
  businessShortCode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate business shortcode (PayBill format)
  if (!/^\d{5,7}$/.test(credentials.businessShortCode)) {
    errors.push('Business shortcode must be 5-7 digits');
  }
  
  // Block Till numbers (common pattern starting with 5)
  if (credentials.businessShortCode.length === 6 && credentials.businessShortCode.startsWith('5')) {
    errors.push('Till numbers are not supported for STK Push. Use PayBill or link Till to shortcode.');
  }
  
  // Validate consumer key
  if (!credentials.consumerKey || credentials.consumerKey.length < 10) {
    errors.push('Consumer key is required and must be at least 10 characters');
  }
  
  // Validate consumer secret
  if (!credentials.consumerSecret || credentials.consumerSecret.length < 10) {
    errors.push('Consumer secret is required and must be at least 10 characters');
  }
  
  // Validate passkey
  if (!credentials.passkey || credentials.passkey.length < 10) {
    errors.push('Passkey is required and must be at least 10 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate M-Pesa OAuth token
 */
export async function generateMpesaToken(
  consumerKey: string,
  consumerSecret: string,
  environment: 'sandbox' | 'production'
): Promise<string> {
  const baseUrl = environment === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate M-Pesa token: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error('No access token received from M-Pesa API');
  }
  
  return data.access_token;
}