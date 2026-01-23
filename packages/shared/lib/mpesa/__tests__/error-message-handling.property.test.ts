/**
 * Property-Based Test: User-Friendly Error Messages
 * 
 * **Feature: mpesa-tenant-credentials-fix, Property 7: User-Friendly Error Messages**
 * **Validates: Requirements 6.4**
 * 
 * This test verifies that the system provides user-friendly error messages for credential issues
 * without exposing technical details like encryption keys, database errors, or raw system information.
 */

import fc from 'fast-check';
import { 
  TenantCredentialErrorHandler,
  createTenantCredentialErrorHandler,
  TenantErrorCategory,
  withTenantErrorHandling
} from '../services/error-handling';
import { 
  MpesaError,
  MpesaEnvironment,
  MpesaValidationError,
  MpesaNetworkError,
  MpesaAuthenticationError
} from '../types';
import { Logger } from '../services/base';

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Test data generators
const environmentArbitrary = fc.constantFrom('sandbox' as const, 'production' as const);

const tenantContextArbitrary = fc.record({
  tenantId: fc.uuid(),
  barId: fc.uuid(),
  tabId: fc.uuid(),
  operation: fc.constantFrom('payment_initiation', 'credential_retrieval', 'tab_resolution', 'decryption'),
  environment: environmentArbitrary
});

const sensitiveDataArbitrary = fc.record({
  consumerKey: fc.string({ minLength: 20, maxLength: 50 }),
  consumerSecret: fc.string({ minLength: 20, maxLength: 50 }),
  passkey: fc.string({ minLength: 30, maxLength: 100 }),
  kmsKey: fc.string({ minLength: 32, maxLength: 64 }),
  encryptedData: fc.string({ minLength: 50, maxLength: 200 }),
  phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
  databaseConnectionString: fc.string({ minLength: 30, maxLength: 100 }),
  stackTrace: fc.string({ minLength: 100, maxLength: 500 })
});

// Error generators for different categories
const tabResolutionErrorArbitrary = fc.oneof(
  fc.constant(new Error('Tab not found')),
  fc.constant(new Error('Orphaned tab - no associated bar')),
  fc.constant(new Error('Inactive bar status')),
  fc.constant(new Error('Invalid tab status for payments')),
  fc.constant(new Error('Tab resolution service failed'))
);

const credentialRetrievalErrorArbitrary = fc.oneof(
  fc.constant(new Error('Credentials not found for tenant')),
  fc.constant(new Error('Credentials inactive for tenant')),
  fc.constant(new Error('Credentials incomplete - missing required fields')),
  fc.constant(new Error('Database connection failed during credential retrieval')),
  fc.constant(new Error('Credential retrieval service error'))
);

const decryptionErrorArbitrary = fc.oneof(
  fc.constant(new Error('MPESA_KMS_KEY environment variable not set')),
  fc.constant(new Error('KMS_KEY invalid length - must be 32 bytes')),
  fc.constant(new Error('KMS_KEY invalid format - contains invalid characters')),
  fc.constant(new Error('KMS not initialized properly')),
  fc.constant(new Error('Invalid encrypted format in database')),
  fc.constant(new Error('Invalid encrypted data - too short')),
  fc.constant(new Error('Corrupted encrypted data - IV invalid')),
  fc.constant(new Error('Decryption failed - key mismatch')),
  fc.constant(new Error('Authentication failed - GCM tag verification failed')),
  fc.constant(new Error('Invalid decrypted data format'))
);

const validationErrorArbitrary = fc.oneof(
  fc.constant(new Error('Credentials invalid - missing consumer key')),
  fc.constant(new Error('Validation error - invalid business shortcode format')),
  fc.constant(new Error('Environment mismatch - sandbox credentials with production endpoint'))
);

const configurationErrorArbitrary = fc.oneof(
  fc.constant(new Error('Invalid tenant config object')),
  fc.constant(new Error('Invalid tenant ID - required field')),
  fc.constant(new Error('Invalid bar ID - must be non-empty')),
  fc.constant(new Error('Invalid environment - must be sandbox or production')),
  fc.constant(new Error('Missing credentials in tenant configuration')),
  fc.constant(new Error('Service config creation error'))
);

