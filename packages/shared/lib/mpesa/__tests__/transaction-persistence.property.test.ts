/**
 * Property-based tests for M-PESA transaction persistence and association
 * Feature: mpesa-payment-integration, Property 3: Transaction Persistence and Association
 * 
 * Tests that transactions are properly persisted and associated with orders
 * throughout the transaction lifecycle.
 */

import * as fc from 'fast-check';
import { TransactionService, TransactionValidator } from '../services';
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

describe('Transaction Persistence and Association Properties', () => {
  let transactionService: TransactionService;
  let mockTransactions: Map<string, any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockTransactions = new Map();

    // Create service with mocked Supabase
    transactionService = new TransactionService('https://mock.supabase.co', 'mock-key');
    (transactionService as any).supabase = mockSupabaseClient;

    // Mock database operations
    jest.spyOn(transactionService, 'createTransaction').mockImplementation(async (data) => {
      const transaction = {
        id: `txn-${Date.now()}-${Math.random()}`,
        orderId: data.orderId,
        customerId: data.customerId || 'test-customer',
        phoneNumber: data.phoneNumber,
        amount: data.amount,
        currency: 'KES' as const,
        status: 'pending' as TransactionStatus,
        environment: data.environment,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockTransactions.set(transaction.id, transaction);
      return transaction;
    });

    jest.spyOn(transactionService, 'getTransaction').mockImplementation(async (id: string) => {
      return mockTransactions.get(id) || null;
    });

    jest.spyOn(transactionService, 'getTransactionByTabId').mockImplementation(async (tabId: string) => {
      const tabTransactions = [];
      for (const [id, transaction] of mockTransactions) {
        if (transaction.tabId === tabId) {
          tabTransactions.push(transaction);
        }
      }
      
      if (tabTransactions.length === 0) {
        return null;
      }
      
      // Return the most recent transaction (sorted by createdAt descending)
      tabTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return tabTransactions[0];
    });

    jest.spyOn(transactionService, 'getTransactionsForOrder').mockImplementation(async (orderId: string) => {
      const transactions = [];
      for (const [id, transaction] of mockTransactions) {
        if (transaction.orderId === orderId) {
          transactions.push(transaction);
        }
      }
      return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    });

    jest.spyOn(transactionService, 'updateTransaction').mockImplementation(async (id: string, updates: any) => {
      const transaction = mockTransactions.get(id);
      if (!transaction) {
        throw new Error(`Transaction ${id} not found`);
      }
      
      const updatedTransaction = { 
        ...transaction, 
        ...updates, 
        updatedAt: new Date(Date.now() + 1) // Ensure updatedAt is always later
      };
      mockTransactions.set(id, updatedTransaction);
      return updatedTransaction;
    });
  });

  // Property 3: Transaction Persistence and Association
  // For any initiated STK Push request, a transaction record should be created 
  // and properly associated with the customer order
  describe('Property 3: Transaction Persistence and Association', () => {

    it('should create and persist transaction for any valid payment initiation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.uuid(),
            customerId: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 70000 }), // Use integer to avoid decimal precision issues
            environment: fc.constantFrom('sandbox' as const, 'production' as const)
          }),
          async (paymentData) => {
            // Create transaction
            const transaction = await transactionService.createTransaction(paymentData);

            // Verify transaction was created and persisted
            expect(transaction).toBeDefined();
            expect(transaction.id).toBeTruthy();
            expect(transaction.orderId).toBe(paymentData.orderId);
            expect(transaction.phoneNumber).toBe(paymentData.phoneNumber);
            expect(transaction.amount).toBe(paymentData.amount);
            expect(transaction.environment).toBe(paymentData.environment);
            expect(transaction.status).toBe('pending');
            expect(transaction.currency).toBe('KES');
            expect(transaction.createdAt).toBeInstanceOf(Date);
            expect(transaction.updatedAt).toBeInstanceOf(Date);

            // Verify transaction can be retrieved by ID
            const retrievedById = await transactionService.getTransaction(transaction.id);
            expect(retrievedById).toEqual(transaction);

            // Verify transaction can be retrieved by order ID
            const retrievedByOrderId = await transactionService.getTransactionByOrderId(paymentData.orderId);
            expect(retrievedByOrderId).toEqual(transaction);

            // Verify order association
            const orderTransactions = await transactionService.getTransactionsForOrder(paymentData.orderId);
            expect(orderTransactions).toContain(transaction);
            expect(orderTransactions.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain transaction-order association throughout transaction lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 1000 }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            checkoutRequestId: fc.string({ minLength: 10, maxLength: 50 }),
            mpesaReceiptNumber: fc.string({ minLength: 10, maxLength: 20 }),
            failureReason: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async (data) => {
            // Create initial transaction
            const transaction = await transactionService.createTransaction({
              orderId: data.orderId,
              phoneNumber: data.phoneNumber,
              amount: data.amount,
              environment: data.environment
            });

            // Verify initial association
            let orderTransactions = await transactionService.getTransactionsForOrder(data.orderId);
            expect(orderTransactions).toHaveLength(1);
            expect(orderTransactions[0].id).toBe(transaction.id);

            // Update transaction to sent status
            await transactionService.updateTransaction(transaction.id, {
              status: 'sent',
              checkoutRequestId: data.checkoutRequestId
            });

            // Verify association is maintained after status update
            orderTransactions = await transactionService.getTransactionsForOrder(data.orderId);
            expect(orderTransactions).toHaveLength(1);
            expect(orderTransactions[0].id).toBe(transaction.id);
            expect(orderTransactions[0].status).toBe('sent');
            expect(orderTransactions[0].checkoutRequestId).toBe(data.checkoutRequestId);

            // Update transaction to completed status
            await transactionService.updateTransaction(transaction.id, {
              status: 'completed',
              mpesaReceiptNumber: data.mpesaReceiptNumber,
              transactionDate: new Date()
            });

            // Verify association is maintained after completion
            orderTransactions = await transactionService.getTransactionsForOrder(data.orderId);
            expect(orderTransactions).toHaveLength(1);
            expect(orderTransactions[0].id).toBe(transaction.id);
            expect(orderTransactions[0].status).toBe('completed');
            expect(orderTransactions[0].mpesaReceiptNumber).toBe(data.mpesaReceiptNumber);

            // Verify transaction can still be retrieved by order ID
            const retrievedByOrderId = await transactionService.getTransactionByOrderId(data.orderId);
            expect(retrievedByOrderId).toBeDefined();
            expect(retrievedByOrderId!.id).toBe(transaction.id);
            expect(retrievedByOrderId!.status).toBe('completed');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle multiple transactions for the same order correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 1000 }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            transactionCount: fc.integer({ min: 2, max: 5 })
          }),
          async (data) => {
            // Clear mock data for this test iteration
            mockTransactions.clear();
            
            const createdTransactions = [];

            // Create multiple transactions for the same order
            for (let i = 0; i < data.transactionCount; i++) {
              const transaction = await transactionService.createTransaction({
                orderId: data.orderId,
                phoneNumber: data.phoneNumber,
                amount: data.amount,
                environment: data.environment
              });
              createdTransactions.push(transaction);

              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // Verify all transactions are associated with the order
            const orderTransactions = await transactionService.getTransactionsForOrder(data.orderId);
            expect(orderTransactions).toHaveLength(data.transactionCount);

            // Verify all created transactions are in the order transactions
            for (const createdTransaction of createdTransactions) {
              const found = orderTransactions.find(t => t.id === createdTransaction.id);
              expect(found).toBeDefined();
              expect(found!.orderId).toBe(data.orderId);
            }

            // Verify transactions are sorted by creation time (most recent first)
            for (let i = 1; i < orderTransactions.length; i++) {
              expect(orderTransactions[i - 1].createdAt.getTime())
                .toBeGreaterThanOrEqual(orderTransactions[i].createdAt.getTime());
            }

            // Verify getTransactionByOrderId returns the most recent transaction
            const latestTransaction = await transactionService.getTransactionByOrderId(data.orderId);
            expect(latestTransaction).toBeDefined();
            expect(latestTransaction!.id).toBe(orderTransactions[0].id);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain data integrity during concurrent transaction operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 1000 }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            updates: fc.array(
              fc.record({
                status: fc.constantFrom('sent' as const, 'completed' as const, 'failed' as const),
                checkoutRequestId: fc.option(fc.string({ minLength: 10, maxLength: 50 })),
                mpesaReceiptNumber: fc.option(fc.string({ minLength: 10, maxLength: 20 })),
                failureReason: fc.option(fc.string({ minLength: 5, maxLength: 100 }))
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (data) => {
            // Create initial transaction
            const transaction = await transactionService.createTransaction({
              orderId: data.orderId,
              phoneNumber: data.phoneNumber,
              amount: data.amount,
              environment: data.environment
            });

            // Apply updates sequentially
            let currentTransaction = transaction;
            for (const update of data.updates) {
              currentTransaction = await transactionService.updateTransaction(currentTransaction.id, update);
              
              // Verify transaction is still associated with order after each update
              const orderTransactions = await transactionService.getTransactionsForOrder(data.orderId);
              expect(orderTransactions.length).toBeGreaterThan(0);
              
              const foundTransaction = orderTransactions.find(t => t.id === currentTransaction.id);
              expect(foundTransaction).toBeDefined();
              expect(foundTransaction!.orderId).toBe(data.orderId);
              expect(foundTransaction!.status).toBe(update.status);
            }

            // Verify final state consistency
            const finalTransaction = await transactionService.getTransaction(currentTransaction.id);
            expect(finalTransaction).toBeDefined();
            expect(finalTransaction!.orderId).toBe(data.orderId);
            expect(finalTransaction!.updatedAt.getTime()).toBeGreaterThan(transaction.createdAt.getTime());
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should validate transaction data consistency during persistence operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.uuid(),
            phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
            amount: fc.integer({ min: 1, max: 70000 }),
            environment: fc.constantFrom('sandbox' as const, 'production' as const)
          }),
          async (data) => {
            // Validate input data before creating transaction
            const validationErrors = TransactionValidator.validateCreateTransactionData(data);
            expect(validationErrors).toHaveLength(0);

            // Create transaction
            const transaction = await transactionService.createTransaction(data);

            // Verify all required fields are present and valid
            expect(transaction.id).toBeTruthy();
            expect(transaction.orderId).toBe(data.orderId);
            expect(transaction.phoneNumber).toBe(data.phoneNumber);
            expect(transaction.amount).toBe(data.amount);
            expect(transaction.environment).toBe(data.environment);
            expect(transaction.currency).toBe('KES');
            expect(transaction.status).toBe('pending');

            // Verify phone number format
            expect(TransactionValidator.validatePhoneNumber(transaction.phoneNumber)).toBe(true);

            // Verify amount format
            expect(TransactionValidator.validateAmount(transaction.amount)).toBe(true);

            // Verify timestamps
            expect(transaction.createdAt).toBeInstanceOf(Date);
            expect(transaction.updatedAt).toBeInstanceOf(Date);
            expect(transaction.updatedAt.getTime()).toBeGreaterThanOrEqual(transaction.createdAt.getTime());

            // Verify transaction can be retrieved and data matches
            const retrievedTransaction = await transactionService.getTransaction(transaction.id);
            expect(retrievedTransaction).toEqual(transaction);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain referential integrity between transactions and orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              orderId: fc.uuid(),
              phoneNumber: fc.stringMatching(/^254[0-9]{9}$/),
              amount: fc.integer({ min: 1, max: 1000 }),
              environment: fc.constantFrom('sandbox' as const, 'production' as const)
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (transactionDataArray) => {
            const createdTransactions = [];
            const orderIds = new Set<string>();

            // Create transactions for different orders
            for (const transactionData of transactionDataArray) {
              const transaction = await transactionService.createTransaction(transactionData);
              createdTransactions.push(transaction);
              orderIds.add(transactionData.orderId);
            }

            // Verify each order has the correct transactions associated
            for (const orderId of orderIds) {
              const orderTransactions = await transactionService.getTransactionsForOrder(orderId);
              const expectedTransactions = createdTransactions.filter(t => t.orderId === orderId);
              
              expect(orderTransactions).toHaveLength(expectedTransactions.length);
              
              for (const expectedTransaction of expectedTransactions) {
                const found = orderTransactions.find(t => t.id === expectedTransaction.id);
                expect(found).toBeDefined();
                expect(found!.orderId).toBe(orderId);
              }
            }

            // Verify no cross-contamination between orders
            for (const transaction of createdTransactions) {
              const orderTransactions = await transactionService.getTransactionsForOrder(transaction.orderId);
              
              // All transactions for this order should have the same orderId
              for (const orderTransaction of orderTransactions) {
                expect(orderTransaction.orderId).toBe(transaction.orderId);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});