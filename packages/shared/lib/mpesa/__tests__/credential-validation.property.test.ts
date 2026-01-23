/**
 * Property-based tests for M-Pesa credential validation
 * Tests universal properties that should hold across all valid inputs
 * 
 * **Validates: Requirements 3.5**
 */

import fc from 'fast-check';
import { 
  DatabaseCredentialRetrievalService
} from '../services/credential-retrieval';
import { MpesaCredentials, MpesaEnvironment } from '../types';

// Mock Supabase client for property testing
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn()
};

// Mock createClient to return our mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Credential Validation Property Tests', () => {
  let service: DatabaseCredentialRetrievalService;

  beforeEach(() => {
    service = new DatabaseCredentialRetrievalService('test-url', 'test-key');
    jest.clearAllMocks();
  });

  // Arbitraries for generating test data
  const environmentArbitrary = fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>;
  
  // Generate valid consumer keys (10-50 chars, alphanumeric)
  const validConsumerKeyArbitrary = fc.string({ minLength: 10, maxLength: 50 })
    .filter(s => /^[A-Za-z0-9]+$/.test(s));
  
  // Generate valid consumer secrets (10-50 chars, alphanumeric)
  const validConsumerSecretArbitrary = fc.string({ minLength: 10, maxLength: 50 })
    .filter(s => /^[A-Za-z0-9]+$/.test(s));
  
  // Generate valid business short codes (5-10 digits)
  const validBusinessShortCodeArbitrary = fc.string({ minLength: 5, maxLength: 10 })
    .filter(s => /^\d+$/.test(s));
  
  // Generate valid passkeys (20+ chars, base64-like)
  const validPasskeyArbitrary = fc.string({ minLength: 20, maxLength: 100 })
    .filter(s => /^[A-Za-z0-9+/=]+$/.test(s));
  
  // Generate valid HTTPS URLs
  const validHttpsUrlArbitrary = fc.webUrl({ validSchemes: ['https'] });
  
  // Generate valid HTTP URLs (for sandbox)
  const validHttpUrlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

  // Generate production business short codes (exactly 6 digits)
  const productionBusinessShortCodeArbitrary = fc.string({ minLength: 6, maxLength: 6 })
    .filter(s => /^\d{6}$/.test(s));

  // Generate sandbox business short codes (5-10 digits)
  const sandboxBusinessShortCodeArbitrary = fc.string({ minLength: 5, maxLength: 10 })
    .filter(s => /^\d{5,10}$/.test(s));

  // Generate valid production callback URLs (no localhost, test, staging, dev)
  const validProductionCallbackUrlArbitrary = fc.webUrl({ validSchemes: ['https'] })
    .filter(url => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return !hostname.includes('localhost') && 
               !hostname.includes('127.0.0.1') && 
               !hostname.includes('test') && 
               !hostname.includes('staging') && 
               !hostname.includes('dev');
      } catch {
        return false;
      }
    });

  // Generate completely valid credentials for any environment
  const validCredentialsArbitrary = fc.record({
    consumerKey: validConsumerKeyArbitrary,
    consumerSecret: validConsumerSecretArbitrary,
    businessShortCode: validBusinessShortCodeArbitrary,
    passkey: validPasskeyArbitrary,
    environment: environmentArbitrary,
    callbackUrl: validHttpsUrlArbitrary,
    timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
    encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
  });

  // Generate valid production credentials
  const validProductionCredentialsArbitrary = fc.record({
    consumerKey: validConsumerKeyArbitrary,
    consumerSecret: validConsumerSecretArbitrary,
    businessShortCode: productionBusinessShortCodeArbitrary,
    passkey: validPasskeyArbitrary,
    environment: fc.constant('production' as MpesaEnvironment),
    callbackUrl: validProductionCallbackUrlArbitrary,
    timeoutUrl: fc.option(validProductionCallbackUrlArbitrary, { nil: undefined }),
    encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
  });

  // Generate valid sandbox credentials
  const validSandboxCredentialsArbitrary = fc.record({
    consumerKey: validConsumerKeyArbitrary,
    consumerSecret: validConsumerSecretArbitrary,
    businessShortCode: sandboxBusinessShortCodeArbitrary,
    passkey: validPasskeyArbitrary,
    environment: fc.constant('sandbox' as MpesaEnvironment),
    callbackUrl: validHttpUrlArbitrary,
    timeoutUrl: fc.option(validHttpUrlArbitrary, { nil: undefined }),
    encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
  });

  // Generate credentials with missing required fields
  const incompleteCredentialsArbitrary = fc.record({
    consumerKey: fc.option(validConsumerKeyArbitrary, { nil: '' }),
    consumerSecret: fc.option(validConsumerSecretArbitrary, { nil: '' }),
    businessShortCode: fc.option(validBusinessShortCodeArbitrary, { nil: '' }),
    passkey: fc.option(validPasskeyArbitrary, { nil: '' }),
    environment: environmentArbitrary,
    callbackUrl: fc.option(validHttpsUrlArbitrary, { nil: '' }),
    timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
    encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
  }).filter(creds => 
    // Ensure at least one required field is missing or empty
    !creds.consumerKey || creds.consumerKey.trim().length === 0 ||
    !creds.consumerSecret || creds.consumerSecret.trim().length === 0 ||
    !creds.businessShortCode || creds.businessShortCode.trim().length === 0 ||
    !creds.passkey || creds.passkey.trim().length === 0 ||
    !creds.callbackUrl || creds.callbackUrl.trim().length === 0
  );

  // Generate credentials with invalid formats
  const invalidFormatCredentialsArbitrary = fc.oneof(
    // Invalid consumer key (too short, too long, or invalid characters)
    fc.record({
      consumerKey: fc.oneof(
        fc.string({ minLength: 1, maxLength: 9 }), // Too short
        fc.string({ minLength: 51, maxLength: 100 }), // Too long
        fc.string({ minLength: 10, maxLength: 50 }).filter(s => !/^[A-Za-z0-9]+$/.test(s)) // Invalid chars
      ),
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: validBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: environmentArbitrary,
      callbackUrl: validHttpsUrlArbitrary,
      timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Invalid consumer secret (too short, too long, or invalid characters)
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: fc.oneof(
        fc.string({ minLength: 1, maxLength: 9 }), // Too short
        fc.string({ minLength: 51, maxLength: 100 }), // Too long
        fc.string({ minLength: 10, maxLength: 50 }).filter(s => !/^[A-Za-z0-9]+$/.test(s)) // Invalid chars
      ),
      businessShortCode: validBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: environmentArbitrary,
      callbackUrl: validHttpsUrlArbitrary,
      timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Invalid business short code (too short, too long, or non-numeric)
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: fc.oneof(
        fc.string({ minLength: 1, maxLength: 4 }), // Too short
        fc.string({ minLength: 11, maxLength: 20 }), // Too long
        fc.string({ minLength: 5, maxLength: 10 }).filter(s => !/^\d+$/.test(s)) // Non-numeric
      ),
      passkey: validPasskeyArbitrary,
      environment: environmentArbitrary,
      callbackUrl: validHttpsUrlArbitrary,
      timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Invalid passkey (too short or invalid characters)
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: validBusinessShortCodeArbitrary,
      passkey: fc.oneof(
        fc.string({ minLength: 1, maxLength: 19 }), // Too short
        fc.string({ minLength: 20, maxLength: 100 }).filter(s => !/^[A-Za-z0-9+/=]+$/.test(s)) // Invalid chars
      ),
      environment: environmentArbitrary,
      callbackUrl: validHttpsUrlArbitrary,
      timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Invalid callback URL
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: validBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: environmentArbitrary,
      callbackUrl: fc.oneof(
        fc.constant('not-a-url'),
        fc.constant('ftp://invalid.com'),
        fc.constant('invalid-protocol://test.com')
      ),
      timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    })
  );

  // Generate credentials with environment inconsistencies
  const environmentInconsistentCredentialsArbitrary = fc.oneof(
    // Production credentials with HTTP URLs
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: productionBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: fc.constant('production' as MpesaEnvironment),
      callbackUrl: fc.webUrl({ validSchemes: ['http'] }), // HTTP in production
      timeoutUrl: fc.option(fc.webUrl({ validSchemes: ['http'] }), { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Production credentials with localhost/test domains
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: productionBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: fc.constant('production' as MpesaEnvironment),
      callbackUrl: fc.constantFrom(
        'https://localhost:3000/callback',
        'https://127.0.0.1:8080/callback',
        'https://test.example.com/callback',
        'https://staging.example.com/callback',
        'https://dev.example.com/callback'
      ),
      timeoutUrl: fc.option(validHttpsUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Production credentials with wrong business short code format
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: fc.string({ minLength: 5, maxLength: 5 }).filter(s => /^\d{5}$/.test(s)), // 5 digits instead of 6
      passkey: validPasskeyArbitrary,
      environment: fc.constant('production' as MpesaEnvironment),
      callbackUrl: validProductionCallbackUrlArbitrary,
      timeoutUrl: fc.option(validProductionCallbackUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    })
  );

  /**
   * Property 3: Credential Validation
   * **Validates: Requirements 3.5**
   * 
   * For any set of M-Pesa credentials, the system should validate that all required 
   * fields are present and properly formatted before attempting STK Push operations.
   */
  it('Property 3: Should validate that all required fields are present and properly formatted', async () => {
    await fc.assert(
      fc.asyncProperty(validCredentialsArbitrary, async (credentials) => {
        // Act
        const isValid = await service.validateCredentials(credentials);

        // Assert - All valid credentials should pass validation
        expect(isValid).toBe(true);

        // Verify all required fields are present and non-empty
        expect(credentials.consumerKey).toBeTruthy();
        expect(credentials.consumerKey.trim().length).toBeGreaterThan(0);
        expect(credentials.consumerSecret).toBeTruthy();
        expect(credentials.consumerSecret.trim().length).toBeGreaterThan(0);
        expect(credentials.businessShortCode).toBeTruthy();
        expect(credentials.businessShortCode.trim().length).toBeGreaterThan(0);
        expect(credentials.passkey).toBeTruthy();
        expect(credentials.passkey.trim().length).toBeGreaterThan(0);
        expect(credentials.callbackUrl).toBeTruthy();
        expect(credentials.callbackUrl.trim().length).toBeGreaterThan(0);
        expect(['sandbox', 'production']).toContain(credentials.environment);

        // Verify field formats are correct
        expect(credentials.consumerKey.length).toBeGreaterThanOrEqual(10);
        expect(credentials.consumerKey.length).toBeLessThanOrEqual(50);
        expect(/^[A-Za-z0-9]+$/.test(credentials.consumerKey)).toBe(true);

        expect(credentials.consumerSecret.length).toBeGreaterThanOrEqual(10);
        expect(credentials.consumerSecret.length).toBeLessThanOrEqual(50);
        expect(/^[A-Za-z0-9]+$/.test(credentials.consumerSecret)).toBe(true);

        expect(credentials.businessShortCode.length).toBeGreaterThanOrEqual(5);
        expect(credentials.businessShortCode.length).toBeLessThanOrEqual(10);
        expect(/^\d+$/.test(credentials.businessShortCode)).toBe(true);

        expect(credentials.passkey.length).toBeGreaterThanOrEqual(20);
        expect(/^[A-Za-z0-9+/=]+$/.test(credentials.passkey)).toBe(true);

        // Verify URL formats
        expect(() => new URL(credentials.callbackUrl)).not.toThrow();
        if (credentials.timeoutUrl) {
          expect(() => new URL(credentials.timeoutUrl)).not.toThrow();
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.1: Production credentials must meet stricter requirements
   * **Validates: Requirements 3.5**
   * 
   * For any production M-Pesa credentials, the system should enforce stricter 
   * validation rules including HTTPS URLs and exact business short code format.
   */
  it('Property 3.1: Should enforce stricter validation for production credentials', async () => {
    await fc.assert(
      fc.asyncProperty(validProductionCredentialsArbitrary, async (credentials) => {
        // Act
        const isValid = await service.validateCredentials(credentials);

        // Assert - All valid production credentials should pass validation
        expect(isValid).toBe(true);
        expect(credentials.environment).toBe('production');

        // Verify production-specific requirements
        const callbackUrl = new URL(credentials.callbackUrl);
        expect(callbackUrl.protocol).toBe('https:');

        if (credentials.timeoutUrl) {
          const timeoutUrl = new URL(credentials.timeoutUrl);
          expect(timeoutUrl.protocol).toBe('https:');
        }

        // Production business short codes should be exactly 6 digits
        expect(credentials.businessShortCode.length).toBe(6);
        expect(/^\d{6}$/.test(credentials.businessShortCode)).toBe(true);

        // Production URLs should not use localhost or test domains
        const hostname = callbackUrl.hostname.toLowerCase();
        expect(hostname).not.toContain('localhost');
        expect(hostname).not.toContain('127.0.0.1');
        expect(hostname).not.toContain('test');
        expect(hostname).not.toContain('staging');
        expect(hostname).not.toContain('dev');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.2: Sandbox credentials allow more flexible requirements
   * **Validates: Requirements 3.5**
   * 
   * For any sandbox M-Pesa credentials, the system should allow more flexible 
   * validation rules while still ensuring basic format correctness.
   */
  it('Property 3.2: Should allow flexible validation for sandbox credentials', async () => {
    await fc.assert(
      fc.asyncProperty(validSandboxCredentialsArbitrary, async (credentials) => {
        // Act
        const isValid = await service.validateCredentials(credentials);

        // Assert - All valid sandbox credentials should pass validation
        expect(isValid).toBe(true);
        expect(credentials.environment).toBe('sandbox');

        // Verify sandbox allows both HTTP and HTTPS
        const callbackUrl = new URL(credentials.callbackUrl);
        expect(['http:', 'https:']).toContain(callbackUrl.protocol);

        if (credentials.timeoutUrl) {
          const timeoutUrl = new URL(credentials.timeoutUrl);
          expect(['http:', 'https:']).toContain(timeoutUrl.protocol);
        }

        // Sandbox business short codes can be 5-10 digits
        expect(credentials.businessShortCode.length).toBeGreaterThanOrEqual(5);
        expect(credentials.businessShortCode.length).toBeLessThanOrEqual(10);
        expect(/^\d{5,10}$/.test(credentials.businessShortCode)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: Incomplete credentials should always be rejected
   * **Validates: Requirements 3.5**
   * 
   * For any M-Pesa credentials missing required fields, the system should 
   * always reject them during validation.
   */
  it('Property 3.3: Should always reject credentials with missing required fields', async () => {
    await fc.assert(
      fc.asyncProperty(incompleteCredentialsArbitrary, async (credentials) => {
        // Act
        const isValid = await service.validateCredentials(credentials);

        // Assert - All incomplete credentials should fail validation
        expect(isValid).toBe(false);

        // Verify at least one required field is missing or empty
        const hasEmptyConsumerKey = !credentials.consumerKey || credentials.consumerKey.trim().length === 0;
        const hasEmptyConsumerSecret = !credentials.consumerSecret || credentials.consumerSecret.trim().length === 0;
        const hasEmptyBusinessShortCode = !credentials.businessShortCode || credentials.businessShortCode.trim().length === 0;
        const hasEmptyPasskey = !credentials.passkey || credentials.passkey.trim().length === 0;
        const hasEmptyCallbackUrl = !credentials.callbackUrl || credentials.callbackUrl.trim().length === 0;

        expect(
          hasEmptyConsumerKey || 
          hasEmptyConsumerSecret || 
          hasEmptyBusinessShortCode || 
          hasEmptyPasskey || 
          hasEmptyCallbackUrl
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.4: Invalid format credentials should always be rejected
   * **Validates: Requirements 3.5**
   * 
   * For any M-Pesa credentials with invalid field formats, the system should 
   * always reject them during validation.
   */
  it('Property 3.4: Should always reject credentials with invalid field formats', async () => {
    await fc.assert(
      fc.asyncProperty(invalidFormatCredentialsArbitrary, async (credentials) => {
        // Act
        const isValid = await service.validateCredentials(credentials);

        // Assert - All invalid format credentials should fail validation
        expect(isValid).toBe(false);

        // The credentials should have at least one format violation
        const hasInvalidConsumerKey = credentials.consumerKey && (
          credentials.consumerKey.length < 10 || 
          credentials.consumerKey.length > 50 || 
          !/^[A-Za-z0-9]+$/.test(credentials.consumerKey)
        );

        const hasInvalidConsumerSecret = credentials.consumerSecret && (
          credentials.consumerSecret.length < 10 || 
          credentials.consumerSecret.length > 50 || 
          !/^[A-Za-z0-9]+$/.test(credentials.consumerSecret)
        );

        const hasInvalidBusinessShortCode = credentials.businessShortCode && (
          credentials.businessShortCode.length < 5 || 
          credentials.businessShortCode.length > 10 || 
          !/^\d+$/.test(credentials.businessShortCode)
        );

        const hasInvalidPasskey = credentials.passkey && (
          credentials.passkey.length < 20 || 
          !/^[A-Za-z0-9+/=]+$/.test(credentials.passkey)
        );

        const hasInvalidCallbackUrl = credentials.callbackUrl && (() => {
          try {
            new URL(credentials.callbackUrl);
            return false;
          } catch {
            return true;
          }
        })();

        expect(
          hasInvalidConsumerKey || 
          hasInvalidConsumerSecret || 
          hasInvalidBusinessShortCode || 
          hasInvalidPasskey || 
          hasInvalidCallbackUrl
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.5: Environment-inconsistent credentials should always be rejected
   * **Validates: Requirements 3.5**
   * 
   * For any M-Pesa credentials with environment inconsistencies, the system should 
   * always reject them during validation.
   */
  it('Property 3.5: Should always reject credentials with environment inconsistencies', async () => {
    await fc.assert(
      fc.asyncProperty(environmentInconsistentCredentialsArbitrary, async (credentials) => {
        // Act
        const isValid = await service.validateCredentials(credentials);

        // Assert - All environment-inconsistent credentials should fail validation
        expect(isValid).toBe(false);

        if (credentials.environment === 'production') {
          // Check for production violations
          let hasProductionViolation = false;

          // Check for HTTP URLs in production
          try {
            const callbackUrl = new URL(credentials.callbackUrl);
            if (callbackUrl.protocol === 'http:') {
              hasProductionViolation = true;
            }

            if (credentials.timeoutUrl) {
              const timeoutUrl = new URL(credentials.timeoutUrl);
              if (timeoutUrl.protocol === 'http:') {
                hasProductionViolation = true;
              }
            }

            // Check for localhost/test domains in production
            const hostname = callbackUrl.hostname.toLowerCase();
            if (hostname.includes('localhost') || 
                hostname.includes('127.0.0.1') || 
                hostname.includes('test') || 
                hostname.includes('staging') || 
                hostname.includes('dev')) {
              hasProductionViolation = true;
            }

            // Check for wrong business short code format in production
            if (!/^\d{6}$/.test(credentials.businessShortCode)) {
              hasProductionViolation = true;
            }

          } catch {
            hasProductionViolation = true; // Invalid URL format
          }

          expect(hasProductionViolation).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.6: Validation should be deterministic and consistent
   * **Validates: Requirements 3.5**
   * 
   * For any M-Pesa credentials, validation should always return the same result 
   * when called multiple times with the same input.
   */
  it('Property 3.6: Should provide deterministic and consistent validation results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          validCredentialsArbitrary,
          incompleteCredentialsArbitrary,
          invalidFormatCredentialsArbitrary,
          environmentInconsistentCredentialsArbitrary
        ),
        async (credentials) => {
          // Act - Validate the same credentials multiple times
          const result1 = await service.validateCredentials(credentials);
          const result2 = await service.validateCredentials(credentials);
          const result3 = await service.validateCredentials(credentials);

          // Assert - Results should be identical
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          expect(result1).toBe(result3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.7: Validation should handle edge cases gracefully
   * **Validates: Requirements 3.5**
   * 
   * For any malformed or null credential input, validation should handle it 
   * gracefully without throwing exceptions.
   */
  it('Property 3.7: Should handle malformed credential inputs gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({}),
          fc.record({
            consumerKey: fc.option(fc.anything(), { nil: null }),
            consumerSecret: fc.option(fc.anything(), { nil: null }),
            businessShortCode: fc.option(fc.anything(), { nil: null }),
            passkey: fc.option(fc.anything(), { nil: null }),
            environment: fc.option(fc.anything(), { nil: null }),
            callbackUrl: fc.option(fc.anything(), { nil: null })
          })
        ),
        async (malformedCredentials) => {
          // Act & Assert - Should not throw exceptions
          let result: boolean;
          expect(async () => {
            result = await service.validateCredentials(malformedCredentials as any);
          }).not.toThrow();

          // Should return false for any malformed input
          result = await service.validateCredentials(malformedCredentials as any);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});