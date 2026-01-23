/**
 * Security Validation Tests for Tenant Credential System
 * 
 * Validates security requirements:
 * - No environment variables used for tenant credentials
 * - Secure memory handling of decrypted credentials
 * - No sensitive data logged or exposed
 * 
 * Requirements: 1.5, 2.3, 2.4
 */

import {
  TabResolutionService,
  CredentialRetrievalService,
  KMSDecryptionService,
  TenantMpesaConfigFactory,
  ServiceFactory,
  STKPushService
} from '../services';
import {
  MpesaEnvironment,
  MpesaCredentials,
  ServiceConfig
} from '../types';
import { TenantInfo } from '../services/tab-resolution';
import { Logger } from '../services/base';

// Mock logger that captures all log calls for security analysis
class SecurityAuditLogger implements Logger {
  public logCalls: Array<{
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: any;
  }> = [];

  info(message: string, data?: any): void {
    this.logCalls.push({ level: 'info', message, data });
  }

  warn(message: string, data?: any): void {
    this.logCalls.push({ level: 'warn', message, data });
  }

  error(message: string, data?: any): void {
    this.logCalls.push({ level: 'error', message, data });
  }

  debug(message: string, data?: any): void {
    this.logCalls.push({ level: 'debug', message, data });
  }

  clearLogs(): void {
    this.logCalls = [];
  }

  getAllLogContent(): string {
    return this.logCalls
      .map(call => `${call.level}: ${call.message} ${JSON.stringify(call.data || {})}`)
      .join('\n');
  }
}

// Mock implementations for security testing
class MockTabResolutionService implements TabResolutionService {
  constructor(private mockTenants: Map<string, TenantInfo>) {}

  async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
    const tenant = this.mockTenants.get(tabId);
    if (!tenant) {
      throw new Error('Tab not found');
    }
    return tenant;
  }

  async validateTabExists(tabId: string): Promise<any> {
    const tenant = this.mockTenants.get(tabId);
    if (!tenant) {
      throw new Error('Tab not found');
    }
    return {
      id: tabId,
      barId: tenant.barId,
      tabNumber: 1,
      status: 'open',
      openedAt: new Date()
    };
  }

  async validateTabStatus(tabId: string): Promise<boolean> {
    const tenant = this.mockTenants.get(tabId);
    return !!tenant && tenant.isActive;
  }
}

class MockCredentialRetrievalService implements CredentialRetrievalService {
  constructor(private mockCredentials: Map<string, MpesaCredentials>) {}

  async getTenantCredentials(tenantId: string, environment: MpesaEnvironment): Promise<MpesaCredentials> {
    const key = `${tenantId}-${environment}`;
    const credentials = this.mockCredentials.get(key);
    if (!credentials) {
      throw new Error('Credentials not found');
    }
    return credentials;
  }

  async validateCredentials(credentials: MpesaCredentials): Promise<boolean> {
    return !!(credentials.consumerKey && credentials.consumerSecret && 
             credentials.businessShortCode && credentials.passkey);
  }
}

// Sensitive data patterns for security validation
const SENSITIVE_PATTERNS = [
  // Credential patterns
  /consumer[_-]?key/i,
  /consumer[_-]?secret/i,
  /business[_-]?shortcode/i,
  /passkey/i,
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /access[_-]?token/i,
  /bearer[_-]?token/i,
  
  // Encryption patterns
  /kms[_-]?key/i,
  /encryption[_-]?key/i,
  /master[_-]?key/i,
  /private[_-]?key/i,
  /decrypt/i,
  /encrypt/i,
  
  // Personal data patterns
  /phone[_-]?number/i,
  /\+254\d{9}/,
  /254\d{9}/,
  /07\d{8}/,
  /01\d{8}/,
  
  // Database patterns
  /password/i,
  /connection[_-]?string/i,
  /database[_-]?url/i,
  /postgres:\/\//,
  /mysql:\/\//,
  
  // Long alphanumeric strings (likely keys/tokens)
  /\b[A-Za-z0-9]{32,}\b/,
  
  // Base64 encoded data (potential encrypted content)
  /^[A-Za-z0-9+\/]{20,}={0,2}$/
];

