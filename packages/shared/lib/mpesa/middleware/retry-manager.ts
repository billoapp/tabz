/**
 * Retry and recovery mechanisms for M-PESA integration
 * Implements exponential backoff, callback retry queue, and duplicate prevention
 * Requirements: 7.4, 7.5, 7.6
 */

import { Logger } from '../services/base';
import { MpesaError, MpesaNetworkError, TransactionStatus } from '../types';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './error-handler';

/**
 * Retry configuration for different operation types
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryableErrors: string[];
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  attemptNumber: number;
  timestamp: Date;
  error?: any;
  delayMs: number;
}

/**
 * Retry operation context
 */
export interface RetryContext {
  operationId: string;
  operationType: 'stkpush' | 'callback' | 'token_refresh' | 'status_query';
  attempts: RetryAttempt[];
  maxAttempts: number;
  nextRetryAt?: Date;
  lastError?: any;
  metadata: Record<string, any>;
}

/**
 * Callback retry queue item
 */
export interface CallbackRetryItem {
  id: string;
  callbackData: any;
  transactionId: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  createdAt: Date;
  lastError?: any;
  priority: 'high' | 'normal' | 'low';
}

/**
 * Duplicate transaction tracking
 */
export interface DuplicateTracker {
  transactionKey: string;
  transactionId: string;
  status: TransactionStatus;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Default retry configurations for different operations
 */
const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  stkpush: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterMs: 500,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SYSTEM_ERROR']
  },
  callback: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterMs: 1000,
    retryableErrors: ['NETWORK_ERROR', 'DATABASE_ERROR', 'SYSTEM_ERROR']
  },
  token_refresh: {
    maxAttempts: 2,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
    jitterMs: 100,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
  },
  status_query: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
    jitterMs: 500,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR']
  }
};

/**
 * Main retry manager class
 */
export class RetryManager {
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private retryContexts: Map<string, RetryContext> = new Map();
  private callbackQueue: Map<string, CallbackRetryItem> = new Map();
  private duplicateTrackers: Map<string, DuplicateTracker> = new Map();
  private retryConfigs: Record<string, RetryConfig>;
  private queueProcessor?: NodeJS.Timeout;
  private autoStartQueue: boolean;

  constructor(
    logger: Logger,
    errorHandler: ErrorHandler,
    customConfigs?: Partial<Record<string, RetryConfig>>,
    autoStartQueue: boolean = true
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    // Filter out undefined values from customConfigs
    const validCustomConfigs: Record<string, RetryConfig> = {};
    if (customConfigs) {
      Object.entries(customConfigs).forEach(([key, value]) => {
        if (value !== undefined) {
          validCustomConfigs[key] = value;
        }
      });
    }
    
    this.retryConfigs = { ...DEFAULT_RETRY_CONFIGS, ...validCustomConfigs };
    this.autoStartQueue = autoStartQueue;
    
    // Start callback queue processor only if auto-start is enabled
    if (this.autoStartQueue) {
      this.startQueueProcessor();
    }
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    operationId: string,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const config = this.retryConfigs[operationType] || this.retryConfigs.stkpush;
    
    const context: RetryContext = {
      operationId,
      operationType: operationType as any,
      attempts: [],
      maxAttempts: config.maxAttempts,
      metadata
    };

    this.retryContexts.set(operationId, context);

    try {
      return await this.executeWithContext(operation, context, config);
    } finally {
      // Clean up context after completion
      setTimeout(() => this.retryContexts.delete(operationId), 60000);
    }
  }

  /**
   * Execute operation with retry context
   */
  private async executeWithContext<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    config: RetryConfig
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptInfo: RetryAttempt = {
        attemptNumber: attempt,
        timestamp: new Date(),
        delayMs: 0
      };

      context.attempts.push(attemptInfo);