// Sensitive data patterns that should never appear in user messages
const SENSITIVE_PATTERNS = [
  /[A-Za-z0-9]{20,}/,  // Long alphanumeric strings (likely keys/tokens)
  /key[_-]?[A-Za-z0-9]+/i,  // Key patterns
  /secret[_-]?[A-Za-z0-9]+/i,  // Secret patterns
  /token[_-]?[A-Za-z0-9]+/i,  // Token patterns
  /password[_-]?[A-Za-z0-9]+/i,  // Password patterns
  /\b[A-Za-z0-9]{32,}\b/,  // 32+ character strings (likely hashes/keys)
  /postgres:\/\/[^@]+@[^\/]+\/\w+/,  // Database connection strings
  /mysql:\/\/[^@]+@[^\/]+\/\w+/,  // MySQL connection strings
  /mongodb:\/\/[^@]+@[^\/]+\/\w+/,  // MongoDB connection strings
  /at\s+[A-Za-z0-9._$]+\([^)]+\)/,  // Stack trace patterns
  /\s+at\s+/,  // Stack trace "at" patterns
  /Error:\s*[A-Za-z0-9._$]+/,  // Raw error class names
  /Exception:\s*[A-Za-z0-9._$]+/,  // Raw exception class names
  /\+254\d{9}/,  // Phone numbers
  /254\d{9}/,  // Phone numbers without +
  /07\d{8}/,  // Local phone numbers
  /01\d{8}/,  // Local phone numbers
];

// Technical terms that should not appear in user messages
const TECHNICAL_TERMS = [
  'KMS', 'AES', 'GCM', 'IV', 'authentication tag', 'cipher', 'decrypt',
  'database', 'SQL', 'query', 'connection', 'pool', 'transaction',
  'stack trace', 'exception', 'null pointer', 'undefined', 'TypeError',
  'ReferenceError', 'SyntaxError', 'JSON.parse', 'Buffer', 'crypto',
  'environment variable', 'process.env', 'NODE_ENV', 'MPESA_KMS_KEY',
  'supabase', 'postgresql', 'RLS', 'row level security', 'JWT',
  'bearer token', 'authorization header', 'API key', 'consumer key',
  'consumer secret', 'business shortcode', 'passkey', 'callback URL'
];