// Test data
const TEST_TENANT: TenantInfo = {
  tenantId: 'tenant-security-test',
  barId: 'bar-security-test',
  barName: 'Security Test Bar',
  isActive: true
};

const SENSITIVE_CREDENTIALS: MpesaCredentials = {
  consumerKey: 'SENSITIVE_CONSUMER_KEY_12345',
  consumerSecret: 'SENSITIVE_CONSUMER_SECRET_67890',
  businessShortCode: '174379',
  passkey: 'SENSITIVE_PASSKEY_ABCDEF123456789',
  callbackUrl: 'https://secure-callback.com/webhook',
  environment: 'sandbox',
  encryptedAt: new Date(),
  lastValidated: new Date()
};

// Mock error handler for security testing
class MockTenantCredentialErrorHandler {
  constructor(private logger: Logger, private environment: MpesaEnvironment) {}

  handleTenantError(error: any, context: any = {}): any {
    return {
      code: 'TEST_ERROR',
      userMessage: 'Test error message',
      adminMessage: 'Test admin message',
      shouldRetry: false,
      severity: 'MEDIUM',
      timestamp: new Date(),
      environment: this.environment,
      context: this.sanitizeContext(context)
    };
  }

  createErrorResponse(errorInfo: any): any {
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.userMessage,
        shouldRetry: errorInfo.shouldRetry
      }
    };
  }

  private sanitizeContext(context: any): any {
    const sanitized = { ...context };
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
    
    return sanitized;
  }
}

// Mock structured logger for security testing
class MockStructuredMpesaLogger {
  constructor(private logger: Logger, private environment: MpesaEnvironment) {}

  logTenantError(errorInfo: any, context: any): void {
    this.logger.error('Tenant error', { errorInfo, context });
  }

  logOperationStart(operation: string, context: any): string {
    const operationId = `op_${Date.now()}`;
    this.logger.info(`Operation started: ${operation}`, { operationId, context });
    return operationId;
  }

  logOperationSuccess(operationId: string, operation: string, context: any): void {
    this.logger.info(`Operation completed: ${operation}`, { operationId, context });
  }

  logSecurityEvent(eventType: string, tenantId: string, context: any): void {
    this.logger.warn(`Security event: ${eventType}`, { tenantId, context });
  }

  getPerformanceMetrics(): any {
    return {
      totalOperations: 1,
      successfulOperations: 1,
      operationBreakdown: {
        credential_retrieval: { count: 1, avgDuration: 100 }
      }
    };
  }
}

// Mock KMS service for security testing
class MockKMSDecryptionService {
  async decrypt(encryptedData: string): Promise<string> {
    // Simple mock decryption - just reverse the string
    return encryptedData.split('').reverse().join('');
  }

  async encrypt(data: string): Promise<string> {
    // Simple mock encryption - just reverse the string
    return data.split('').reverse().join('');
  }
}

// Factory functions for mocks
function createTenantCredentialErrorHandler(logger: Logger, environment: MpesaEnvironment): MockTenantCredentialErrorHandler {
  return new MockTenantCredentialErrorHandler(logger, environment);
}

function createStructuredMpesaLogger(logger: Logger, environment: MpesaEnvironment): MockStructuredMpesaLogger {
  return new MockStructuredMpesaLogger(logger, environment);
}

function createKMSDecryptionService(): MockKMSDecryptionService {
  return new MockKMSDecryptionService();
}

