/**
 * M-Pesa Credential Encryption Service
 * Shared encryption utilities for M-Pesa credentials
 */

import * as crypto from 'crypto';

/**
 * Get the master encryption key with proper error handling
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
 * Encrypt a credential using AES-256-GCM
 * Returns bytea-compatible Buffer for database storage
 */
export function encryptCredential(plaintext: string): Buffer {
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
    const masterKey = getMasterKey();
    
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