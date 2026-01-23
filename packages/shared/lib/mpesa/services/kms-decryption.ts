/**
 * KMS Decryption Service
 * Handles secure decryption of stored credentials using system-level KMS keys
 * 
 * Requirements: 1.3, 2.2, 3.2
 */

import * as crypto from 'crypto';
import { MpesaError } from '../types';
import { 
  TenantCredentialErrorHandler, 
  createTenantCredentialErrorHandler,
  withTenantErrorHandling 
} from './error-handling';
import { Logger, ConsoleLogger } from './base';

export interface KMSDecryptionService {
  decrypt(encryptedValue: string | Buffer): Promise<string>;
  validateDecryption(decryptedValue: string): boolean;
}

/**
 * Secure memory buffer for handling sensitive data
 * Automatically clears memory when disposed
 */
class SecureBuffer {
  private buffer: Buffer;
  private isCleared: boolean = false;

  constructor(data: string | Buffer) {
    if (typeof data === 'string') {
      this.buffer = Buffer.from(data, 'utf8');
    } else {
      this.buffer = Buffer.from(data);
    }
  }

  /**
   * Get the buffer data (use with caution)
   */
  getData(): Buffer {
    if (this.isCleared) {
      throw new Error('SecureBuffer has been cleared');
    }
    return this.buffer;
  }

  /**
   * Get string representation of the buffer
   */
  toString(encoding: BufferEncoding = 'utf8'): string {
    if (this.isCleared) {
      throw new Error('SecureBuffer has been cleared');
    }
    return this.buffer.toString(encoding);
  }

  /**
   * Securely clear the buffer by overwriting with random data
   */
  clear(): void {
    if (!this.isCleared && this.buffer) {
      // Overwrite with random data multiple times for security
      for (let i = 0; i < 3; i++) {
        crypto.randomFillSync(this.buffer);
      }
      // Final overwrite with zeros
      this.buffer.fill(0);
      this.isCleared = true;
    }
  }

  /**
   * Get buffer length
   */
  get length(): number {
    return this.isCleared ? 0 : this.buffer.length;
  }
}

