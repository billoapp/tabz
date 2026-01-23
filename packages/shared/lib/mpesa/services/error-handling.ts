/**
 * Enhanced Error Handling Service for M-Pesa Tenant Credentials
 * Provides comprehensive error handling with user-friendly messages and proper logging
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 6.4
 */

import { 
  MpesaError, 
  MpesaEnvironment,
  MpesaValidationError,
  MpesaNetworkError,
  MpesaAuthenticationError
} from '../types';
import { Logger } from './base';
import { 
  ErrorHandler, 
  ErrorCategory, 
  ErrorSeverity, 
  createErrorHandler,
  ErrorInfo 
} from '../middleware/error-handler';

/**
 * Enhanced error categories specific to tenant credential operations
 */
export enum TenantErrorCategory {
  TAB_RESOLUTION = 'TAB_RESOLUTION',
  CREDENTIAL_RETRIEVAL = 'CREDENTIAL_RETRIEVAL', 
  CREDENTIAL_DECRYPTION = 'CREDENTIAL_DECRYPTION',
  CREDENTIAL_VALIDATION = 'CREDENTIAL_VALIDATION',
  TENANT_CONFIGURATION = 'TENANT_CONFIGURATION',
  PAYMENT_INITIATION = 'PAYMENT_INITIATION'
}

/**
 * User-friendly error messages for tenant credential issues
 */
const TENANT_USER_MESSAGES: Record<string, string> = {
  // Tab resolution errors
  'TAB_NOT_FOUND': 'The selected tab could not be found. Please refresh and try again.',
  'ORPHANED_TAB': 'This tab is not properly configured. Please contact support.',
  'INACTIVE_BAR': 'This location is temporarily unavailable for payments.',
  'INVALID_TAB_STATUS': 'This tab is not available for payments at this time.',
  'TAB_RESOLUTION_ERROR': 'Unable to process payment for this tab. Please try again.',

  // Credential retrieval errors
  'CREDENTIALS_NOT_FOUND': 'Payment service is not configured for this location. Please contact the establishment.',
  'CREDENTIALS_INACTIVE': 'Payment service is temporarily unavailable at this location.',
  'CREDENTIALS_INCOMPLETE': 'Payment service configuration is incomplete. Please contact support.',
  'DATABASE_ERROR': 'Service temporarily unavailable. Please try again in a few moments.',
  'CREDENTIAL_RETRIEVAL_ERROR': 'Unable to access payment configuration. Please try again.',

  // Decryption errors
  'KMS_KEY_MISSING': 'Payment service is temporarily unavailable. Please try again later.',
  'KMS_KEY_INVALID_LENGTH': 'Payment service configuration error. Please contact support.',
  'KMS_KEY_INVALID_FORMAT': 'Payment service configuration error. Please contact support.',
  'KMS_NOT_INITIALIZED': 'Payment service is temporarily unavailable. Please try again later.',
  'INVALID_ENCRYPTED_FORMAT': 'Payment configuration error. Please contact support.',
  'INVALID_ENCRYPTED_DATA': 'Payment configuration error. Please contact support.',
  'CORRUPTED_ENCRYPTED_DATA': 'Payment configuration error. Please contact support.',
  'DECRYPTION_FAILED': 'Unable to access payment credentials. Please try again later.',
  'AUTHENTICATION_FAILED': 'Payment service authentication failed. Please try again later.',
  'DECRYPTION_ERROR': 'Unable to process payment credentials. Please try again later.',
  'INVALID_DECRYPTED_DATA': 'Payment configuration error. Please contact support.',

  // Validation errors
  'CREDENTIALS_INVALID': 'Payment service configuration is invalid. Please contact support.',
  'VALIDATION_ERROR': 'Payment configuration validation failed. Please contact support.',
  'ENVIRONMENT_MISMATCH': 'Payment service configuration error. Please contact support.',

  // Configuration errors
  'INVALID_TENANT_CONFIG': 'Payment service configuration is invalid. Please contact support.',
  'INVALID_TENANT_ID': 'Invalid location configuration. Please contact support.',
  'INVALID_BAR_ID': 'Invalid location configuration. Please contact support.',
  'INVALID_BAR_NAME': 'Invalid location configuration. Please contact support.',
  'INVALID_ENVIRONMENT': 'Payment service environment configuration error. Please contact support.',
  'MISSING_CREDENTIALS': 'Payment credentials are missing. Please contact support.',
  'INVALID_TIMEOUT': 'Payment service configuration error. Please contact support.',
  'INVALID_RETRY_ATTEMPTS': 'Payment service configuration error. Please contact support.',
  'INVALID_RATE_LIMIT': 'Payment service configuration error. Please contact support.',

  // Service creation errors
  'SERVICE_CONFIG_CREATION_ERROR': 'Unable to configure payment service. Please try again.',
  'TAB_SERVICE_CONFIG_CREATION_ERROR': 'Unable to process payment for this tab. Please try again.',
  'BATCH_SERVICE_CONFIG_ERROR': 'Unable to configure payment services. Please try again.'
};

