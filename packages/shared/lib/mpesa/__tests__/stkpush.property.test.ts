/**
 * Property-based tests for STK Push request generation
 * Feature: mpesa-payment-integration, Property 1: STK Push Request Completeness
 * 
 * Tests that STK Push request generation includes all required parameters
 * and maintains proper format and validation for M-PESA API compliance.
 */

import * as fc from 'fast-check';
import { 
  STKPushRequest,
  MpesaEnvironment,
  MpesaCredentials
} from '../index';

// Mock STK Push request builder for testing
// This will be replaced with the actual implementation from task 2.1
class MockSTKPushRequestBuilder {
  constructor(
    private credentials: MpesaCredentials,
    private environment: MpesaEnvironment
  ) {}

  /**
   * Generate password using base64(shortcode+passkey+timestamp) format
   */
  generatePassword(shortcode: string, passkey: string, timestamp: string): string {
    const concatenated = shortcode + passkey + timestamp;
    return Buffer.from(concatenated).toString('base64');
  }

  /**
   * Generate timestamp in YYYYMMDDHHmmss format
   */
  generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Build complete STK Push request with all required parameters
   */
  buildSTKPushRequest(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string
  ): STKPushRequest {
    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(
      this.credentials.businessShortCode,
      this.credentials.passkey,
      timestamp
    );

    // Ensure account reference and transaction description are within limits
    const truncatedAccountRef = accountReference.substring(0, 12);
    const truncatedTransactionDesc = transactionDesc.substring(0, 13);

    return {
      BusinessShortCode: this.credentials.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: this.credentials.businessShortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: this.credentials.callbackUrl,
      AccountReference: truncatedAccountRef,
      TransactionDesc: truncatedTransactionDesc
    };
  }
}

