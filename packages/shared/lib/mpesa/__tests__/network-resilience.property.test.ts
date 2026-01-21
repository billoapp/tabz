/**
 * Property-based tests for M-PESA network resilience
 * Feature: mpesa-payment-integration, Property 16: Network Resilience
 * Validates: Requirements 7.5, 7.6
 */

import fc from 'fast-check';
import { RetryManager, createRetryManager, RetryConfig } from '../middleware/retry-manager';
import { ErrorHandler, createErrorHandler } from '../middleware/error-handler';
import { MpesaNetworkError, MpesaError } from '../types';
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

// Mock operation that can fail with network errors
class MockNetworkOperation {
  private failureCount: number = 0;
  private maxFailures: number;
  private failureType: 'network' | 'timeout' | 'system' | 'auth';

  constructor(maxFailures: number, failureType: 'network' | 'timeout' | 'system' | 'auth' = 'network') {
    this.maxFailures = maxFailures;
    this.failureType = failureType;
  }

  async execute(): Promise<string> {
    if (this.failureCount < this.maxFailures) {
      this.failureCount++;
      
      switch (this.failureType) {
        case 'network':
          throw new MpesaNetworkError(`Network failure attempt ${this.failureCount}`);
        case 'timeout':
          throw new MpesaError('Request timeout', 'TIMEOUT_ERROR');
        case 'system':
          throw new MpesaError('System error', 'SYSTEM_ERROR');
        case 'auth':
          throw new MpesaError('Authentication failed', 'AUTHENTICATION_ERROR');
        default:
          throw new Error('Unknown error');
      }
    }
    
    return `Success after ${this.failureCount} failures`;
  }

