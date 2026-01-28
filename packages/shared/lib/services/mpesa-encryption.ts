/**
 * Production-grade M-Pesa credential encryption utilities
 * Storage Contract: PostgreSQL bytea hex format (\x...) is the ONLY canonical format
 * 
 * Rules:
 * - In-memory: Buffer
 * - Database: bytea (hex string \x...)
 * - API transport: never exposed
 * - Shared package input: bytea hex string
 */

import crypto from 'crypto';

/**
 * Get the master encryption key with proper validation
 */
function getMasterKey(): string {
  const masterKey = process.env.MPESA_KMS_KEY;
  
  if (!masterKey) {
    throw new Error('MPESA_KMS_KEY environment variable is required');
  }
  
  if (masterKey.length !== 32) {
    throw new Error('MPESA_KMS_KEY must be exactly 32 bytes');
  }
  
  return masterKey;
}

/**
 * Encrypt a credential and return PostgreSQL bytea hex format
 * This is the ONLY way credentials should be stored in the database
 * 
 * @param plaintext - The credential to encrypt
 * @returns PostgreSQL bytea hex string (format: \x1a2b3c...)
 */
export function encryptToBytea(plaintext: string): string {
  try {
    const masterKey = getMasterKey();
    
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'utf8'), iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine: IV (12) + AuthTag (16) + Encrypted Data
    const encryptedBuffer = Buffer.concat([iv, authTag, encrypted]);
    
    // Return PostgreSQL bytea hex format
    return `\\x${encryptedBuffer.toString('hex')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a credential from PostgreSQL bytea hex format
 * This is the ONLY format we accept - no guessing, no fallbacks
 * 
 * @param byteaHex - PostgreSQL bytea hex string (format: \x1a2b3c...)
 * @returns Decrypted plaintext string
 */
export function decryptFromBytea(byteaHex: string): string {
  try {
    const masterKey = getMasterKey();
    
    // Validate format - fail fast if not bytea hex
    if (!byteaHex.startsWith('\\x')) {
      throw new Error('Invalid bytea format: must start with \\x');
    }
    
    // Convert hex string to Buffer
    const encryptedBuffer = Buffer.from(byteaHex.slice(2), 'hex');
    
    if (encryptedBuffer.length < 28) { // 12 (IV) + 16 (AuthTag) = 28 minimum
      throw new Error('Invalid encrypted data: too short');
    }
    
    // Extract components
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(masterKey, 'utf8'), iv);
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
 * Validate M-Pesa credentials format before encryption
 */
export function validateMpesaCredentials(credentials: {
  businessShortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate business shortcode (5-7 digits)
  if (!/^\d{5,7}$/.test(credentials.businessShortcode)) {
    errors.push('Business shortcode must be 5-7 digits');
  }
  
  // Block Till numbers (common pattern starting with 5)
  if (credentials.businessShortcode.length === 6 && credentials.businessShortcode.startsWith('5')) {
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
 * Test encryption/decryption cycle for diagnostics
 */
export function testEncryptionCycle(testValue: string = 'test_credential_12345'): boolean {
  try {
    const encrypted = encryptToBytea(testValue);
    const decrypted = decryptFromBytea(encrypted);
    return decrypted === testValue;
  } catch (error) {
    console.error('Encryption cycle test failed:', error);
    return false;
  }
}