/**
 * Admin-level detailed error messages for debugging
 */
const TENANT_ADMIN_MESSAGES: Record<string, string> = {
  // Tab resolution errors
  'TAB_NOT_FOUND': 'Tab ID not found in database - check tab existence and permissions',
  'ORPHANED_TAB': 'Tab exists but has no associated bar - data integrity issue',
  'INACTIVE_BAR': 'Bar exists but is marked as inactive - check bar status',
  'INVALID_TAB_STATUS': 'Tab status does not allow payments - check business rules',
  'TAB_RESOLUTION_ERROR': 'Tab to tenant resolution failed - check database connectivity',

  // Credential retrieval errors
  'CREDENTIALS_NOT_FOUND': 'No M-Pesa credentials found for tenant in specified environment',
  'CREDENTIALS_INACTIVE': 'M-Pesa credentials exist but are marked as inactive',
  'CREDENTIALS_INCOMPLETE': 'M-Pesa credentials missing required fields - check data integrity',
  'DATABASE_ERROR': 'Database query failed during credential retrieval - check connection',
  'CREDENTIAL_RETRIEVAL_ERROR': 'Credential retrieval service failed - check logs for details',

  // Decryption errors
  'KMS_KEY_MISSING': 'MPESA_KMS_KEY environment variable not set',
  'KMS_KEY_INVALID_LENGTH': 'MPESA_KMS_KEY must be exactly 32 bytes for AES-256',
  'KMS_KEY_INVALID_FORMAT': 'MPESA_KMS_KEY contains invalid characters',
  'KMS_NOT_INITIALIZED': 'KMS decryption service not properly initialized',
  'INVALID_ENCRYPTED_FORMAT': 'Encrypted credential data format is invalid',
  'INVALID_ENCRYPTED_DATA': 'Encrypted data too short or corrupted',
  'CORRUPTED_ENCRYPTED_DATA': 'Encrypted data appears corrupted - IV or auth tag invalid',
  'DECRYPTION_FAILED': 'AES decryption failed - check key validity',
  'AUTHENTICATION_FAILED': 'GCM authentication tag verification failed',
  'DECRYPTION_ERROR': 'General decryption error - check encryption format and key',
  'INVALID_DECRYPTED_DATA': 'Decrypted data failed validation checks',

  // Validation errors
  'CREDENTIALS_INVALID': 'Credential validation failed - check field formats and values',
  'VALIDATION_ERROR': 'General validation error - check input parameters',
  'ENVIRONMENT_MISMATCH': 'Credential environment does not match endpoint requirements',

  // Configuration errors
  'INVALID_TENANT_CONFIG': 'Tenant configuration object is invalid or missing',
  'INVALID_TENANT_ID': 'Tenant ID is required and must be non-empty',
  'INVALID_BAR_ID': 'Bar ID is required and must be non-empty',
  'INVALID_BAR_NAME': 'Bar name is required and must be non-empty',
  'INVALID_ENVIRONMENT': 'Environment must be sandbox or production',
  'MISSING_CREDENTIALS': 'Credentials object is required in tenant configuration',
  'INVALID_TIMEOUT': 'Timeout value must be greater than 0',
  'INVALID_RETRY_ATTEMPTS': 'Retry attempts cannot be negative',
  'INVALID_RATE_LIMIT': 'Rate limit must be greater than 0',

  // Service creation errors
  'SERVICE_CONFIG_CREATION_ERROR': 'Failed to create service configuration from tenant config',
  'TAB_SERVICE_CONFIG_CREATION_ERROR': 'Failed to create service configuration from tab resolution',
  'BATCH_SERVICE_CONFIG_ERROR': 'Failed to create one or more service configurations in batch'
};

