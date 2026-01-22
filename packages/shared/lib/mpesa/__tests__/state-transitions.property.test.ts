/**
 * Property-based tests for M-PESA transaction state transitions
 * Feature: mpesa-payment-integration, Property 6: Transaction State Transitions
 * 
 * Tests that transaction state transitions follow the defined flow and maintain
 * proper data consistency throughout the transaction lifecycle.
 */

import * as fc from 'fast-check';
import { TransactionService, TransactionStateMachine, StateMachineUtils } from '../services';
import { TransactionStatus, MpesaEnvironment } from '../types';

// Mock Supabase client for testing
const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    })),
    rpc: jest.fn()
  }))
};

describe('Transaction State Transitions Properties', () => {
  let transactionService: TransactionService;
  let stateMachine: TransactionStateMachine;
  let mockTransactions: Map<string, any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockTransactions = new Map();

    // Create service with mocked Supabase
    transactionService = new TransactionService('https://mock.supabase.co', 'mock-key');
    (transactionService as any).supabase = mockSupabaseClient;

    // Mock transaction service methods
    jest.spyOn(transactionService, 'getTransaction').mockImplementation(async (id: string) => {
      const transaction = mockTransactions.get(id);
      return transaction || null;
    });

    jest.spyOn(transactionService, 'updateTransaction').mockImplementation(async (id: string, updates: any) => {
      const transaction = mockTransactions.get(id);
      if (!transaction) {
        throw new Error(`Transaction ${id} not found`);
      }
      
      const updatedTransaction = { ...transaction, ...updates, updatedAt: new Date() };
      mockTransactions.set(id, updatedTransaction);
      return updatedTransaction;
    });

    jest.spyOn(transactionService, 'getTransactionByCheckoutRequestId').mockImplementation(async (checkoutRequestId: string) => {
      for (const [id, transaction] of mockTransactions) {
        if (transaction.checkoutRequestId === checkoutRequestId) {
          return transaction;
        }
      }
      return null;
    });

    stateMachine = new TransactionStateMachine(transactionService);
  });

  afterEach(() => {
    if (stateMachine) {
      stateMachine.cleanup();
    }
  });

  // Property 6: Transaction State Transitions
  // For any transaction, state transitions should follow the defined flow:
  // pending → sent → (completed|failed|cancelled|timeout), with proper data updates at each transition
  describe('Property 6: Transaction State Transitions', () => {

    it('should only allow valid state transitions for any transaction', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate transaction data
          fc.record({
            id: fc.uuid(),
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.float({ min: 1, max: 1000, noNaN: true }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            initialStatus: fc.constantFrom('pending' as const, 'sent' as const, 'failed' as const, 'cancelled' as const, 'timeout' as const),
            targetStatus: fc.constantFrom('pending' as const, 'sent' as const, 'completed' as const, 'failed' as const, 'cancelled' as const, 'timeout' as const)
          }),
          async (transactionData) => {
            // Create mock transaction
            const transaction = {
              id: transactionData.id,
              orderId: transactionData.orderId,
              customerId: 'test-customer',
              phoneNumber: transactionData.phoneNumber,
              amount: transactionData.amount,
              currency: 'KES',
              status: transactionData.initialStatus,
              environment: transactionData.environment,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            mockTransactions.set(transactionData.id, transaction);

            // Check if transition is valid
            const isValidTransition = stateMachine.isValidTransition(
              transactionData.initialStatus,
              transactionData.targetStatus
            );

            if (isValidTransition) {
              // Valid transition should succeed
              // For sent->cancelled transition, provide the required result code
              const context = transactionData.initialStatus === 'sent' && transactionData.targetStatus === 'cancelled'
                ? { resultCode: 1032 }
                : {};

              await expect(
                stateMachine.transitionTo(transactionData.id, transactionData.targetStatus, context)
              ).resolves.not.toThrow();

              // Verify transaction status was updated
              const updatedTransaction = mockTransactions.get(transactionData.id);
              expect(updatedTransaction.status).toBe(transactionData.targetStatus);
            } else {
              // Invalid transition should throw error
              await expect(
                stateMachine.transitionTo(transactionData.id, transactionData.targetStatus)
              ).rejects.toThrow(/Invalid state transition/);

              // Verify transaction status was not changed
              const unchangedTransaction = mockTransactions.get(transactionData.id);
              expect(unchangedTransaction.status).toBe(transactionData.initialStatus);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain data consistency during state transitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.float({ min: 1, max: 1000, noNaN: true }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            checkoutRequestId: fc.string({ minLength: 10, maxLength: 50 }),
            mpesaReceiptNumber: fc.string({ minLength: 10, maxLength: 20 }),
            failureReason: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async (data) => {
            // Test pending → sent transition
            const pendingTransaction = {
              id: data.id,
              orderId: data.orderId,
              customerId: 'test-customer',
              phoneNumber: data.phoneNumber,
              amount: data.amount,
              currency: 'KES',
              status: 'pending' as TransactionStatus,
              environment: data.environment,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            mockTransactions.set(data.id, pendingTransaction);

            // Transition to sent with checkout request ID
            await stateMachine.transitionTo(data.id, 'sent', {
              checkoutRequestId: data.checkoutRequestId
            });

            let transaction = mockTransactions.get(data.id);
            expect(transaction.status).toBe('sent');
            expect(transaction.checkoutRequestId).toBe(data.checkoutRequestId);

            // Test sent → completed transition
            await stateMachine.transitionTo(data.id, 'completed', {
              mpesaReceiptNumber: data.mpesaReceiptNumber,
              transactionDate: new Date()
            });

            transaction = mockTransactions.get(data.id);
            expect(transaction.status).toBe('completed');
            expect(transaction.mpesaReceiptNumber).toBe(data.mpesaReceiptNumber);
            expect(transaction.transactionDate).toBeDefined();

            // Verify completed transaction cannot be changed
            await expect(
              stateMachine.transitionTo(data.id, 'failed')
            ).rejects.toThrow(/Invalid state transition/);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should properly handle retry transitions from terminal states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.float({ min: 1, max: 1000, noNaN: true }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            terminalStatus: fc.constantFrom('failed' as const, 'cancelled' as const, 'timeout' as const),
            failureReason: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async (data) => {
            // Create transaction in terminal state
            const transaction = {
              id: data.id,
              orderId: data.orderId,
              customerId: 'test-customer',
              phoneNumber: data.phoneNumber,
              amount: data.amount,
              currency: 'KES',
              status: data.terminalStatus,
              failureReason: data.failureReason,
              environment: data.environment,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            mockTransactions.set(data.id, transaction);

            // Should be able to retry (transition back to pending)
            await stateMachine.transitionTo(data.id, 'pending');

            const retriedTransaction = mockTransactions.get(data.id);
            expect(retriedTransaction.status).toBe('pending');
            
            // Failure data should be cleared for retry
            expect(retriedTransaction.failureReason).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should correctly process M-PESA callbacks and transition states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.float({ min: 1, max: 1000, noNaN: true }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            checkoutRequestId: fc.string({ minLength: 10, maxLength: 50 }),
            resultCode: fc.constantFrom(0, 1032, 1001, 1037), // Success, cancelled, timeout, other failure
            mpesaReceiptNumber: fc.string({ minLength: 10, maxLength: 20 }),
            resultDesc: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async (data) => {
            // Create transaction in sent state
            const transaction = {
              id: data.id,
              orderId: data.orderId,
              customerId: 'test-customer',
              phoneNumber: data.phoneNumber,
              amount: data.amount,
              currency: 'KES',
              status: 'sent' as TransactionStatus,
              checkoutRequestId: data.checkoutRequestId,
              environment: data.environment,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            mockTransactions.set(data.id, transaction);

            // Create callback data
            const callbackData = {
              Body: {
                stkCallback: {
                  MerchantRequestID: 'test-merchant-id',
                  CheckoutRequestID: data.checkoutRequestId,
                  ResultCode: data.resultCode,
                  ResultDesc: data.resultDesc,
                  CallbackMetadata: data.resultCode === 0 ? {
                    Item: [
                      { Name: 'MpesaReceiptNumber', Value: data.mpesaReceiptNumber },
                      { Name: 'TransactionDate', Value: '20240101120000' },
                      { Name: 'Amount', Value: data.amount },
                      { Name: 'PhoneNumber', Value: data.phoneNumber }
                    ]
                  } : undefined
                }
              }
            };

            // Process callback
            await stateMachine.processCallback(data.checkoutRequestId, callbackData);

            const updatedTransaction = mockTransactions.get(data.id);

            // Verify correct state transition based on result code
            if (data.resultCode === 0) {
              expect(updatedTransaction.status).toBe('completed');
              expect(updatedTransaction.mpesaReceiptNumber).toBe(data.mpesaReceiptNumber);
            } else if (data.resultCode === 1032) {
              expect(updatedTransaction.status).toBe('cancelled');
              expect(updatedTransaction.failureReason).toContain('cancelled');
            } else {
              expect(updatedTransaction.status).toBe('failed');
              expect(updatedTransaction.failureReason).toBe(data.resultDesc);
            }

            expect(updatedTransaction.resultCode).toBe(data.resultCode);
            expect(updatedTransaction.callbackData).toEqual(callbackData);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain valid next states for any current state', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pending' as const, 'sent' as const, 'completed' as const, 'failed' as const, 'cancelled' as const, 'timeout' as const),
          (currentStatus) => {
            const validNextStates = stateMachine.getValidNextStates(currentStatus);

            // Verify valid next states are correct for each status
            switch (currentStatus) {
              case 'pending':
                expect(validNextStates).toEqual(['sent']);
                break;
              case 'sent':
                expect(validNextStates).toEqual(expect.arrayContaining(['completed', 'failed', 'cancelled', 'timeout']));
                expect(validNextStates).toHaveLength(4);
                break;
              case 'failed':
              case 'cancelled':
              case 'timeout':
                expect(validNextStates).toEqual(['pending']);
                break;
              case 'completed':
                expect(validNextStates).toEqual([]);
                break;
            }

            // Verify all returned states are valid transitions
            validNextStates.forEach(nextState => {
              expect(stateMachine.isValidTransition(currentStatus, nextState)).toBe(true);
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should correctly identify final states and retry capabilities', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pending' as const, 'sent' as const, 'completed' as const, 'failed' as const, 'cancelled' as const, 'timeout' as const),
          (status) => {
            const isFinal = StateMachineUtils.isFinalState(status);
            const canRetry = StateMachineUtils.canRetry(status);

            // Verify final state logic
            if (status === 'completed') {
              expect(isFinal).toBe(true);
              expect(canRetry).toBe(false);
            } else if (['failed', 'cancelled', 'timeout'].includes(status)) {
              expect(isFinal).toBe(false);
              expect(canRetry).toBe(true);
            } else {
              expect(isFinal).toBe(false);
              expect(canRetry).toBe(false);
            }

            // Verify status description exists
            const description = StateMachineUtils.getStatusDescription(status);
            expect(description).toBeTruthy();
            expect(typeof description).toBe('string');

            // Verify status color exists
            const color = StateMachineUtils.getStatusColor(status);
            expect(color).toBeTruthy();
            expect(typeof color).toBe('string');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain transaction state summary consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.float({ min: 1, max: 1000, noNaN: true }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            status: fc.constantFrom('pending' as const, 'sent' as const, 'completed' as const, 'failed' as const, 'cancelled' as const, 'timeout' as const)
          }),
          async (data) => {
            // Create transaction
            const transaction = {
              id: data.id,
              orderId: data.orderId,
              customerId: 'test-customer',
              phoneNumber: data.phoneNumber,
              amount: data.amount,
              currency: 'KES',
              status: data.status,
              environment: data.environment,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            mockTransactions.set(data.id, transaction);

            // Get state summary
            const summary = await stateMachine.getTransactionStateSummary(data.id);

            // Verify summary consistency
            expect(summary.currentStatus).toBe(data.status);
            expect(summary.validNextStates).toEqual(stateMachine.getValidNextStates(data.status));
            expect(summary.canRetry).toBe(StateMachineUtils.canRetry(data.status));
            expect(summary.isCompleted).toBe(data.status === 'completed');
            expect(summary.isFinal).toBe(StateMachineUtils.isFinalState(data.status));
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});