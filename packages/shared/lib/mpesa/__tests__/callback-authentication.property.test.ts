/**
 * Property-Based Tests for M-PESA Callback Authentication
 * Feature: mpesa-payment-integration, Property 11: Callback Authentication
 * 
 * Tests that callback authentication correctly validates authentic M-PESA callbacks
 * and rejects invalid or malicious callback attempts.
 * 
 * **Validates: Requirements 5.2**
 */

import fc from 'fast-check';
import { CallbackHandler, DefaultCallbackAuthenticator, CallbackAuthenticator } from '../services/callback';
import { TransactionService } from '../services/transaction';
import { ServiceFactory } from '../services/base';
import { STKCallbackData, MpesaEnvironment, Transaction } from '../types';
import { Logger } from '../services/base';

// Mock logger for testing
class MockLogger implements Logger {
  info(message: string, context?: any): void {}
  warn(message: string, context?: any): void {}
  error(message: string, context?: any): void {}
  debug(message: string, context?: any): void {}
}

// Mock transaction service for testing
class MockTransactionService {
  private mockTransactions: Map<string, Transaction> = new Map();

  async findByCheckoutRequestId(checkoutRequestId: string): Promise<Transaction | null> {
    return this.mockTransactions.get(checkoutRequestId) || null;
  }

  async updateTransactionStatus(id: string, status: any, additionalData?: any): Promise<Transaction> {
    const existing = Array.from(this.mockTransactions.values()).find(t => t.id === id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    const updated = {
      ...existing,
      status,
      ...additionalData,
      updatedAt: new Date()
    };

    this.mockTransactions.set(existing.checkoutRequestId!, updated);
    return updated;
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const transaction = Array.from(this.mockTransactions.values()).find(t => t.id === id);
    return transaction || null;
  }

  async getRecentTransactions(limit: number = 50): Promise<Transaction[]> {
    return Array.from(this.mockTransactions.values()).slice(0, limit);
  }

  addMockTransaction(transaction: Transaction): void {
    this.mockTransactions.set(transaction.checkoutRequestId!, transaction);
  }

  clearMockTransactions(): void {
    this.mockTransactions.clear();
  }
}

// Test authenticator that always fails authentication
class AlwaysFailAuthenticator implements CallbackAuthenticator {
  async validateCallback(callbackData: any, headers?: Record<string, string>): Promise<boolean> {
    return false;
  }
}

// Test authenticator that validates based on a specific header
class HeaderBasedAuthenticator implements CallbackAuthenticator {
  constructor(private expectedHeaderValue: string) {}

  async validateCallback(callbackData: any, headers?: Record<string, string>): Promise<boolean> {
    return headers?.['x-test-auth'] === this.expectedHeaderValue;
  }
}

// Test generators
const generateValidCallbackStructure = () => fc.record({
  checkoutRequestId: fc.string({ minLength: 15, maxLength: 30 }).map(s => 
    s.replace(/[^a-zA-Z0-9]/g, 'A')
  ),
  merchantRequestId: fc.string({ minLength: 15, maxLength: 30 }).map(s => 
    s.replace(/[^a-zA-Z0-9]/g, 'B')
  ),
  resultCode: fc.integer({ min: 0, max: 9999 }),
  resultDesc: fc.string({ minLength: 1, maxLength: 100 })
}).map(data => ({
  Body: {
    stkCallback: {
      MerchantRequestID: data.merchantRequestId,
      CheckoutRequestID: data.checkoutRequestId,
      ResultCode: data.resultCode,
      ResultDesc: data.resultDesc
    }
  }
}));

const generateInvalidCallbackStructure = () => fc.oneof(
  // Missing Body
  fc.record({}),
  
  // Missing stkCallback
  fc.record({
    Body: fc.record({})
  }),
  
  // Missing required fields in stkCallback - completely omit fields
  fc.record({
    Body: fc.record({
      stkCallback: fc.record({}).chain(base => {
        // Randomly include or exclude each required field
        return fc.record({
          includeMerchantRequestID: fc.boolean(),
          includeCheckoutRequestID: fc.boolean(),
          includeResultCode: fc.boolean(),
          includeResultDesc: fc.boolean()
        }).map(flags => {
          const result: any = { ...base };
          
          if (flags.includeMerchantRequestID) {
            result.MerchantRequestID = 'test-merchant-id';
          }
          if (flags.includeCheckoutRequestID) {
            result.CheckoutRequestID = 'test-checkout-id';
          }
          if (flags.includeResultCode) {
            result.ResultCode = 0;
          }
          if (flags.includeResultDesc) {
            result.ResultDesc = 'test description';
          }
          
          return result;
        }).filter(callback => {
          // Ensure at least one required field is completely missing
          return !('MerchantRequestID' in callback) || 
                 !('CheckoutRequestID' in callback) || 
                 !('ResultCode' in callback) || 
                 !('ResultDesc' in callback);
        });
      })
    })
  }),
  
  // Completely malformed structure
  fc.record({
    malformed: fc.string()
  })
);

const generateMockTransaction = () => fc.record({
  id: fc.uuid(),
  checkoutRequestId: fc.string({ minLength: 15, maxLength: 30 }).map(s => 
    s.replace(/[^a-zA-Z0-9]/g, 'A')
  ),
  tabId: fc.uuid(),
  customerId: fc.uuid(),
  phoneNumber: fc.integer({ min: 700000000, max: 799999999 }).map(n => `254${n}`),
  amount: fc.float({ min: 1, max: 999999, noNaN: true }).map(n => 
    Math.round(n * 100) / 100
  )
}).map(data => ({
  ...data,
  currency: 'KES' as const,
  status: 'sent' as const,
  environment: 'sandbox' as MpesaEnvironment,
  createdAt: new Date(),
  updatedAt: new Date()
}));

const generateHeaders = () => fc.record({
  'content-type': fc.constant('application/json'),
  'user-agent': fc.string({ minLength: 5, maxLength: 50 }),
  'x-forwarded-for': fc.ipV4(),
  'x-test-auth': fc.string({ minLength: 10, maxLength: 20 }) // Always generate auth header
});

describe('M-PESA Callback Authentication Property Tests', () => {
  let mockTransactionService: MockTransactionService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockTransactionService = new MockTransactionService();
    mockLogger = new MockLogger();
  });

