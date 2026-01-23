/**
 * Structured Error Logging Service for M-Pesa Tenant Credentials
 * Provides comprehensive logging with tenant context, correlation IDs, and performance metrics
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { Logger } from './base';
import { MpesaEnvironment } from '../types';
import { TenantErrorCategory, TenantErrorInfo } from './error-handling';

/**
 * Correlation ID for request tracing
 */
export class CorrelationIdManager {
  private static currentId: string | null = null;

  static generate(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `mpesa_${timestamp}_${random}`;
  }

  static set(correlationId: string): void {
    this.currentId = correlationId;
  }

  static get(): string | null {
    return this.currentId;
  }

  static clear(): void {
    this.currentId = null;
  }

  static withCorrelationId<T>(correlationId: string, fn: () => T): T {
    const previousId = this.currentId;
    this.set(correlationId);
    try {
      return fn();
    } finally {
      if (previousId) {
        this.set(previousId);
      } else {
        this.clear();
      }
    }
  }

  static async withCorrelationIdAsync<T>(correlationId: string, fn: () => Promise<T>): Promise<T> {
    const previousId = this.currentId;
    this.set(correlationId);
    try {
      return await fn();
    } finally {
      if (previousId) {
        this.set(previousId);
      } else {
        this.clear();
      }
    }
  }
}

/**
 * Performance metrics for credential operations
 */
export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tenantId?: string;
  tabId?: string;
  environment?: MpesaEnvironment;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance metrics collector
 */
export class PerformanceMetricsCollector {
  private metrics: PerformanceMetrics[] = [];
  private activeOperations = new Map<string, PerformanceMetrics>();

