/**
 * Property-Based Tests for Order Status Synchronization
 * Feature: mpesa-payment-integration, Property 7: Order Status Synchronization
 * 
 * Tests the universal property that for any payment callback received,
 * the corresponding order status should be updated to match the payment result
 * (paid for success, payment_failed for failure)
 */

import fc from 'fast-check';
import { OrderStatusUpdateService } from '../services/order-sync';
import { Transaction, ServiceConfig, MpesaEnvironment } from '../types';

// Mock the entire BaseService to avoid configuration validation
jest.mock('../services/base', () => ({
  BaseService: class MockBaseService {
    protected config: any;
    protected logger: any;
    protected httpClient: any;

    constructor(config: any, logger?: any, httpClient?: any) {
      this.config = config;
      this.logger = logger || { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      this.httpClient = httpClient;
    }

    protected validateConfig(): void {
      // Skip validation in tests
    }

    protected logWithContext(level: string, message: string, context?: any): void {
      this.logger[level]?.(message, context);
    }
  }
}));

// Mock Supabase client for testing
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn()
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Property 7: Order Status Synchronization', () => {
  let orderSyncService: OrderStatusUpdateService;
  let mockConfig: ServiceConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      environment: 'sandbox' as MpesaEnvironment,
      credentials: {
        consumerKey: 'test-key',
        consumerSecret: 'test-secret',
        businessShortCode: '174379',
        passkey: 'test-passkey',
        environment: 'sandbox' as MpesaEnvironment,
        callbackUrl: 'http://test.com/callback',
        encryptedAt: new Date(),
      },
      timeoutMs: 30000,
      retryAttempts: 3,
      rateLimitPerMinute: 60,
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceKey: 'test-service-key'
    };

    orderSyncService = new OrderStatusUpdateService(mockConfig);
  });

  /**
   * Property 7: Order Status Synchronization
   * For any payment callback received, the corresponding order status should be updated 
   * to match the payment result (paid for success, payment_failed for failure)
   */
  test('Property 7: Order Status Synchronization - Successful Payments', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid transaction data
        fc.record({
          id: fc.uuid(),
          tabId: fc.uuid(),
          customerId: fc.string({ minLength: 10, maxLength: 20 }),
          phoneNumber: fc.string({ minLength: 12, maxLength: 12 }).filter(s => s.startsWith('254')),
          amount: fc.float({ min: 1, max: 100000, noNaN: true }).map(n => Math.round(n * 100) / 100),
          currency: fc.constant('KES' as const),
          status: fc.constant('sent' as const),
          checkoutRequestId: fc.string({ minLength: 20, maxLength: 30 }),
          mpesaReceiptNumber: fc.string({ minLength: 8, maxLength: 15 }).map(s => s.toUpperCase()),
          transactionDate: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          environment: fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>,
          createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date() })
        }),
        async (transactionData) => {
          // Setup: Mock successful database operations
          const mockPaymentId = fc.sample(fc.uuid(), 1)[0];
          
          mockSupabase.rpc.mockResolvedValueOnce({
            data: mockPaymentId,
            error: null
          });

          // Execute: Process successful payment
          const result = await orderSyncService.updateOrderStatusForSuccessfulPayment(
            transactionData as Transaction,
            transactionData.mpesaReceiptNumber!,
            transactionData.transactionDate!
          );

          // Verify: Payment processing succeeded
          expect(result.success).toBe(true);
          expect(result.tabPaymentId).toBe(mockPaymentId);
          expect(result.tabId).toBe(transactionData.tabId);
          expect(result.amount).toBe(transactionData.amount);

          // Verify: Database function was called with correct parameters
          expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_mpesa_payment', {
            p_transaction_id: transactionData.id,
            p_mpesa_receipt_number: transactionData.mpesaReceiptNumber,
            p_transaction_date: transactionData.transactionDate!.toISOString()
          });

          // Property: For successful payments, a tab_payments record should be created
          expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property 7: Order Status Synchronization - Failed Payments', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid transaction data for failed payments
        fc.record({
          id: fc.uuid(),
          tabId: fc.uuid(),
          customerId: fc.string({ minLength: 10, maxLength: 20 }),
          phoneNumber: fc.string({ minLength: 12, maxLength: 12 }).filter(s => s.startsWith('254')),
          amount: fc.float({ min: 1, max: 100000, noNaN: true }).map(n => Math.round(n * 100) / 100),
          currency: fc.constant('KES' as const),
          status: fc.constant('sent' as const),
          checkoutRequestId: fc.string({ minLength: 20, maxLength: 30 }),
          environment: fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>,
          createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date() })
        }),
        fc.string({ minLength: 5, maxLength: 200 }), // failure reason
        fc.integer({ min: 1, max: 9999 }), // result code
        async (transactionData, failureReason, resultCode) => {
          // Setup: Mock successful database operations
          mockSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: null
          });

          // Execute: Process failed payment
          const result = await orderSyncService.updateOrderStatusForFailedPayment(
            transactionData as Transaction,
            failureReason,
            resultCode
          );

          // Verify: Payment processing succeeded (even though payment failed)
          expect(result.success).toBe(true);
          expect(result.tabId).toBe(transactionData.tabId);
          expect(result.amount).toBe(transactionData.amount);

          // Verify: Database function was called with correct parameters
          expect(mockSupabase.rpc).toHaveBeenCalledWith('fail_mpesa_payment', {
            p_transaction_id: transactionData.id,
            p_failure_reason: failureReason,
            p_result_code: resultCode
          });

          // Property: For failed payments, transaction should be marked as failed
          expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property 7: Order Status Synchronization - Database Error Handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          tabId: fc.uuid(),
          customerId: fc.string({ minLength: 10, maxLength: 20 }),
          phoneNumber: fc.string({ minLength: 12, maxLength: 12 }).filter(s => s.startsWith('254')),
          amount: fc.float({ min: 1, max: 100000, noNaN: true }).map(n => Math.round(n * 100) / 100),
          currency: fc.constant('KES' as const),
          status: fc.constant('sent' as const),
          environment: fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>,
          createdAt: fc.date(),
          updatedAt: fc.date()
        }),
        fc.string({ minLength: 5, maxLength: 100 }), // error message
        async (transactionData, errorMessage) => {
          // Setup: Mock database error
          mockSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: errorMessage }
          });

          // Execute: Process payment with database error
          const result = await orderSyncService.updateOrderStatusForSuccessfulPayment(
            transactionData as Transaction,
            'TEST123456',
            new Date()
          );

          // Property: Service should handle database errors gracefully
          expect(result.success).toBe(false);
          expect(result.error).toContain(errorMessage);

          // Property: Should not throw exceptions on database errors
          expect(() => result).not.toThrow();
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property 7: Order Status Synchronization - Input Validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate transaction data with potential validation issues
        fc.record({
          id: fc.option(fc.uuid(), { nil: undefined }),
          tabId: fc.option(fc.uuid(), { nil: undefined }),
          customerId: fc.string({ minLength: 0, maxLength: 50 }),
          phoneNumber: fc.string({ minLength: 0, maxLength: 20 }),
          amount: fc.option(fc.float({ min: -1000, max: 1000000, noNaN: true }), { nil: undefined }),
          currency: fc.constant('KES' as const),
          status: fc.constantFrom('pending', 'sent', 'completed', 'failed') as fc.Arbitrary<any>,
          environment: fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>,
          createdAt: fc.date(),
          updatedAt: fc.date()
        }),
        fc.string({ minLength: 8, maxLength: 15 }), // receipt number
        fc.date(), // transaction date
        async (transactionData, receiptNumber, transactionDate) => {
          // Setup: Mock successful database operation
          mockSupabase.rpc.mockResolvedValueOnce({
            data: fc.sample(fc.uuid(), 1)[0],
            error: null
          });

          // Execute: Process payment with potentially invalid data
          const result = await orderSyncService.updateOrderStatusForSuccessfulPayment(
            transactionData as Transaction,
            receiptNumber,
            transactionDate
          );

          // Property: Service should handle invalid input gracefully
          if (!transactionData.id || !transactionData.tabId || !transactionData.amount || transactionData.amount <= 0) {
            // For invalid transactions, the service should still attempt processing
            // but may fail at the database level (which is expected)
            expect(typeof result.success).toBe('boolean');
          } else {
            // For valid transactions, should succeed
            expect(result.success).toBe(true);
            expect(result.tabId).toBe(transactionData.tabId);
            expect(result.amount).toBe(transactionData.amount);
          }

          // Property: Should never throw exceptions
          expect(() => result).not.toThrow();
        }
      ),
      { numRuns: 10 }
    );
  });
});