  afterEach(() => {
    mockTransactionService.clearMockTransactions();
  });

  /**
   * Property 11a: Valid callbacks with proper structure should pass default authentication
   */
  test('Property 11a: Valid callback structure passes default authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCallbackStructure(),
        async (callbackData) => {
          // Arrange: Create default authenticator
          const authenticator = new DefaultCallbackAuthenticator(mockLogger);

          // Act: Validate the callback
          const isValid = await authenticator.validateCallback(callbackData);

          // Assert: Valid structure should pass authentication
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  });

  /**
   * Property 11b: Invalid callbacks with malformed structure should fail default authentication
   */
  test('Property 11b: Invalid callback structure fails default authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateInvalidCallbackStructure(),
        async (callbackData) => {
          // Arrange: Create default authenticator
          const authenticator = new DefaultCallbackAuthenticator(mockLogger);

          // Act: Validate the callback
          const isValid = await authenticator.validateCallback(callbackData);

          // Assert: Invalid structure should fail authentication
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  });

  /**
   * Property 11c: Callback handler should reject callbacks that fail authentication
   */
  test('Property 11c: Callback handler rejects unauthenticated callbacks', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCallbackStructure(),
        async (callbackData) => {
          // Arrange: Create callback handler with always-fail authenticator
          const config = ServiceFactory.createServiceConfig(
            'sandbox',
            {
              consumerKey: 'test-consumer-key',
              consumerSecret: 'test-consumer-secret',
              businessShortCode: '174379',
              passkey: 'test-passkey',
              environment: 'sandbox',
              callbackUrl: 'https://test.example.com/callback',
              encryptedAt: new Date(),
            } as any,
            { timeoutMs: 5000, retryAttempts: 1, rateLimitPerMinute: 100 }
          );

          const alwaysFailAuth = new AlwaysFailAuthenticator();
          const callbackHandler = new CallbackHandler(
            config,
            mockTransactionService as any,
            alwaysFailAuth,
            mockLogger
          );

          // Act: Process the callback
          const result = await callbackHandler.handleSTKCallback(callbackData as STKCallbackData);

          // Assert: Callback should be rejected due to authentication failure
          expect(result.success).toBe(false);
          expect(result.error).toContain('authentication failed');
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  });

