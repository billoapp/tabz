/**
 * Integration test for KMSDecryptionService with existing encryption service
 * Verifies that the new service can decrypt data encrypted by the existing service
 */

import { SystemKMSDecryptionService } from '../services/kms-decryption';
import { encryptCredential } from '../services/encryption';

describe('KMS Integration Tests', () => {
  let kmsService: SystemKMSDecryptionService;
  const originalEnv = process.env.MPESA_KMS_KEY;
  const testKey = 'test-key-32-bytes-long-for-aes!'; // Exactly 32 bytes

  beforeEach(() => {
    process.env.MPESA_KMS_KEY = testKey;
    kmsService = new SystemKMSDecryptionService();
  });

  afterEach(() => {
    if (kmsService && typeof kmsService.dispose === 'function') {
      kmsService.dispose();
    }
    
    if (originalEnv) {
      process.env.MPESA_KMS_KEY = originalEnv;
    } else {
      delete process.env.MPESA_KMS_KEY;
    }
  });

  it('should decrypt data encrypted by the existing encryption service', async () => {
    const testCredential = 'test-consumer-key-12345';
    
    // Encrypt using existing service
    const encryptedBuffer = encryptCredential(testCredential);
    
    // Decrypt using new KMS service
    const decryptedValue = await kmsService.decrypt(encryptedBuffer);
    
    expect(decryptedValue).toBe(testCredential);
  });

  it('should handle various credential types', async () => {
    const testCredentials = [
      'CONSUMER_KEY_ABC123',
      'consumer-secret-xyz789',
      'business-shortcode-123456',
      'passkey-with-special-chars!@#$%',
      'https://callback.example.com/webhook'
    ];

    for (const credential of testCredentials) {
      const encrypted = encryptCredential(credential);
      const decrypted = await kmsService.decrypt(encrypted);
      expect(decrypted).toBe(credential);
    }
  });

  it('should validate decrypted credential formats', async () => {
    const validCredentials = [
      'valid-key-123',
      'ANOTHER_VALID_KEY',
      'mixed-Case-Key-456'
    ];

    const invalidCredentials = [
      '', // Empty
      'a', // Too short
      'key-with-null\x00byte'
    ];

    // Test valid credentials
    for (const credential of validCredentials) {
      const encrypted = encryptCredential(credential);
      const decrypted = await kmsService.decrypt(encrypted);
      expect(kmsService.validateDecryption(decrypted)).toBe(true);
    }

    // Test validation of invalid patterns (without encryption)
    for (const credential of invalidCredentials) {
      expect(kmsService.validateDecryption(credential)).toBe(false);
    }
  });
});