      try {
        this.logger.debug(`Executing ${context.operationType} attempt ${attempt}/${config.maxAttempts}`, {
          operationId: context.operationId,
          metadata: context.metadata
        });

        const result = await operation();
        
        this.logger.info(`${context.operationType} succeeded on attempt ${attempt}`, {
          operationId: context.operationId,
          totalAttempts: attempt
        });

        return result;
      } catch (error) {
        lastError = error;
        attemptInfo.error = error;
        context.lastError = error;

        const errorInfo = this.errorHandler.handleError(error, {
          operationId: context.operationId,
          operationType: context.operationType,
          attempt,
          maxAttempts: config.maxAttempts
        });

        // Check if error is retryable
        if (!this.isRetryableError(errorInfo.code, config) || attempt === config.maxAttempts) {
          this.logger.error(`${context.operationType} failed permanently`, {
            operationId: context.operationId,
            attempt,
            errorCode: errorInfo.code,
            errorMessage: errorInfo.message
          });
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        attemptInfo.delayMs = delay;
        context.nextRetryAt = new Date(Date.now() + delay);

        this.logger.warn(`${context.operationType} failed, retrying in ${delay}ms`, {
          operationId: context.operationId,
          attempt,
          errorCode: errorInfo.code,
          nextRetryAt: context.nextRetryAt
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable based on configuration
   */
  private isRetryableError(errorCode: string, config: RetryConfig): boolean {
    return config.retryableErrors.includes(errorCode);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add random jitter to prevent thundering herd
    const jitter = Math.random() * config.jitterMs;
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Add callback to retry queue
   */
  addCallbackToRetryQueue(
    callbackData: any,
    transactionId: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const id = `callback_${transactionId}_${Date.now()}`;
    const config = this.retryConfigs.callback;
    
    const item: CallbackRetryItem = {
      id,
      callbackData,
      transactionId,
      attempts: 0,
      maxAttempts: config.maxAttempts,
      nextRetryAt: new Date(),
      createdAt: new Date(),
      priority
    };

    this.callbackQueue.set(id, item);
    
    this.logger.info('Added callback to retry queue', {
      callbackId: id,
      transactionId,
      priority,
      maxAttempts: config.maxAttempts
    });

    return id;
  }

  /**
   * Process callback retry queue
   */
  private async processCallbackQueue(): Promise<void> {
    const now = new Date();
    const readyItems = Array.from(this.callbackQueue.values())
      .filter(item => item.nextRetryAt <= now)
      .sort((a, b) => {
        // Sort by priority (high > normal > low) then by creation time
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    for (const item of readyItems.slice(0, 10)) { // Process max 10 items per cycle
      await this.processCallbackRetryItem(item);
    }
  }

  /**
   * Process individual callback retry item
   */
  private async processCallbackRetryItem(item: CallbackRetryItem): Promise<void> {
    item.attempts++;
    
    try {
      this.logger.debug(`Processing callback retry attempt ${item.attempts}/${item.maxAttempts}`, {
        callbackId: item.id,
        transactionId: item.transactionId
      });

      // Here you would call the actual callback processing function
      // For now, we'll simulate the processing
      await this.simulateCallbackProcessing(item.callbackData, item.transactionId);
      
      // Success - remove from queue
      this.callbackQueue.delete(item.id);
      
      this.logger.info('Callback retry succeeded', {
        callbackId: item.id,
        transactionId: item.transactionId,
        attempts: item.attempts
      });

    } catch (error) {
      item.lastError = error;
      
      const errorInfo = this.errorHandler.handleError(error, {
        callbackId: item.id,
        transactionId: item.transactionId,
        attempt: item.attempts
      });

      if (item.attempts >= item.maxAttempts || !this.isRetryableError(errorInfo.code, this.retryConfigs.callback)) {
        // Max attempts reached or non-retryable error - remove from queue
        this.callbackQueue.delete(item.id);
        
        this.logger.error('Callback retry failed permanently', {
          callbackId: item.id,
          transactionId: item.transactionId,
          attempts: item.attempts,
          errorCode: errorInfo.code
        });
      } else {
        // Schedule next retry
        const delay = this.calculateDelay(item.attempts, this.retryConfigs.callback);
        item.nextRetryAt = new Date(Date.now() + delay);
        
        this.logger.warn('Callback retry failed, scheduling next attempt', {
          callbackId: item.id,
          transactionId: item.transactionId,
          attempts: item.attempts,
          nextRetryAt: item.nextRetryAt,
          errorCode: errorInfo.code
        });
      }
    }
  }

  /**
   * Simulate callback processing (replace with actual implementation)
   */
  private async simulateCallbackProcessing(callbackData: any, transactionId: string): Promise<void> {
    // This would be replaced with actual callback processing logic
    // For now, we'll just simulate some processing time
    await this.sleep(100);
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Simulated callback processing failure');
    }
  }

  /**
   * Check for duplicate transaction and prevent if found
   */
  checkDuplicateTransaction(
    phoneNumber: string,
    amount: number,
    tabId: string,
    windowMs: number = 300000 // 5 minutes
  ): { isDuplicate: boolean; existingTransactionId?: string } {
    const transactionKey = `${phoneNumber}_${amount}_${tabId}`;
    const now = new Date();
    
    // Clean up expired trackers
    this.cleanupExpiredDuplicateTrackers();
    
    const existing = this.duplicateTrackers.get(transactionKey);
    
    if (existing && existing.expiresAt > now) {
      this.logger.warn('Duplicate transaction detected', {
        transactionKey,
        existingTransactionId: existing.transactionId,
        existingStatus: existing.status,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        amount,
        tabId
      });
      
      return {
        isDuplicate: true,
        existingTransactionId: existing.transactionId
      };
    }
    
    return { isDuplicate: false };
  }

  /**
   * Track transaction to prevent duplicates
   */
  trackTransaction(
    phoneNumber: string,
    amount: number,
    tabId: string,
    transactionId: string,
    status: TransactionStatus,
    windowMs: number = 300000 // 5 minutes
  ): void {
    const transactionKey = `${phoneNumber}_${amount}_${tabId}`;
    const now = new Date();
    
    const tracker: DuplicateTracker = {
      transactionKey,
      transactionId,
      status,
      createdAt: now,
      expiresAt: new Date(now.getTime() + windowMs)
    };
    
    this.duplicateTrackers.set(transactionKey, tracker);
    
    this.logger.debug('Transaction tracked for duplicate prevention', {
      transactionKey,
      transactionId,
      status,
      expiresAt: tracker.expiresAt
    });
  }

  /**
   * Update transaction status in duplicate tracker
   */
  updateTransactionStatus(transactionId: string, status: TransactionStatus): void {
    for (const tracker of this.duplicateTrackers.values()) {
      if (tracker.transactionId === transactionId) {
        tracker.status = status;
        this.logger.debug('Updated transaction status in duplicate tracker', {
          transactionId,
          status
        });
        break;
      }
    }
  }

  /**
   * Clean up expired duplicate trackers
   */
  private cleanupExpiredDuplicateTrackers(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [key, tracker] of this.duplicateTrackers.entries()) {
      if (tracker.expiresAt <= now) {
        this.duplicateTrackers.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired duplicate trackers`);
    }
  }

  /**
   * Start callback queue processor
   */
  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(async () => {
      try {
        await this.processCallbackQueue();
      } catch (error) {
        this.logger.error('Error processing callback queue', { error });
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Stop callback queue processor
   */
  stopQueueProcessor(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = undefined;
    }
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): Record<string, any> {
    return {
      activeRetryContexts: this.retryContexts.size,
      callbackQueueSize: this.callbackQueue.size,
      duplicateTrackersCount: this.duplicateTrackers.size,
      queueItems: Array.from(this.callbackQueue.values()).map(item => ({
        id: item.id,
        transactionId: item.transactionId,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        priority: item.priority,
        nextRetryAt: item.nextRetryAt,
        createdAt: item.createdAt
      }))
    };
  }

  /**
   * Utility function to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return '*'.repeat(phoneNumber.length);
    }
    return phoneNumber.substring(0, 3) + '*'.repeat(phoneNumber.length - 6) + phoneNumber.substring(phoneNumber.length - 3);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopQueueProcessor();
    this.retryContexts.clear();
    this.callbackQueue.clear();
    this.duplicateTrackers.clear();
  }
}

/**
 * Factory function to create retry manager with default configuration
 */
export function createRetryManager(
  logger: Logger,
  errorHandler: ErrorHandler,
  customConfigs?: Partial<Record<string, RetryConfig>>,
  autoStartQueue: boolean = true
): RetryManager {
  return new RetryManager(logger, errorHandler, customConfigs, autoStartQueue);
}

/**
 * Decorator for automatic retry functionality
 */
export function withRetry(
  retryManager: RetryManager,
  operationType: string,
  generateOperationId?: () => string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const operationId = generateOperationId ? generateOperationId() : `${propertyName}_${Date.now()}`;
      
      return retryManager.executeWithRetry(
        () => method.apply(this, args),
        operationType,
        operationId,
        { method: propertyName, args: args.length }
      );
    };

    return descriptor;
  };
}