  startOperation(
    operationName: string,
    context: {
      tenantId?: string;
      tabId?: string;
      environment?: MpesaEnvironment;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const operationId = `${operationName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const metric: PerformanceMetrics = {
      operationName,
      startTime: performance.now(),
      success: false,
      tenantId: context.tenantId,
      tabId: context.tabId,
      environment: context.environment,
      metadata: context.metadata
    };

    this.activeOperations.set(operationId, metric);
    return operationId;
  }

  endOperation(operationId: string, success: boolean, errorCode?: string): PerformanceMetrics | null {
    const metric = this.activeOperations.get(operationId);
    if (!metric) {
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
    metric.errorCode = errorCode;

    this.activeOperations.delete(operationId);
    this.metrics.push(metric);

    return metric;
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getMetricsSummary(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    operationBreakdown: Record<string, {
      count: number;
      successRate: number;
      averageDuration: number;
    }>;
  } {
    const total = this.metrics.length;
    const successful = this.metrics.filter(m => m.success).length;
    const failed = total - successful;
    const averageDuration = total > 0 
      ? this.metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / total 
      : 0;

    const operationBreakdown: Record<string, {
      count: number;
      successRate: number;
      averageDuration: number;
    }> = {};

    const operationGroups = this.metrics.reduce((groups, metric) => {
      if (!groups[metric.operationName]) {
        groups[metric.operationName] = [];
      }
      groups[metric.operationName].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    for (const [operationName, operations] of Object.entries(operationGroups)) {
      const count = operations.length;
      const successCount = operations.filter(op => op.success).length;
      const successRate = count > 0 ? successCount / count : 0;
      const avgDuration = count > 0 
        ? operations.reduce((sum, op) => sum + (op.duration || 0), 0) / count 
        : 0;

      operationBreakdown[operationName] = {
        count,
        successRate,
        averageDuration: avgDuration
      };
    }

    return {
      totalOperations: total,
      successfulOperations: successful,
      failedOperations: failed,
      averageDuration,
      operationBreakdown
    };
  }

  clearMetrics(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }
}

/**
 * Structured logging context
 */
export interface LoggingContext {
  correlationId?: string;
  tenantId?: string;
  barId?: string;
  tabId?: string;
  customerId?: string;
  operation?: string;
  environment?: MpesaEnvironment;
  performanceMetrics?: PerformanceMetrics;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp?: Date;
  [key: string]: any;
}

/**
 * Structured logger for M-Pesa tenant operations
 */
export class StructuredMpesaLogger {
  private baseLogger: Logger;
  private environment: MpesaEnvironment;
  private performanceCollector: PerformanceMetricsCollector;
  private defaultContext: LoggingContext;

  constructor(
    baseLogger: Logger, 
    environment: MpesaEnvironment,
    defaultContext: LoggingContext = {}
  ) {
    this.baseLogger = baseLogger;
    this.environment = environment;
    this.performanceCollector = new PerformanceMetricsCollector();
    this.defaultContext = defaultContext;
  }

  /**
   * Create enriched logging context
   */
  private createContext(context: LoggingContext = {}): LoggingContext {
    return {
      ...this.defaultContext,
      ...context,
      correlationId: context.correlationId || CorrelationIdManager.get() || undefined,
      timestamp: context.timestamp || new Date(),
      environment: context.environment || this.environment
    };
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: LoggingContext): LoggingContext {
    const sanitized = { ...context };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'credential', 'passkey',
      'consumerKey', 'consumerSecret', 'phoneNumber', 'encryptedData',
      'decryptedData', 'masterKey', 'kmsKey', 'authorization'
    ];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }

    // Mask partial sensitive data in sandbox environment
    if (this.environment === 'sandbox') {
      if (sanitized.tenantId && typeof sanitized.tenantId === 'string') {
        sanitized.tenantId = this.maskId(sanitized.tenantId);
      }
      if (sanitized.customerId && typeof sanitized.customerId === 'string') {
        sanitized.customerId = this.maskId(sanitized.customerId);
      }
    }
    
    return sanitized;
  }

  /**
   * Mask ID values for logging
   */
  private maskId(id: string): string {
    if (id.length <= 8) {
      return id.substring(0, 2) + '*'.repeat(id.length - 2);
    }
    return id.substring(0, 4) + '*'.repeat(id.length - 8) + id.substring(id.length - 4);
  }

  /**
   * Log tenant credential operation start
   */
  logOperationStart(
    operation: string,
    context: LoggingContext = {}
  ): string {
    const enrichedContext = this.createContext(context);
    const operationId = this.performanceCollector.startOperation(operation, {
      tenantId: enrichedContext.tenantId,
      tabId: enrichedContext.tabId,
      environment: enrichedContext.environment,
      metadata: { correlationId: enrichedContext.correlationId }
    });

    const logContext = this.sanitizeContext({
      ...enrichedContext,
      operationId,
      phase: 'start'
    });

    this.baseLogger.info(`[TENANT_OPERATION_START] ${operation}`, logContext);
    return operationId;
  }

  /**
   * Log tenant credential operation success
   */
  logOperationSuccess(
    operationId: string,
    operation: string,
    context: LoggingContext = {}
  ): void {
    const metric = this.performanceCollector.endOperation(operationId, true);
    const enrichedContext = this.createContext({
      ...context,
      performanceMetrics: metric
    });

    const logContext = this.sanitizeContext({
      ...enrichedContext,
      operationId,
      phase: 'success',
      duration: metric?.duration
    });

    this.baseLogger.info(`[TENANT_OPERATION_SUCCESS] ${operation}`, logContext);
  }

  /**
   * Log tenant credential operation failure
   */
  logOperationFailure(
    operationId: string,
    operation: string,
    error: any,
    context: LoggingContext = {}
  ): void {
    const errorCode = error?.code || 'UNKNOWN_ERROR';
    const metric = this.performanceCollector.endOperation(operationId, false, errorCode);
    
    const enrichedContext = this.createContext({
      ...context,
      performanceMetrics: metric,
      errorCode,
      errorMessage: error?.message,
      errorCategory: error?.category
    });

    const logContext = this.sanitizeContext({
      ...enrichedContext,
      operationId,
      phase: 'failure',
      duration: metric?.duration
    });

    this.baseLogger.error(`[TENANT_OPERATION_FAILURE] ${operation}`, logContext);
  }

  /**
   * Log tenant error with enhanced context
   */
  logTenantError(
    errorInfo: TenantErrorInfo,
    context: LoggingContext = {}
  ): void {
    const enrichedContext = this.createContext({
      ...context,
      tenantCategory: errorInfo.tenantCategory,
      statusCode: errorInfo.statusCode,
      tenantId: errorInfo.tenantId,
      barId: errorInfo.barId,
      tabId: errorInfo.tabId,
      errorCode: errorInfo.code,
      severity: errorInfo.severity,
      shouldRetry: errorInfo.shouldRetry,
      retryAfterMs: errorInfo.retryAfterMs
    });

    const logContext = this.sanitizeContext(enrichedContext);
    const logMessage = `[${errorInfo.tenantCategory}] ${errorInfo.adminMessage}`;

    switch (errorInfo.severity) {
      case 'CRITICAL':
        this.baseLogger.error(`[CRITICAL] ${logMessage}`, logContext);
        break;
      case 'HIGH':
        this.baseLogger.error(`[HIGH] ${logMessage}`, logContext);
        break;
      case 'MEDIUM':
        this.baseLogger.warn(`[MEDIUM] ${logMessage}`, logContext);
        break;
      case 'LOW':
        this.baseLogger.info(`[LOW] ${logMessage}`, logContext);
        break;
      default:
        this.baseLogger.error(logMessage, logContext);
    }
  }

  /**
   * Log credential retrieval metrics
   */
  logCredentialRetrievalMetrics(
    tenantId: string,
    environment: MpesaEnvironment,
    success: boolean,
    duration: number,
    context: LoggingContext = {}
  ): void {
    const enrichedContext = this.createContext({
      ...context,
      tenantId,
      environment,
      operation: 'credential_retrieval',
      success,
      duration,
      metricType: 'credential_retrieval_performance'
    });

    const logContext = this.sanitizeContext(enrichedContext);

    if (success) {
      this.baseLogger.info('[CREDENTIAL_RETRIEVAL_METRICS] Successful credential retrieval', logContext);
    } else {
      this.baseLogger.warn('[CREDENTIAL_RETRIEVAL_METRICS] Failed credential retrieval', logContext);
    }

    // Alert on slow credential retrieval (> 1 second)
    if (duration > 1000) {
      this.baseLogger.warn('[PERFORMANCE_ALERT] Slow credential retrieval detected', {
        ...logContext,
        alertType: 'slow_credential_retrieval',
        threshold: 1000
      });
    }
  }

  /**
   * Log decryption performance metrics
   */
  logDecryptionMetrics(
    tenantId: string,
    fieldCount: number,
    duration: number,
    success: boolean,
    context: LoggingContext = {}
  ): void {
    const enrichedContext = this.createContext({
      ...context,
      tenantId,
      operation: 'credential_decryption',
      fieldCount,
      duration,
      success,
      metricType: 'decryption_performance'
    });

    const logContext = this.sanitizeContext(enrichedContext);

    if (success) {
      this.baseLogger.info('[DECRYPTION_METRICS] Successful credential decryption', logContext);
    } else {
      this.baseLogger.error('[DECRYPTION_METRICS] Failed credential decryption', logContext);
    }

    // Alert on slow decryption (> 500ms)
    if (duration > 500) {
      this.baseLogger.warn('[PERFORMANCE_ALERT] Slow credential decryption detected', {
        ...logContext,
        alertType: 'slow_decryption',
        threshold: 500
      });
    }
  }

  /**
   * Log payment flow metrics
   */
  logPaymentFlowMetrics(
    tabId: string,
    tenantId: string,
    amount: number,
    success: boolean,
    totalDuration: number,
    context: LoggingContext = {}
  ): void {
    const enrichedContext = this.createContext({
      ...context,
      tabId,
      tenantId,
      amount,
      success,
      totalDuration,
      operation: 'payment_flow',
      metricType: 'payment_flow_performance'
    });

    const logContext = this.sanitizeContext(enrichedContext);

    if (success) {
      this.baseLogger.info('[PAYMENT_FLOW_METRICS] Successful payment flow', logContext);
    } else {
      this.baseLogger.error('[PAYMENT_FLOW_METRICS] Failed payment flow', logContext);
    }

    // Alert on slow payment flow (> 5 seconds)
    if (totalDuration > 5000) {
      this.baseLogger.warn('[PERFORMANCE_ALERT] Slow payment flow detected', {
        ...logContext,
        alertType: 'slow_payment_flow',
        threshold: 5000
      });
    }
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    eventType: 'CREDENTIAL_ACCESS' | 'DECRYPTION_ATTEMPT' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY',
    tenantId: string,
    context: LoggingContext = {}
  ): void {
    const enrichedContext = this.createContext({
      ...context,
      tenantId,
      eventType,
      securityEvent: true,
      alertLevel: 'SECURITY'
    });

    const logContext = this.sanitizeContext(enrichedContext);

    this.baseLogger.warn(`[SECURITY_EVENT] ${eventType}`, logContext);
  }

  /**
   * Get performance metrics summary
   */
  getPerformanceMetrics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    operationBreakdown: Record<string, {
      count: number;
      successRate: number;
      averageDuration: number;
    }>;
  } {
    return this.performanceCollector.getMetricsSummary();
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.performanceCollector.clearMetrics();
  }

  /**
   * Create child logger with additional context
   */
  createChildLogger(additionalContext: LoggingContext): StructuredMpesaLogger {
    return new StructuredMpesaLogger(
      this.baseLogger,
      this.environment,
      { ...this.defaultContext, ...additionalContext }
    );
  }
}

/**
 * Factory function to create structured M-Pesa logger
 */
export function createStructuredMpesaLogger(
  baseLogger: Logger,
  environment: MpesaEnvironment,
  defaultContext: LoggingContext = {}
): StructuredMpesaLogger {
  return new StructuredMpesaLogger(baseLogger, environment, defaultContext);
}

/**
 * Utility function to wrap operations with structured logging
 */
export async function withStructuredLogging<T>(
  operation: string,
  logger: StructuredMpesaLogger,
  context: LoggingContext,
  fn: () => Promise<T>
): Promise<T> {
  const operationId = logger.logOperationStart(operation, context);
  
  try {
    const result = await fn();
    logger.logOperationSuccess(operationId, operation, context);
    return result;
  } catch (error) {
    logger.logOperationFailure(operationId, operation, error, context);
    throw error;
  }
}

/**
 * Utility function to wrap synchronous operations with structured logging
 */
export function withStructuredLoggingSync<T>(
  operation: string,
  logger: StructuredMpesaLogger,
  context: LoggingContext,
  fn: () => T
): T {
  const operationId = logger.logOperationStart(operation, context);
  
  try {
    const result = fn();
    logger.logOperationSuccess(operationId, operation, context);
    return result;
  } catch (error) {
    logger.logOperationFailure(operationId, operation, error, context);
    throw error;
  }
}