/**
 * Error categorization for tenant credential operations
 */
const TENANT_ERROR_CATEGORIZATION: Record<string, { 
  category: TenantErrorCategory; 
  severity: ErrorSeverity; 
  shouldRetry: boolean;
  statusCode: number;
}> = {
  // Tab resolution errors
  'TAB_NOT_FOUND': { 
    category: TenantErrorCategory.TAB_RESOLUTION, 
    severity: ErrorSeverity.LOW, 
    shouldRetry: false,
    statusCode: 404
  },
  'ORPHANED_TAB': { 
    category: TenantErrorCategory.TAB_RESOLUTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'INACTIVE_BAR': { 
    category: TenantErrorCategory.TAB_RESOLUTION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_TAB_STATUS': { 
    category: TenantErrorCategory.TAB_RESOLUTION, 
    severity: ErrorSeverity.LOW, 
    shouldRetry: false,
    statusCode: 400
  },
  'TAB_RESOLUTION_ERROR': { 
    category: TenantErrorCategory.TAB_RESOLUTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: true,
    statusCode: 500
  },

  // Credential retrieval errors
  'CREDENTIALS_NOT_FOUND': { 
    category: TenantErrorCategory.CREDENTIAL_RETRIEVAL, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 503
  },
  'CREDENTIALS_INACTIVE': { 
    category: TenantErrorCategory.CREDENTIAL_RETRIEVAL, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 503
  },
  'CREDENTIALS_INCOMPLETE': { 
    category: TenantErrorCategory.CREDENTIAL_RETRIEVAL, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 503
  },
  'DATABASE_ERROR': { 
    category: TenantErrorCategory.CREDENTIAL_RETRIEVAL, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: true,
    statusCode: 503
  },
  'CREDENTIAL_RETRIEVAL_ERROR': { 
    category: TenantErrorCategory.CREDENTIAL_RETRIEVAL, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: true,
    statusCode: 500
  },

  // Decryption errors
  'KMS_KEY_MISSING': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.CRITICAL, 
    shouldRetry: false,
    statusCode: 500
  },
  'KMS_KEY_INVALID_LENGTH': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.CRITICAL, 
    shouldRetry: false,
    statusCode: 500
  },
  'KMS_KEY_INVALID_FORMAT': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.CRITICAL, 
    shouldRetry: false,
    statusCode: 500
  },
  'KMS_NOT_INITIALIZED': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.CRITICAL, 
    shouldRetry: false,
    statusCode: 500
  },
  'INVALID_ENCRYPTED_FORMAT': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },
  'INVALID_ENCRYPTED_DATA': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },
  'CORRUPTED_ENCRYPTED_DATA': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },
  'DECRYPTION_FAILED': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },
  'AUTHENTICATION_FAILED': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },
  'DECRYPTION_ERROR': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },
  'INVALID_DECRYPTED_DATA': { 
    category: TenantErrorCategory.CREDENTIAL_DECRYPTION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 500
  },

  // Validation errors
  'CREDENTIALS_INVALID': { 
    category: TenantErrorCategory.CREDENTIAL_VALIDATION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 500
  },
  'VALIDATION_ERROR': { 
    category: TenantErrorCategory.CREDENTIAL_VALIDATION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 500
  },
  'ENVIRONMENT_MISMATCH': { 
    category: TenantErrorCategory.CREDENTIAL_VALIDATION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 500
  },

  // Configuration errors
  'INVALID_TENANT_CONFIG': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_TENANT_ID': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_BAR_ID': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_BAR_NAME': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_ENVIRONMENT': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'MISSING_CREDENTIALS': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_TIMEOUT': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_RETRY_ATTEMPTS': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 400
  },
  'INVALID_RATE_LIMIT': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.MEDIUM, 
    shouldRetry: false,
    statusCode: 400
  },

  // Service creation errors
  'SERVICE_CONFIG_CREATION_ERROR': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: true,
    statusCode: 500
  },
  'TAB_SERVICE_CONFIG_CREATION_ERROR': { 
    category: TenantErrorCategory.PAYMENT_INITIATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: true,
    statusCode: 500
  },
  'BATCH_SERVICE_CONFIG_ERROR': { 
    category: TenantErrorCategory.TENANT_CONFIGURATION, 
    severity: ErrorSeverity.HIGH, 
    shouldRetry: true,
    statusCode: 500
  }
};

