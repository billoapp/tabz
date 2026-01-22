/**
 * M-PESA End-to-End Integration Test Suite
 * Comprehensive integration testing for the complete M-PESA payment flow
 * Tests all components working together from payment initiation to completion
 */

import { STKPushService } from '../services/stkpush';
import { CallbackService } from '../services/callback';
import { TransactionStateMachine } from '../services/state-machine';
import { TransactionService } from '../services/transaction';
import { OrderSyncService } from '../services/order-sync';
import { ErrorHandler } from '../middleware/error-handler';
import { RateLimiter } from '../middleware/rate-limiter';
import { AuditLogger } from '../middleware/audit-logger';
import { MpesaConfig } from '../config';
import { 
  sandboxTestDataGenerator,
  mockCallbackGenerator,
  sandboxValidator 
} from '../testing/sandbox-utilities';
import { 
  TransactionStatus, 
  STKPushRequest, 
  STKCallbackData,
  PaymentInitiationResult,
  MpesaPaymentStatus 
} from '../types';

describe('M-PESA End-to-End Integration Tests', () => {
  let stkPushService: STKPushService;
  let callbackService: CallbackService;
  let transactionService: TransactionService;
  let orderSyncService: OrderSyncService;
  let errorHandler: ErrorHandler;
  let rateLimiter: RateLimiter;
  let auditLogger: AuditLogger;
  let config: MpesaConfig;

  // Mock external dependencies
  let mockDatabase: Map<string, any>;
  let mockOrderSystem: Map<string, any>;
  let mockMpesaAPI: jest.Mock;

  beforeEach(async () => {
    // Initialize mock storage
    mockDatabase = new Map();
    mockOrderSystem = new Map();
    mockMpesaAPI = jest.fn();

    // Initialize configuration for sandbox
    config = new MpesaConfig('sandbox');
    
    // Initialize services
    transactionService = new TransactionService(mockDatabase as any);
    orderSyncService = new OrderSyncService(mockOrderSystem as any);
    errorHandler = new ErrorHandler();
    rateLimiter = new RateLimiter();
    auditLogger = new AuditLogger();
    
    stkPushService = new STKPushService(config, errorHandler);
    callbackService = new CallbackService(
      transactionService,
      orderSyncService,
      auditLogger,
      errorHandler
    );

    // Mock M-PESA API responses
    jest.spyOn(stkPushService, 'sendSTKPush').mockImplementation(async (request) => {
      const checkoutRequestId = sandboxTestDataGenerator.generateCheckoutRequestId();
      return {
        MerchantRequestID: sandboxTestDataGenerator.generateMerchantRequestId(),
        CheckoutRequestID: checkoutRequestId,
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      };
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Payment Flow Integration', () => {
    it('should complete successful payment flow from initiation to callback processing', async () => {
      // Step 1: Generate test data
      const orderId = 'order_' + Date.now();
      const customerId = 'customer_' + Date.now();
      const phoneNumber = '254708374149'; // Sandbox test number
      const amount = 100;

      // Create mock order
      mockOrderSystem.set(orderId, {
        id: orderId,
        customerId,
        amount,
        status: 'pending_payment',
        items: [{ name: 'Test Item', price: amount }]
      });

      // Step 2: Initiate payment
      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      expect(paymentResult.success).toBe(true);
      expect(paymentResult.transactionId).toBeDefined();
      expect(paymentResult.checkoutRequestId).toBeDefined();

      // Verify transaction was created
      const transaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(transaction).toBeDefined();
      expect(transaction.status).toBe('sent');
      expect(transaction.orderId).toBe(orderId);
      expect(transaction.amount).toBe(amount);
      expect(transaction.phoneNumber).toBe(phoneNumber);

      // Step 3: Simulate successful callback
      const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
        paymentResult.checkoutRequestId!,
        amount,
        phoneNumber
      );

      await callbackHandler.handleSTKCallback(successCallback);

      // Step 4: Verify final state
      const updatedTransaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(updatedTransaction.status).toBe('completed');
      expect(updatedTransaction.mpesaReceiptNumber).toBeDefined();
      expect(updatedTransaction.transactionDate).toBeDefined();

      // Verify order was updated
      const updatedOrder = mockOrderSystem.get(orderId);
      expect(updatedOrder.status).toBe('paid');
      expect(updatedOrder.paymentDetails).toBeDefined();
      expect(updatedOrder.paymentDetails.mpesaReceiptNumber).toBe(updatedTransaction.mpesaReceiptNumber);
    });

    it('should handle failed payment flow correctly', async () => {
      // Step 1: Setup test data
      const orderId = 'order_fail_' + Date.now();
      const customerId = 'customer_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 50;

      mockOrderSystem.set(orderId, {
        id: orderId,
        customerId,
        amount,
        status: 'pending_payment'
      });

      // Step 2: Initiate payment
      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      expect(paymentResult.success).toBe(true);

      // Step 3: Simulate failed callback (user cancelled)
      const failedCallback = mockCallbackGenerator.generateFailedCallback(
        paymentResult.checkoutRequestId!,
        1032,
        'Request cancelled by user'
      );

      await callbackHandler.handleSTKCallback(failedCallback);

      // Step 4: Verify final state
      const updatedTransaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(updatedTransaction.status).toBe('cancelled');
      expect(updatedTransaction.failureReason).toBe('Request cancelled by user');

      // Verify order status
      const updatedOrder = mockOrderSystem.get(orderId);
      expect(updatedOrder.status).toBe('payment_failed');
      expect(updatedOrder.failureReason).toBe('Request cancelled by user');
    });

    it('should handle timeout scenarios correctly', async () => {
      // Step 1: Setup test data
      const orderId = 'order_timeout_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 75;

      mockOrderSystem.set(orderId, {
        id: orderId,
        amount,
        status: 'pending_payment'
      });

      // Step 2: Initiate payment
      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      // Step 3: Simulate timeout callback
      const timeoutCallback = mockCallbackGenerator.generateTimeoutCallback(
        paymentResult.checkoutRequestId!
      );

      await callbackHandler.handleSTKCallback(timeoutCallback);

      // Step 4: Verify timeout handling
      const updatedTransaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(updatedTransaction.status).toBe('timeout');
      expect(updatedTransaction.failureReason).toBe('DS timeout user cannot be reached');

      const updatedOrder = mockOrderSystem.get(orderId);
      expect(updatedOrder.status).toBe('payment_failed');
    });

    it('should handle retry scenarios correctly', async () => {
      // Step 1: Setup initial failed payment
      const orderId = 'order_retry_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 200;

      mockOrderSystem.set(orderId, {
        id: orderId,
        amount,
        status: 'pending_payment'
      });

      // Step 2: First payment attempt (fails)
      const firstPaymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      const failedCallback = mockCallbackGenerator.generateFailedCallback(
        firstPaymentResult.checkoutRequestId!,
        1,
        'Insufficient funds in account'
      );

      await callbackHandler.handleSTKCallback(failedCallback);

      // Step 3: Retry payment
      const retryResult = await paymentService.retryPayment(firstPaymentResult.transactionId!);
      expect(retryResult.success).toBe(true);
      expect(retryResult.transactionId).toBe(firstPaymentResult.transactionId);

      // Step 4: Second attempt succeeds
      const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
        retryResult.checkoutRequestId!,
        amount,
        phoneNumber
      );

      await callbackHandler.handleSTKCallback(successCallback);

      // Step 5: Verify final success state
      const finalTransaction = await transactionService.getTransaction(firstPaymentResult.transactionId!);
      expect(finalTransaction.status).toBe('completed');
      expect(finalTransaction.mpesaReceiptNumber).toBeDefined();

      const finalOrder = mockOrderSystem.get(orderId);
      expect(finalOrder.status).toBe('paid');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle M-PESA API errors gracefully', async () => {
      // Mock API failure
      jest.spyOn(stkPushHandler, 'sendSTKPush').mockRejectedValue(
        new Error('Connection timeout')
      );

      const orderId = 'order_api_error_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 100;

      mockOrderSystem.set(orderId, {
        id: orderId,
        amount,
        status: 'pending_payment'
      });

      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      expect(paymentResult.success).toBe(false);
      expect(paymentResult.error).toContain('Connection timeout');
      expect(paymentResult.transactionId).toBeDefined();

      // Verify transaction was created with failed status
      const transaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(transaction.status).toBe('failed');
    });

    it('should handle invalid callback data gracefully', async () => {
      const invalidCallback = {
        Body: {
          stkCallback: {
            // Missing required fields
            ResultCode: 0
          }
        }
      } as any;

      // Should not throw error
      await expect(callbackHandler.handleSTKCallback(invalidCallback)).resolves.not.toThrow();
    });

    it('should handle duplicate callbacks correctly', async () => {
      // Setup successful payment
      const orderId = 'order_duplicate_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 150;

      mockOrderSystem.set(orderId, {
        id: orderId,
        amount,
        status: 'pending_payment'
      });

      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
        paymentResult.checkoutRequestId!,
        amount,
        phoneNumber
      );

      // Process callback first time
      await callbackHandler.handleSTKCallback(successCallback);

      const firstProcessTransaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(firstProcessTransaction.status).toBe('completed');

      // Process same callback again (duplicate)
      await callbackHandler.handleSTKCallback(successCallback);

      // Should remain in completed state, not cause errors
      const secondProcessTransaction = await transactionService.getTransaction(paymentResult.transactionId!);
      expect(secondProcessTransaction.status).toBe('completed');
      expect(secondProcessTransaction.mpesaReceiptNumber).toBe(firstProcessTransaction.mpesaReceiptNumber);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits across payment attempts', async () => {
      const phoneNumber = '254708374149';
      const amount = 100;

      // Attempt multiple payments rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const orderId = `order_rate_${i}_${Date.now()}`;
        mockOrderSystem.set(orderId, {
          id: orderId,
          amount,
          status: 'pending_payment'
        });

        promises.push(paymentService.initiatePayment(orderId, phoneNumber, amount));
      }

      const results = await Promise.all(promises);

      // Some requests should be rate limited
      const successCount = results.filter(r => r.success).length;
      const rateLimitedCount = results.filter(r => !r.success && r.error?.includes('rate limit')).length;

      expect(successCount).toBeLessThan(10);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log all payment activities comprehensively', async () => {
      const auditLogSpy = jest.spyOn(auditLogger, 'logTransaction');

      const orderId = 'order_audit_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 300;

      mockOrderSystem.set(orderId, {
        id: orderId,
        amount,
        status: 'pending_payment'
      });

      // Complete payment flow
      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
        paymentResult.checkoutRequestId!,
        amount,
        phoneNumber
      );

      await callbackHandler.handleSTKCallback(successCallback);

      // Verify audit logging
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_initiated',
          transactionId: paymentResult.transactionId,
          orderId,
          amount,
          phoneNumber: expect.stringContaining('***') // Should be masked
        })
      );

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_completed',
          transactionId: paymentResult.transactionId
        })
      );
    });
  });

  describe('Environment Configuration Integration', () => {
    it('should use correct URLs and settings for sandbox environment', async () => {
      expect(config.environment).toBe('sandbox');
      expect(config.baseURL).toContain('sandbox');
      expect(config.stkPushURL).toContain('sandbox');
    });

    it('should validate sandbox constraints during payment flow', async () => {
      const orderId = 'order_sandbox_' + Date.now();
      const invalidPhoneNumber = '254700000000'; // Not approved for sandbox
      const amount = 100;

      mockOrderSystem.set(orderId, {
        id: orderId,
        amount,
        status: 'pending_payment'
      });

      const paymentResult = await paymentService.initiatePayment(
        orderId,
        invalidPhoneNumber,
        amount
      );

      expect(paymentResult.success).toBe(false);
      expect(paymentResult.error).toContain('not approved for sandbox testing');
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent payment requests efficiently', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const orderId = `order_perf_${i}_${Date.now()}`;
        const phoneNumber = '254708374149';
        const amount = 50;

        mockOrderSystem.set(orderId, {
          id: orderId,
          amount,
          status: 'pending_payment'
        });

        promises.push(paymentService.initiatePayment(orderId, phoneNumber, amount));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Most requests should succeed (accounting for rate limiting)
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(concurrentRequests * 0.5);
    });

    it('should process callbacks efficiently', async () => {
      // Setup multiple pending transactions
      const transactions = [];
      for (let i = 0; i < 50; i++) {
        const orderId = `order_callback_perf_${i}_${Date.now()}`;
        const phoneNumber = '254708374149';
        const amount = 100;

        mockOrderSystem.set(orderId, {
          id: orderId,
          amount,
          status: 'pending_payment'
        });

        const paymentResult = await paymentService.initiatePayment(orderId, phoneNumber, amount);
        transactions.push(paymentResult);
      }

      // Process callbacks concurrently
      const startTime = Date.now();
      const callbackPromises = transactions.map(async (payment) => {
        const callback = mockCallbackGenerator.generateSuccessfulCallback(
          payment.checkoutRequestId!,
          100,
          '254708374149'
        );
        return callbackHandler.handleSTKCallback(callback);
      });

      await Promise.all(callbackPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process all callbacks within reasonable time
      expect(duration).toBeLessThan(3000);

      // Verify all transactions were updated
      for (const payment of transactions) {
        const transaction = await transactionService.getTransaction(payment.transactionId!);
        expect(transaction.status).toBe('completed');
      }
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across all components', async () => {
      const orderId = 'order_consistency_' + Date.now();
      const customerId = 'customer_consistency_' + Date.now();
      const phoneNumber = '254708374149';
      const amount = 500;

      // Create order with specific data
      const originalOrder = {
        id: orderId,
        customerId,
        amount,
        status: 'pending_payment',
        createdAt: new Date(),
        items: [
          { id: 'item1', name: 'Test Item 1', price: 300 },
          { id: 'item2', name: 'Test Item 2', price: 200 }
        ]
      };

      mockOrderSystem.set(orderId, originalOrder);

      // Complete payment flow
      const paymentResult = await paymentService.initiatePayment(
        orderId,
        phoneNumber,
        amount
      );

      const successCallback = mockCallbackGenerator.generateSuccessfulCallback(
        paymentResult.checkoutRequestId!,
        amount,
        phoneNumber
      );

      await callbackHandler.handleSTKCallback(successCallback);

      // Verify data consistency
      const transaction = await transactionService.getTransaction(paymentResult.transactionId!);
      const updatedOrder = mockOrderSystem.get(orderId);

      // Transaction data should match order data
      expect(transaction.orderId).toBe(orderId);
      expect(transaction.amount).toBe(amount);
      expect(transaction.phoneNumber).toBe(phoneNumber);
      expect(transaction.status).toBe('completed');

      // Order should be updated consistently
      expect(updatedOrder.status).toBe('paid');
      expect(updatedOrder.paymentDetails.amount).toBe(amount);
      expect(updatedOrder.paymentDetails.mpesaReceiptNumber).toBe(transaction.mpesaReceiptNumber);
      expect(updatedOrder.paymentDetails.transactionId).toBe(transaction.id);

      // Original order data should be preserved
      expect(updatedOrder.id).toBe(originalOrder.id);
      expect(updatedOrder.customerId).toBe(originalOrder.customerId);
      expect(updatedOrder.items).toEqual(originalOrder.items);
    });
  });
});