/**
 * Unit Tests for Error Scenarios in Tenant Credential System
 * 
 * Tests comprehensive error handling for:
 * - Missing credentials error handling
 * - Decryption failure scenarios  
 * - Database connectivity errors
 * - Invalid tab scenarios
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import {
  TabResolutionService,
  CredentialRetrievalService,
  KMSDecryptionService,
  TenantMpesaConfigFactory,
  createTabResolutionService,
  createCredentialRetrievalService,
  createKMSDecryptionService,
  createTenantMpesaConfigFactory,
  TenantCredentialErrorHandler,
  createTenantCredentialErrorHandler,
  StructuredMpesaLogger,
  createStructuredMpesaLogger,
  CorrelationIdManager
} from '../services';
import { 
  MpesaError,
  MpesaEnvironment,
  TenantInfo,
  MpesaCredentials
} from '../types';
import { Logger } from '../services/base';

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  }))
};

describe('Error Scenarios - Missing Credentials', () => {
  let credentialRetrievalService: CredentialRetrievalService;
  let errorHandler: TenantCredentialErrorHandler;
  let structuredLogger: StructuredMpesaLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    credentialRetrievalService = createCredentialRetrievalService(
      'https://test.supabase.co',
      'test-service-key'
    );
    
    errorHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
    structuredLogger = createStructuredMpesaLogger(mockLogger, 'sandbox');
  });

  it('should handle missing credentials for tenant', async () => {
    // Mock database to return no credentials
    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          }))
        }))
      }))
    }));

    // Replace the service's supabase client
    (credentialRetrievalService as any).supabase = { from: mockFrom };

    const tenantId = 'tenant-123';
    const environment: MpesaEnvironment = 'sandbox';

    // Test credential retrieval failure
    await expect(
      credentialRetrievalService.getTenantCredentials(tenantId, environment)
    ).rejects.toThrow('Credentials not found');

    // Verify error handling
    try {
      await credentialRetrievalService.getTenantCredentials(tenantId, environment);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId,
        environment,
        operation: 'credential_retrieval'
      });

      expect(errorInfo.code).toBe('CREDENTIALS_NOT_FOUND');
      expect(errorInfo.tenantCategory).toBe('CREDENTIAL_RETRIEVAL');
      expect(errorInfo.statusCode).toBe(503);
      expect(errorInfo.userMessage).toContain('Payment service not configured');
      expect(errorInfo.shouldRetry).toBe(false);
    }

    // Verify structured logging
    expect(mockFrom).toHaveBeenCalledWith('mpesa_credentials');
  });

  it('should handle inactive credentials', async () => {
    // Mock database to return inactive credentials
    const inactiveCredentials = {
      id: 'cred-123',
      tenant_id: 'tenant-123',
      environment: 'sandbox',
      consumer_key_enc: 'encrypted-key',
      consumer_secret_enc: 'encrypted-secret',
      business_shortcode_enc: 'encrypted-shortcode',
      passkey_enc: 'encrypted-passkey',
      callback_url: 'https://example.com/callback',
      is_active: false, // Inactive
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: inactiveCredentials, error: null })
          }))
        }))
      }))
    }));

    (credentialRetrievalService as any).supabase = { from: mockFrom };

    const tenantId = 'tenant-123';
    const environment: MpesaEnvironment = 'sandbox';

    // Test inactive credentials handling
    await expect(
      credentialRetrievalService.getTenantCredentials(tenantId, environment)
    ).rejects.toThrow('Credentials inactive');

    // Verify error categorization
    try {
      await credentialRetrievalService.getTenantCredentials(tenantId, environment);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId,
        environment,
        operation: 'credential_retrieval'
      });

      expect(errorInfo.code).toBe('CREDENTIALS_INACTIVE');
      expect(errorInfo.userMessage).toContain('temporarily unavailable');
      expect(errorInfo.shouldRetry).toBe(false);
    }
  });

  it('should handle incomplete credentials', async () => {
    // Mock database to return incomplete credentials (missing required fields)
    const incompleteCredentials = {
      id: 'cred-123',
      tenant_id: 'tenant-123',
      environment: 'sandbox',
      consumer_key_enc: 'encrypted-key',
      consumer_secret_enc: null, // Missing
      business_shortcode_enc: 'encrypted-shortcode',
      passkey_enc: null, // Missing
      callback_url: 'https://example.com/callback',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: incompleteCredentials, error: null })
          }))
        }))
      }))
    }));

    (credentialRetrievalService as any).supabase = { from: mockFrom };

    const tenantId = 'tenant-123';
    const environment: MpesaEnvironment = 'sandbox';

    // Test incomplete credentials handling
    await expect(
      credentialRetrievalService.getTenantCredentials(tenantId, environment)
    ).rejects.toThrow('Credentials incomplete');

    // Verify error details
    try {
      await credentialRetrievalService.getTenantCredentials(tenantId, environment);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId,
        environment,
        operation: 'credential_retrieval'
      });

      expect(errorInfo.code).toBe('CREDENTIALS_INCOMPLETE');
      expect(errorInfo.userMessage).toContain('configuration incomplete');
      expect(errorInfo.severity).toBe('HIGH');
    }
  });
});

describe('Error Scenarios - Decryption Failures', () => {
  let kmsDecryptionService: KMSDecryptionService;
  let errorHandler: TenantCredentialErrorHandler;
  let structuredLogger: StructuredMpesaLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear environment variables for testing
    delete process.env.MPESA_KMS_KEY;
    
    errorHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
    structuredLogger = createStructuredMpesaLogger(mockLogger, 'sandbox');
  });

  it('should handle missing KMS key', async () => {
    // Ensure KMS key is not set
    delete process.env.MPESA_KMS_KEY;

    kmsDecryptionService = createKMSDecryptionService();

    // Test missing KMS key
    await expect(
      kmsDecryptionService.decrypt('encrypted-data')
    ).rejects.toThrow('MPESA_KMS_KEY environment variable not set');

    // Verify error handling
    try {
      await kmsDecryptionService.decrypt('encrypted-data');
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        operation: 'credential_decryption'
      });

      expect(errorInfo.code).toBe('KMS_KEY_MISSING');
      expect(errorInfo.tenantCategory).toBe('CREDENTIAL_DECRYPTION');
      expect(errorInfo.severity).toBe('CRITICAL');
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.shouldRetry).toBe(false);
    }
  });

  it('should handle invalid KMS key length', async () => {
    // Set invalid KMS key (wrong length)
    process.env.MPESA_KMS_KEY = 'short-key';

    kmsDecryptionService = createKMSDecryptionService();

    // Test invalid key length
    await expect(
      kmsDecryptionService.decrypt('encrypted-data')
    ).rejects.toThrow('KMS_KEY invalid length');

    // Verify error categorization
    try {
      await kmsDecryptionService.decrypt('encrypted-data');
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        operation: 'credential_decryption'
      });

      expect(errorInfo.code).toBe('KMS_KEY_INVALID_LENGTH');
      expect(errorInfo.severity).toBe('CRITICAL');
      expect(errorInfo.userMessage).toContain('temporarily unavailable');
    }
  });

  it('should handle invalid KMS key format', async () => {
    // Set invalid KMS key (invalid characters)
    process.env.MPESA_KMS_KEY = 'invalid-characters-@#$%^&*()!@#$%^&*()!@#$%^&*()!@';

    kmsDecryptionService = createKMSDecryptionService();

    // Test invalid key format
    await expect(
      kmsDecryptionService.decrypt('encrypted-data')
    ).rejects.toThrow('KMS_KEY invalid format');

    // Verify error handling
    try {
      await kmsDecryptionService.decrypt('encrypted-data');
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        operation: 'credential_decryption'
      });

      expect(errorInfo.code).toBe('KMS_KEY_INVALID_FORMAT');
      expect(errorInfo.tenantCategory).toBe('CREDENTIAL_DECRYPTION');
    }
  });

  it('should handle corrupted encrypted data', async () => {
    // Set valid KMS key
    process.env.MPESA_KMS_KEY = 'a'.repeat(32); // 32 character key

    kmsDecryptionService = createKMSDecryptionService();

    // Test corrupted encrypted data
    await expect(
      kmsDecryptionService.decrypt('corrupted-data-not-base64')
    ).rejects.toThrow();

    // Test with invalid encrypted format
    await expect(
      kmsDecryptionService.decrypt('dGVzdA==') // Valid base64 but invalid encrypted format
    ).rejects.toThrow();
  });

  it('should handle decryption authentication failure', async () => {
    // Set valid KMS key
    process.env.MPESA_KMS_KEY = 'a'.repeat(32);

    kmsDecryptionService = createKMSDecryptionService();

    // Create properly formatted but invalid encrypted data (wrong key)
    const invalidEncryptedData = Buffer.from('invalid-iv-and-data').toString('base64');

    await expect(
      kmsDecryptionService.decrypt(invalidEncryptedData)
    ).rejects.toThrow();

    // Verify error handling for authentication failure
    try {
      await kmsDecryptionService.decrypt(invalidEncryptedData);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        operation: 'credential_decryption'
      });

      expect(errorInfo.tenantCategory).toBe('CREDENTIAL_DECRYPTION');
      expect(errorInfo.severity).toBe('HIGH');
      expect(errorInfo.shouldRetry).toBe(false);
    }
  });
});

describe('Error Scenarios - Database Connectivity', () => {
  let tabResolutionService: TabResolutionService;
  let credentialRetrievalService: CredentialRetrievalService;
  let errorHandler: TenantCredentialErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    errorHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
  });

  it('should handle database connection timeout', async () => {
    tabResolutionService = createTabResolutionService(
      'https://invalid-url.supabase.co',
      'invalid-key'
    );

    const tabId = 'tab-123';

    // Test database connection failure
    await expect(
      tabResolutionService.resolveTabToTenant(tabId)
    ).rejects.toThrow();

    // Verify error handling
    try {
      await tabResolutionService.resolveTabToTenant(tabId);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId,
        operation: 'tab_resolution'
      });

      expect(errorInfo.tenantCategory).toBe('TAB_RESOLUTION');
      expect(errorInfo.shouldRetry).toBe(true); // Database errors are retryable
      expect(errorInfo.userMessage).toContain('try again');
    }
  });

  it('should handle database permission errors', async () => {
    // Mock database to return permission error
    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { code: '42501', message: 'permission denied' } 
          })
        }))
      }))
    }));

    credentialRetrievalService = createCredentialRetrievalService(
      'https://test.supabase.co',
      'test-service-key'
    );

    (credentialRetrievalService as any).supabase = { from: mockFrom };

    const tenantId = 'tenant-123';
    const environment: MpesaEnvironment = 'sandbox';

    // Test permission error
    await expect(
      credentialRetrievalService.getTenantCredentials(tenantId, environment)
    ).rejects.toThrow();

    // Verify error categorization
    try {
      await credentialRetrievalService.getTenantCredentials(tenantId, environment);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tenantId,
        environment,
        operation: 'credential_retrieval'
      });

      expect(errorInfo.tenantCategory).toBe('CREDENTIAL_RETRIEVAL');
      expect(errorInfo.severity).toBe('HIGH');
    }
  });

  it('should handle database query timeout', async () => {
    // Mock database to simulate timeout
    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockRejectedValue(new Error('Query timeout'))
        }))
      }))
    }));

    tabResolutionService = createTabResolutionService(
      'https://test.supabase.co',
      'test-service-key'
    );

    (tabResolutionService as any).supabase = { from: mockFrom };

    const tabId = 'tab-123';

    // Test query timeout
    await expect(
      tabResolutionService.resolveTabToTenant(tabId)
    ).rejects.toThrow('Query timeout');

    // Verify retry recommendation
    try {
      await tabResolutionService.resolveTabToTenant(tabId);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId,
        operation: 'tab_resolution'
      });

      expect(errorInfo.shouldRetry).toBe(true);
      expect(errorInfo.userMessage).toContain('try again');
    }
  });
});

describe('Error Scenarios - Invalid Tab Scenarios', () => {
  let tabResolutionService: TabResolutionService;
  let configFactory: TenantMpesaConfigFactory;
  let errorHandler: TenantCredentialErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    errorHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
  });

  it('should handle non-existent tab', async () => {
    // Mock database to return no tab
    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
        }))
      }))
    }));

    tabResolutionService = createTabResolutionService(
      'https://test.supabase.co',
      'test-service-key'
    );

    (tabResolutionService as any).supabase = { from: mockFrom };

    const tabId = 'non-existent-tab';

    // Test non-existent tab
    await expect(
      tabResolutionService.resolveTabToTenant(tabId)
    ).rejects.toThrow('Tab not found');

    // Verify error handling
    try {
      await tabResolutionService.resolveTabToTenant(tabId);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId,
        operation: 'tab_resolution'
      });

      expect(errorInfo.code).toBe('TAB_NOT_FOUND');
      expect(errorInfo.tenantCategory).toBe('TAB_RESOLUTION');
      expect(errorInfo.statusCode).toBe(404);
      expect(errorInfo.shouldRetry).toBe(false);
      expect(errorInfo.userMessage).toContain('refresh');
    }
  });

  it('should handle orphaned tab (no associated bar)', async () => {
    // Mock database to return tab without bar
    const orphanedTab = {
      id: 'tab-123',
      bar_id: null, // No associated bar
      customer_id: 'customer-123',
      status: 'open'
    };

    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: orphanedTab, error: null })
        }))
      }))
    }));

    tabResolutionService = createTabResolutionService(
      'https://test.supabase.co',
      'test-service-key'
    );

    (tabResolutionService as any).supabase = { from: mockFrom };

    const tabId = 'tab-123';

    // Test orphaned tab
    await expect(
      tabResolutionService.resolveTabToTenant(tabId)
    ).rejects.toThrow('Orphaned tab');

    // Verify error categorization
    try {
      await tabResolutionService.resolveTabToTenant(tabId);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId,
        operation: 'tab_resolution'
      });

      expect(errorInfo.code).toBe('ORPHANED_TAB');
      expect(errorInfo.severity).toBe('HIGH');
      expect(errorInfo.userMessage).toContain('not properly configured');
    }
  });

  it('should handle inactive bar', async () => {
    // Mock database to return tab with inactive bar
    const tabWithInactiveBar = {
      id: 'tab-123',
      bar_id: 'bar-456',
      customer_id: 'customer-123',
      status: 'open',
      bars: {
        id: 'bar-456',
        name: 'Test Bar',
        is_active: false // Inactive bar
      }
    };

    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: tabWithInactiveBar, error: null })
        }))
      }))
    }));

    tabResolutionService = createTabResolutionService(
      'https://test.supabase.co',
      'test-service-key'
    );

    (tabResolutionService as any).supabase = { from: mockFrom };

    const tabId = 'tab-123';

    // Test inactive bar
    await expect(
      tabResolutionService.resolveTabToTenant(tabId)
    ).rejects.toThrow('Inactive bar');

    // Verify error handling
    try {
      await tabResolutionService.resolveTabToTenant(tabId);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId,
        operation: 'tab_resolution'
      });

      expect(errorInfo.code).toBe('INACTIVE_BAR');
      expect(errorInfo.userMessage).toContain('temporarily unavailable');
    }
  });

  it('should handle invalid tab status', async () => {
    // Mock database to return tab with invalid status
    const tabWithInvalidStatus = {
      id: 'tab-123',
      bar_id: 'bar-456',
      customer_id: 'customer-123',
      status: 'closed', // Invalid for payments
      bars: {
        id: 'bar-456',
        name: 'Test Bar',
        is_active: true
      }
    };

    const mockFrom = jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: tabWithInvalidStatus, error: null })
        }))
      }))
    }));

    tabResolutionService = createTabResolutionService(
      'https://test.supabase.co',
      'test-service-key'
    );

    (tabResolutionService as any).supabase = { from: mockFrom };

    const tabId = 'tab-123';

    // Test invalid tab status
    await expect(
      tabResolutionService.resolveTabToTenant(tabId)
    ).rejects.toThrow('Invalid tab status');

    // Verify error details
    try {
      await tabResolutionService.resolveTabToTenant(tabId);
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        tabId,
        operation: 'tab_resolution'
      });

      expect(errorInfo.code).toBe('INVALID_TAB_STATUS');
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.shouldRetry).toBe(false);
    }
  });
});

describe('Error Scenarios - Structured Logging', () => {
  let structuredLogger: StructuredMpesaLogger;
  let errorHandler: TenantCredentialErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    
    structuredLogger = createStructuredMpesaLogger(mockLogger, 'sandbox', {
      service: 'mpesa-tenant-credentials',
      version: '1.0.0'
    });
    
    errorHandler = createTenantCredentialErrorHandler(mockLogger, 'sandbox');
  });

  it('should log error scenarios with correlation IDs', async () => {
    const correlationId = CorrelationIdManager.generate();
    
    await CorrelationIdManager.withCorrelationIdAsync(correlationId, async () => {
      const operationId = structuredLogger.logOperationStart('credential_retrieval', {
        tenantId: 'tenant-123',
        tabId: 'tab-456'
      });

      // Simulate error
      const error = new MpesaError('Credentials not found', 'CREDENTIALS_NOT_FOUND', 404);
      
      structuredLogger.logOperationFailure(operationId, 'credential_retrieval', error, {
        tenantId: 'tenant-123',
        tabId: 'tab-456'
      });

      // Verify logging calls
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[TENANT_OPERATION_START] credential_retrieval',
        expect.objectContaining({
          correlationId,
          tenantId: expect.stringMatching(/ten\*\*\*-123/), // Masked in sandbox
          tabId: expect.stringMatching(/tab\*\*\*-456/), // Masked in sandbox
          operationId,
          phase: 'start'
        })
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[TENANT_OPERATION_FAILURE] credential_retrieval',
        expect.objectContaining({
          correlationId,
          operationId,
          phase: 'failure',
          errorCode: 'CREDENTIALS_NOT_FOUND',
          errorMessage: 'Credentials not found'
        })
      );
    });
  });

  it('should track performance metrics for failed operations', async () => {
    const operationId = structuredLogger.logOperationStart('decryption', {
      tenantId: 'tenant-123'
    });

    // Simulate slow operation
    await new Promise(resolve => setTimeout(resolve, 100));

    const error = new Error('Decryption failed');
    structuredLogger.logOperationFailure(operationId, 'decryption', error);

    // Get performance metrics
    const metrics = structuredLogger.getPerformanceMetrics();
    
    expect(metrics.totalOperations).toBe(1);
    expect(metrics.failedOperations).toBe(1);
    expect(metrics.successfulOperations).toBe(0);
    expect(metrics.averageDuration).toBeGreaterThan(90); // At least 90ms

    expect(metrics.operationBreakdown.decryption).toBeDefined();
    expect(metrics.operationBreakdown.decryption.count).toBe(1);
    expect(metrics.operationBreakdown.decryption.successRate).toBe(0);
  });

  it('should sanitize sensitive data in error logs', async () => {
    const sensitiveContext = {
      tenantId: 'tenant-123',
      consumerKey: 'sensitive-consumer-key',
      consumerSecret: 'sensitive-consumer-secret',
      phoneNumber: '254712345678',
      kmsKey: 'super-secret-kms-key'
    };

    const error = new Error('Test error with sensitive data');
    const errorInfo = errorHandler.handleTenantError(error, sensitiveContext);

    structuredLogger.logTenantError(errorInfo, sensitiveContext);

    // Verify sensitive data is not logged
    const logCalls = (mockLogger.error as jest.Mock).mock.calls;
    const loggedContext = logCalls[0][1];

    expect(loggedContext.consumerKey).toBeUndefined();
    expect(loggedContext.consumerSecret).toBeUndefined();
    expect(loggedContext.phoneNumber).toBeUndefined();
    expect(loggedContext.kmsKey).toBeUndefined();
    
    // Verify tenant ID is masked in sandbox
    expect(loggedContext.tenantId).toMatch(/ten\*\*\*-123/);
  });

  it('should log security events for suspicious activities', () => {
    structuredLogger.logSecurityEvent('UNAUTHORIZED_ACCESS', 'tenant-123', {
      ipAddress: '192.168.1.100',
      userAgent: 'Suspicious Bot',
      attemptedOperation: 'credential_access'
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[SECURITY_EVENT] UNAUTHORIZED_ACCESS',
      expect.objectContaining({
        tenantId: expect.stringMatching(/ten\*\*\*-123/),
        eventType: 'UNAUTHORIZED_ACCESS',
        securityEvent: true,
        alertLevel: 'SECURITY'
      })
    );
  });

  it('should alert on performance issues', () => {
    // Log slow credential retrieval
    structuredLogger.logCredentialRetrievalMetrics(
      'tenant-123',
      'sandbox',
      true,
      1500, // 1.5 seconds - above threshold
      { operation: 'slow_retrieval_test' }
    );

    // Verify performance alert was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[PERFORMANCE_ALERT] Slow credential retrieval detected',
      expect.objectContaining({
        alertType: 'slow_credential_retrieval',
        threshold: 1000,
        duration: 1500
      })
    );
  });
});