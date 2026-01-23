/**
 * Property-based tests for M-PESA credential encryption round-trip
 * Feature: mpesa-tenant-credentials-fix, Property 2: Credential Encryption Round-Trip
 * 
 * **Validates: Requirements 2.1, 2.2**
 * 
 * Tests that for any valid M-Pesa credentials, when stored in encrypted format 
 * and later retrieved, the decryption process using the system KMS key should 
 * produce the original credential values.
 */

import * as fc from 'fast-check';
import { SystemKMSDecryptionService } from '../services/kms-decryption';
import { encryptCredential } from '../services/encryption';
import { MpesaCredentials, MpesaEnvironment } from '../types';

describe('Property 2: Credential Encryption Round-Trip', () => {
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

  /**
   * Property 2: Credential Encryption Round-Trip
   * For any valid M-Pesa credentials, when stored in encrypted format and later retrieved,
   * the decryption process using the system KMS key should produce the original credential values
   */
  it('should preserve credential data through encryption-decryption cycle for any valid M-Pesa credentials', () => {
    fc.assert(
      fc.property(
        // Generate valid M-Pesa credential strings
        fc.record({
          consumerKey: fc.string({ 
            minLength: 10, 
            maxLength: 100,
            // Generate realistic M-Pesa consumer keys
          }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9\-_\.]+$/.test(s)),
          
          consumerSecret: fc.string({ 
            minLength: 10, 
            maxLength: 100,
            // Generate realistic M-Pesa consumer secrets
          }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9\-_\.]+$/.test(s)),
          
          businessShortCode: fc.stringMatching(/^\d{5,7}$/), // 5-7 digits for M-Pesa shortcodes
          
          passkey: fc.string({ 
            minLength: 20, 
            maxLength: 200,
            // Generate realistic M-Pesa passkeys
          }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9\-_\.]+$/.test(s)),
          
          environment: fc.constantFrom('sandbox' as MpesaEnvironment, 'production' as MpesaEnvironment),
          
          callbackUrl: fc.oneof(
            fc.constant('https://api.example.com/mpesa/callback'),
            fc.constant('https://secure.example.com/payments/mpesa/webhook'),
            fc.constant('https://app.example.com/api/v1/mpesa/callback'),
            fc.webUrl({ validSchemes: ['https'] })
          ),
          
          timeoutUrl: fc.option(fc.oneof(
            fc.constant('https://api.example.com/mpesa/timeout'),
            fc.constant('https://secure.example.com/payments/mpesa/timeout'),
            fc.webUrl({ validSchemes: ['https'] })
          )),
          
          encryptedAt: fc.date({ 
            min: new Date('2020-01-01'), 
            max: new Date('2030-12-31') 
          }),
          
          lastValidated: fc.option(fc.date({ 
            min: new Date('2020-01-01'), 
            max: new Date('2030-12-31') 
          }))
        }),
        async (credentialData) => {
          const originalCredentials: MpesaCredentials = credentialData;

          // Test encryption-decryption round-trip for each credential field
          const testFields = [
            { name: 'consumerKey', value: originalCredentials.consumerKey },
            { name: 'consumerSecret', value: originalCredentials.consumerSecret },
            { name: 'businessShortCode', value: originalCredentials.businessShortCode },
            { name: 'passkey', value: originalCredentials.passkey }
          ];

          for (const field of testFields) {
            // Encrypt the credential field
            const encryptedBuffer = encryptCredential(field.value);
            
            // Verify encrypted data is different from original
            expect(encryptedBuffer.toString()).not.toBe(field.value);
            expect(encryptedBuffer.toString('base64')).not.toBe(field.value);
            
            // Verify encrypted data is not empty and has proper structure
            expect(encryptedBuffer.length).toBeGreaterThan(28); // IV (12) + AuthTag (16) + data
            
            // Decrypt using KMS service
            const decryptedValue = await kmsService.decrypt(encryptedBuffer);
            
            // Verify decrypted value matches original exactly
            expect(decryptedValue).toBe(field.value);
            
            // Verify validation passes for decrypted value
            expect(kmsService.validateDecryption(decryptedValue)).toBe(true);
          }

          // Test complete credential object round-trip simulation
          const encryptedCredentials = {
            consumer_key_enc: encryptCredential(originalCredentials.consumerKey),
            consumer_secret_enc: encryptCredential(originalCredentials.consumerSecret),
            business_shortcode_enc: encryptCredential(originalCredentials.businessShortCode),
            passkey_enc: encryptCredential(originalCredentials.passkey),
            // Non-encrypted metadata
            callback_url: originalCredentials.callbackUrl,
            timeout_url: originalCredentials.timeoutUrl,
            environment: originalCredentials.environment,
            encrypted_at: originalCredentials.encryptedAt,
            last_validated: originalCredentials.lastValidated
          };

          // Decrypt all fields to reconstruct credentials
          const reconstructedCredentials: MpesaCredentials = {
            consumerKey: await kmsService.decrypt(encryptedCredentials.consumer_key_enc),
            consumerSecret: await kmsService.decrypt(encryptedCredentials.consumer_secret_enc),
            businessShortCode: await kmsService.decrypt(encryptedCredentials.business_shortcode_enc),
            passkey: await kmsService.decrypt(encryptedCredentials.passkey_enc),
            callbackUrl: encryptedCredentials.callback_url,
            timeoutUrl: encryptedCredentials.timeout_url,
            environment: encryptedCredentials.environment,
            encryptedAt: encryptedCredentials.encrypted_at,
            lastValidated: encryptedCredentials.last_validated
          };

          // Verify complete credential object is preserved exactly
          expect(reconstructedCredentials).toEqual(originalCredentials);
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as specified in design
    );
  });

  /**
   * Property 2 Edge Cases: Handle edge cases in credential encryption round-trip
   */
  it('should handle edge cases in credential values without data loss', () => {
    fc.assert(
      fc.property(
        // Generate edge case credential values
        fc.oneof(
          // Minimum length values
          fc.record({
            consumerKey: fc.string({ minLength: 10, maxLength: 10 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
            consumerSecret: fc.string({ minLength: 10, maxLength: 10 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
            businessShortCode: fc.constant('12345'), // Minimum 5 digits
            passkey: fc.string({ minLength: 20, maxLength: 20 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s))
          }),
          // Maximum length values
          fc.record({
            consumerKey: fc.string({ minLength: 100, maxLength: 100 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
            consumerSecret: fc.string({ minLength: 100, maxLength: 100 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
            businessShortCode: fc.constant('1234567'), // Maximum 7 digits
            passkey: fc.string({ minLength: 200, maxLength: 200 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s))
          }),
          // Special character patterns
          fc.record({
            consumerKey: fc.stringMatching(/^[a-zA-Z0-9\-_\.]{15,50}$/),
            consumerSecret: fc.stringMatching(/^[a-zA-Z0-9\-_\.]{15,50}$/),
            businessShortCode: fc.stringMatching(/^[1-9]\d{4,6}$/), // No leading zeros
            passkey: fc.stringMatching(/^[a-zA-Z0-9\-_\.]{25,100}$/)
          })
        ),
        async (credentialFields) => {
          // Test multiple encryption-decryption cycles for stability
          let currentValues = credentialFields;
          
          for (let cycle = 0; cycle < 3; cycle++) {
            // Encrypt all fields
            const encrypted = {
              consumerKey: encryptCredential(currentValues.consumerKey),
              consumerSecret: encryptCredential(currentValues.consumerSecret),
              businessShortCode: encryptCredential(currentValues.businessShortCode),
              passkey: encryptCredential(currentValues.passkey)
            };
            
            // Decrypt all fields
            const decrypted = {
              consumerKey: await kmsService.decrypt(encrypted.consumerKey),
              consumerSecret: await kmsService.decrypt(encrypted.consumerSecret),
              businessShortCode: await kmsService.decrypt(encrypted.businessShortCode),
              passkey: await kmsService.decrypt(encrypted.passkey)
            };
            
            // Verify data integrity after each cycle
            expect(decrypted).toEqual(credentialFields);
            currentValues = decrypted;
          }
          
          // Final verification that data is still intact
          expect(currentValues).toEqual(credentialFields);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2 Security: Verify encryption provides security properties
   */
  it('should maintain security properties during credential encryption', () => {
    fc.assert(
      fc.property(
        fc.record({
          consumerKey: fc.string({ minLength: 20, maxLength: 80 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
          consumerSecret: fc.string({ minLength: 20, maxLength: 80 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
          passkey: fc.string({ minLength: 30, maxLength: 150 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s))
        }),
        async (credentials) => {
          // Encrypt each credential
          const encryptedKey = encryptCredential(credentials.consumerKey);
          const encryptedSecret = encryptCredential(credentials.consumerSecret);
          const encryptedPasskey = encryptCredential(credentials.passkey);

          // Verify encrypted data doesn't contain plaintext
          const keyStr = encryptedKey.toString();
          const secretStr = encryptedSecret.toString();
          const passkeyStr = encryptedPasskey.toString();
          
          expect(keyStr).not.toContain(credentials.consumerKey);
          expect(secretStr).not.toContain(credentials.consumerSecret);
          expect(passkeyStr).not.toContain(credentials.passkey);

          // Verify encrypted data is larger than original (includes IV + AuthTag + encrypted data)
          expect(encryptedKey.length).toBeGreaterThan(credentials.consumerKey.length);
          expect(encryptedSecret.length).toBeGreaterThan(credentials.consumerSecret.length);
          expect(encryptedPasskey.length).toBeGreaterThan(credentials.passkey.length);

          // Verify encrypted data has proper AES-256-GCM structure
          expect(encryptedKey.length).toBeGreaterThanOrEqual(28 + credentials.consumerKey.length);
          expect(encryptedSecret.length).toBeGreaterThanOrEqual(28 + credentials.consumerSecret.length);
          expect(encryptedPasskey.length).toBeGreaterThanOrEqual(28 + credentials.passkey.length);

          // Verify decryption works correctly
          const decryptedKey = await kmsService.decrypt(encryptedKey);
          const decryptedSecret = await kmsService.decrypt(encryptedSecret);
          const decryptedPasskey = await kmsService.decrypt(encryptedPasskey);

          expect(decryptedKey).toBe(credentials.consumerKey);
          expect(decryptedSecret).toBe(credentials.consumerSecret);
          expect(decryptedPasskey).toBe(credentials.passkey);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 Concurrent Operations: Handle concurrent encryption/decryption
   */
  it('should handle concurrent encryption-decryption operations without data corruption', () => {
    fc.assert(
      fc.property(
        // Generate multiple credential sets for concurrent testing
        fc.array(
          fc.record({
            consumerKey: fc.string({ minLength: 15, maxLength: 60 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
            consumerSecret: fc.string({ minLength: 15, maxLength: 60 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s)),
            passkey: fc.string({ minLength: 25, maxLength: 120 }).filter(s => /^[a-zA-Z0-9\-_\.]+$/.test(s))
          }),
          { minLength: 2, maxLength: 8 }
        ),
        async (credentialSets) => {
          // Process all credential sets concurrently
          const promises = credentialSets.map(async (credentials) => {
            // Encrypt
            const encrypted = {
              consumerKey: encryptCredential(credentials.consumerKey),
              consumerSecret: encryptCredential(credentials.consumerSecret),
              passkey: encryptCredential(credentials.passkey)
            };
            
            // Decrypt
            const decrypted = {
              consumerKey: await kmsService.decrypt(encrypted.consumerKey),
              consumerSecret: await kmsService.decrypt(encrypted.consumerSecret),
              passkey: await kmsService.decrypt(encrypted.passkey)
            };
            
            return { original: credentials, decrypted };
          });

          const results = await Promise.all(promises);

          // Verify all operations completed successfully
          results.forEach(({ original, decrypted }, index) => {
            expect(decrypted).toEqual(original);
            
            // Verify no cross-contamination between different credential sets
            results.forEach(({ decrypted: otherDecrypted }, otherIndex) => {
              if (index !== otherIndex) {
                expect(decrypted.consumerKey).not.toBe(otherDecrypted.consumerKey);
                expect(decrypted.consumerSecret).not.toBe(otherDecrypted.consumerSecret);
                expect(decrypted.passkey).not.toBe(otherDecrypted.passkey);
              }
            });
          });
        }
      ),
      { numRuns: 30 } // Reduced runs for concurrent testing
    );
  });

  /**
   * Property 2 Base64 Encoding: Handle base64 encoded encrypted data
   */
  it('should handle base64 encoded encrypted data correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 15, maxLength: 100 }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9\-_\.]+$/.test(s)),
        async (credentialValue) => {
          // Encrypt credential
          const encryptedBuffer = encryptCredential(credentialValue);
          
          // Convert to base64 string (common database storage format)
          const base64Encrypted = encryptedBuffer.toString('base64');
          
          // Verify base64 string is different from original
          expect(base64Encrypted).not.toBe(credentialValue);
          expect(base64Encrypted.length).toBeGreaterThan(0);
          
          // Decrypt from base64 string
          const decryptedFromBase64 = await kmsService.decrypt(base64Encrypted);
          
          // Verify decryption from base64 produces original value
          expect(decryptedFromBase64).toBe(credentialValue);
          
          // Also verify decryption from buffer produces same result
          const decryptedFromBuffer = await kmsService.decrypt(encryptedBuffer);
          expect(decryptedFromBuffer).toBe(credentialValue);
          expect(decryptedFromBase64).toBe(decryptedFromBuffer);
        }
      ),
      { numRuns: 100 }
    );
  });
});