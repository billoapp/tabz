/**
 * Comprehensive Error Handling Tests
 * Tests the enhanced error handling for tenant credential operations
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 6.4
 */

import { 
  TenantCredentialErrorHandler,
  createTenantCredentialErrorHandler,
  withTenantErrorHandling,
  TenantErrorCategory
} from '../services/error-handling';
import { MpesaError, MpesaEnvironment } from '../types';
import { ErrorSeverity } from '../middleware/error-handler';

// Mock logger for testing
class MockLogger {
  private logs: Array<{ level: string; message: string; meta?: any }> = [];

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

  getLogs(): Array<{ level: string; message: string; meta?: any }> {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

describe('Comprehensive Error Handling', () => {
  let mockLogger: MockLogger;
  let errorHandler: TenantCredentialErrorHandler;

  beforeEach(() => {
    mockLogger = new MockLogger();
    errorHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
  });

  describe('Tab Resolution Errors', () => {
    it('should handle TAB_NOT_FOUND error with user-friendly message', () => {
      const error = new MpesaError('Tab not found: tab-123', 'TAB_NOT_FOUND', 404);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId: 'tab-123',
        operation: 'resolveTabToTenant'
      });

      expect(errorInfo.code).toBe('TAB_NOT_FOUND');
      expect(errorInfo.statusCode).toBe(404);
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.TAB_RESOLUTION);
      expect(errorInfo.severity).toBe(ErrorSeverity.LOW);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('The selected tab could not be found. Please refresh and try again.');
      expect(errorInfo.adminMessage).toContain('Tab ID not found in database');
      expect(errorInfo.tabId).toBe('tab-123');
    });

    it('should handle ORPHANED_TAB error with proper categorization', () => {
      const error = new MpesaError('Orphaned tab detected', 'ORPHANED_TAB', 400);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId: 'tab-123',
        barId: 'bar-456',
        operation: 'resolveTabToTenant'
      });

      expect(errorInfo.code).toBe('ORPHANED_TAB');
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.TAB_RESOLUTION);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('This tab is not properly configured. Please contact support.');
      expect(errorInfo.adminMessage).toContain('data integrity issue');
    });

    it('should handle INACTIVE_BAR error appropriately', () => {
      const error = new MpesaError('Inactive bar', 'INACTIVE_BAR', 400);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId: 'tab-123',
        barId: 'bar-456',
        operation: 'resolveTabToTenant'
      });

      expect(errorInfo.code).toBe('INACTIVE_BAR');
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.userMessage).toBe('This location is temporarily unavailable for payments.');
      expect(errorInfo.shouldRetry).toBe(false);
    });
  });

  describe('Credential Retrieval Errors', () => {
    it('should handle CREDENTIALS_NOT_FOUND with service unavailable message', () => {
      const error = new MpesaError('No credentials found', 'CREDENTIALS_NOT_FOUND', 404);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        environment: 'sandbox' as MpesaEnvironment,
        operation: 'getTenantCredentials'
      });

      expect(errorInfo.code).toBe('CREDENTIALS_NOT_FOUND');
      expect(errorInfo.statusCode).toBe(503); // Service unavailable, not 404
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.CREDENTIAL_RETRIEVAL);
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('Payment service is not configured for this location. Please contact the establishment.');
      expect(errorInfo.adminMessage).toContain('No M-Pesa credentials found for tenant');
    });

    it('should handle CREDENTIALS_INACTIVE appropriately', () => {
      const error = new MpesaError('Credentials inactive', 'CREDENTIALS_INACTIVE', 403);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        environment: 'production' as MpesaEnvironment,
        operation: 'getTenantCredentials'
      });

      expect(errorInfo.code).toBe('CREDENTIALS_INACTIVE');
      expect(errorInfo.statusCode).toBe(503);
      expect(errorInfo.userMessage).toBe('Payment service is temporarily unavailable at this location.');
      expect(errorInfo.shouldRetry).toBe(false);
    });

    it('should handle DATABASE_ERROR with retry capability', () => {
      const error = new MpesaError('Database connection failed', 'DATABASE_ERROR', 500);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        operation: 'getTenantCredentials'
      });

      expect(errorInfo.code).toBe('DATABASE_ERROR');
      expect(errorInfo.statusCode).toBe(503);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.shouldRetry).toBe(true);
      expect(errorInfo.userMessage).toBe('Service temporarily unavailable. Please try again in a few moments.');
    });
  });

  describe('Decryption Errors', () => {
    it('should handle KMS_KEY_MISSING as critical error', () => {
      const error = new MpesaError('KMS key missing', 'KMS_KEY_MISSING', 500);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        operation: 'decrypt'
      });

      expect(errorInfo.code).toBe('KMS_KEY_MISSING');
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.CREDENTIAL_DECRYPTION);
      expect(errorInfo.severity).toBe(ErrorSeverity.CRITICAL);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('Payment service is temporarily unavailable. Please try again later.');
      expect(errorInfo.adminMessage).toContain('MPESA_KMS_KEY environment variable not set');
    });

    it('should handle DECRYPTION_FAILED without exposing technical details', () => {
      const error = new MpesaError('Decryption failed', 'DECRYPTION_FAILED', 500);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        operation: 'decrypt'
      });

      expect(errorInfo.code).toBe('DECRYPTION_FAILED');
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('Unable to access payment credentials. Please try again later.');
      expect(errorInfo.adminMessage).toContain('AES decryption failed');
      
      // Ensure no sensitive data in user message
      expect(errorInfo.userMessage).not.toContain('key');
      expect(errorInfo.userMessage).not.toContain('decrypt');
      expect(errorInfo.userMessage).not.toContain('AES');
    });

    it('should handle CORRUPTED_ENCRYPTED_DATA appropriately', () => {
      const error = new MpesaError('Corrupted data', 'CORRUPTED_ENCRYPTED_DATA', 400);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        operation: 'decrypt'
      });

      expect(errorInfo.code).toBe('CORRUPTED_ENCRYPTED_DATA');
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.userMessage).toBe('Payment configuration error. Please contact support.');
      expect(errorInfo.shouldRetry).toBe(false);
    });
  });

  describe('Validation Errors', () => {
    it('should handle CREDENTIALS_INVALID with configuration message', () => {
      const error = new MpesaError('Invalid credentials', 'CREDENTIALS_INVALID', 500);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        operation: 'validateCredentials'
      });

      expect(errorInfo.code).toBe('CREDENTIALS_INVALID');
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.CREDENTIAL_VALIDATION);
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('Payment service configuration is invalid. Please contact support.');
    });
  });

  describe('Configuration Errors', () => {
    it('should handle INVALID_TENANT_CONFIG with proper status code', () => {
      const error = new MpesaError('Invalid config', 'INVALID_TENANT_CONFIG', 400);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        operation: 'createTenantConfig'
      });

      expect(errorInfo.code).toBe('INVALID_TENANT_CONFIG');
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.TENANT_CONFIGURATION);
      expect(errorInfo.severity).toBe(ErrorSeverity.HIGH);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toBe('Payment service configuration is invalid. Please contact support.');
    });
  });

  describe('Context Sanitization', () => {
    it('should sanitize sensitive data from context', () => {
      const error = new MpesaError('Test error', 'TEST_ERROR', 500);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123456789',
        barId: 'bar-987654321',
        consumerKey: 'sensitive-key',
        consumerSecret: 'sensitive-secret',
        passkey: 'sensitive-passkey',
        phoneNumber: '254712345678',
        operation: 'testOperation'
      });

      // Sensitive fields should be removed
      expect(errorInfo.context.consumerKey).toBeUndefined();
      expect(errorInfo.context.consumerSecret).toBeUndefined();
      expect(errorInfo.context.passkey).toBeUndefined();
      expect(errorInfo.context.phoneNumber).toBeUndefined();
      
      // IDs should be masked in sandbox
      expect(errorInfo.context.tenantId).toContain('*');
      expect(errorInfo.context.barId).toContain('*');
      
      // Non-sensitive fields should remain
      expect(errorInfo.context.operation).toBe('testOperation');
    });

    it('should not log sensitive data even in sandbox mode', () => {
      const error = new MpesaError('Test error', 'TEST_ERROR', 500);
      
      errorHandler.handleTenantError(error, {
        consumerKey: 'sensitive-key',
        consumerSecret: 'sensitive-secret',
        operation: 'testOperation'
      });

      const logs = mockLogger.getLogs();
      const logContent = JSON.stringify(logs);
      
      expect(logContent).not.toContain('sensitive-key');
      expect(logContent).not.toContain('sensitive-secret');
    });
  });

  describe('Error Response Creation', () => {
    it('should create proper error response for production environment', () => {
      const prodErrorHandler = createTenantCredentialErrorHandler(mockLogger, 'production');
      const error = new MpesaError('Test error', 'CREDENTIALS_NOT_FOUND', 404);
      
      const errorInfo = prodErrorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        operation: 'test'
      });

      const response = prodErrorHandler.createErrorResponse(errorInfo);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('CREDENTIALS_NOT_FOUND');
      expect(response.error.message).toBe('Payment service is not configured for this location. Please contact the establishment.');
      expect(response.error.shouldRetry).toBe(false);
      
      // No debug info in production
      expect(response.debug).toBeUndefined();
    });

    it('should create error response with debug info for sandbox environment', () => {
      const error = new MpesaError('Test error', 'CREDENTIALS_NOT_FOUND', 404);
      
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        tabId: 'tab-789',
        operation: 'test'
      });

      const response = errorHandler.createErrorResponse(errorInfo);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('CREDENTIALS_NOT_FOUND');
      expect(response.error.shouldRetry).toBe(false);
      
      // Debug info included in sandbox
      expect(response.debug).toBeDefined();
      expect(response.debug!.category).toBe(TenantErrorCategory.CREDENTIAL_RETRIEVAL);
      expect(response.debug!.severity).toBe(ErrorSeverity.MEDIUM);
      expect(response.debug!.tenantId).toBe('tenant-123');
      expect(response.debug!.barId).toBe('bar-456');
      expect(response.debug!.tabId).toBe('tab-789');
    });
  });

  describe('withTenantErrorHandling Wrapper', () => {
    it('should wrap successful operations without modification', async () => {
      const successfulOperation = async () => {
        return { success: true, data: 'test-data' };
      };

      const result = await withTenantErrorHandling(
        successfulOperation,
        errorHandler,
        { operation: 'test' }
      );

      expect(result).toEqual({ success: true, data: 'test-data' });
    });

    it('should enhance errors with tenant context', async () => {
      const failingOperation = async () => {
        throw new Error('Original error message');
      };

      try {
        await withTenantErrorHandling(
          failingOperation,
          errorHandler,
          {
            tenantId: 'tenant-123',
            tabId: 'tab-456',
            operation: 'testOperation'
          }
        );
        
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MpesaError);
        const mpesaError = error as MpesaError;
        expect(mpesaError.statusCode).toBeDefined();
        expect(mpesaError.code).toBeDefined();
      }
    });

    it('should preserve MpesaError instances', async () => {
      const failingOperation = async () => {
        throw new MpesaError('Specific error', 'SPECIFIC_ERROR', 400);
      };

      try {
        await withTenantErrorHandling(
          failingOperation,
          errorHandler,
          { operation: 'test' }
        );
        
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MpesaError);
        const mpesaError = error as MpesaError;
        expect(mpesaError.code).toBe('SPECIFIC_ERROR');
        expect(mpesaError.statusCode).toBe(400);
      }
    });
  });

  describe('Logging Behavior', () => {
    it('should log errors with appropriate levels based on severity', () => {
      // Test different severity levels
      const criticalError = new MpesaError('Critical error', 'KMS_KEY_MISSING', 500);
      const highError = new MpesaError('High error', 'DECRYPTION_FAILED', 500);
      const mediumError = new MpesaError('Medium error', 'CREDENTIALS_NOT_FOUND', 404);
      const lowError = new MpesaError('Low error', 'TAB_NOT_FOUND', 404);

      mockLogger.clear();

      errorHandler.handleTenantError(criticalError, { operation: 'test1' });
      errorHandler.handleTenantError(highError, { operation: 'test2' });
      errorHandler.handleTenantError(mediumError, { operation: 'test3' });
      errorHandler.handleTenantError(lowError, { operation: 'test4' });

      const logs = mockLogger.getLogs();
      
      // Check that appropriate log levels were used
      expect(logs.some(log => log.level === 'error' && log.message.includes('[CRITICAL]'))).toBe(true);
      expect(logs.some(log => log.level === 'error' && log.message.includes('[HIGH]'))).toBe(true);
      expect(logs.some(log => log.level === 'warn' && log.message.includes('[MEDIUM]'))).toBe(true);
      expect(logs.some(log => log.level === 'info' && log.message.includes('[LOW]'))).toBe(true);
    });

    it('should include tenant context in logs without sensitive data', () => {
      const error = new MpesaError('Test error', 'TEST_ERROR', 500);
      
      mockLogger.clear();
      
      errorHandler.handleTenantError(error, {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        tabId: 'tab-789',
        consumerKey: 'sensitive-data',
        operation: 'testOperation'
      });

      const logs = mockLogger.getLogs();
      const logContent = JSON.stringify(logs);
      
      // Should include non-sensitive context
      expect(logContent).toContain('tenant-123');
      expect(logContent).toContain('bar-456');
      expect(logContent).toContain('tab-789');
      expect(logContent).toContain('testOperation');
      
      // Should not include sensitive data
      expect(logContent).not.toContain('sensitive-data');
    });
  });

  describe('Error Statistics and Cleanup', () => {
    it('should provide error statistics', () => {
      const error = new MpesaError('Test error', 'TEST_ERROR', 500);
      
      errorHandler.handleTenantError(error, { operation: 'test' });
      
      const stats = errorHandler.getErrorStats();
      expect(typeof stats).toBe('object');
    });

    it('should support cleanup operations', () => {
      expect(() => errorHandler.cleanup()).not.toThrow();
    });
  });

  describe('Unknown Error Handling', () => {
    it('should handle unknown errors with default categorization', () => {
      const unknownError = new Error('Unknown error type');
      
      const errorInfo = errorHandler.handleTenantError(unknownError, {
        operation: 'unknownOperation'
      });

      expect(errorInfo.code).toBe('UNKNOWN_ERROR');
      expect(errorInfo.tenantCategory).toBe(TenantErrorCategory.TENANT_CONFIGURATION);
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorInfo.shouldRetry).toBe(true);
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.userMessage).toBe('Payment service is temporarily unavailable. Please try again or contact support.');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error message';
      
      const errorInfo = errorHandler.handleTenantError(stringError, {
        operation: 'stringErrorTest'
      });

      expect(errorInfo.code).toBe('UNKNOWN_ERROR');
      expect(errorInfo.userMessage).toBe('Payment service is temporarily unavailable. Please try again or contact support.');
    });
  });
});