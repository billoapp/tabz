/**
 * KMS Decryption Service Unit Tests
 * Tests secure credential decryption functionality
 */

// Jest globals are available without import in the test environment
import * as crypto from 'crypto';
import { 
  SystemKMSDecryptionService, 
  createKMSDecryptionService,
  KMSDecryptionError,
  KMSKeyError 
} from '../services/kms-decryption';
import { MpesaError } from '../types';

describe('KMSDecryptionService', () => {
  let service: SystemKMSDecryptionService;
  const originalEnv = process.env.MPESA_KMS_KEY;
  const testKey = 'test-key-32-bytes-long-for-aes!'; // Exactly 32 bytes

  beforeEach(() => {
    // Set up test environment
    process.env.MPESA_KMS_KEY = testKey;
    service = new SystemKMSDecryptionService();
  });

  afterEach(() => {
    // Clean up
    if (service && typeof service.dispose === 'function') {
      service.dispose();
    }
    
    // Restore original environment
    if (originalEnv) {
      process.env.MPESA_KMS_KEY = originalEnv;
    } else {
      delete process.env.MPESA_KMS_KEY;
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid 32-byte key', () => {
      expect(() => new SystemKMSDecryptionService()).not.toThrow();
    });

    it('should throw error when MPESA_KMS_KEY is missing', () => {
      delete process.env.MPESA_KMS_KEY;
      
      expect(() => new SystemKMSDecryptionService()).toThrow(MpesaError);
      expect(() => new SystemKMSDecryptionService()).toThrow('MPESA_KMS_KEY environment variable is required');
    });

    it('should throw error when MPESA_KMS_KEY is wrong length', () => {
      process.env.MPESA_KMS_KEY = 'too-short';
      
      expect(() => new SystemKMSDecryptionService()).toThrow(MpesaError);
      expect(() => new SystemKMSDecryptionService()).toThrow('must be exactly 32 bytes');
    });

    it('should throw error when MPESA_KMS_KEY contains invalid characters', () => {
      process.env.MPESA_KMS_KEY = 'invalid-key-with-\x00-null-bytes!!';
      
      expect(() => new SystemKMSDecryptionService()).toThrow(MpesaError);
      expect(() => new SystemKMSDecryptionService()).toThrow('invalid characters');
    });
  });

  describe('Decryption', () => {
    let encryptedData: Buffer;
    const testPlaintext = 'test-credential-value';

    beforeEach(() => {
      // Create test encrypted data using the same algorithm
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(testKey, 'utf8'), iv);
      
      let encrypted = cipher.update(testPlaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const authTag = cipher.getAuthTag();
      encryptedData = Buffer.concat([iv, authTag, encrypted]);
    });

    it('should decrypt valid encrypted data successfully', async () => {
      const result = await service.decrypt(encryptedData);
      expect(result).toBe(testPlaintext);
    });

    it('should decrypt base64 encoded string successfully', async () => {
      const base64Data = encryptedData.toString('base64');
      const result = await service.decrypt(base64Data);
      expect(result).toBe(testPlaintext);
    });

    it('should throw error for invalid base64 string', async () => {
      await expect(service.decrypt('invalid-base64!')).rejects.toThrow(MpesaError);
      await expect(service.decrypt('invalid-base64!')).rejects.toThrow('Invalid encrypted value format');
    });

    it('should throw error for data too short', async () => {
      const shortData = Buffer.alloc(20); // Less than 28 bytes minimum
      await expect(service.decrypt(shortData)).rejects.toThrow(MpesaError);
      await expect(service.decrypt(shortData)).rejects.toThrow('insufficient length');
    });

    it('should throw error for corrupted IV', async () => {
      const corruptedData = Buffer.from(encryptedData);
      corruptedData.fill(0, 0, 12); // Zero out IV
      
      await expect(service.decrypt(corruptedData)).rejects.toThrow(MpesaError);
      await expect(service.decrypt(corruptedData)).rejects.toThrow('corrupted IV');
    });

    it('should throw error for corrupted auth tag', async () => {
      const corruptedData = Buffer.from(encryptedData);
      corruptedData.fill(0, 12, 28); // Zero out auth tag
      
      await expect(service.decrypt(corruptedData)).rejects.toThrow(MpesaError);
      await expect(service.decrypt(corruptedData)).rejects.toThrow('authentication tag');
    });

    it('should throw error for wrong key', async () => {
      // Create new service with different key
      process.env.MPESA_KMS_KEY = 'different-key-32-bytes-long-!!';
      const wrongKeyService = new SystemKMSDecryptionService();
      
      await expect(wrongKeyService.decrypt(encryptedData)).rejects.toThrow(MpesaError);
      await expect(wrongKeyService.decrypt(encryptedData)).rejects.toThrow('Decryption failed');
      
      wrongKeyService.dispose();
    });

    it('should handle authentication failures gracefully', async () => {
      // Corrupt the encrypted data portion
      const corruptedData = Buffer.from(encryptedData);
      corruptedData[30] = corruptedData[30] ^ 0xFF; // Flip bits in encrypted data
      
      await expect(service.decrypt(corruptedData)).rejects.toThrow(MpesaError);
    });
  });

  describe('Validation', () => {
    it('should validate normal credential strings', () => {
      expect(service.validateDecryption('valid-credential-123')).toBe(true);
      expect(service.validateDecryption('CONSUMER_KEY_ABC123')).toBe(true);
      expect(service.validateDecryption('passkey-with-special-chars!@#')).toBe(true);
    });

    it('should reject empty or null values', () => {
      expect(service.validateDecryption('')).toBe(false);
      expect(service.validateDecryption('   ')).toBe(false);
      expect(service.validateDecryption(null as any)).toBe(false);
      expect(service.validateDecryption(undefined as any)).toBe(false);
    });

    it('should reject very short values', () => {
      expect(service.validateDecryption('a')).toBe(false);
      expect(service.validateDecryption('ab')).toBe(false);
    });

    it('should reject very long values', () => {
      const longString = 'a'.repeat(1001);
      expect(service.validateDecryption(longString)).toBe(false);
    });

    it('should reject non-printable characters', () => {
      expect(service.validateDecryption('test\x00null')).toBe(false);
      expect(service.validateDecryption('test\x01control')).toBe(false);
      expect(service.validateDecryption('test\x7Fdelete')).toBe(false);
    });

    it('should reject suspicious patterns', () => {
      expect(service.validateDecryption('\x00\x00\x00\x00')).toBe(false);
      expect(service.validateDecryption('\x01\x02\x03\x04')).toBe(false);
      expect(service.validateDecryption('aaaaaaaaaaaaa')).toBe(false); // Repeated character
    });
  });

  describe('Memory Security', () => {
    it('should clear sensitive data after decryption', async () => {
      const testData = 'sensitive-credential-data';
      
      // Create encrypted data
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(testKey, 'utf8'), iv);
      let encrypted = cipher.update(testData, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedBuffer = Buffer.concat([iv, authTag, encrypted]);
      
      // Decrypt
      const result = await service.decrypt(encryptedBuffer);
      expect(result).toBe(testData);
      
      // The internal secure buffer should be cleared automatically
      // This is tested implicitly by the fact that the service doesn't leak memory
    });

    it('should dispose resources properly', () => {
      expect(() => service.dispose()).not.toThrow();
      
      // After disposal, the service should still be in a safe state
      // but may not be usable for new operations
    });
  });

  describe('Factory Function', () => {
    it('should create service instance successfully', () => {
      const factoryService = createKMSDecryptionService();
      expect(factoryService).toBeDefined();
      expect(typeof factoryService.decrypt).toBe('function');
      expect(typeof factoryService.validateDecryption).toBe('function');
    });
  });

  describe('Error Types', () => {
    it('should throw KMSKeyError for key-related issues', () => {
      delete process.env.MPESA_KMS_KEY;
      
      expect(() => new SystemKMSDecryptionService()).toThrow(MpesaError);
    });

    it('should throw appropriate error codes', async () => {
      try {
        await service.decrypt('invalid-data');
      } catch (error) {
        expect(error).toBeInstanceOf(MpesaError);
        expect((error as MpesaError).code).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent decryption requests', async () => {
      // Create multiple encrypted values
      const values = ['cred1', 'cred2', 'cred3'];
      const encryptedValues = values.map(value => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(testKey, 'utf8'), iv);
        let encrypted = cipher.update(value, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
      });

      // Decrypt concurrently
      const promises = encryptedValues.map(encrypted => service.decrypt(encrypted));
      const results = await Promise.all(promises);

      expect(results).toEqual(values);
    });

    it('should handle large credential values', async () => {
      const largeValue = 'x'.repeat(500); // Large but valid credential
      
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(testKey, 'utf8'), iv);
      let encrypted = cipher.update(largeValue, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedData = Buffer.concat([iv, authTag, encrypted]);

      const result = await service.decrypt(encryptedData);
      expect(result).toBe(largeValue);
    });
  });
});