  /**
   * Property 11d: Custom authenticator should be respected by callback handler
   */
  test('Property 11d: Custom authenticator controls callback acceptance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          generateMockTransaction(),
          fc.string({ minLength: 10, maxLength: 20 }).filter(s => s.trim().length > 5) // Ensure non-empty auth token
        ),
        async ([mockTransaction, authToken]) => {
          // Create a valid callback structure
          const callbackData = {
            Body: {
              stkCallback: {
                MerchantRequestID: 'test-merchant-request-id',
                CheckoutRequestID: mockTransaction.checkoutRequestId,
                ResultCode: 0,
                ResultDesc: 'The service request is processed successfully.'
              }
            }
          };

          // Arrange: Create callback handler with header-based authenticator
          const config = ServiceFactory.createServiceConfig(
            'sandbox',
            {
              consumerKey: 'test-consumer-key',
              consumerSecret: 'test-consumer-secret',
              businessShortCode: '174379',
              passkey: 'test-passkey',
              environment: 'sandbox',
              callbackUrl: 'https://test.example.com/callback',
              encryptedAt: new Date(),
            } as any,
            { timeoutMs: 5000, retryAttempts: 1, rateLimitPerMinute: 100 }
          );

          const headerAuth = new HeaderBasedAuthenticator(authToken);
          const callbackHandler = new CallbackHandler(
            config,
            mockTransactionService as any,
            headerAuth,
            mockLogger
          );

          // Setup mock transaction
          mockTransactionService.addMockTransaction(mockTransaction);

          // Test with correct auth header
          const headersWithAuth = { 
            'content-type': 'application/json',
            'x-test-auth': authToken 
          };
          const resultWithAuth = await callbackHandler.handleSTKCallback(
            callbackData as STKCallbackData, 
            headersWithAuth
          );

          // Test with incorrect auth header
          const headersWithoutAuth = { 
            'content-type': 'application/json',
            'x-test-auth': 'wrong-token-different-from-expected' 
          };
          const resultWithoutAuth = await callbackHandler.handleSTKCallback(
            callbackData as STKCallbackData, 
            headersWithoutAuth
          );

          // Assert: Callback should succeed with correct auth, fail with incorrect auth
          expect(resultWithAuth.success).toBe(true);
          expect(resultWithoutAuth.success).toBe(false);
          expect(resultWithoutAuth.error).toContain('authentication failed');
        }
      ),
      { numRuns: 50, timeout: 15000 }
    );
  });

  /**
   * Property 11e: Authentication should be performed before any callback processing
   */
  test('Property 11e: Authentication precedes callback processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCallbackStructure(),
        async (callbackData) => {
          // Arrange: Create spy authenticator to track when authentication is called
          let authenticationCalled = false;
          let processingAttempted = false;

          const spyAuthenticator: CallbackAuthenticator = {
            async validateCallback(callbackData: any, headers?: Record<string, string>): Promise<boolean> {
              authenticationCalled = true;
              return false; // Always fail to prevent processing
            }
          };

          // Mock transaction service that tracks if it's called
          const spyTransactionService = {
            ...mockTransactionService,
            findByCheckoutRequestId: async (checkoutRequestId: string) => {
              processingAttempted = true;
              return mockTransactionService.findByCheckoutRequestId(checkoutRequestId);
            }
          };

          const config = ServiceFactory.createServiceConfig(
            'sandbox',
            {
              consumerKey: 'test-consumer-key',
              consumerSecret: 'test-consumer-secret',
              businessShortCode: '174379',
              passkey: 'test-passkey',
              environment: 'sandbox',
              callbackUrl: 'https://test.example.com/callback',
              encryptedAt: new Date(),
            } as any,
            { timeoutMs: 5000, retryAttempts: 1, rateLimitPerMinute: 100 }
          );

          const callbackHandler = new CallbackHandler(
            config,
            spyTransactionService as any,
            spyAuthenticator,
            mockLogger
          );

          // Act: Process the callback
          const result = await callbackHandler.handleSTKCallback(callbackData as STKCallbackData);

          // Assert: Authentication should be called, but processing should not proceed
          expect(authenticationCalled).toBe(true);
          expect(processingAttempted).toBe(false);
          expect(result.success).toBe(false);
          expect(result.error).toContain('authentication failed');
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  });

  /**
   * Property 11f: Default authenticator validates required fields presence
   */
  test('Property 11f: Default authenticator validates required field presence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          includeMerchantRequestID: fc.boolean(),
          includeCheckoutRequestID: fc.boolean(),
          includeResultCode: fc.boolean(),
          includeResultDesc: fc.boolean()
        }),
        async (flags) => {
          // Create callback with potentially missing fields (completely omitted, not undefined)
          const stkCallback: any = {};
          
          if (flags.includeMerchantRequestID) {
            stkCallback.MerchantRequestID = 'test-merchant-id';
          }
          if (flags.includeCheckoutRequestID) {
            stkCallback.CheckoutRequestID = 'test-checkout-id';
          }
          if (flags.includeResultCode) {
            stkCallback.ResultCode = 0;
          }
          if (flags.includeResultDesc) {
            stkCallback.ResultDesc = 'test description';
          }

          const callbackData = {
            Body: {
              stkCallback
            }
          };

          const authenticator = new DefaultCallbackAuthenticator(mockLogger);

          // Act: Validate the callback
          const isValid = await authenticator.validateCallback(callbackData);

          // Assert: Should only be valid if all required fields are present
          const hasAllRequiredFields = 
            flags.includeMerchantRequestID &&
            flags.includeCheckoutRequestID &&
            flags.includeResultCode &&
            flags.includeResultDesc;

          expect(isValid).toBe(hasAllRequiredFields);
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  });
});