describe('Property Test: User-Friendly Error Messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide user-friendly messages without exposing sensitive data', async () => {
    await fc.assert(
      fc.asyncProperty(
        environmentArbitrary,
        tenantContextArbitrary,
        sensitiveDataArbitrary,
        fc.oneof(
          tabResolutionErrorArbitrary,
          credentialRetrievalErrorArbitrary,
          decryptionErrorArbitrary,
          validationErrorArbitrary,
          configurationErrorArbitrary
        ),
        async (environment, context, sensitiveData, error) => {
          const errorHandler = createTenantCredentialErrorHandler(mockLogger, environment);

          // Add sensitive data to error context to test sanitization
          const contextWithSensitiveData = {
            ...context,
            ...sensitiveData,
            // Add some additional sensitive patterns
            rawError: error.message,
            stackTrace: error.stack || 'Error stack trace with sensitive data',
            databaseUrl: `postgres://user:${sensitiveData.consumerSecret}@localhost:5432/db`,
            apiKey: sensitiveData.consumerKey,
            encryptionKey: sensitiveData.kmsKey
          };

          // Handle the error
          const errorInfo = errorHandler.handleTenantError(error, contextWithSensitiveData);

          // Property 1: User message should not contain sensitive data patterns
          for (const pattern of SENSITIVE_PATTERNS) {
            expect(errorInfo.userMessage).not.toMatch(pattern);
          }

          // Property 2: User message should not contain technical terms
          const userMessageLower = errorInfo.userMessage.toLowerCase();
          for (const term of TECHNICAL_TERMS) {
            expect(userMessageLower).not.toContain(term.toLowerCase());
          }

          // Property 3: User message should not contain any of the original sensitive data
          expect(errorInfo.userMessage).not.toContain(sensitiveData.consumerKey);
          expect(errorInfo.userMessage).not.toContain(sensitiveData.consumerSecret);
          expect(errorInfo.userMessage).not.toContain(sensitiveData.passkey);
          expect(errorInfo.userMessage).not.toContain(sensitiveData.kmsKey);
          expect(errorInfo.userMessage).not.toContain(sensitiveData.encryptedData);
          expect(errorInfo.userMessage).not.toContain(sensitiveData.phoneNumber);
          expect(errorInfo.userMessage).not.toContain(sensitiveData.databaseConnectionString);

          // Property 4: User message should be helpful and actionable
          expect(errorInfo.userMessage).toBeTruthy();
          expect(errorInfo.userMessage.length).toBeGreaterThan(10);
          expect(errorInfo.userMessage).toMatch(/^[A-Z]/); // Should start with capital letter
          expect(errorInfo.userMessage).toMatch(/[.!]$/); // Should end with punctuation

          // Property 5: User message should suggest appropriate action
          const hasActionableGuidance = 
            errorInfo.userMessage.includes('try again') ||
            errorInfo.userMessage.includes('contact support') ||
            errorInfo.userMessage.includes('contact the establishment') ||
            errorInfo.userMessage.includes('refresh') ||
            errorInfo.userMessage.includes('later');
          expect(hasActionableGuidance).toBe(true);

          // Property 6: Admin message can contain technical details (in sandbox only)
          if (environment === 'sandbox') {
            expect(errorInfo.adminMessage).toBeTruthy();
            expect(errorInfo.adminMessage.length).toBeGreaterThan(errorInfo.userMessage.length);
          }

          // Property 7: Context should be sanitized (no sensitive data)
          if (errorInfo.context) {
            const contextString = JSON.stringify(errorInfo.context);
            expect(contextString).not.toContain(sensitiveData.consumerKey);
            expect(contextString).not.toContain(sensitiveData.consumerSecret);
            expect(contextString).not.toContain(sensitiveData.passkey);
            expect(contextString).not.toContain(sensitiveData.kmsKey);
            expect(contextString).not.toContain(sensitiveData.phoneNumber);
          }

          // Property 8: Error response should have consistent structure
          const errorResponse = errorHandler.createErrorResponse(errorInfo);
          expect(errorResponse.success).toBe(false);
          expect(errorResponse.error).toBeDefined();
          expect(errorResponse.error.code).toBeTruthy();
          expect(errorResponse.error.message).toBe(errorInfo.userMessage);
          expect(typeof errorResponse.error.shouldRetry).toBe('boolean');

          // Property 9: Debug info should only be present in sandbox
          if (environment === 'sandbox') {
            expect(errorResponse.debug).toBeDefined();
            expect(errorResponse.debug?.adminMessage).toBeTruthy();
          } else {
            expect(errorResponse.debug).toBeUndefined();
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should categorize errors appropriately for different tenant operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        environmentArbitrary,
        tenantContextArbitrary,
        async (environment, context) => {
          const errorHandler = createTenantCredentialErrorHandler(mockLogger, environment);

          // Test different error categories
          const errorTestCases = [
            { error: new Error('Tab not found'), expectedCategory: TenantErrorCategory.TAB_RESOLUTION },
            { error: new Error('Credentials not found'), expectedCategory: TenantErrorCategory.CREDENTIAL_RETRIEVAL },
            { error: new Error('Decryption failed'), expectedCategory: TenantErrorCategory.CREDENTIAL_DECRYPTION },
            { error: new Error('Credentials invalid'), expectedCategory: TenantErrorCategory.CREDENTIAL_VALIDATION },
            { error: new Error('Invalid tenant config'), expectedCategory: TenantErrorCategory.TENANT_CONFIGURATION }
          ];

          for (const testCase of errorTestCases) {
            const errorInfo = errorHandler.handleTenantError(testCase.error, context);

            // Property 1: Error should be categorized correctly
            expect(errorInfo.tenantCategory).toBe(testCase.expectedCategory);

            // Property 2: Status code should be appropriate for category
            expect(errorInfo.statusCode).toBeGreaterThanOrEqual(400);
            expect(errorInfo.statusCode).toBeLessThan(600);

            // Property 3: User message should be category-appropriate
            switch (testCase.expectedCategory) {
              case TenantErrorCategory.TAB_RESOLUTION:
                expect(errorInfo.userMessage.toLowerCase()).toMatch(/tab|refresh|try again/);
                break;
              case TenantErrorCategory.CREDENTIAL_RETRIEVAL:
                expect(errorInfo.userMessage.toLowerCase()).toMatch(/payment service|location|establishment/);
                break;
              case TenantErrorCategory.CREDENTIAL_DECRYPTION:
                expect(errorInfo.userMessage.toLowerCase()).toMatch(/temporarily unavailable|try again later/);
                break;
              case TenantErrorCategory.CREDENTIAL_VALIDATION:
                expect(errorInfo.userMessage.toLowerCase()).toMatch(/configuration|contact support/);
                break;
              case TenantErrorCategory.TENANT_CONFIGURATION:
                expect(errorInfo.userMessage.toLowerCase()).toMatch(/configuration|contact support/);
                break;
            }

            // Property 4: Retry guidance should be consistent with error type
            const shouldRetryForCategory = [
              TenantErrorCategory.CREDENTIAL_RETRIEVAL,
              TenantErrorCategory.CREDENTIAL_DECRYPTION
            ].includes(testCase.expectedCategory);
            
            if (shouldRetryForCategory) {
              expect(errorInfo.userMessage.toLowerCase()).toMatch(/try again|temporarily/);
            }
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should handle MpesaError instances with proper message transformation', async () => {
    await fc.assert(
      fc.asyncProperty(
        environmentArbitrary,
        tenantContextArbitrary,
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 400, max: 599 }),
        async (environment, context, rawMessage, errorCode, statusCode) => {
          const errorHandler = createTenantCredentialErrorHandler(mockLogger, environment);

          // Create MpesaError with potentially sensitive raw message
          const mpesaError = new MpesaError(
            `Raw technical error: ${rawMessage} with key: ABC123XYZ789`,
            errorCode,
            statusCode
          );

          const errorInfo = errorHandler.handleTenantError(mpesaError, context);

          // Property 1: User message should not contain raw technical details
          expect(errorInfo.userMessage).not.toContain('Raw technical error');
          expect(errorInfo.userMessage).not.toContain('ABC123XYZ789');
          expect(errorInfo.userMessage).not.toContain(rawMessage);

          // Property 2: Error code should be preserved or transformed appropriately
          expect(errorInfo.code).toBeTruthy();
          expect(typeof errorInfo.code).toBe('string');

          // Property 3: Status code should be appropriate
          expect(errorInfo.statusCode).toBeGreaterThanOrEqual(400);
          expect(errorInfo.statusCode).toBeLessThan(600);

          // Property 4: User message should be friendly and actionable
          expect(errorInfo.userMessage).toMatch(/^[A-Z]/);
          expect(errorInfo.userMessage).toMatch(/[.!]$/);
          expect(errorInfo.userMessage.length).toBeGreaterThan(10);

          // Property 5: Should not expose the original error code to users
          expect(errorInfo.userMessage).not.toContain(errorCode);
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should provide consistent error messages for the same error types', async () => {
    await fc.assert(
      fc.asyncProperty(
        environmentArbitrary,
        fc.array(tenantContextArbitrary, { minLength: 2, maxLength: 5 }),
        async (environment, contexts) => {
          const errorHandler = createTenantCredentialErrorHandler(mockLogger, environment);

          // Test same error type across different contexts
          const sameErrorType = new Error('Credentials not found for tenant');
          const errorInfos = contexts.map(context => 
            errorHandler.handleTenantError(sameErrorType, context)
          );

          // Property 1: Same error type should produce same user message
          const firstUserMessage = errorInfos[0].userMessage;
          for (const errorInfo of errorInfos.slice(1)) {
            expect(errorInfo.userMessage).toBe(firstUserMessage);
          }

          // Property 2: Same error type should have same category
          const firstCategory = errorInfos[0].tenantCategory;
          for (const errorInfo of errorInfos.slice(1)) {
            expect(errorInfo.tenantCategory).toBe(firstCategory);
          }

          // Property 3: Same error type should have same status code
          const firstStatusCode = errorInfos[0].statusCode;
          for (const errorInfo of errorInfos.slice(1)) {
            expect(errorInfo.statusCode).toBe(firstStatusCode);
          }

          // Property 4: Same error type should have same retry guidance
          const firstShouldRetry = errorInfos[0].shouldRetry;
          for (const errorInfo of errorInfos.slice(1)) {
            expect(errorInfo.shouldRetry).toBe(firstShouldRetry);
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should handle error wrapping with proper message sanitization', async () => {
    await fc.assert(
      fc.asyncProperty(
        environmentArbitrary,
        tenantContextArbitrary,
        sensitiveDataArbitrary,
        async (environment, context, sensitiveData) => {
          const errorHandler = createTenantCredentialErrorHandler(mockLogger, environment);

          // Create a mock operation that might expose sensitive data
          const mockOperation = async (): Promise<string> => {
            throw new Error(`Database error: Connection failed to postgres://user:${sensitiveData.consumerSecret}@localhost:5432/db with key ${sensitiveData.kmsKey}`);
          };

          // Test error wrapping utility
          try {
            await withTenantErrorHandling(mockOperation, errorHandler, context);
            fail('Expected error to be thrown');
          } catch (wrappedError) {
            expect(wrappedError).toBeInstanceOf(MpesaError);
            
            const mpesaError = wrappedError as MpesaError;

            // Property 1: Wrapped error message should not contain sensitive data
            expect(mpesaError.message).not.toContain(sensitiveData.consumerSecret);
            expect(mpesaError.message).not.toContain(sensitiveData.kmsKey);
            expect(mpesaError.message).not.toContain('postgres://');

            // Property 2: Wrapped error should be user-friendly
            expect(mpesaError.message).toMatch(/^[A-Z]/);
            expect(mpesaError.message).toMatch(/[.!]$/);
            expect(mpesaError.message.length).toBeGreaterThan(10);

            // Property 3: Wrapped error should have appropriate status code
            expect(mpesaError.statusCode).toBeGreaterThanOrEqual(400);
            expect(mpesaError.statusCode).toBeLessThan(600);

            // Property 4: Wrapped error should have meaningful code
            expect(mpesaError.code).toBeTruthy();
            expect(typeof mpesaError.code).toBe('string');
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should provide environment-appropriate error detail levels', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary,
        fc.oneof(
          tabResolutionErrorArbitrary,
          credentialRetrievalErrorArbitrary,
          decryptionErrorArbitrary
        ),
        async (context, error) => {
          // Test both environments
          const sandboxHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
          const productionHandler = createTenantCredentialErrorHandler(mockLogger, 'production');

          const sandboxErrorInfo = sandboxHandler.handleTenantError(error, context);
          const productionErrorInfo = productionHandler.handleTenantError(error, context);

          // Property 1: User messages should be identical regardless of environment
          expect(sandboxErrorInfo.userMessage).toBe(productionErrorInfo.userMessage);

          // Property 2: Sandbox should provide more detailed admin messages
          if (sandboxErrorInfo.adminMessage && productionErrorInfo.adminMessage) {
            expect(sandboxErrorInfo.adminMessage.length).toBeGreaterThanOrEqual(
              productionErrorInfo.adminMessage.length
            );
          }

          // Property 3: Error responses should have different debug info based on environment
          const sandboxResponse = sandboxHandler.createErrorResponse(sandboxErrorInfo);
          const productionResponse = productionHandler.createErrorResponse(productionErrorInfo);

          expect(sandboxResponse.debug).toBeDefined();
          expect(productionResponse.debug).toBeUndefined();

          // Property 4: Core error structure should be identical
          expect(sandboxResponse.success).toBe(productionResponse.success);
          expect(sandboxResponse.error.code).toBe(productionResponse.error.code);
          expect(sandboxResponse.error.message).toBe(productionResponse.error.message);
          expect(sandboxResponse.error.shouldRetry).toBe(productionResponse.error.shouldRetry);
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });
});