export class SystemKMSDecryptionService implements KMSDecryptionService {
  private masterKey: SecureBuffer | null = null;
  private errorHandler: TenantCredentialErrorHandler;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new ConsoleLogger();
    this.errorHandler = createTenantCredentialErrorHandler(this.logger, 'sandbox'); // Default to sandbox
    this.initializeMasterKey();
  }

  /**
   * Initialize and validate the master encryption key
   * @private
   */
  private initializeMasterKey(): void {
    try {
      const masterKeyEnv = process.env.MPESA_KMS_KEY;
      
      if (!masterKeyEnv) {
        throw new MpesaError(
          'MPESA_KMS_KEY environment variable is required for credential decryption',
          'KMS_KEY_MISSING',
          500
        );
      }
      
      if (masterKeyEnv.length !== 32) {
        throw new MpesaError(
          'MPESA_KMS_KEY must be exactly 32 bytes for AES-256 encryption',
          'KMS_KEY_INVALID_LENGTH',
          500
        );
      }

      // Validate key contains only valid characters
      if (!/^[\x20-\x7E]*$/.test(masterKeyEnv)) {
        throw new MpesaError(
          'MPESA_KMS_KEY contains invalid characters',
          'KMS_KEY_INVALID_FORMAT',
          500
        );
      }
      
      this.masterKey = new SecureBuffer(masterKeyEnv);
    } catch (error) {
      // Handle the error through the error handler
      const errorInfo = this.errorHandler.handleTenantError(error, {
        operation: 'initializeMasterKey'
      });
      
      if (error instanceof MpesaError) {
        throw error;
      }
      throw new MpesaError(
        `Failed to initialize KMS key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'KMS_INITIALIZATION_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Decrypt a credential using AES-256-GCM with secure memory handling
   * @param encryptedValue - The encrypted credential as string or Buffer
   * @returns Promise<string> - The decrypted plaintext
   * @throws MpesaError if decryption fails
   */
  async decrypt(encryptedValue: string | Buffer): Promise<string> {
    return withTenantErrorHandling(
      async () => {
        let encryptedBuffer: Buffer;
        let decryptedBuffer: SecureBuffer | null = null;
        
        try {
          // Ensure we have a master key
          if (!this.masterKey) {
            throw new MpesaError(
              'KMS service not properly initialized',
              'KMS_NOT_INITIALIZED',
              500
            );
          }

          // Convert input to Buffer if needed
          if (typeof encryptedValue === 'string') {
            // Assume base64 encoded string
            try {
              encryptedBuffer = Buffer.from(encryptedValue, 'base64');
            } catch {
              throw new MpesaError(
                'Invalid encrypted value format: expected base64 string or Buffer',
                'INVALID_ENCRYPTED_FORMAT',
                400
              );
            }
          } else {
            encryptedBuffer = encryptedValue;
          }

          // Validate minimum length: IV (12) + AuthTag (16) = 28 bytes minimum
          if (encryptedBuffer.length < 28) {
            throw new MpesaError(
              'Invalid encrypted data: insufficient length for AES-256-GCM format',
              'INVALID_ENCRYPTED_DATA',
              400
            );
          }

          // Extract components: IV (12) + AuthTag (16) + Encrypted Data
          const iv = encryptedBuffer.subarray(0, 12);
          const authTag = encryptedBuffer.subarray(12, 28);
          const encrypted = encryptedBuffer.subarray(28);

          // Validate IV and authTag are not all zeros (potential corruption)
          if (iv.every(byte => byte === 0) || authTag.every(byte => byte === 0)) {
            throw new MpesaError(
              'Invalid encrypted data: corrupted IV or authentication tag',
              'CORRUPTED_ENCRYPTED_DATA',
              400
            );
          }

          // Create decipher with secure key handling
          const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey.getData(), iv);
          decipher.setAuthTag(authTag);

          // Decrypt data
          let decryptedData = decipher.update(encrypted);
          const finalData = decipher.final();
          decryptedData = Buffer.concat([decryptedData, finalData]);

          // Store in secure buffer
          decryptedBuffer = new SecureBuffer(decryptedData);

          // Convert to string and validate
          const decryptedString = decryptedBuffer.toString('utf8');
          
          if (!this.validateDecryption(decryptedString)) {
            throw new MpesaError(
              'Decrypted data failed validation checks',
              'INVALID_DECRYPTED_DATA',
              500
            );
          }

          return decryptedString;

        } catch (error) {
          if (error instanceof MpesaError) {
            throw error;
          }

          // Handle specific crypto errors
          if (error instanceof Error) {
            if (error.message.includes('bad decrypt') || error.message.includes('wrong final block length')) {
              throw new MpesaError(
                'Decryption failed: invalid key or corrupted data',
                'DECRYPTION_FAILED',
                500,
                error
              );
            }
            
            if (error.message.includes('Unsupported state or unable to authenticate data')) {
              throw new MpesaError(
                'Decryption failed: authentication tag verification failed',
                'AUTHENTICATION_FAILED',
                500,
                error
              );
            }
          }

          throw new MpesaError(
            `Credential decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'DECRYPTION_ERROR',
            500,
            error
          );
        } finally {
          // Always clear sensitive data from memory
          if (decryptedBuffer) {
            decryptedBuffer.clear();
          }
          
          // Clear the encrypted buffer if we created it from string
          if (typeof encryptedValue === 'string' && encryptedBuffer) {
            crypto.randomFillSync(encryptedBuffer);
            encryptedBuffer.fill(0);
          }
        }
      },
      this.errorHandler,
      {
        operation: 'decrypt'
      }
    );
  }

  /**
   * Validate that decrypted data appears to be valid credential data
   * @param decryptedValue - The decrypted string to validate
   * @returns boolean - true if the data appears valid
   */
  validateDecryption(decryptedValue: string): boolean {
    try {
      // Check for null, undefined, or empty string
      if (!decryptedValue || decryptedValue.trim().length === 0) {
        return false;
      }

      // Check for reasonable length (credentials should be at least a few characters)
      if (decryptedValue.length < 3) {
        return false;
      }

      // Check for reasonable maximum length (prevent extremely long strings)
      if (decryptedValue.length > 1000) {
        return false;
      }

      // Check that the string contains only printable ASCII characters
      // This helps detect corruption or encoding issues
      if (!/^[\x20-\x7E]*$/.test(decryptedValue)) {
        return false;
      }

      // Check for common corruption patterns
      const suspiciousPatterns = [
        /^\x00+$/, // All null bytes
        /^[\x00-\x1F]+$/, // All control characters
        /^.{1}\1{10,}$/, // Same character repeated many times
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(decryptedValue)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      // If validation itself fails, consider the data invalid
      return false;
    }
  }

  /**
   * Clean up resources and clear sensitive data
   */
  dispose(): void {
    if (this.masterKey) {
      this.masterKey.clear();
      this.masterKey = null;
    }
  }
}

/**
 * Factory function to create KMSDecryptionService instance
 * @param logger - Optional logger instance
 * @returns KMSDecryptionService instance
 */
export function createKMSDecryptionService(logger?: Logger): KMSDecryptionService {
  return new SystemKMSDecryptionService(logger);
}

/**
 * Error types specific to KMS decryption
 */
export class KMSDecryptionError extends MpesaError {
  constructor(message: string, code: string, originalError?: any) {
    super(message, code, 500, originalError);
    this.name = 'KMSDecryptionError';
  }
}

export class KMSKeyError extends KMSDecryptionError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'KMSKeyError';
  }
}

export class DecryptionValidationError extends KMSDecryptionError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'DecryptionValidationError';
  }
}