  reset(): void {
    this.failureCount = 0;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

// Generators for test data
const operationTypeGenerator = fc.oneof(
  fc.constant('stkpush'),
  fc.constant('callback'),
  fc.constant('token_refresh'),
  fc.constant('status_query')
);

const failureTypeGenerator = fc.oneof(
  fc.constant('network' as const),
  fc.constant('timeout' as const),
  fc.constant('system' as const),
  fc.constant('auth' as const)
);

const retryConfigGenerator = fc.record({
  maxAttempts: fc.integer({ min: 1, max: 5 }),
  baseDelayMs: fc.integer({ min: 100, max: 2000 }),
  maxDelayMs: fc.integer({ min: 2000, max: 10000 }),
  backoffMultiplier: fc.float({ min: 1.5, max: 3.0 }),
  jitterMs: fc.integer({ min: 0, max: 1000 }),
  retryableErrors: fc.constant(['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SYSTEM_ERROR'])
});

describe('Network Resilience Property Tests', () => {
  let mockLogger: MockLogger;
  let errorHandler: ErrorHandler;
  let retryManager: RetryManager;

  beforeEach(() => {
    mockLogger = new MockLogger();
    errorHandler = createErrorHandler(mockLogger, 'sandbox');
  });

  afterEach(() => {
    if (retryManager) {
      retryManager.cleanup();
    }
  });

  /**
   * Property 16: Network Resilience
   * For any network error during callback processing, the system should implement 
   * proper retry logic with exponential backoff
   */
  describe('Property 16: Network Resilience', () => {
    test('should implement exponential backoff for retryable network errors', () => {
      fc.assert(fc.property(
        operationTypeGenerator,
        fc.integer({ min: 1, max: 3 }), // failures before success
        failureTypeGenerator,
        retryConfigGenerator,
        async (operationType, maxFailures, failureType, customConfig) => {
          // Skip non-retryable errors for this test
          fc.pre(['network', 'timeout', 'system'].includes(failureType));

          // Arrange
          const customConfigs = { [operationType]: customConfig };
          retryManager = createRetryManager(mockLogger, errorHandler, customConfigs, false);
          
          const mockOperation = new MockNetworkOperation(maxFailures, failureType);
          const operationId = `test_${Date.now()}`;
          
          mockLogger.clear();

          // Act
          const result = await retryManager.executeWithRetry(
            () => mockOperation.execute(),
            operationType,
            operationId,
            { testData: true }
          );

          // Assert - Operation eventually succeeded
          expect(result).toContain('Success after');
          expect(mockOperation.getFailureCount()).toBe(maxFailures);

          // Assert - Retry attempts were logged
          const retryLogs = mockLogger.logs.filter(log => 
            log.message.includes('failed, retrying in') || log.message.includes('succeeded on attempt')
          );
          expect(retryLogs.length).toBeGreaterThan(0);

          // Assert - Exponential backoff was applied (check log messages for increasing delays)
          const retryWarnings = mockLogger.logs.filter(log => 
            log.level === 'warn' && log.message.includes('failed, retrying in')
          );
          
          if (retryWarnings.length > 1) {
            // Extract delay values from log messages and verify they increase
            const delays = retryWarnings.map(log => {
              const match = log.message.match(/retrying in (\d+)ms/);
              return match ? parseInt(match[1]) : 0;
            });
            
            // Verify delays generally increase (allowing for jitter)
            for (let i = 1; i < delays.length; i++) {
              expect(delays[i]).toBeGreaterThanOrEqual(delays[i-1] * 0.8); // Allow 20% variance for jitter
            }
          }

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should not retry non-retryable errors', () => {
      fc.assert(fc.property(
        operationTypeGenerator,
        retryConfigGenerator,
        async (operationType, customConfig) => {
          // Arrange
          const customConfigs = { [operationType]: customConfig };
          retryManager = createRetryManager(mockLogger, errorHandler, customConfigs, false);
          
          const mockOperation = new MockNetworkOperation(1, 'auth'); // Auth errors are not retryable
          const operationId = `test_${Date.now()}`;
          
          mockLogger.clear();

          // Act & Assert - Should throw without retrying
          await expect(retryManager.executeWithRetry(
            () => mockOperation.execute(),
            operationType,
            operationId,
            { testData: true }
          )).rejects.toThrow();

          // Assert - Only one attempt was made
          expect(mockOperation.getFailureCount()).toBe(1);

          // Assert - No retry warnings in logs
          const retryWarnings = mockLogger.logs.filter(log => 
            log.level === 'warn' && log.message.includes('failed, retrying in')
          );
          expect(retryWarnings.length).toBe(0);

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should respect maximum retry attempts', () => {
      fc.assert(fc.property(
        operationTypeGenerator,
        fc.integer({ min: 1, max: 5 }), // max attempts
        retryConfigGenerator,
        async (operationType, maxAttempts, baseConfig) => {
          // Arrange
          const customConfig = { ...baseConfig, maxAttempts };
          const customConfigs = { [operationType]: customConfig };
          retryManager = createRetryManager(mockLogger, errorHandler, customConfigs, false);
          
          // Create operation that always fails
          const mockOperation = new MockNetworkOperation(maxAttempts + 10, 'network');
          const operationId = `test_${Date.now()}`;
          
          mockLogger.clear();

          // Act & Assert - Should eventually throw after max attempts
          await expect(retryManager.executeWithRetry(
            () => mockOperation.execute(),
            operationType,
            operationId,
            { testData: true }
          )).rejects.toThrow();

          // Assert - Exactly maxAttempts were made
          expect(mockOperation.getFailureCount()).toBe(maxAttempts);

          // Assert - Final error log indicates max attempts reached
          const errorLogs = mockLogger.logs.filter(log => 
            log.level === 'error' && log.message.includes('failed permanently')
          );
          expect(errorLogs.length).toBe(1);

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should apply jitter to prevent thundering herd', () => {
      fc.assert(fc.property(
        operationTypeGenerator,
        fc.integer({ min: 500, max: 2000 }), // jitter amount
        async (operationType, jitterMs) => {
          // Arrange
          const customConfig: RetryConfig = {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
            jitterMs,
            retryableErrors: ['NETWORK_ERROR']
          };
          const customConfigs = { [operationType]: customConfig };
          retryManager = createRetryManager(mockLogger, errorHandler, customConfigs, false);
          
          const mockOperation = new MockNetworkOperation(2, 'network');
          const operationId = `test_${Date.now()}`;
          
          mockLogger.clear();

          // Act
          await retryManager.executeWithRetry(
            () => mockOperation.execute(),
            operationType,
            operationId,
            { testData: true }
          );

          // Assert - Retry delays should vary due to jitter
          const retryWarnings = mockLogger.logs.filter(log => 
            log.level === 'warn' && log.message.includes('failed, retrying in')
          );
          
          if (retryWarnings.length > 0) {
            const delays = retryWarnings.map(log => {
              const match = log.message.match(/retrying in (\d+)ms/);
              return match ? parseInt(match[1]) : 0;
            });
            
            // Verify delays are within expected range (base + jitter)
            delays.forEach((delay, index) => {
              const expectedBase = customConfig.baseDelayMs * Math.pow(customConfig.backoffMultiplier, index);
              const minDelay = expectedBase;
              const maxDelay = expectedBase + jitterMs;
              
              expect(delay).toBeGreaterThanOrEqual(minDelay);
              expect(delay).toBeLessThanOrEqual(maxDelay);
            });
          }

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should handle callback retry queue with exponential backoff', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 10, maxLength: 50 }), // transaction ID
        fc.oneof(fc.constant('high'), fc.constant('normal'), fc.constant('low')), // priority
        async (transactionId, priority) => {
          // Arrange
          retryManager = createRetryManager(mockLogger, errorHandler, undefined, false);
          
          const callbackData = { 
            Body: { 
              stkCallback: { 
                CheckoutRequestID: 'test-checkout-id',
                ResultCode: 0,
                ResultDesc: 'Success'
              } 
            } 
          };
          
          mockLogger.clear();

          // Act - Add callback to retry queue
          const callbackId = retryManager.addCallbackToRetryQueue(callbackData, transactionId, priority);

          // Assert - Callback was added to queue
          expect(typeof callbackId).toBe('string');
          expect(callbackId).toContain('callback_');
          expect(callbackId).toContain(transactionId);

          // Assert - Addition was logged
          const addLogs = mockLogger.logs.filter(log => 
            log.message.includes('Added callback to retry queue')
          );
          expect(addLogs.length).toBe(1);
          expect(addLogs[0].meta.transactionId).toBe(transactionId);
          expect(addLogs[0].meta.priority).toBe(priority);

          // Assert - Queue stats show the item
          const stats = retryManager.getRetryStats();
          expect(stats.callbackQueueSize).toBeGreaterThan(0);
          
          const queueItem = stats.queueItems.find((item: any) => item.id === callbackId);
          expect(queueItem).toBeDefined();
          expect(queueItem.transactionId).toBe(transactionId);
          expect(queueItem.priority).toBe(priority);

          return true;
        }
      ), { numRuns: 10 });
    });

    test('should provide retry statistics and monitoring data', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          operationType: operationTypeGenerator,
          transactionId: fc.string({ minLength: 10, maxLength: 50 }),
          failureCount: fc.integer({ min: 0, max: 3 })
        }), { minLength: 1, maxLength: 5 }),
        async (operations) => {
          // Arrange
          retryManager = createRetryManager(mockLogger, errorHandler, undefined, false);
          
          // Act - Execute multiple operations
          for (const op of operations) {
            const mockOperation = new MockNetworkOperation(op.failureCount, 'network');
            
            try {
              await retryManager.executeWithRetry(
                () => mockOperation.execute(),
                op.operationType,
                op.transactionId,
                { testData: true }
              );
            } catch (error) {
              // Some operations may fail completely, that's okay for this test
            }
          }

          // Assert - Statistics are available
          const stats = retryManager.getRetryStats();
          expect(typeof stats).toBe('object');
          expect(typeof stats.activeRetryContexts).toBe('number');
          expect(typeof stats.callbackQueueSize).toBe('number');
          expect(typeof stats.duplicateTrackersCount).toBe('number');
          expect(Array.isArray(stats.queueItems)).toBe(true);

          // Assert - Statistics contain reasonable values
          expect(stats.activeRetryContexts).toBeGreaterThanOrEqual(0);
          expect(stats.callbackQueueSize).toBeGreaterThanOrEqual(0);
          expect(stats.duplicateTrackersCount).toBeGreaterThanOrEqual(0);

          return true;
        }
      ), { numRuns: 5 });
    });

    test('should handle concurrent retry operations without interference', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          operationType: operationTypeGenerator,
          operationId: fc.string({ minLength: 5, maxLength: 20 }),
          failureCount: fc.integer({ min: 0, max: 2 })
        }), { minLength: 2, maxLength: 5 }),
        async (operations) => {
          // Ensure unique operation IDs
          const uniqueOperations = operations.filter((op, index, arr) => 
            arr.findIndex(o => o.operationId === op.operationId) === index
          );
          fc.pre(uniqueOperations.length >= 2);

          // Arrange
          retryManager = createRetryManager(mockLogger, errorHandler, undefined, false);
          mockLogger.clear();

          // Act - Execute operations concurrently
          const promises = uniqueOperations.map(async (op) => {
            const mockOperation = new MockNetworkOperation(op.failureCount, 'network');
            
            try {
              const result = await retryManager.executeWithRetry(
                () => mockOperation.execute(),
                op.operationType,
                op.operationId,
                { testData: true }
              );
              return { operationId: op.operationId, success: true, result };
            } catch (error) {
              return { operationId: op.operationId, success: false, error };
            }
          });

          const results = await Promise.all(promises);

          // Assert - All operations completed (successfully or with failure)
          expect(results.length).toBe(uniqueOperations.length);
          
          // Assert - Each operation was handled independently
          results.forEach((result, index) => {
            expect(result.operationId).toBe(uniqueOperations[index].operationId);
            
            if (uniqueOperations[index].failureCount === 0) {
              expect(result.success).toBe(true);
            }
            // Operations with failures may succeed or fail depending on retry logic
          });

          // Assert - Logs contain entries for all operations
          const operationIds = results.map(r => r.operationId);
          operationIds.forEach(opId => {
            const operationLogs = mockLogger.logs.filter(log => 
              log.meta && log.meta.operationId === opId
            );
            expect(operationLogs.length).toBeGreaterThan(0);
          });

          return true;
        }
      ), { numRuns: 5 });
    });
  });
});