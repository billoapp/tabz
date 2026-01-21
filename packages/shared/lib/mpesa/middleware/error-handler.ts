/**
 * Comprehensive error handling middleware for M-PESA integration
 * Implements API error categorization, user-friendly messages, and admin logging
 * Requirements: 7.1, 7.2, 7.3, 5.5
 */

import { 
  MpesaError, 
  MpesaValidationError, 
  MpesaNetworkError, 
  MpesaAuthenticationError,
  MpesaEnvironment 
} from '../types';
import { Logger } from '../services/base';

/**
 * Error categories for proper handling and routing
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION', 
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  CONFIGURATION = 'CONFIGURATION',
  CALLBACK = 'CALLBACK',
  TRANSACTION = 'TRANSACTION',
  SYSTEM = 'SYSTEM',
  EXTERNAL_API = 'EXTERNAL_API'
}

/**
 * Error severity levels for logging and alerting
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM', 
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Structured error information for logging and monitoring
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  userMessage: string;
  adminMessage: string;
  context: Record<string, any>;
  timestamp: Date;
  environment: MpesaEnvironment;
  stackTrace?: string;
  originalError?: any;
  shouldRetry: boolean;
  retryAfterMs?: number;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlerConfig {
  environment: MpesaEnvironment;
  enableDetailedLogging: boolean;
  enableStackTraces: boolean;
  logSensitiveData: boolean;
  alertThresholds: {
    [key in ErrorSeverity]: number; // errors per minute to trigger alert
  };
}

/**
 * User-friendly error messages mapped by error codes
 */
const USER_MESSAGES: Record<string, string> = {
  // Network errors
  'NETWORK_ERROR': 'Payment service is temporarily unavailable. Please try again in a few moments.',
  'TIMEOUT_ERROR': 'The payment request timed out. Please try again.',
  'CONNECTION_ERROR': 'Unable to connect to payment service. Please check your internet connection.',
  
  // Authentication errors
  'AUTHENTICATION_ERROR': 'Payment service is temporarily unavailable. Please try again later.',
  'INVALID_CREDENTIALS': 'Payment service is temporarily unavailable. Please try again later.',
  'TOKEN_EXPIRED': 'Payment service is temporarily unavailable. Please try again later.',
  
  // Validation errors
  'VALIDATION_ERROR': 'Please check your payment details and try again.',
  'INVALID_PHONE_NUMBER': 'Please enter a valid phone number in the format 254XXXXXXXXX.',
  'INVALID_AMOUNT': 'Please enter a valid payment amount.',
  'AMOUNT_TOO_LOW': 'The minimum payment amount is KES 1.',
  'AMOUNT_TOO_HIGH': 'The maximum payment amount is KES 70,000.',
  
  // Rate limiting
  'RATE_LIMIT_ERROR': 'Too many payment attempts. Please wait a moment before trying again.',
  
  // M-PESA specific errors
  'INSUFFICIENT_FUNDS': 'Insufficient funds in your M-PESA account. Please top up and try again.',
  'USER_CANCELLED': 'Payment was cancelled. You can try again when ready.',
  'INVALID_TRANSACTION': 'Transaction could not be processed. Please try again.',
  'DUPLICATE_TRANSACTION': 'A payment for this order is already being processed.',
  
  // System errors
  'SYSTEM_ERROR': 'A system error occurred. Please try again or contact support.',
  'DATABASE_ERROR': 'Service temporarily unavailable. Please try again later.',
  'CONFIGURATION_ERROR': 'Payment service is temporarily unavailable. Please try again later.',
  
  // Default fallback
  'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again or contact support.'
};

/**
 * Admin-level detailed error messages for debugging
 */