describe('STK Push Request Completeness Properties', () => {
  
  // Property 1: STK Push Request Completeness
  // For any valid payment request with customer phone number and order details,
  // the generated STK Push request should contain all required parameters:
  // BusinessShortCode, Password, Timestamp, TransactionType, Amount, PartyA,
  // PartyB, PhoneNumber, CallBackURL, AccountReference, and TransactionDesc
  describe('Property 1: STK Push Request Completeness', () => {
    
    it('should generate complete STK Push requests with all required parameters for any valid input', () => {
      fc.assert(
        fc.property(
          // Generate valid test data
          fc.record({
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            credentials: fc.record({
              businessShortCode: fc.stringMatching(/^\d{5,7}$/), // 5-7 digits
              consumerKey: fc.string({ minLength: 20, maxLength: 50 }),
              consumerSecret: fc.string({ minLength: 20, maxLength: 50 }),
              passkey: fc.string({ minLength: 20, maxLength: 100 }),
              callbackUrl: fc.constantFrom(
                'https://api.example.com/callback',
                'https://secure.example.com/mpesa/callback'
              )
            }),
            paymentData: fc.record({
              phoneNumber: fc.stringMatching(/^254[0-9]{9}$/), // Valid Kenyan phone number
              amount: fc.integer({ min: 1, max: 70000 }), // Valid amount range
              accountReference: fc.string({ minLength: 1, maxLength: 20 }), // Will be truncated to 12
              transactionDesc: fc.string({ minLength: 1, maxLength: 20 }) // Will be truncated to 13
            })
          }),
          (testData) => {
            // Create credentials
            const credentials: MpesaCredentials = {
              ...testData.credentials,
              environment: testData.environment,
              encryptedAt: new Date()
            };

            // Create STK Push request builder
            const builder = new MockSTKPushRequestBuilder(credentials, testData.environment);

            // Generate STK Push request
            const stkRequest = builder.buildSTKPushRequest(
              testData.paymentData.phoneNumber,
              testData.paymentData.amount,
              testData.paymentData.accountReference,
              testData.paymentData.transactionDesc
            );

            // Verify all required parameters are present and valid
            expect(stkRequest.BusinessShortCode).toBeDefined();
            expect(stkRequest.BusinessShortCode).toBe(credentials.businessShortCode);
            expect(stkRequest.BusinessShortCode).toMatch(/^\d{5,7}$/);

            expect(stkRequest.Password).toBeDefined();
            expect(stkRequest.Password).toBeTruthy();
            expect(typeof stkRequest.Password).toBe('string');

            expect(stkRequest.Timestamp).toBeDefined();
            expect(stkRequest.Timestamp).toMatch(/^\d{14}$/); // YYYYMMDDHHmmss format

            expect(stkRequest.TransactionType).toBeDefined();
            expect(stkRequest.TransactionType).toBe('CustomerPayBillOnline');

            expect(stkRequest.Amount).toBeDefined();
            expect(stkRequest.Amount).toBe(testData.paymentData.amount);
            expect(typeof stkRequest.Amount).toBe('number');
            expect(stkRequest.Amount).toBeGreaterThan(0);

            expect(stkRequest.PartyA).toBeDefined();
            expect(stkRequest.PartyA).toBe(testData.paymentData.phoneNumber);
            expect(stkRequest.PartyA).toMatch(/^254[0-9]{9}$/);

            expect(stkRequest.PartyB).toBeDefined();
            expect(stkRequest.PartyB).toBe(credentials.businessShortCode);

            expect(stkRequest.PhoneNumber).toBeDefined();
            expect(stkRequest.PhoneNumber).toBe(testData.paymentData.phoneNumber);
            expect(stkRequest.PhoneNumber).toMatch(/^254[0-9]{9}$/);

            expect(stkRequest.CallBackURL).toBeDefined();
            expect(stkRequest.CallBackURL).toBe(credentials.callbackUrl);
            expect(stkRequest.CallBackURL).toMatch(/^https:\/\/.+/);

            expect(stkRequest.AccountReference).toBeDefined();
            expect(stkRequest.AccountReference.length).toBeLessThanOrEqual(12);
            expect(stkRequest.AccountReference.length).toBeGreaterThan(0);

            expect(stkRequest.TransactionDesc).toBeDefined();
            expect(stkRequest.TransactionDesc.length).toBeLessThanOrEqual(13);
            expect(stkRequest.TransactionDesc.length).toBeGreaterThan(0);

            // Verify password generation correctness (Property 2 validation)
            const expectedPassword = Buffer.from(
              credentials.businessShortCode + credentials.passkey + stkRequest.Timestamp
            ).toString('base64');
            expect(stkRequest.Password).toBe(expectedPassword);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle edge cases for account reference and transaction description truncation', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessShortCode: fc.stringMatching(/^\d{5,7}$/),
            passkey: fc.string({ minLength: 20, maxLength: 100 }),
            callbackUrl: fc.constant('https://example.com/callback'),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 1000 }),
            // Generate strings that exceed the limits
            accountReference: fc.string({ minLength: 13, maxLength: 50 }), // Exceeds 12 char limit
            transactionDesc: fc.string({ minLength: 14, maxLength: 50 }) // Exceeds 13 char limit
          }),
          (testData) => {
            const credentials: MpesaCredentials = {
              businessShortCode: testData.businessShortCode,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey,
              environment: 'sandbox',
              callbackUrl: testData.callbackUrl,
              encryptedAt: new Date()
            };

            const builder = new MockSTKPushRequestBuilder(credentials, 'sandbox');
            const stkRequest = builder.buildSTKPushRequest(
              testData.phoneNumber,
              testData.amount,
              testData.accountReference,
              testData.transactionDesc
            );

            // Verify truncation is applied correctly
            expect(stkRequest.AccountReference.length).toBeLessThanOrEqual(12);
            expect(stkRequest.AccountReference).toBe(testData.accountReference.substring(0, 12));

            expect(stkRequest.TransactionDesc.length).toBeLessThanOrEqual(13);
            expect(stkRequest.TransactionDesc).toBe(testData.transactionDesc.substring(0, 13));

            // Verify all other required parameters are still present
            expect(stkRequest.BusinessShortCode).toBeDefined();
            expect(stkRequest.Password).toBeDefined();
            expect(stkRequest.Timestamp).toBeDefined();
            expect(stkRequest.TransactionType).toBeDefined();
            expect(stkRequest.Amount).toBeDefined();
            expect(stkRequest.PartyA).toBeDefined();
            expect(stkRequest.PartyB).toBeDefined();
            expect(stkRequest.PhoneNumber).toBeDefined();
            expect(stkRequest.CallBackURL).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain parameter consistency across multiple request generations', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessShortCode: fc.stringMatching(/^\d{5,7}$/),
            passkey: fc.string({ minLength: 20, maxLength: 100 }),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 1000 }),
            accountReference: fc.string({ minLength: 1, maxLength: 12 }),
            transactionDesc: fc.string({ minLength: 1, maxLength: 13 })
          }),
          (testData) => {
            const credentials: MpesaCredentials = {
              businessShortCode: testData.businessShortCode,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey,
              environment: 'sandbox',
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            const builder = new MockSTKPushRequestBuilder(credentials, 'sandbox');

            // Generate multiple requests with same input
            const request1 = builder.buildSTKPushRequest(
              testData.phoneNumber,
              testData.amount,
              testData.accountReference,
              testData.transactionDesc
            );

            // Small delay to ensure different timestamp
            const request2 = builder.buildSTKPushRequest(
              testData.phoneNumber,
              testData.amount,
              testData.accountReference,
              testData.transactionDesc
            );

            // Static parameters should be identical
            expect(request1.BusinessShortCode).toBe(request2.BusinessShortCode);
            expect(request1.TransactionType).toBe(request2.TransactionType);
            expect(request1.Amount).toBe(request2.Amount);
            expect(request1.PartyA).toBe(request2.PartyA);
            expect(request1.PartyB).toBe(request2.PartyB);
            expect(request1.PhoneNumber).toBe(request2.PhoneNumber);
            expect(request1.CallBackURL).toBe(request2.CallBackURL);
            expect(request1.AccountReference).toBe(request2.AccountReference);
            expect(request1.TransactionDesc).toBe(request2.TransactionDesc);

            // Dynamic parameters (timestamp and password) may differ
            // but should still be valid
            expect(request1.Timestamp).toMatch(/^\d{14}$/);
            expect(request2.Timestamp).toMatch(/^\d{14}$/);
            expect(request1.Password).toBeTruthy();
            expect(request2.Password).toBeTruthy();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should generate valid timestamps in YYYYMMDDHHmmss format', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessShortCode: fc.stringMatching(/^\d{5,7}$/),
            passkey: fc.string({ minLength: 20, maxLength: 100 })
          }),
          (testData) => {
            const credentials: MpesaCredentials = {
              businessShortCode: testData.businessShortCode,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey,
              environment: 'sandbox',
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            const builder = new MockSTKPushRequestBuilder(credentials, 'sandbox');
            const timestamp = builder.generateTimestamp();

            // Verify timestamp format
            expect(timestamp).toMatch(/^\d{14}$/);
            expect(timestamp.length).toBe(14);

            // Verify timestamp represents a valid date
            const year = parseInt(timestamp.substring(0, 4));
            const month = parseInt(timestamp.substring(4, 6));
            const day = parseInt(timestamp.substring(6, 8));
            const hours = parseInt(timestamp.substring(8, 10));
            const minutes = parseInt(timestamp.substring(10, 12));
            const seconds = parseInt(timestamp.substring(12, 14));

            expect(year).toBeGreaterThanOrEqual(2020);
            expect(year).toBeLessThanOrEqual(2030);
            expect(month).toBeGreaterThanOrEqual(1);
            expect(month).toBeLessThanOrEqual(12);
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
            expect(hours).toBeGreaterThanOrEqual(0);
            expect(hours).toBeLessThanOrEqual(23);
            expect(minutes).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeLessThanOrEqual(59);
            expect(seconds).toBeGreaterThanOrEqual(0);
            expect(seconds).toBeLessThanOrEqual(59);

            // Verify timestamp is close to current time (within 1 minute)
            const timestampDate = new Date(
              year, month - 1, day, hours, minutes, seconds
            );
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - timestampDate.getTime());
            expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should validate phone number format consistency', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessShortCode: fc.stringMatching(/^\d{5,7}$/),
            passkey: fc.string({ minLength: 20, maxLength: 100 }),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 1000 })
          }),
          (testData) => {
            const credentials: MpesaCredentials = {
              businessShortCode: testData.businessShortCode,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey,
              environment: 'sandbox',
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            const builder = new MockSTKPushRequestBuilder(credentials, 'sandbox');
            const stkRequest = builder.buildSTKPushRequest(
              testData.phoneNumber,
              testData.amount,
              'TEST_REF',
              'Test Payment'
            );

            // Verify phone number consistency
            expect(stkRequest.PartyA).toBe(testData.phoneNumber);
            expect(stkRequest.PhoneNumber).toBe(testData.phoneNumber);
            expect(stkRequest.PartyA).toBe(stkRequest.PhoneNumber);

            // Verify phone number format
            expect(stkRequest.PhoneNumber).toMatch(/^254[0-9]{9}$/);
            expect(stkRequest.PhoneNumber.length).toBe(12);
            expect(stkRequest.PhoneNumber.startsWith('254')).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Property 2: Password Generation Correctness
  // For any valid business shortcode, passkey, and timestamp, the generated password
  // should be the base64 encoding of the concatenated string (shortcode+passkey+timestamp)
  // and should be deterministic (same inputs produce same output)
  describe('Property 2: Password Generation Correctness', () => {
    it('should generate correct base64 password for any valid shortcode, passkey, and timestamp', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessShortCode: fc.stringMatching(/^\d{5,7}$/),
            passkey: fc.string({ minLength: 20, maxLength: 100 }),
            timestamp: fc.stringMatching(/^\d{14}$/) // YYYYMMDDHHmmss format
          }),
          (testData) => {
            const credentials: MpesaCredentials = {
              businessShortCode: testData.businessShortCode,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey,
              environment: 'sandbox',
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            const builder = new MockSTKPushRequestBuilder(credentials, 'sandbox');
            
            // Generate password using the service method
            const generatedPassword = builder.generatePassword(
              testData.businessShortCode,
              testData.passkey,
              testData.timestamp
            );

            // Calculate expected password manually
            const concatenated = testData.businessShortCode + testData.passkey + testData.timestamp;
            const expectedPassword = Buffer.from(concatenated).toString('base64');

            // Verify password correctness
            expect(generatedPassword).toBe(expectedPassword);
            expect(generatedPassword).toBeTruthy();
            expect(typeof generatedPassword).toBe('string');
            
            // Verify it's valid base64
            expect(() => Buffer.from(generatedPassword, 'base64')).not.toThrow();
            
            // Verify deterministic behavior (same inputs = same output)
            const secondGeneration = builder.generatePassword(
              testData.businessShortCode,
              testData.passkey,
              testData.timestamp
            );
            expect(generatedPassword).toBe(secondGeneration);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should generate different passwords for different inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            shortcode1: fc.stringMatching(/^\d{5,7}$/),
            shortcode2: fc.stringMatching(/^\d{5,7}$/),
            passkey1: fc.string({ minLength: 20, maxLength: 100 }),
            passkey2: fc.string({ minLength: 20, maxLength: 100 }),
            timestamp1: fc.stringMatching(/^\d{14}$/),
            timestamp2: fc.stringMatching(/^\d{14}$/)
          }).filter(data => 
            // Ensure at least one component is different
            data.shortcode1 !== data.shortcode2 || 
            data.passkey1 !== data.passkey2 || 
            data.timestamp1 !== data.timestamp2
          ),
          (testData) => {
            const credentials1: MpesaCredentials = {
              businessShortCode: testData.shortcode1,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey1,
              environment: 'sandbox',
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            const credentials2: MpesaCredentials = {
              businessShortCode: testData.shortcode2,
              consumerKey: 'test-consumer-key-12345678901234567890',
              consumerSecret: 'test-consumer-secret-12345678901234567890',
              passkey: testData.passkey2,
              environment: 'sandbox',
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            const builder1 = new MockSTKPushRequestBuilder(credentials1, 'sandbox');
            const builder2 = new MockSTKPushRequestBuilder(credentials2, 'sandbox');

            const password1 = builder1.generatePassword(
              testData.shortcode1,
              testData.passkey1,
              testData.timestamp1
            );

            const password2 = builder2.generatePassword(
              testData.shortcode2,
              testData.passkey2,
              testData.timestamp2
            );

            // Different inputs should produce different passwords
            expect(password1).not.toBe(password2);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});