/**
 * Enhanced error information for tenant credential operations
 */
export interface TenantErrorInfo extends ErrorInfo {
  tenantCategory: TenantErrorCategory;
  statusCode: number;
  tenantId?: string;
  barId?: string;
  tabId?: string;
  environment: MpesaEnvironment; // Required to match base interface
}

/**
 * Enhanced error handling service for tenant credential operations
 */
export class TenantCredentialErrorHandler {
  private baseErrorHandler: ErrorHandler;
  private logger: Logger;
  private environment: MpesaEnvironment;

  constructor(logger: Logger, environment: MpesaEnvironment) {
    this.logger = logger;
    this.environment = environment;
    this.baseErrorHandler = createErrorHandler(logger, environment, {
      enableDetailedLogging: environment === 'sandbox',
      enableStackTraces: environment === 'sandbox',
      logSensitiveData: false // Never log sensitive data
    });
  }

  /**
   * Handle tenant credential related errors with enhanced context
   */
  handleTenantError(
    error: any, 
    context: {
      tenantId?: string;
      barId?: string;
      tabId?: string;
      operation?: string;
      environment?: MpesaEnvironment;
      [key: string]: any;
    } = {}
  ): TenantErrorInfo {
    // First get base error info
    const baseErrorInfo = this.baseErrorHandler.handleError(error, context);
    
    // Extract tenant-specific error code
    const tenantErrorCode = this.extractTenantErrorCode(error);
    
    // Get tenant-specific categorization
    const tenantCategorization = this.categorizeTenantError(tenantErrorCode);
    
    // Create enhanced error info
    const tenantErrorInfo: TenantErrorInfo = {
      ...baseErrorInfo,
      tenantCategory: tenantCategorization.category,
      statusCode: tenantCategorization.statusCode,
      code: tenantErrorCode,
      userMessage: this.getTenantUserMessage(tenantErrorCode),
      adminMessage: this.getTenantAdminMessage(tenantErrorCode, error),
      shouldRetry: tenantCategorization.shouldRetry,
      severity: tenantCategorization.severity,
      tenantId: context.tenantId,
      barId: context.barId,
      tabId: context.tabId,
      environment: context.environment || this.environment,
      context: this.sanitizeTenantContext(context)
    };

    // Log with tenant-specific context
    this.logTenantError(tenantErrorInfo);
    
    return tenantErrorInfo;
  }