const ADMIN_MESSAGES: Record<string, string> = {
  'NETWORK_ERROR': 'Network communication with M-PESA API failed',
  'AUTHENTICATION_ERROR': 'M-PESA API authentication failed - check credentials',
  'VALIDATION_ERROR': 'Input validation failed - check request parameters',
  'RATE_LIMIT_ERROR': 'API rate limit exceeded - implement backoff strategy',
  'CONFIGURATION_ERROR': 'M-PESA service configuration is invalid',
  'DATABASE_ERROR': 'Database operation failed - check connection and queries',
  'CALLBACK_ERROR': 'M-PESA callback processing failed',
  'TRANSACTION_ERROR': 'Transaction state management error',
  'SYSTEM_ERROR': 'Internal system error - check logs for details'
};

/**
 * Error categorization rules based on error types and codes
 */
const ERROR_CATEGORIZATION: Record<string, { category: ErrorCategory; severity: ErrorSeverity; shouldRetry: boolean }> = {
  // Network errors - usually retryable
  'NETWORK_ERROR': { category: ErrorCategory.NETWORK, severity: ErrorSeverity.MEDIUM, shouldRetry: true },
  'TIMEOUT_ERROR': { category: ErrorCategory.NETWORK, severity: ErrorSeverity.MEDIUM, shouldRetry: true },
  'CONNECTION_ERROR': { category: ErrorCategory.NETWORK, severity: ErrorSeverity.MEDIUM, shouldRetry: true },
  
  // Authentication errors - not retryable without fixing credentials
  'AUTHENTICATION_ERROR': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH, shouldRetry: false },
  'INVALID_CREDENTIALS': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.CRITICAL, shouldRetry: false },
  'TOKEN_EXPIRED': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.MEDIUM, shouldRetry: true },
  
  // Validation errors - not retryable without fixing input
  'VALIDATION_ERROR': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW, shouldRetry: false },
  'INVALID_PHONE_NUMBER': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW, shouldRetry: false },
  'INVALID_AMOUNT': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW, shouldRetry: false },
  
  // Rate limiting - retryable after delay
  'RATE_LIMIT_ERROR': { category: ErrorCategory.RATE_LIMIT, severity: ErrorSeverity.MEDIUM, shouldRetry: true },
  
  // M-PESA specific errors
  'INSUFFICIENT_FUNDS': { category: ErrorCategory.EXTERNAL_API, severity: ErrorSeverity.LOW, shouldRetry: false },
  'USER_CANCELLED': { category: ErrorCategory.EXTERNAL_API, severity: ErrorSeverity.LOW, shouldRetry: false },
  'DUPLICATE_TRANSACTION': { category: ErrorCategory.TRANSACTION, severity: ErrorSeverity.MEDIUM, shouldRetry: false },
  
  // System errors - may be retryable depending on cause
  'SYSTEM_ERROR': { category: ErrorCategory.SYSTEM, severity: ErrorSeverity.HIGH, shouldRetry: true },
  'DATABASE_ERROR': { category: ErrorCategory.SYSTEM, severity: ErrorSeverity.HIGH, shouldRetry: true },
  'CONFIGURATION_ERROR': { category: ErrorCategory.CONFIGURATION, severity: ErrorSeverity.CRITICAL, shouldRetry: false }
};

/**
 * Main error handling middleware class
 */
