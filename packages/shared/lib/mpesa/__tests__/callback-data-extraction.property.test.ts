/**
 * Property-Based Tests for M-PESA Callback Data Extraction
 * Feature: mpesa-payment-integration, Property 5: Callback Data Extraction Completeness
 * 
 * Tests that for any valid M-PESA callback (successful or failed), 
 * all relevant data fields are correctly extracted and processed according to the callback type.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import fc from 'fast-check';
import { CallbackHandler, DefaultCallbackAuthenticator } from '../services/callback';
import { TransactionService } from '../services/transaction';
import { ServiceFactory } from '../services/base';
import { STKCallbackData, MpesaEnvironment, Transaction } from '../types';

// Transaction service interface for testing
interface ITransactionService {
  findByCheckoutRequestId(checkoutRequestId: string): Promise<Transaction | null>;
  updateTransactionStatus(id: string, status: any, additionalData?: any): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | null>;
  getRecentTransactions(limit?: number): Promise<Transaction[]>;
}

// Mock transaction service for testing
class MockTransactionService implements ITransactionService {
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

    // Update in map using checkout request ID as key
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

  // Helper method for tests
  addMockTransaction(transaction: Transaction): void {
    this.mockTransactions.set(transaction.checkoutRequestId!, transaction);
  }

  clearMockTransactions(): void {
    this.mockTransactions.clear();
  }
}

// Test generators
const generateCheckoutRequestId = () => fc.string({ minLength: 15, maxLength: 30 }).map(s => 
  s.replace(/[^a-zA-Z0-9]/g, 'A') // Ensure alphanumeric
);

const generateMerchantRequestId = () => fc.string({ minLength: 15, maxLength: 30 }).map(s => 
  s.replace(/[^a-zA-Z0-9]/g, 'B') // Ensure alphanumeric
);

const generateMpesaReceiptNumber = () => fc.string({ minLength: 8, maxLength: 15 }).map(s => 
  s.replace(/[^a-zA-Z0-9]/g, 'X').toUpperCase()
);

const generatePhoneNumber = () => fc.integer({ min: 700000000, max: 799999999 }).map(n => 
  `254${n}`
);

const generateAmount = () => fc.float({ min: 1, max: 999999, noNaN: true }).map(n => 
  Math.round(n * 100) / 100 // Round to 2 decimal places
);

const generateTransactionDate = () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
  
  return fc.date({ min: pastDate, max: now }).map(date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  });
};

const generateSuccessfulCallback = () => fc.record({
  checkoutRequestId: generateCheckoutRequestId(),
  merchantRequestId: generateMerchantRequestId(),
  mpesaReceiptNumber: generateMpesaReceiptNumber(),
  phoneNumber: generatePhoneNumber(),
  amount: generateAmount(),
  transactionDate: generateTransactionDate()
}).map(data => ({
  Body: {
    stkCallback: {
      MerchantRequestID: data.merchantRequestId,
      CheckoutRequestID: data.checkoutRequestId,
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'MpesaReceiptNumber', Value: data.mpesaReceiptNumber },
          { Name: 'TransactionDate', Value: data.transactionDate },
          { Name: 'Amount', Value: data.amount },
          { Name: 'PhoneNumber', Value: data.phoneNumber }
        ]
      }
    }
  }
}));

const generateFailedCallback = () => fc.record({
  checkoutRequestId: generateCheckoutRequestId(),
  merchantRequestId: generateMerchantRequestId(),
  resultCode: fc.constantFrom(1, 1032, 1037, 2001), // Common M-PESA error codes
  resultDesc: fc.constantFrom(
    'Insufficient funds',
    'Request cancelled by user',
    'STK Push Timeout',
    'Invalid initiator information'
  )
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

const generateMockTransaction = () => fc.record({
  id: fc.uuid(),
  checkoutRequestId: generateCheckoutRequestId(),
  tabId: fc.uuid(),
  customerId: fc.uuid(),
  phoneNumber: generatePhoneNumber(),
  amount: generateAmount()
}).map(data => ({
  ...data,
  currency: 'KES' as const,
  status: 'sent' as const,
  environment: 'sandbox' as MpesaEnvironment,
  createdAt: new Date(),
  updatedAt: new Date()
}));

describe('M-PESA Callback Data Extraction Property Tests', () => {
  let callbackHandler: CallbackHandler;
  let mockTransactionService: MockTransactionService;

  beforeEach(() => {
    mockTransactionService = new MockTransactionService();
    
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

    const logger = ServiceFactory.createLogger();
    const authenticator = new DefaultCallbackAuthenticator(logger);

    callbackHandler = new CallbackHandler(
      config,
      mockTransactionService as any, // Type assertion for testing
      authenticator,
      logger
    );
  });

  afterEach(() => {
    mockTransactionService.clearMockTransactions();
  });

  /**
   * Property 5: Callback Data Extraction Completeness
   * For any valid successful M-PESA callback, all required data fields should be correctly extracted
   */
  test('Property 5a: Successful callback data extraction completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(generateSuccessfulCallback(), generateMockTransaction()),
        async ([callbackData, mockTransaction]) => {
          // Setup: Create mock transaction with matching checkout request ID
          const transactionWithMatchingId = {
            ...mockTransaction,
            checkoutRequestId: callbackData.Body.stkCallback.CheckoutRequestID
          };
          mockTransactionService.addMockTransaction(transactionWithMatchingId);

          // Act: Process the callback
          const result = await callbackHandler.handleSTKCallback(callbackData as STKCallbackData);

          // Assert: Callback should be processed successfully
          expect(result.success).toBe(true);
          expect(result.transactionId).toBe(transactionWithMatchingId.id);
          expect(result.status).toBe('completed');

          // Verify that all callback metadata was extracted and used
          // The transaction should be updated with the callback data
          const updatedTransaction = await mockTransactionService.findByCheckoutRequestId(
            callbackData.Body.stkCallback.CheckoutRequestID
          );

          expect(updatedTransaction).toBeTruthy();
          expect(updatedTransaction!.status).toBe('completed');
          expect(updatedTransaction!.mpesaReceiptNumber).toBe(
            callbackData.Body.stkCallback.CallbackMetadata!.Item.find(item => item.Name === 'MpesaReceiptNumber')!.Value
          );
          expect(updatedTransaction!.callbackData).toEqual(callbackData);
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  });

  /**
   * Property 5b: Failed callback data extraction completeness
   * For any valid failed M-PESA callback, error codes and descriptions should be correctly extracted
   */
  test('Property 5b: Failed callback data extraction completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(generateFailedCallback(), generateMockTransaction()),
        async ([callbackData, mockTransaction]) => {
          // Setup: Create mock transaction with matching checkout request ID
          const transactionWithMatchingId = {
            ...mockTransaction,
            checkoutRequestId: callbackData.Body.stkCallback.CheckoutRequestID
          };
          mockTransactionService.addMockTransaction(transactionWithMatchingId);

          // Act: Process the callback
          const result = await callbackHandler.handleSTKCallback(callbackData as STKCallbackData);

          // Assert: Callback should be processed successfully
          expect(result.success).toBe(true);
          expect(result.transactionId).toBe(transactionWithMatchingId.id);

          // Verify status mapping based on result code
          const expectedStatus = callbackData.Body.stkCallback.ResultCode === 1032 ? 'cancelled' :
                               callbackData.Body.stkCallback.ResultCode === 1037 ? 'timeout' : 'failed';
          expect(result.status).toBe(expectedStatus);

          // Verify that error information was extracted and stored
          const updatedTransaction = await mockTransactionService.findByCheckoutRequestId(
            callbackData.Body.stkCallback.CheckoutRequestID
          );

          expect(updatedTransaction).toBeTruthy();
          expect(updatedTransaction!.status).toBe(expectedStatus);
          expect(updatedTransaction!.failureReason).toBe(callbackData.Body.stkCallback.ResultDesc);
          expect(updatedTransaction!.resultCode).toBe(callbackData.Body.stkCallback.ResultCode);
          expect(updatedTransaction!.callbackData).toEqual(callbackData);
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  });

  /**
   * Property 5c: Callback validation completeness
   * For any callback with missing required fields, validation should fail with appropriate errors
   */
  test('Property 5c: Callback validation identifies missing fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          checkoutRequestId: fc.option(generateCheckoutRequestId(), { nil: undefined }),
          merchantRequestId: fc.option(generateMerchantRequestId(), { nil: undefined }),
          resultCode: fc.option(fc.integer({ min: 0, max: 9999 }), { nil: undefined }),
          resultDesc: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
        }),
        async (incompleteData) => {
          // Create callback with potentially missing fields
          const callbackData = {
            Body: {
              stkCallback: {
                ...(incompleteData.merchantRequestId && { MerchantRequestID: incompleteData.merchantRequestId }),
                ...(incompleteData.checkoutRequestId && { CheckoutRequestID: incompleteData.checkoutRequestId }),
                ...(incompleteData.resultCode !== undefined && { ResultCode: incompleteData.resultCode }),
                ...(incompleteData.resultDesc && { ResultDesc: incompleteData.resultDesc })
              }
            }
          };

          // Check if any required field is missing
          const hasAllRequiredFields = 
            incompleteData.merchantRequestId &&
            incompleteData.checkoutRequestId &&
            incompleteData.resultCode !== undefined &&
            incompleteData.resultDesc;

          // Act: Validate the callback
          const validation = callbackHandler.validateCallback(callbackData as STKCallbackData);

          // Assert: Validation should fail if any required field is missing
          if (!hasAllRequiredFields) {
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
          } else {
            // If all fields are present, validation should pass
            expect(validation.isValid).toBe(true);
          }
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  });

  /**
   * Property 5d: Successful callback metadata validation
   * For successful callbacks (ResultCode = 0), all required metadata fields must be present
   */
  test('Property 5d: Successful callback requires complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          checkoutRequestId: generateCheckoutRequestId(),
          merchantRequestId: generateMerchantRequestId(),
          hasReceiptNumber: fc.boolean(),
          hasAmount: fc.boolean(),
          hasPhoneNumber: fc.boolean(),
          hasTransactionDate: fc.boolean()
        }),
        async (testData) => {
          // Create callback metadata with potentially missing fields
          const metadataItems: Array<{ Name: string; Value: string | number }> = [];
          if (testData.hasReceiptNumber) {
            metadataItems.push({ Name: 'MpesaReceiptNumber', Value: 'TEST123456789' });
          }
          if (testData.hasAmount) {
            metadataItems.push({ Name: 'Amount', Value: 100.50 });
          }
          if (testData.hasPhoneNumber) {
            metadataItems.push({ Name: 'PhoneNumber', Value: '254712345678' });
          }
          if (testData.hasTransactionDate) {
            metadataItems.push({ Name: 'TransactionDate', Value: '20240120143000' });
          }

          const callbackData = {
            Body: {
              stkCallback: {
                MerchantRequestID: testData.merchantRequestId,
                CheckoutRequestID: testData.checkoutRequestId,
                ResultCode: 0, // Success
                ResultDesc: 'Success',
                CallbackMetadata: {
                  Item: metadataItems
                }
              }
            }
          };

          // Act: Validate the callback
          const validation = callbackHandler.validateCallback(callbackData as STKCallbackData);

          // Assert: Validation should only pass if all required metadata is present
          const hasAllMetadata = testData.hasReceiptNumber && testData.hasAmount && 
                                testData.hasPhoneNumber && testData.hasTransactionDate;

          if (hasAllMetadata) {
            expect(validation.isValid).toBe(true);
          } else {
            expect(validation.isValid).toBe(false);
            expect(validation.errors.some(error => error.includes('metadata'))).toBe(true);
          }
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  });
});