  /**
   * Extract tenant-specific error code
   */
  private extractTenantErrorCode(error: any): string {
    if (error instanceof MpesaError) {
      return error.code;
    }
    
    if (error instanceof Error) {
      // Check for specific tenant error patterns
      const message = error.message.toLowerCase();
      
      // Tab resolution patterns
      if (message.includes('tab not found')) return 'TAB_NOT_FOUND';
      if (message.includes('orphaned tab')) return 'ORPHANED_TAB';
      if (message.includes('inactive bar')) return 'INACTIVE_BAR';
      if (message.includes('invalid tab status')) return 'INVALID_TAB_STATUS';
      if (message.includes('tab resolution')) return 'TAB_RESOLUTION_ERROR';
      
      // Credential retrieval patterns
      if (message.includes('credentials not found')) return 'CREDENTIALS_NOT_FOUND';
      if (message.includes('credentials inactive')) return 'CREDENTIALS_INACTIVE';
      if (message.includes('credentials incomplete')) return 'CREDENTIALS_INCOMPLETE';
      if (message.includes('credential retrieval')) return 'CREDENTIAL_RETRIEVAL_ERROR';
      
      // Decryption patterns
      if (message.includes('kms_key') && message.includes('missing')) return 'KMS_KEY_MISSING';
      if (message.includes('kms_key') && message.includes('length')) return 'KMS_KEY_INVALID_LENGTH';
      if (message.includes('kms_key') && message.includes('format')) return 'KMS_KEY_INVALID_FORMAT';
      if (message.includes('kms') && message.includes('not initialized')) return 'KMS_NOT_INITIALIZED';
      if (message.includes('invalid encrypted format')) return 'INVALID_ENCRYPTED_FORMAT';
      if (message.includes('invalid encrypted data')) return 'INVALID_ENCRYPTED_DATA';
      if (message.includes('corrupted')) return 'CORRUPTED_ENCRYPTED_DATA';
      if (message.includes('decryption failed')) return 'DECRYPTION_FAILED';
      if (message.includes('authentication') && message.includes('failed')) return 'AUTHENTICATION_FAILED';
      if (message.includes('decryption')) return 'DECRYPTION_ERROR';
      if (message.includes('invalid decrypted data')) return 'INVALID_DECRYPTED_DATA';
      
      // Validation patterns
      if (message.includes('credentials invalid')) return 'CREDENTIALS_INVALID';
      if (message.includes('environment mismatch')) return 'ENVIRONMENT_MISMATCH';
      
      // Configuration patterns
      if (message.includes('invalid tenant config')) return 'INVALID_TENANT_CONFIG';
      if (message.includes('invalid tenant id')) return 'INVALID_TENANT_ID';
      if (message.includes('invalid bar id')) return 'INVALID_BAR_ID';
      if (message.includes('invalid bar name')) return 'INVALID_BAR_NAME';
      if (message.includes('invalid environment')) return 'INVALID_ENVIRONMENT';
      if (message.includes('missing credentials')) return 'MISSING_CREDENTIALS';
      
      // Service creation patterns
      if (message.includes('service config creation')) return 'SERVICE_CONFIG_CREATION_ERROR';
      if (message.includes('tab service config')) return 'TAB_SERVICE_CONFIG_CREATION_ERROR';
      if (message.includes('batch service config')) return 'BATCH_SERVICE_CONFIG_ERROR';
    }
    
    // Fall back to base error handler
    return 'UNKNOWN_ERROR';
  }

  /**
   * Categorize tenant-specific errors
   */
  private categorizeTenantError(errorCode: string): {
    category: TenantErrorCategory;
    severity: ErrorSeverity;
    shouldRetry: boolean;
    statusCode: number;
  } {
    const categorization = TENANT_ERROR_CATEGORIZATION[errorCode];
    if (categorization) {
      return categorization;
    }

    // Default categorization
    return {
      category: TenantErrorCategory.TENANT_CONFIGURATION,
      severity: ErrorSeverity.MEDIUM,
      shouldRetry: true,
      statusCode: 500
    };
  }

  /**
   * Get user-friendly message for tenant errors
   */
  private getTenantUserMessage(errorCode: string): string {
    return TENANT_USER_MESSAGES[errorCode] || 
           'Payment service is temporarily unavailable. Please try again or contact support.';
  }

  /**
   * Get admin message for tenant errors
   */
  private getTenantAdminMessage(errorCode: string, error: any): string {
    const baseMessage = TENANT_ADMIN_MESSAGES[errorCode] || 'Unknown tenant credential error';
    
    if (this.environment === 'sandbox' && error instanceof Error) {
      return `${baseMessage}: ${error.message}`;
    }
    
    return baseMessage;
  }