export class ErrorHandler {
  private logger: Logger;
  private config: ErrorHandlerConfig;
  private errorCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(logger: Logger, config: ErrorHandlerConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Process and categorize an error, returning structured error information
   */
  handleError(error: any, context: Record<string, any> = {}): ErrorInfo {
    const timestamp = new Date();
    const errorCode = this.extractErrorCode(error);
    const categorization = this.categorizeError(errorCode, error);
    
    const errorInfo: ErrorInfo = {
      category: categorization.category,
      severity: categorization.severity,
      code: errorCode,
      message: this.extractErrorMessage(error),
      userMessage: this.getUserMessage(errorCode),
      adminMessage: this.getAdminMessage(errorCode, error),
      context: this.sanitizeContext(context),
      timestamp,
      environment: this.config.environment,
      stackTrace: this.config.enableStackTraces ? this.extractStackTrace(error) : undefined,
      originalError: this.config.enableDetailedLogging ? error : undefined,
      shouldRetry: categorization.shouldRetry,
      retryAfterMs: this.calculateRetryDelay(categorization.category, errorCode)
    };

    // Log the error with appropriate level
    this.logError(errorInfo);
    
    // Track error frequency for alerting
    this.trackErrorFrequency(errorInfo);
    
    return errorInfo;
  }

  /**
   * Extract error code from various error types
   */
  private extractErrorCode(error: any): string {
    if (error instanceof MpesaError) {
      return error.code;
    }
    
    if (error instanceof Error) {
      // Check for specific error patterns
      if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
      if (error.message.includes('network')) return 'NETWORK_ERROR';
      if (error.message.includes('authentication')) return 'AUTHENTICATION_ERROR';
      if (error.message.includes('validation')) return 'VALIDATION_ERROR';
      if (error.message.includes('rate limit')) return 'RATE_LIMIT_ERROR';
      if (error.message.includes('duplicate')) return 'DUPLICATE_TRANSACTION';
      if (error.message.includes('insufficient funds')) return 'INSUFFICIENT_FUNDS';
      if (error.message.includes('cancelled')) return 'USER_CANCELLED';
    }
    
    // Check HTTP status codes
    if (typeof error === 'object' && error.status) {
      switch (error.status) {
        case 401: return 'AUTHENTICATION_ERROR';
        case 400: return 'VALIDATION_ERROR';
        case 429: return 'RATE_LIMIT_ERROR';
        case 500: return 'SYSTEM_ERROR';
        case 503: return 'NETWORK_ERROR';
        default: return 'UNKNOWN_ERROR';
      }
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Categorize error based on code and type
   */
  private categorizeError(errorCode: string, error: any): { category: ErrorCategory; severity: ErrorSeverity; shouldRetry: boolean } {
    const categorization = ERROR_CATEGORIZATION[errorCode];
    if (categorization) {
      return categorization;
    }

    // Default categorization for unknown errors
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      shouldRetry: true
    };
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (typeof error === 'object' && error.message) {
      return error.message;
    }
    
    return 'Unknown error occurred';
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(errorCode: string): string {
    return USER_MESSAGES[errorCode] || USER_MESSAGES['UNKNOWN_ERROR'];
  }

  /**
   * Get admin-level detailed error message
   */
  private getAdminMessage(errorCode: string, error: any): string {
    const baseMessage = ADMIN_MESSAGES[errorCode] || 'Unknown error occurred';
    
    if (this.config.enableDetailedLogging && error instanceof Error) {
      return `${baseMessage}: ${error.message}`;
    }
    
    return baseMessage;
  }

  /**
   * Extract stack trace if available and enabled
   */
  private extractStackTrace(error: any): string | undefined {
    if (error instanceof Error && error.stack) {
      return error.stack;
    }
    return undefined;
  }

  /**
   * Sanitize context data to remove sensitive information
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'credential',
      'consumerKey', 'consumerSecret', 'passkey', 'phoneNumber'
    ];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (this.config.logSensitiveData && this.config.environment === 'sandbox') {
          // In sandbox with explicit logging enabled, log partial data
          sanitized[field] = this.maskSensitiveData(sanitized[field]);
        } else {
          // In all other cases, remove completely
          delete sanitized[field];
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Mask sensitive data for logging
   */
  private maskSensitiveData(value: any): string {
    if (typeof value !== 'string') {
      return '[MASKED]';
    }
    
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  /**
   * Log error with appropriate level based on severity
   */
  private logError(errorInfo: ErrorInfo): void {
    const logData = {
      category: errorInfo.category,
      code: errorInfo.code,
      severity: errorInfo.severity,
      environment: errorInfo.environment,
      context: errorInfo.context,
      shouldRetry: errorInfo.shouldRetry,
      retryAfterMs: errorInfo.retryAfterMs,
      stackTrace: errorInfo.stackTrace
    };

    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`[CRITICAL] ${errorInfo.adminMessage}`, logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`[HIGH] ${errorInfo.adminMessage}`, logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`[MEDIUM] ${errorInfo.adminMessage}`, logData);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(`[LOW] ${errorInfo.adminMessage}`, logData);
        break;
    }
  }

  /**
   * Track error frequency for alerting
   */
  private trackErrorFrequency(errorInfo: ErrorInfo): void {
    const key = `${errorInfo.category}_${errorInfo.severity}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    
    const current = this.errorCounts.get(key);
    
    if (!current || now > current.resetTime) {
      this.errorCounts.set(key, { count: 1, resetTime: now + windowMs });
    } else {
      current.count++;
      
      // Check if we've exceeded alert threshold
      const threshold = this.config.alertThresholds[errorInfo.severity];
      if (current.count >= threshold) {
        this.triggerAlert(errorInfo, current.count);
      }
    }
  }

  /**
   * Trigger alert when error threshold is exceeded
   */
  private triggerAlert(errorInfo: ErrorInfo, errorCount: number): void {
    this.logger.error(`[ALERT] Error threshold exceeded`, {
      category: errorInfo.category,
      severity: errorInfo.severity,
      errorCount,
      threshold: this.config.alertThresholds[errorInfo.severity],
      environment: errorInfo.environment,
      timeWindow: '1 minute'
    });
  }

  /**
   * Calculate retry delay based on error category and code
   */
  private calculateRetryDelay(category: ErrorCategory, errorCode: string): number | undefined {
    switch (category) {
      case ErrorCategory.NETWORK:
        return 1000; // 1 second for network errors
      case ErrorCategory.RATE_LIMIT:
        return 60000; // 1 minute for rate limit errors
      case ErrorCategory.AUTHENTICATION:
        if (errorCode === 'TOKEN_EXPIRED') {
          return 100; // Immediate retry for token refresh
        }
        return undefined; // No retry for other auth errors
      case ErrorCategory.SYSTEM:
        return 5000; // 5 seconds for system errors
      default:
        return undefined;
    }
  }

  /**
   * Clean up expired error count entries
   */
  cleanupErrorCounts(): void {
    const now = Date.now();
    for (const [key, data] of this.errorCounts.entries()) {
      if (now > data.resetTime) {
        this.errorCounts.delete(key);
      }
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, data] of this.errorCounts.entries()) {
      stats[key] = {
        count: data.count,
        resetTime: new Date(data.resetTime).toISOString()
      };
    }
    
    return stats;
  }
}

/**
 * Factory function to create error handler with default configuration
 */
export function createErrorHandler(
  logger: Logger,
  environment: MpesaEnvironment,
  overrides?: Partial<ErrorHandlerConfig>
): ErrorHandler {
  const defaultConfig: ErrorHandlerConfig = {
    environment,
    enableDetailedLogging: environment === 'sandbox',
    enableStackTraces: environment === 'sandbox',
    logSensitiveData: false, // Always false by default for security
    alertThresholds: {
      [ErrorSeverity.LOW]: 50,
      [ErrorSeverity.MEDIUM]: 20,
      [ErrorSeverity.HIGH]: 10,
      [ErrorSeverity.CRITICAL]: 5
    }
  };

  const config = { ...defaultConfig, ...overrides };
  return new ErrorHandler(logger, config);
}

/**
 * Express middleware wrapper for error handling
 */
export function createExpressErrorMiddleware(errorHandler: ErrorHandler) {
  return (error: any, req: any, res: any, next: any) => {
    const context = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.body
    };

    const errorInfo = errorHandler.handleError(error, context);
    
    // Return appropriate response based on error category
    const statusCode = error.statusCode || 500;
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.userMessage,
        shouldRetry: errorInfo.shouldRetry,
        retryAfterMs: errorInfo.retryAfterMs
      },
      // Include admin details only in development
      ...(errorHandler['config'].enableDetailedLogging && {
        debug: {
          category: errorInfo.category,
          severity: errorInfo.severity,
          adminMessage: errorInfo.adminMessage,
          timestamp: errorInfo.timestamp
        }
      })
    });
  };
}