/**
 * Property-based tests for M-PESA duplicate transaction prevention
 * Feature: mpesa-payment-integration, Property 15: Duplicate Transaction Prevention
 * Validates: Requirements 7.4
 */

import fc from 'fast-check';
import { RetryManager, createRetryManager } from '../middleware/retry-manager';
import { ErrorHandler, createErrorHandler } from '../middleware/error-handler';
import { TransactionStatus } from '../types';
import { Logger } from '../services/base';

// Mock logger for testing
class MockLogger implements Logger {
  public logs: Array<{ level: string; message: string; meta?: any }> = [];

  info(message: string, meta?: any): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: any): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: any): void {
    this.logs.push({ level: 'error', message, meta });
  }

  debug(message: string, meta?: any): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  clear(): void {
    this.logs = [];
  }
}

// Generators for test data
const phoneNumberGenerator = fc.string({ minLength: 10, maxLength: 15 })
  .filter(s => /^\d+$/.test(s))
  .map(s => `254${s.slice(0, 9)}`);

const amountGenerator = fc.integer({ min: 1, max: 100000 });

const tabIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const transactionIdGenerator = fc.string({ minLength: 10, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const transactionStatusGenerator = fc.oneof(
  fc.constant('pending' as TransactionStatus),
  fc.constant('sent' as TransactionStatus),
  fc.constant('completed' as TransactionStatus),
  fc.constant('failed' as TransactionStatus),
  fc.constant('cancelled' as TransactionStatus),
  fc.constant('timeout' as TransactionStatus)
);

const windowMsGenerator = fc.integer({ min: 1000, max: 600000 }); // 1 second to 10 minutes

describe('Duplicate Transaction Prevention Property Tests', () => {
  let mockLogger: MockLogger;
  let errorHandler: ErrorHandler;
  let retryManager: RetryManager;

  beforeEach(() => {
    mockLogger = new MockLogger();
    errorHandler = createErrorHandler(mockLogger, 'sandbox');
    retryManager = createRetryManager(mockLogger, errorHandler, undefined, false); // Disable auto-start
  });

  afterEach(() => {
    if (retryManager) {
      retryManager.cleanup();
    }
  });

  /**
   * Property 15: Duplicate Transaction Prevention
   * For any duplicate payment attempt, the system should prevent duplicate charges 
   * and return the original transaction status
   */
  describe('Property 15: Duplicate Transaction Prevention', () => {
    test('should detect duplicate transactions within the time window', () => {
      fc.assert(fc.property(
        phoneNumberGenerator,
        amountGenerator,
        tabIdGenerator,
        transactionIdGenerator,
        transactionStatusGenerator,
        windowMsGenerator,
        (phoneNumber, amount, tabId, transactionId, status, windowMs) => {
          // Arrange - Track the first transaction
          retryManager.trackTransaction(phoneNumber, amount, tabId, transactionId, status, windowMs);

          // Act - Check for duplicate with same parameters
          const duplicateCheck = retryManager.checkDuplicateTransaction(phoneNumber, amount, tabId, windowMs);

          // Assert - Should detect duplicate
          expect(duplicateCheck.isDuplicate).toBe(true);
          expect(duplicateCheck.existingTransactionId).toBe(transactionId);

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should not detect duplicates with different parameters', () => {
      fc.assert(fc.property(
        phoneNumberGenerator,
        amountGenerator,
        tabIdGenerator,
        transactionIdGenerator,
        transactionStatusGenerator,
        windowMsGenerator,
        phoneNumberGenerator,
        amountGenerator,
        tabIdGenerator,
        (phoneNumber1, amount1, tabId1, transactionId1, status1, windowMs, phoneNumber2, amount2, tabId2) => {
          // Ensure parameters are different
          fc.pre(phoneNumber1 !== phoneNumber2 || amount1 !== amount2 || tabId1 !== tabId2);

          // Arrange - Track the first transaction
          retryManager.trackTransaction(phoneNumber1, amount1, tabId1, transactionId1, status1, windowMs);

          // Act - Check for duplicate with different parameters
          const duplicateCheck = retryManager.checkDuplicateTransaction(phoneNumber2, amount2, tabId2, windowMs);

          // Assert - Should not detect duplicate
          expect(duplicateCheck.isDuplicate).toBe(false);
          expect(duplicateCheck.existingTransactionId).toBeUndefined();

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should not detect duplicates after time window expires', () => {
      fc.assert(fc.property(
        phoneNumberGenerator,
        amountGenerator,
        tabIdGenerator,
        transactionIdGenerator,
        transactionStatusGenerator,
        fc.integer({ min: 100, max: 1000 }), // Short window for testing
        (phoneNumber, amount, tabId, transactionId, status, windowMs) => {
          // Arrange - Track transaction with short window
          retryManager.trackTransaction(phoneNumber, amount, tabId, transactionId, status, windowMs);

          // Act - Wait for window to expire (simulate by using expired window)
          const expiredWindowMs = 1; // Very short window that should be expired
          const duplicateCheck = retryManager.checkDuplicateTransaction(phoneNumber, amount, tabId, expiredWindowMs);

          // Assert - Should not detect duplicate after expiry
          expect(duplicateCheck.isDuplicate).toBe(false);
          expect(duplicateCheck.existingTransactionId).toBeUndefined();

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should update transaction status in duplicate tracker', () => {
      fc.assert(fc.property(
        phoneNumberGenerator,
        amountGenerator,
        tabIdGenerator,
        transactionIdGenerator,
        transactionStatusGenerator,
        transactionStatusGenerator,
        windowMsGenerator,
        (phoneNumber, amount, tabId, transactionId, initialStatus, newStatus, windowMs) => {
          // Ensure statuses are different
          fc.pre(initialStatus !== newStatus);

          // Arrange - Track transaction with initial status
          retryManager.trackTransaction(phoneNumber, amount, tabId, transactionId, initialStatus, windowMs);

          // Act - Update transaction status
          retryManager.updateTransactionStatus(transactionId, newStatus);

          // Assert - Duplicate check should still work (status update doesn't affect duplicate detection)
          const duplicateCheck = retryManager.checkDuplicateTransaction(phoneNumber, amount, tabId, windowMs);
          expect(duplicateCheck.isDuplicate).toBe(true);
          expect(duplicateCheck.existingTransactionId).toBe(transactionId);

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should handle multiple transactions with different combinations', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          phoneNumber: phoneNumberGenerator,
          amount: amountGenerator,
          tabId: tabIdGenerator,
          transactionId: transactionIdGenerator,
          status: transactionStatusGenerator
        }), { minLength: 2, maxLength: 10 }),
        windowMsGenerator,
        (transactions, windowMs) => {
          // Arrange - Track all transactions
          transactions.forEach(tx => {
            retryManager.trackTransaction(tx.phoneNumber, tx.amount, tx.tabId, tx.transactionId, tx.status, windowMs);
          });

          // Act & Assert - Check each transaction for duplicates
          transactions.forEach((tx, index) => {
            const duplicateCheck = retryManager.checkDuplicateTransaction(tx.phoneNumber, tx.amount, tx.tabId, windowMs);
            
            // Should always detect as duplicate since we just tracked it
            expect(duplicateCheck.isDuplicate).toBe(true);
            expect(duplicateCheck.existingTransactionId).toBe(tx.transactionId);
          });

          // Act & Assert - Check for non-existent combinations
          const nonExistentCheck = retryManager.checkDuplicateTransaction(
            '254999999999', // Different phone
            999999, // Different amount
            'non-existent-tab', // Different tab
            windowMs
          );
          expect(nonExistentCheck.isDuplicate).toBe(false);

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should properly clean up expired duplicate trackers', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          phoneNumber: phoneNumberGenerator,
          amount: amountGenerator,
          tabId: tabIdGenerator,
          transactionId: transactionIdGenerator,
          status: transactionStatusGenerator,
          windowMs: fc.integer({ min: 100, max: 1000 }) // Short windows for testing
        }), { minLength: 1, maxLength: 5 }),
        (transactions) => {
          // Arrange - Track transactions with short windows
          transactions.forEach(tx => {
            retryManager.trackTransaction(tx.phoneNumber, tx.amount, tx.tabId, tx.transactionId, tx.status, tx.windowMs);
          });

          // Act - Check duplicates immediately (should find them)
          const immediateChecks = transactions.map(tx => 
            retryManager.checkDuplicateTransaction(tx.phoneNumber, tx.amount, tx.tabId, tx.windowMs)
          );

          // Assert - All should be detected as duplicates initially
          immediateChecks.forEach(check => {
            expect(check.isDuplicate).toBe(true);
          });

          // Act - Check duplicates with very short window (should trigger cleanup)
          const expiredChecks = transactions.map(tx => 
            retryManager.checkDuplicateTransaction(tx.phoneNumber, tx.amount, tx.tabId, 1) // 1ms window
          );

          // Assert - Should not detect duplicates after cleanup
          expiredChecks.forEach(check => {
            expect(check.isDuplicate).toBe(false);
          });

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should generate consistent transaction keys for same parameters', () => {
      fc.assert(fc.property(
        phoneNumberGenerator,
        amountGenerator,
        tabIdGenerator,
        transactionIdGenerator,
        transactionStatusGenerator,
        windowMsGenerator,
        (phoneNumber, amount, tabId, transactionId1, status, windowMs) => {
          const transactionId2 = `${transactionId1}_different`;

          // Arrange - Track first transaction
          retryManager.trackTransaction(phoneNumber, amount, tabId, transactionId1, status, windowMs);

          // Act - Try to track second transaction with same parameters but different ID
          retryManager.trackTransaction(phoneNumber, amount, tabId, transactionId2, status, windowMs);

          // Act - Check for duplicate
          const duplicateCheck = retryManager.checkDuplicateTransaction(phoneNumber, amount, tabId, windowMs);

          // Assert - Should detect duplicate (first transaction should be returned)
          expect(duplicateCheck.isDuplicate).toBe(true);
          // The existing transaction ID should be the first one tracked
          expect(duplicateCheck.existingTransactionId).toBe(transactionId1);

          return true;
        }
      ), { numRuns: 20 });
    });

    test('should handle edge cases with empty or special characters', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant('254700000000'),
          fc.constant('254711111111'),
          fc.constant('254722222222')
        ),
        fc.oneof(
          fc.constant(1),
          fc.constant(100),
          fc.constant(1000),
          fc.constant(70000)
        ),
        fc.oneof(
          fc.constant('tab-1'),
          fc.constant('tab_2'),
          fc.constant('tab.3'),
          fc.constant('tab 4')
        ),
        transactionIdGenerator,
        transactionStatusGenerator,
        windowMsGenerator,
        (phoneNumber, amount, tabId, transactionId, status, windowMs) => {
          // Arrange - Track transaction
          retryManager.trackTransaction(phoneNumber, amount, tabId, transactionId, status, windowMs);

          // Act - Check for duplicate
          const duplicateCheck = retryManager.checkDuplicateTransaction(phoneNumber, amount, tabId, windowMs);

          // Assert - Should work correctly with edge case values
          expect(duplicateCheck.isDuplicate).toBe(true);
          expect(duplicateCheck.existingTransactionId).toBe(transactionId);

          // Act - Check with slightly different values
          const differentAmountCheck = retryManager.checkDuplicateTransaction(phoneNumber, amount + 1, tabId, windowMs);
          expect(differentAmountCheck.isDuplicate).toBe(false);

          return true;
        }
      ), { numRuns: 20 });
    });
  });
});