  /**
   * Sanitize tenant context to remove sensitive information
   */
  private sanitizeTenantContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    
    // Remove sensitive fields specific to tenant operations
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'credential', 'passkey',
      'consumerKey', 'consumerSecret', 'phoneNumber', 'encryptedData',
      'decryptedData', 'masterKey', 'kmsKey'
    ];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }
    
    // Mask partial sensitive data if in sandbox with detailed logging
    if (this.environment === 'sandbox') {
      if (sanitized.tenantId && typeof sanitized.tenantId === 'string') {
        sanitized.tenantId = this.maskId(sanitized.tenantId);
      }
      if (sanitized.barId && typeof sanitized.barId === 'string') {
        sanitized.barId = this.maskId(sanitized.barId);
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
   * Log tenant error with enhanced context
   */
  private logTenantError(errorInfo: TenantErrorInfo): void {
    const logData = {
      tenantCategory: errorInfo.tenantCategory,
      statusCode: errorInfo.statusCode,
      tenantId: errorInfo.tenantId,
      barId: errorInfo.barId,
      tabId: errorInfo.tabId,
      environment: errorInfo.environment,
      category: errorInfo.category,
      code: errorInfo.code,
      severity: errorInfo.severity,
      context: errorInfo.context,
      shouldRetry: errorInfo.shouldRetry,
      retryAfterMs: errorInfo.retryAfterMs
    };

    const logMessage = `[${errorInfo.tenantCategory}] ${errorInfo.adminMessage}`;

    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`[CRITICAL] ${logMessage}`, logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`[HIGH] ${logMessage}`, logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`[MEDIUM] ${logMessage}`, logData);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(`[LOW] ${logMessage}`, logData);
        break;
    }
  }

  /**
   * Create standardized error response for APIs
   */
  createErrorResponse(errorInfo: TenantErrorInfo): {
    success: false;
    error: {
      code: string;
      message: string;
      shouldRetry: boolean;
      retryAfterMs?: number;
    };
    debug?: {
      category: string;
      severity: string;
      adminMessage: string;
      timestamp: string;
      tenantId?: string;
      barId?: string;
      tabId?: string;
    };
  } {
    const response = {
      success: false as const,
      error: {
        code: errorInfo.code,
        message: errorInfo.userMessage,
        shouldRetry: errorInfo.shouldRetry,
        ...(errorInfo.retryAfterMs && { retryAfterMs: errorInfo.retryAfterMs })
      }
    };

    // Include debug information only in sandbox environment
    if (this.environment === 'sandbox') {
      return {
        ...response,
        debug: {
          category: errorInfo.tenantCategory,
          severity: errorInfo.severity,
          adminMessage: errorInfo.adminMessage,
          timestamp: errorInfo.timestamp.toISOString(),
          ...(errorInfo.tenantId && { tenantId: errorInfo.tenantId }),
          ...(errorInfo.barId && { barId: errorInfo.barId }),
          ...(errorInfo.tabId && { tabId: errorInfo.tabId })
        }
      };
    }

    return response;
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): Record<string, any> {
    return this.baseErrorHandler.getErrorStats();
  }

  /**
   * Clean up expired error counts
   */
  cleanup(): void {
    this.baseErrorHandler.cleanupErrorCounts();
  }
}

/**
 * Factory function to create tenant credential error handler
 */
export function createTenantCredentialErrorHandler(
  logger: Logger,
  environment: MpesaEnvironment
): TenantCredentialErrorHandler {
  return new TenantCredentialErrorHandler(logger, environment);
}

/**
 * Utility function to wrap service operations with error handling
 */
export async function withTenantErrorHandling<T>(
  operation: () => Promise<T>,
  errorHandler: TenantCredentialErrorHandler,
  context: {
    tenantId?: string;
    barId?: string;
    tabId?: string;
    operation?: string;
    environment?: MpesaEnvironment;
    [key: string]: any;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = errorHandler.handleTenantError(error, context);
    
    // Create a new MpesaError with the enhanced information
    const enhancedError = new MpesaError(
      errorInfo.userMessage,
      errorInfo.code,
      errorInfo.statusCode,
      error
    );
    
    throw enhancedError;
  }
}