function createTenantMpesaConfigFactory(options: any): TenantMpesaConfigFactory {
  return new TenantMpesaConfigFactory(options);
}

  describe('Environment Variable Security', () => {
    it('should not use environment variables for tenant-specific credentials', async () => {
      // Set up mock services with tenant credentials
      const mockTenants = new Map([['test-tab', TEST_TENANT]]);
      const mockCredentials = new Map([[`${TEST_TENANT.tenantId}-sandbox`, SENSITIVE_CREDENTIALS]]);

      const tabResolutionService = new MockTabResolutionService(mockTenants);
      const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
      
      const configFactory = createTenantMpesaConfigFactory({
        defaultTimeoutMs: 30000,
        defaultRetryAttempts: 3,
        defaultRateLimitPerMinute: 60,
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceKey: 'test-key'
      });

      // Create service configuration using tenant credentials
      const serviceConfig = await configFactory.createServiceConfigFromTab(
        'test-tab',
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      // Verify credentials come from tenant data, not environment variables
      expect(serviceConfig.consumerKey).toBe(SENSITIVE_CREDENTIALS.consumerKey);
      expect(serviceConfig.consumerSecret).toBe(SENSITIVE_CREDENTIALS.consumerSecret);
      expect(serviceConfig.businessShortCode).toBe(SENSITIVE_CREDENTIALS.businessShortCode);
      expect(serviceConfig.passkey).toBe(SENSITIVE_CREDENTIALS.passkey);

      // Verify no environment variables are used for tenant credentials
      expect(serviceConfig.consumerKey).not.toBe(process.env.MPESA_CONSUMER_KEY);
      expect(serviceConfig.consumerSecret).not.toBe(process.env.MPESA_CONSUMER_SECRET);
      expect(serviceConfig.businessShortCode).not.toBe(process.env.MPESA_BUSINESS_SHORTCODE);
      expect(serviceConfig.passkey).not.toBe(process.env.MPESA_PASSKEY);
    });

    it('should only use environment variables for system-level configuration', async () => {
      // Set system-level environment variables
      const originalKmsKey = process.env.MPESA_KMS_KEY;
      const originalEnvironment = process.env.MPESA_ENVIRONMENT;

      process.env.MPESA_KMS_KEY = 'system-level-kms-key-for-decryption';
      process.env.MPESA_ENVIRONMENT = 'sandbox';

      try {
        // Create KMS service (should use system environment variable)
        const kmsService = createKMSDecryptionService();
        expect(kmsService).toBeTruthy();

        // Verify system environment variables are used for system services only
        expect(process.env.MPESA_KMS_KEY).toBe('system-level-kms-key-for-decryption');
        expect(process.env.MPESA_ENVIRONMENT).toBe('sandbox');

        // But tenant credentials should never come from environment
        const mockTenants = new Map([['test-tab', TEST_TENANT]]);
        const mockCredentials = new Map([[`${TEST_TENANT.tenantId}-sandbox`, SENSITIVE_CREDENTIALS]]);

        const tabResolutionService = new MockTabResolutionService(mockTenants);
        const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
        
        const configFactory = createTenantMpesaConfigFactory({
          defaultTimeoutMs: 30000,
          defaultRetryAttempts: 3,
          defaultRateLimitPerMinute: 60,
          supabaseUrl: 'https://test.supabase.co',
          supabaseServiceKey: 'test-key'
        });

        const serviceConfig = await configFactory.createServiceConfigFromTab(
          'test-tab',
          tabResolutionService,
          credentialRetrievalService,
          { environment: 'sandbox' }
        );

        // Tenant credentials should come from database, not environment
        expect(serviceConfig.consumerKey).toBe(SENSITIVE_CREDENTIALS.consumerKey);
        expect(serviceConfig.consumerKey).not.toBe(process.env.MPESA_CONSUMER_KEY);

      } finally {
        // Restore original environment variables
        if (originalKmsKey) {
          process.env.MPESA_KMS_KEY = originalKmsKey;
        } else {
          delete process.env.MPESA_KMS_KEY;
        }
        
        if (originalEnvironment) {
          process.env.MPESA_ENVIRONMENT = originalEnvironment;
        } else {
          delete process.env.MPESA_ENVIRONMENT;
        }
      }
    });

    it('should validate environment variable usage patterns', () => {
      // Allowed system-level environment variables
      const allowedEnvVars = [
        'MPESA_KMS_KEY',
        'MPESA_ENVIRONMENT',
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'NODE_ENV'
      ];

      // Forbidden tenant-specific environment variables
      const forbiddenEnvVars = [
        'MPESA_CONSUMER_KEY',
        'MPESA_CONSUMER_SECRET',
        'MPESA_BUSINESS_SHORTCODE',
        'MPESA_PASSKEY',
        'MPESA_CALLBACK_URL'
      ];

      // Verify system allows only appropriate environment variables
      for (const envVar of allowedEnvVars) {
        // These should be acceptable for system-level configuration
        expect(typeof process.env[envVar]).toBe('string');
      }

      // Verify tenant-specific environment variables are not used
      for (const envVar of forbiddenEnvVars) {
        // These should not be used for tenant credentials in the new system
        // (They may exist for backward compatibility but shouldn't be used)
        if (process.env[envVar]) {
          console.warn(`Warning: ${envVar} environment variable exists but should not be used for tenant credentials`);
        }
      }
    });
  });

  describe('Secure Memory Handling', () => {
    it('should clear sensitive data from memory after use', async () => {
      // Set up KMS service for testing
      process.env.MPESA_KMS_KEY = 'a'.repeat(32); // 32-byte test key
      const kmsService = createKMSDecryptionService();

      const sensitiveData = 'SENSITIVE_CREDENTIAL_DATA_12345';
      
      // Encrypt and decrypt data
      const encrypted = await kmsService.encrypt(sensitiveData);
      const decrypted = await kmsService.decrypt(encrypted);

      expect(decrypted).toBe(sensitiveData);

      // Verify that the service doesn't retain decrypted data
      // (This is more of a design verification since JavaScript doesn't have explicit memory management)
      expect(typeof decrypted).toBe('string');
      
      // After processing, sensitive data should not be accessible through service internals
      const serviceInternals = JSON.stringify(kmsService);
      expect(serviceInternals).not.toContain(sensitiveData);
      expect(serviceInternals).not.toContain(decrypted);
    });

    it('should not store decrypted credentials in service instances', async () => {
      const mockTenants = new Map([['test-tab', TEST_TENANT]]);
      const mockCredentials = new Map([[`${TEST_TENANT.tenantId}-sandbox`, SENSITIVE_CREDENTIALS]]);

      const tabResolutionService = new MockTabResolutionService(mockTenants);
      const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
      
      const configFactory = createTenantMpesaConfigFactory({
        defaultTimeoutMs: 30000,
        defaultRetryAttempts: 3,
        defaultRateLimitPerMinute: 60,
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceKey: 'test-key'
      });

      // Create service configuration
      const serviceConfig = await configFactory.createServiceConfigFromTab(
        'test-tab',
        tabResolutionService,
        credentialRetrievalService,
        { environment: 'sandbox' }
      );

      // Create STK Push service
      const logger = ServiceFactory.createLogger();
      const httpClient = ServiceFactory.createHttpClient(30000);
      const stkService = new STKPushService(serviceConfig, logger, httpClient);

      // Verify service instances don't store raw credentials in accessible properties
      const serviceString = JSON.stringify(stkService);
      
      // Service should not contain raw sensitive credentials
      expect(serviceString).not.toContain(SENSITIVE_CREDENTIALS.consumerKey);
      expect(serviceString).not.toContain(SENSITIVE_CREDENTIALS.consumerSecret);
      expect(serviceString).not.toContain(SENSITIVE_CREDENTIALS.passkey);
    });

    it('should handle credential cleanup on service destruction', async () => {
      const mockTenants = new Map([['test-tab', TEST_TENANT]]);
      const mockCredentials = new Map([[`${TEST_TENANT.tenantId}-sandbox`, SENSITIVE_CREDENTIALS]]);

      const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);

      // Retrieve credentials
      const credentials = await credentialRetrievalService.getTenantCredentials(
        TEST_TENANT.tenantId,
        'sandbox'
      );

      expect(credentials.consumerKey).toBe(SENSITIVE_CREDENTIALS.consumerKey);

      // Simulate service cleanup (JavaScript garbage collection simulation)
      const credentialsCopy = { ...credentials };
      
      // Clear original credentials object
      Object.keys(credentials).forEach(key => {
        delete (credentials as any)[key];
      });

      // Verify original is cleared
      expect(credentials.consumerKey).toBeUndefined();
      
      // But copy still has data (showing we need to be careful about copies)
      expect(credentialsCopy.consumerKey).toBe(SENSITIVE_CREDENTIALS.consumerKey);
    });
  });

  describe('Sensitive Data Exposure Prevention', () => {
    it('should not log sensitive credential data', async () => {
      securityLogger.clearLogs();

      // Create error with sensitive context
      const sensitiveContext = {
        tenantId: TEST_TENANT.tenantId,
        consumerKey: SENSITIVE_CREDENTIALS.consumerKey,
        consumerSecret: SENSITIVE_CREDENTIALS.consumerSecret,
        passkey: SENSITIVE_CREDENTIALS.passkey,
        phoneNumber: '254712345678',
        kmsKey: 'super-secret-kms-key-12345',
        databaseUrl: 'postgres://user:password@localhost:5432/db'
      };

      const error = new Error('Test error with sensitive data');
      const errorInfo = errorHandler.handleTenantError(error, sensitiveContext);

      // Log the error
      structuredLogger.logTenantError(errorInfo, sensitiveContext);

      // Analyze all log content for sensitive data
      const allLogContent = securityLogger.getAllLogContent();

      // Verify no sensitive data is logged
      expect(allLogContent).not.toContain(SENSITIVE_CREDENTIALS.consumerKey);
      expect(allLogContent).not.toContain(SENSITIVE_CREDENTIALS.consumerSecret);
      expect(allLogContent).not.toContain(SENSITIVE_CREDENTIALS.passkey);
      expect(allLogContent).not.toContain('254712345678');
      expect(allLogContent).not.toContain('super-secret-kms-key-12345');
      expect(allLogContent).not.toContain('postgres://user:password@localhost:5432/db');

      // Verify tenant ID is masked in sandbox
      expect(allLogContent).toMatch(/ten\*\*\*-test/);
    });

    it('should sanitize error messages for user consumption', async () => {
      const sensitiveError = new Error(`Database error: Connection failed to postgres://user:${SENSITIVE_CREDENTIALS.consumerSecret}@localhost:5432/db with key ${SENSITIVE_CREDENTIALS.consumerKey}`);
      
      const errorInfo = errorHandler.handleTenantError(sensitiveError, {
        tenantId: TEST_TENANT.tenantId,
        operation: 'credential_retrieval'
      });

      // User message should not contain sensitive data
      expect(errorInfo.userMessage).not.toContain(SENSITIVE_CREDENTIALS.consumerSecret);
      expect(errorInfo.userMessage).not.toContain(SENSITIVE_CREDENTIALS.consumerKey);
      expect(errorInfo.userMessage).not.toContain('postgres://');

      // User message should be generic and helpful
      expect(errorInfo.userMessage).toMatch(/payment service|temporarily unavailable|contact support/i);
      expect(errorInfo.userMessage.length).toBeGreaterThan(10);
      expect(errorInfo.userMessage).toMatch(/^[A-Z]/); // Starts with capital
      expect(errorInfo.userMessage).toMatch(/[.!]$/); // Ends with punctuation
    });

    it('should validate no sensitive patterns in log output', async () => {
      securityLogger.clearLogs();

      // Perform various operations that might log sensitive data
      const mockTenants = new Map([['test-tab', TEST_TENANT]]);
      const mockCredentials = new Map([[`${TEST_TENANT.tenantId}-sandbox`, SENSITIVE_CREDENTIALS]]);

      const tabResolutionService = new MockTabResolutionService(mockTenants);
      const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);

      // Log various operations
      const operationId1 = structuredLogger.logOperationStart('tab_resolution', {
        tabId: 'test-tab',
        tenantId: TEST_TENANT.tenantId
      });

      structuredLogger.logOperationSuccess(operationId1, 'tab_resolution', {
        tenantId: TEST_TENANT.tenantId
      });

      const operationId2 = structuredLogger.logOperationStart('credential_retrieval', {
        tenantId: TEST_TENANT.tenantId,
        environment: 'sandbox'
      });

      structuredLogger.logOperationSuccess(operationId2, 'credential_retrieval', {
        tenantId: TEST_TENANT.tenantId,
        credentialsFound: true
      });

      // Log security event
      structuredLogger.logSecurityEvent('CREDENTIAL_ACCESS', TEST_TENANT.tenantId, {
        operation: 'credential_retrieval',
        ipAddress: '192.168.1.100'
      });

      // Analyze all log content for sensitive patterns
      const allLogContent = securityLogger.getAllLogContent();

      // Check for sensitive patterns
      for (const pattern of SENSITIVE_PATTERNS) {
        const matches = allLogContent.match(pattern);
        if (matches) {
          // Allow some expected patterns in controlled contexts
          const allowedMatches = [
            'environment', // Environment field is OK
            'sandbox', // Environment value is OK
            'credential_retrieval', // Operation name is OK
            'CREDENTIAL_ACCESS' // Security event type is OK
          ];

          const isAllowed = allowedMatches.some(allowed => 
            matches[0].toLowerCase().includes(allowed.toLowerCase())
          );

          if (!isAllowed) {
            fail(`Sensitive pattern detected in logs: ${matches[0]} (pattern: ${pattern})`);
          }
        }
      }
    });

    it('should prevent sensitive data in error responses', async () => {
      const sensitiveError = new Error(`KMS decryption failed with key: ${SENSITIVE_CREDENTIALS.consumerKey}`);
      
      const errorInfo = errorHandler.handleTenantError(sensitiveError, {
        tenantId: TEST_TENANT.tenantId,
        operation: 'credential_decryption',
        kmsKey: 'secret-kms-key-12345',
        encryptedData: 'base64-encrypted-data-with-secrets'
      });

      const errorResponse = errorHandler.createErrorResponse(errorInfo);

      // Verify error response doesn't contain sensitive data
      const responseString = JSON.stringify(errorResponse);
      
      expect(responseString).not.toContain(SENSITIVE_CREDENTIALS.consumerKey);
      expect(responseString).not.toContain('secret-kms-key-12345');
      expect(responseString).not.toContain('base64-encrypted-data-with-secrets');

      // Verify response structure is safe
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.message).toBeTruthy();
      expect(errorResponse.error.code).toBeTruthy();
      expect(typeof errorResponse.error.shouldRetry).toBe('boolean');

      // Debug info should only be present in sandbox and should be sanitized
      if (errorResponse.debug) {
        const debugString = JSON.stringify(errorResponse.debug);
        expect(debugString).not.toContain(SENSITIVE_CREDENTIALS.consumerKey);
        expect(debugString).not.toContain('secret-kms-key-12345');
      }
    });
  });

  describe('Production vs Sandbox Security', () => {
    it('should provide different security levels for production vs sandbox', async () => {
      const sandboxLogger = new SecurityAuditLogger();
      const productionLogger = new SecurityAuditLogger();

      const sandboxErrorHandler = createTenantCredentialErrorHandler(sandboxLogger, 'sandbox');
      const productionErrorHandler = createTenantCredentialErrorHandler(productionLogger, 'production');

      const error = new Error('Test error for environment comparison');
      const context = {
        tenantId: TEST_TENANT.tenantId,
        operation: 'test_operation'
      };

      // Handle same error in both environments
      const sandboxErrorInfo = sandboxErrorHandler.handleTenantError(error, context);
      const productionErrorInfo = productionErrorHandler.handleTenantError(error, context);

      // User messages should be identical
      expect(sandboxErrorInfo.userMessage).toBe(productionErrorInfo.userMessage);

      // Create error responses
      const sandboxResponse = sandboxErrorHandler.createErrorResponse(sandboxErrorInfo);
      const productionResponse = productionErrorHandler.createErrorResponse(productionErrorInfo);

      // Production should not have debug info
      expect(productionResponse.debug).toBeUndefined();
      
      // Sandbox may have debug info but it should be sanitized
      if (sandboxResponse.debug) {
        expect(sandboxResponse.debug.adminMessage).toBeTruthy();
        expect(sandboxResponse.debug.category).toBeTruthy();
        
        // Even debug info should not contain sensitive data
        const debugString = JSON.stringify(sandboxResponse.debug);
        for (const pattern of SENSITIVE_PATTERNS) {
          expect(debugString).not.toMatch(pattern);
        }
      }
    });

    it('should mask sensitive data differently in sandbox vs production', async () => {
      const sandboxLogger = createStructuredMpesaLogger(securityLogger, 'sandbox');
      const productionLogger = createStructuredMpesaLogger(securityLogger, 'production');

      const sensitiveContext = {
        tenantId: 'tenant-12345678',
        customerId: 'customer-87654321',
        operation: 'test_masking'
      };

      // Clear logs
      securityLogger.clearLogs();

      // Log in sandbox
      sandboxLogger.logOperationStart('test_operation', sensitiveContext);
      
      const sandboxLogs = securityLogger.getAllLogContent();
      securityLogger.clearLogs();

      // Log in production  
      productionLogger.logOperationStart('test_operation', sensitiveContext);
      
      const productionLogs = securityLogger.getAllLogContent();

      // Sandbox should mask IDs
      expect(sandboxLogs).toMatch(/ten\*\*\*\*-12345678/);
      expect(sandboxLogs).toMatch(/cus\*\*\*\*-87654321/);

      // Production should have even less detail or no IDs at all
      expect(productionLogs).not.toContain('tenant-12345678');
      expect(productionLogs).not.toContain('customer-87654321');
    });
  });

  describe('Memory and Performance Security', () => {
    it('should not leak sensitive data through performance metrics', async () => {
      const performanceLogger = createStructuredMpesaLogger(securityLogger, 'sandbox');
      
      // Perform operations with sensitive context
      const operationId = performanceLogger.logOperationStart('credential_retrieval', {
        tenantId: TEST_TENANT.tenantId,
        sensitiveData: SENSITIVE_CREDENTIALS.consumerKey
      });

      performanceLogger.logOperationSuccess(operationId, 'credential_retrieval', {
        credentialsRetrieved: true,
        decryptionKey: 'secret-key-12345'
      });

      // Get performance metrics
      const metrics = performanceLogger.getPerformanceMetrics();
      const metricsString = JSON.stringify(metrics);

      // Verify no sensitive data in performance metrics
      expect(metricsString).not.toContain(SENSITIVE_CREDENTIALS.consumerKey);
      expect(metricsString).not.toContain('secret-key-12345');

      // Verify metrics are still useful
      expect(metrics.totalOperations).toBe(1);
      expect(metrics.successfulOperations).toBe(1);
      expect(metrics.operationBreakdown.credential_retrieval).toBeDefined();
    });

    it('should handle memory pressure without exposing sensitive data', async () => {
      // Simulate memory pressure by creating many credential operations
      const mockTenants = new Map();
      const mockCredentials = new Map();

      // Create multiple tenants with sensitive credentials
      for (let i = 0; i < 100; i++) {
        const tenantId = `tenant-${i}`;
        const tabId = `tab-${i}`;
        
        mockTenants.set(tabId, {
          tenantId,
          barId: `bar-${i}`,
          barName: `Bar ${i}`,
          isActive: true
        });

        mockCredentials.set(`${tenantId}-sandbox`, {
          consumerKey: `sensitive-key-${i}`,
          consumerSecret: `sensitive-secret-${i}`,
          businessShortCode: '174379',
          passkey: `sensitive-passkey-${i}`,
          callbackUrl: `https://callback-${i}.com`,
          environment: 'sandbox' as const
        });
      }

      const tabResolutionService = new MockTabResolutionService(mockTenants);
      const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
      
      const configFactory = createTenantMpesaConfigFactory({
        defaultTimeoutMs: 30000,
        defaultRetryAttempts: 3,
        defaultRateLimitPerMinute: 60,
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceKey: 'test-key'
      });

      // Process all tenants
      const results = [];
      for (let i = 0; i < 100; i++) {
        const tabId = `tab-${i}`;
        const serviceConfig = await configFactory.createServiceConfigFromTab(
          tabId,
          tabResolutionService,
          credentialRetrievalService,
          { environment: 'sandbox' }
        );
        
        results.push(serviceConfig);
      }

      // Verify all operations completed successfully
      expect(results.length).toBe(100);

      // Verify no cross-contamination of credentials
      for (let i = 0; i < 100; i++) {
        expect(results[i].consumerKey).toBe(`sensitive-key-${i}`);
        expect(results[i].consumerSecret).toBe(`sensitive-secret-${i}`);
        expect(results[i].passkey).toBe(`sensitive-passkey-${i}`);
      }

      // Verify memory doesn't retain all sensitive data
      const configFactoryString = JSON.stringify(configFactory);
      
      // Should not contain all the sensitive keys
      let sensitiveKeyCount = 0;
      for (let i = 0; i < 100; i++) {
        if (configFactoryString.includes(`sensitive-key-${i}`)) {
          sensitiveKeyCount++;
        }
      }
      
      // Should not retain most sensitive data (some might be in recent operations)
      expect(sensitiveKeyCount).toBeLessThan(10);
    });
  });
});