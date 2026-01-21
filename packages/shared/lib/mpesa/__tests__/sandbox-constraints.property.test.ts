/**
 * Property-Based Tests for Sandbox Testing Constraints
 * **Property 18: Sandbox Testing Constraints**
 * **Validates: Requirements 8.6**
 * 
 * These tests verify that sandbox testing utilities enforce proper constraints
 * and validation rules for the M-PESA sandbox environment.
 */

import fc from 'fast-check';
import {
  sandboxTestDataGenerator,
  mockCallbackGenerator,
  sandboxValidator,
  sandboxScenarioGenerator,
  SANDBOX_TEST_PHONE_NUMBERS,
  SANDBOX_AMOUNT_CONSTRAINTS,
  SANDBOX_BUSINESS_SHORTCODES
} from '../testing/sandbox-utilities';
import { STKPushRequest } from '../types';

describe('Property 18: Sandbox Testing Constraints', () => {
  describe('Phone Number Constraint Properties', () => {
    it('should only accept approved sandbox phone numbers', () => {
      fc.assert(fc.property(
        fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
        (approvedPhone) => {
          const validation = sandboxValidator.validateSandboxPhoneNumber(approvedPhone);
          expect(validation.isValid).toBe(true);
          expect(validation.error).toBeUndefined();
        }
      ), { numRuns: 10 });
    });

    it('should reject non-approved phone numbers', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 12, maxLength: 12 }).filter(s => 
          s.startsWith('254') && 
          !SANDBOX_TEST_PHONE_NUMBERS.includes(s as any) &&
          !s.startsWith('254711') // Exclude valid test pattern
        ),
        (invalidPhone) => {
          const validation = sandboxValidator.validateSandboxPhoneNumber(invalidPhone);
          expect(validation.isValid).toBe(false);
          expect(validation.error).toContain('not approved for sandbox testing');
        }
      ), { numRuns: 50 });
    });

    it('should accept 254711 pattern phone numbers', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 999999 }).map(n => `254711${n.toString().padStart(6, '0')}`),
        (testPatternPhone) => {
          const validation = sandboxValidator.validateSandboxPhoneNumber(testPatternPhone);
          expect(validation.isValid).toBe(true);
        }
      ), { numRuns: 10 });
    });

    it('should handle phone number formatting consistently', () => {
      fc.assert(fc.property(
        fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
        fc.constantFrom(' ', '-', '(', ')', ''),
        fc.constantFrom(' ', '-', '(', ')', ''),
        (phone, prefix, suffix) => {
          const formattedPhone = `${prefix}${phone}${suffix}`;
          const validation = sandboxValidator.validateSandboxPhoneNumber(formattedPhone);
          expect(validation.isValid).toBe(true);
        }
      ), { numRuns: 10 });
    });
  });

  describe('Amount Constraint Properties', () => {
    it('should accept amounts within sandbox limits', () => {
      fc.assert(fc.property(
        fc.integer({ 
          min: SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT, 
          max: SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT 
        }),
        (validAmount) => {
          const validation = sandboxValidator.validateSandboxAmount(validAmount);
          expect(validation.isValid).toBe(true);
          expect(validation.error).toBeUndefined();
        }
      ), { numRuns: 10 });
    });

    it('should reject amounts below minimum', () => {
      fc.assert(fc.property(
        fc.integer({ min: -1000, max: SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT - 1 }),
        (belowMinAmount) => {
          const validation = sandboxValidator.validateSandboxAmount(belowMinAmount);
          expect(validation.isValid).toBe(false);
          expect(validation.error).toContain('below minimum');
        }
      ), { numRuns: 50 });
    });

    it('should reject amounts above maximum', () => {
      fc.assert(fc.property(
        fc.integer({ min: SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT + 1, max: 10000 }),
        (aboveMaxAmount) => {
          const validation = sandboxValidator.validateSandboxAmount(aboveMaxAmount);
          expect(validation.isValid).toBe(false);
          expect(validation.error).toContain('exceeds sandbox maximum');
        }
      ), { numRuns: 50 });
    });

    it('should generate amounts within constraints', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 1000 }), // Arbitrary iterations
        (_) => {
          const generatedAmount = sandboxTestDataGenerator.generateTestAmount();
          expect(generatedAmount).toBeGreaterThanOrEqual(SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT);
          expect(generatedAmount).toBeLessThanOrEqual(SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT);
          expect(SANDBOX_AMOUNT_CONSTRAINTS.RECOMMENDED_TEST_AMOUNTS).toContain(generatedAmount);
        }
      ), { numRuns: 10 });
    });
  });

  describe('Business Shortcode Constraint Properties', () => {
    it('should accept approved sandbox shortcodes', () => {
      fc.assert(fc.property(
        fc.constantFrom(...Object.values(SANDBOX_BUSINESS_SHORTCODES)),
        (approvedShortcode) => {
          const validation = sandboxValidator.validateSandboxBusinessShortcode(approvedShortcode);
          expect(validation.isValid).toBe(true);
          expect(validation.error).toBeUndefined();
        }
      ), { numRuns: 10 });
    });

    it('should reject non-approved shortcodes', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 6, maxLength: 6 }).filter(s => 
          /^\d+$/.test(s) && 
          !(Object.values(SANDBOX_BUSINESS_SHORTCODES) as string[]).includes(s)
        ),
        (invalidShortcode) => {
          const validation = sandboxValidator.validateSandboxBusinessShortcode(invalidShortcode);
          expect(validation.isValid).toBe(false);
          expect(validation.error).toContain('not approved for sandbox');
        }
      ), { numRuns: 50 });
    });
  });

  describe('STK Push Request Constraint Properties', () => {
    it('should validate complete requests with all constraints', () => {
      fc.assert(fc.property(
        fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
        fc.integer({ 
          min: SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT, 
          max: SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT 
        }),
        fc.constantFrom(...Object.values(SANDBOX_BUSINESS_SHORTCODES)),
        fc.constantFrom('https://example.com/callback', 'https://test.com/mpesa'),
        (phone, amount, shortcode, callbackUrl) => {
          const request: STKPushRequest = {
            BusinessShortCode: shortcode,
            Password: sandboxTestDataGenerator.generateTestPassword(shortcode, 'test', '20240101120000'),
            Timestamp: '20240101120000',
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: callbackUrl,
            AccountReference: 'TEST123',
            TransactionDesc: 'Test Payment'
          };

          const validation = sandboxValidator.validateSandboxSTKPushRequest(request);
          expect(validation.isValid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }
      ), { numRuns: 10 });
    });

    it('should reject requests with HTTP callback URLs', () => {
      fc.assert(fc.property(
        fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
        fc.integer({ 
          min: SANDBOX_AMOUNT_CONSTRAINTS.MIN_AMOUNT, 
          max: SANDBOX_AMOUNT_CONSTRAINTS.MAX_AMOUNT 
        }),
        fc.constantFrom(...Object.values(SANDBOX_BUSINESS_SHORTCODES)),
        fc.string().filter(s => s.startsWith('http://') && s.length > 7),
        (phone, amount, shortcode, httpCallbackUrl) => {
          const request: STKPushRequest = {
            BusinessShortCode: shortcode,
            Password: sandboxTestDataGenerator.generateTestPassword(shortcode, 'test', '20240101120000'),
            Timestamp: '20240101120000',
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: httpCallbackUrl,
            AccountReference: 'TEST123',
            TransactionDesc: 'Test Payment'
          };

          const validation = sandboxValidator.validateSandboxSTKPushRequest(request);
          expect(validation.isValid).toBe(false);
          expect(validation.errors).toContain('Callback URL should use HTTPS even in sandbox environment');
        }
      ), { numRuns: 50 });
    });

    it('should accumulate multiple validation errors', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 12, maxLength: 12 }).filter(s => 
          !SANDBOX_TEST_PHONE_NUMBERS.includes(s as any) && 
          !s.startsWith('254711')
        ),
        fc.integer({ min: 2000, max: 10000 }),
        fc.string({ minLength: 6, maxLength: 6 }).filter(s => 
          /^\d+$/.test(s) && 
          !(Object.values(SANDBOX_BUSINESS_SHORTCODES) as string[]).includes(s)
        ),
        (invalidPhone, invalidAmount, invalidShortcode) => {
          const request: STKPushRequest = {
            BusinessShortCode: invalidShortcode,
            Password: 'test',
            Timestamp: '20240101120000',
            TransactionType: 'CustomerPayBillOnline',
            Amount: invalidAmount,
            PartyA: invalidPhone,
            PartyB: invalidShortcode,
            PhoneNumber: invalidPhone,
            CallBackURL: 'http://example.com/callback',
            AccountReference: 'TEST123',
            TransactionDesc: 'Test Payment'
          };

          const validation = sandboxValidator.validateSandboxSTKPushRequest(request);
          expect(validation.isValid).toBe(false);
          expect(validation.errors.length).toBeGreaterThanOrEqual(3); // Phone, amount, shortcode, and HTTP URL
        }
      ), { numRuns: 50 });
    });
  });

  describe('Environment Constraint Properties', () => {
    it('should only accept sandbox environment', () => {
      const sandboxValidation = sandboxValidator.validateSandboxEnvironment('sandbox');
      expect(sandboxValidation.isValid).toBe(true);
      expect(sandboxValidation.error).toBeUndefined();
    });

    it('should reject production environment', () => {
      const productionValidation = sandboxValidator.validateSandboxEnvironment('production');
      expect(productionValidation.isValid).toBe(false);
      expect(productionValidation.error).toContain('Environment must be set to "sandbox"');
    });
  });

  describe('Data Generation Constraint Properties', () => {
    it('should generate phone numbers within approved set', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (_) => {
          const generatedPhone = sandboxTestDataGenerator.generateTestPhoneNumber();
          expect(SANDBOX_TEST_PHONE_NUMBERS).toContain(generatedPhone as any);
        }
      ), { numRuns: 10 });
    });

    it('should generate valid STK Push requests that pass validation', () => {
      fc.assert(fc.property(
        fc.record({
          phoneNumber: fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
          amount: fc.constantFrom(...SANDBOX_AMOUNT_CONSTRAINTS.RECOMMENDED_TEST_AMOUNTS),
          shortcode: fc.constantFrom(...Object.values(SANDBOX_BUSINESS_SHORTCODES))
        }),
        (overrides) => {
          const request = sandboxTestDataGenerator.generateTestSTKPushRequest({
            PhoneNumber: overrides.phoneNumber,
            PartyA: overrides.phoneNumber,
            Amount: overrides.amount,
            BusinessShortCode: overrides.shortcode,
            PartyB: overrides.shortcode
          });

          const validation = sandboxValidator.validateSandboxSTKPushRequest(request);
          expect(validation.isValid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }
      ), { numRuns: 10 });
    });

    it('should generate unique identifiers consistently', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        (iterations) => {
          const checkoutIds = new Set<string>();
          const merchantIds = new Set<string>();
          const receiptNumbers = new Set<string>();

          for (let i = 0; i < iterations; i++) {
            const checkoutId = sandboxTestDataGenerator.generateCheckoutRequestId();
            const merchantId = sandboxTestDataGenerator.generateMerchantRequestId();
            const receiptNumber = sandboxTestDataGenerator.generateReceiptNumber();

            // Should be unique
            expect(checkoutIds.has(checkoutId)).toBe(false);
            expect(merchantIds.has(merchantId)).toBe(false);
            expect(receiptNumbers.has(receiptNumber)).toBe(false);

            checkoutIds.add(checkoutId);
            merchantIds.add(merchantId);
            receiptNumbers.add(receiptNumber);

            // Should match expected formats
            expect(checkoutId).toMatch(/^ws_CO_\d+_[a-z0-9]+$/);
            expect(merchantId).toMatch(/^[a-z0-9\-]+$/);
            expect(receiptNumber).toMatch(/^[A-Z0-9]+$/);
          }
        }
      ), { numRuns: 20 });
    });

    it('should generate timestamps in correct format', () => {
      fc.assert(fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (testDate) => {
          const timestamp = sandboxTestDataGenerator.generateTimestamp(testDate);
          
          // Should be 14 digits
          expect(timestamp).toMatch(/^\d{14}$/);
          
          // Should represent the input date
          const year = testDate.getFullYear().toString();
          const month = (testDate.getMonth() + 1).toString().padStart(2, '0');
          const day = testDate.getDate().toString().padStart(2, '0');
          
          expect(timestamp.substring(0, 4)).toBe(year);
          expect(timestamp.substring(4, 6)).toBe(month);
          expect(timestamp.substring(6, 8)).toBe(day);
        }
      ), { numRuns: 10 });
    });

    it('should generate passwords that decode correctly', () => {
      fc.assert(fc.property(
        fc.constantFrom(...Object.values(SANDBOX_BUSINESS_SHORTCODES)),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 14, maxLength: 14 }).filter(s => /^\d{14}$/.test(s)),
        (shortcode, passkey, timestamp) => {
          const password = sandboxTestDataGenerator.generateTestPassword(shortcode, passkey, timestamp);
          
          // Should be valid base64
          expect(password).toMatch(/^[A-Za-z0-9+/]+=*$/);
          
          // Should decode to concatenated string
          const decoded = Buffer.from(password, 'base64').toString();
          expect(decoded).toBe(shortcode + passkey + timestamp);
        }
      ), { numRuns: 10 });
    });
  });

  describe('Callback Generation Constraint Properties', () => {
    it('should generate callbacks with consistent structure', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
        (checkoutRequestId, amount, phoneNumber) => {
          const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
            checkoutRequestId,
            amount,
            phoneNumber
          );

          // Verify structure
          expect(successCallback.Body).toBeDefined();
          expect(successCallback.Body.stkCallback).toBeDefined();
          expect(successCallback.Body.stkCallback.CheckoutRequestID).toBe(checkoutRequestId);
          expect(successCallback.Body.stkCallback.ResultCode).toBe(0);
          expect(successCallback.Body.stkCallback.CallbackMetadata).toBeDefined();

          // Verify metadata
          const metadata = successCallback.Body.stkCallback.CallbackMetadata!;
          expect(metadata.Item).toHaveLength(4);

          const amountItem = metadata.Item.find(item => item.Name === 'Amount');
          expect(amountItem?.Value).toBe(amount);

          const phoneItem = metadata.Item.find(item => item.Name === 'PhoneNumber');
          expect(phoneItem?.Value).toBe(parseInt(phoneNumber));
        }
      ), { numRuns: 10 });
    });

    it('should generate failure callbacks without metadata', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.integer({ min: 1, max: 9999 }).filter(n => n !== 0),
        fc.string({ minLength: 10, maxLength: 100 }),
        (checkoutRequestId, resultCode, resultDesc) => {
          const failureCallback = mockCallbackGenerator.generateFailedCallback(
            checkoutRequestId,
            resultCode,
            resultDesc
          );

          expect(failureCallback.Body.stkCallback.CheckoutRequestID).toBe(checkoutRequestId);
          expect(failureCallback.Body.stkCallback.ResultCode).toBe(resultCode);
          expect(failureCallback.Body.stkCallback.ResultDesc).toBe(resultDesc);
          expect(failureCallback.Body.stkCallback.CallbackMetadata).toBeUndefined();
        }
      ), { numRuns: 10 });
    });

    it('should respect success probability in random callbacks', () => {
      fc.assert(fc.property(
        fc.float({ min: 0.1, max: 0.9 }),
        fc.string({ minLength: 10, maxLength: 30 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom(...SANDBOX_TEST_PHONE_NUMBERS),
        (successProbability, checkoutRequestId, amount, phoneNumber) => {
          const sampleSize = 100;
          let successCount = 0;

          for (let i = 0; i < sampleSize; i++) {
            const callback = mockCallbackGenerator.generateRandomCallback(
              `${checkoutRequestId}_${i}`,
              amount,
              phoneNumber,
              successProbability
            );

            if (callback.Body.stkCallback.ResultCode === 0) {
              successCount++;
            }
          }

          const actualSuccessRate = successCount / sampleSize;
          
          // Allow 20% variance from expected probability
          const tolerance = 0.2;
          expect(actualSuccessRate).toBeGreaterThan(successProbability - tolerance);
          expect(actualSuccessRate).toBeLessThan(successProbability + tolerance);
        }
      ), { numRuns: 10 }); // Fewer runs due to nested loops
    });
  });

  describe('Scenario Generation Constraint Properties', () => {
    it('should generate scenarios with correct callback types', () => {
      fc.assert(fc.property(
        fc.constantFrom('success' as const, 'failure' as const, 'timeout' as const, 'random' as const),
        (scenarioType) => {
          const scenario = sandboxScenarioGenerator.generateTestScenario(scenarioType);
          
          expect(scenario.scenario).toBe(scenarioType);
          expect(scenario.request).toBeDefined();
          expect(scenario.expectedCallback).toBeDefined();

          // Verify request is valid
          const validation = sandboxValidator.validateSandboxSTKPushRequest(scenario.request);
          expect(validation.isValid).toBe(true);

          // Verify callback matches scenario type (except random)
          if (scenarioType === 'success') {
            expect(scenario.expectedCallback.Body.stkCallback.ResultCode).toBe(0);
          } else if (scenarioType === 'failure') {
            expect(scenario.expectedCallback.Body.stkCallback.ResultCode).toBe(1032);
          } else if (scenarioType === 'timeout') {
            expect(scenario.expectedCallback.Body.stkCallback.ResultCode).toBe(1037);
          }
        }
      ), { numRuns: 10 });
    });

    it('should generate test suites with specified count and variety', () => {
      fc.assert(fc.property(
        fc.integer({ min: 4, max: 20 }),
        (suiteSize) => {
          const testSuite = sandboxScenarioGenerator.generateTestSuite(suiteSize);
          
          expect(testSuite).toHaveLength(suiteSize);
          
          // Should have variety of scenario types
          const scenarioTypes = testSuite.map(s => s.scenario);
          const uniqueTypes = new Set(scenarioTypes);
          
          if (suiteSize >= 4) {
            expect(uniqueTypes.size).toBeGreaterThanOrEqual(2); // At least 2 different types
          }
          
          // All scenarios should be valid
          testSuite.forEach(scenario => {
            const validation = sandboxValidator.validateSandboxSTKPushRequest(scenario.request);
            expect(validation.isValid).toBe(true);
          });
        }
      ), { numRuns: 20 });
    });
  });
});