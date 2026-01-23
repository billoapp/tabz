/**
 * Unit tests for TenantMpesaConfigFactory
 * Tests specific examples and edge cases for tenant configuration creation
 */

import {
  TenantMpesaConfigFactory,
  TenantMpesaConfig,
  createTenantMpesaConfigFactory,
  TenantConfigError,
  InvalidTenantInfoError,
  InvalidCredentialsError,
  EnvironmentConfigError
} from '../services/tenant-config-factory';
import { TenantInfo } from '../services/tab-resolution';
import { MpesaCredentials, MpesaEnvironment, MpesaError } from '../types';
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

describe('TenantMpesaConfigFactory', () => {
  let factory: TenantMpesaConfigFactory;
  let mockLogger: MockLogger;

  const validTenantInfo: TenantInfo = {
    tenantId: 'tenant-123',
    barId: 'bar-456',
    barName: 'Test Bar',
    isActive: true
  };

  const validSandboxCredentials: MpesaCredentials = {
    consumerKey: 'test-consumer-key-123',
    consumerSecret: 'test-consumer-secret-456',
    businessShortCode: '174379',
    passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    environment: 'sandbox' as MpesaEnvironment,
    callbackUrl: 'https://example.com/callback',
    timeoutUrl: 'https://example.com/timeout',
    encryptedAt: new Date('2024-01-01'),
    lastValidated: new Date('2024-01-01')
  };

  const validProductionCredentials: MpesaCredentials = {
    ...validSandboxCredentials,
    environment: 'production' as MpesaEnvironment,
    businessShortCode: '123456'
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    factory = new TenantMpesaConfigFactory({
      logger: mockLogger,
      defaultTimeoutMs: 30000,
      defaultRetryAttempts: 3,
      defaultRateLimitPerMinute: 60,
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceKey: 'test-service-key-that-is-long-enough-to-pass-validation'
    });
  });

  describe('createTenantConfig', () => {
    it('should create valid tenant configuration with sandbox credentials', () => {
      const config = factory.createTenantConfig(validTenantInfo, validSandboxCredentials);

      expect(config).toBeDefined();
      expect(config.tenantId).toBe(validTenantInfo.tenantId);
      expect(config.barId).toBe(validTenantInfo.barId);
      expect(config.barName).toBe(validTenantInfo.barName);
      expect(config.environment).toBe('sandbox');
      expect(config.credentials).toEqual({
        ...validSandboxCredentials,
        environment: 'sandbox'
      });
      expect(config.timeoutMs).toBe(30000);
      expect(config.retryAttempts).toBe(3);
      expect(config.rateLimitPerMinute).toBe(60);

      // Check that info log was created
      const infoLogs = mockLogger.logs.filter(log => log.level === 'info');
      expect(infoLogs).toHaveLength(2); // Environment determination + config creation
      expect(infoLogs[1].message).toContain('Created tenant M-Pesa configuration');
    });

    it('should create valid tenant configuration with production credentials when allowed', () => {
      factory = new TenantMpesaConfigFactory({
        logger: mockLogger,
        allowProductionWithoutExplicitConfig: true
      });

      const config = factory.createTenantConfig(validTenantInfo, validProductionCredentials);

      expect(config.environment).toBe('production');
      expect(config.credentials.environment).toBe('production');

      // Check that production warning was logged
      const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('Production M-Pesa configuration created'))).toBe(true);
    });

    it('should default to sandbox when production is not explicitly allowed', () => {
      const config = factory.createTenantConfig(validTenantInfo, validProductionCredentials);

      expect(config.environment).toBe('sandbox');
      expect(config.credentials.environment).toBe('sandbox');

      // Check that warning was logged about environment override
      const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('Production environment requested'))).toBe(true);
      expect(warnLogs.some(log => log.message.includes('Environment override applied'))).toBe(true);
    });

    it('should apply configuration overrides', () => {
      const overrides = {
        timeoutMs: 60000,
        retryAttempts: 5,
        rateLimitPerMinute: 120
      };

      const config = factory.createTenantConfig(validTenantInfo, validSandboxCredentials, overrides);

      expect(config.timeoutMs).toBe(60000);
      expect(config.retryAttempts).toBe(5);
      expect(config.rateLimitPerMinute).toBe(120);
    });

    it('should throw error for invalid tenant info - missing tenantId', () => {
      const invalidTenantInfo = { ...validTenantInfo, tenantId: '' };

      expect(() => factory.createTenantConfig(invalidTenantInfo, validSandboxCredentials))
        .toThrow(new MpesaError('Tenant ID is required and cannot be empty', 'INVALID_TENANT_ID', 400));
    });

    it('should throw error for invalid tenant info - missing barId', () => {
      const invalidTenantInfo = { ...validTenantInfo, barId: '' };

      expect(() => factory.createTenantConfig(invalidTenantInfo, validSandboxCredentials))
        .toThrow(new MpesaError('Bar ID is required and cannot be empty', 'INVALID_BAR_ID', 400));
    });

    it('should throw error for invalid tenant info - missing barName', () => {
      const invalidTenantInfo = { ...validTenantInfo, barName: '' };

      expect(() => factory.createTenantConfig(invalidTenantInfo, validSandboxCredentials))
        .toThrow(new MpesaError('Bar name is required and cannot be empty', 'INVALID_BAR_NAME', 400));
    });

    it('should throw error for inactive tenant', () => {
      const inactiveTenantInfo = { ...validTenantInfo, isActive: false };

      expect(() => factory.createTenantConfig(inactiveTenantInfo, validSandboxCredentials))
        .toThrow(new MpesaError('Tenant tenant-123 (Test Bar) is not active', 'INACTIVE_TENANT', 403));
    });

    it('should throw error for null tenant info', () => {
      expect(() => factory.createTenantConfig(null as any, validSandboxCredentials))
        .toThrow(new MpesaError('Tenant information is required', 'INVALID_TENANT_INFO', 400));
    });

    it('should throw error for missing credentials', () => {
      expect(() => factory.createTenantConfig(validTenantInfo, null as any))
        .toThrow(new MpesaError('M-Pesa credentials are required', 'INVALID_CREDENTIALS', 400));
    });

    it('should throw error for incomplete credentials - missing consumerKey', () => {
      const incompleteCredentials = { ...validSandboxCredentials, consumerKey: '' };

      expect(() => factory.createTenantConfig(validTenantInfo, incompleteCredentials))
        .toThrow(new MpesaError("M-Pesa credential field 'consumerKey' is required and cannot be empty", 'INCOMPLETE_CREDENTIALS', 400));
    });

    it('should throw error for incomplete credentials - missing businessShortCode', () => {
      const incompleteCredentials = { ...validSandboxCredentials, businessShortCode: '' };

      expect(() => factory.createTenantConfig(validTenantInfo, incompleteCredentials))
        .toThrow(new MpesaError("M-Pesa credential field 'businessShortCode' is required and cannot be empty", 'INCOMPLETE_CREDENTIALS', 400));
    });

    it('should throw error for invalid environment', () => {
      const invalidCredentials = { ...validSandboxCredentials, environment: 'invalid' as MpesaEnvironment };

      expect(() => factory.createTenantConfig(validTenantInfo, invalidCredentials))
        .toThrow(new MpesaError("Invalid M-Pesa environment: invalid. Must be 'sandbox' or 'production'", 'INVALID_ENVIRONMENT', 400));
    });

    it('should throw error for invalid callback URL', () => {
      const invalidCredentials = { ...validSandboxCredentials, callbackUrl: 'not-a-url' };

      expect(() => factory.createTenantConfig(validTenantInfo, invalidCredentials))
        .toThrow(new MpesaError('Invalid callback URL format', 'INVALID_CALLBACK_URL', 400));
    });

    it('should throw error for invalid timeout URL', () => {
      const invalidCredentials = { ...validSandboxCredentials, timeoutUrl: 'not-a-url' };

      expect(() => factory.createTenantConfig(validTenantInfo, invalidCredentials))
        .toThrow(new MpesaError('Invalid timeout URL format', 'INVALID_TIMEOUT_URL', 400));
    });

    it('should throw error for production with HTTP callback URL', () => {
      factory = new TenantMpesaConfigFactory({
        logger: mockLogger,
        allowProductionWithoutExplicitConfig: true
      });

      const invalidProductionCredentials = {
        ...validProductionCredentials,
        callbackUrl: 'http://example.com/callback'
      };

      expect(() => factory.createTenantConfig(validTenantInfo, invalidProductionCredentials))
        .toThrow(new MpesaError('Production environment requires HTTPS callback URL', 'PRODUCTION_REQUIRES_HTTPS', 400));
    });

    it('should throw error for production with HTTP timeout URL', () => {
      factory = new TenantMpesaConfigFactory({
        logger: mockLogger,
        allowProductionWithoutExplicitConfig: true
      });

      const invalidProductionCredentials = {
        ...validProductionCredentials,
        timeoutUrl: 'http://example.com/timeout'
      };

      expect(() => factory.createTenantConfig(validTenantInfo, invalidProductionCredentials))
        .toThrow(new MpesaError('Production environment requires HTTPS timeout URL', 'PRODUCTION_REQUIRES_HTTPS', 400));
    });

    it('should throw error for invalid timeout configuration', () => {
      const invalidOverrides = { timeoutMs: -1000 };

      expect(() => factory.createTenantConfig(validTenantInfo, validSandboxCredentials, invalidOverrides))
        .toThrow(new MpesaError('Timeout must be greater than 0', 'INVALID_TIMEOUT', 400));
    });

    it('should throw error for invalid retry attempts', () => {
      const invalidOverrides = { retryAttempts: -1 };

      expect(() => factory.createTenantConfig(validTenantInfo, validSandboxCredentials, invalidOverrides))
        .toThrow(new MpesaError('Retry attempts cannot be negative', 'INVALID_RETRY_ATTEMPTS', 400));
    });

    it('should throw error for invalid rate limit', () => {
      const invalidOverrides = { rateLimitPerMinute: 0 };

      expect(() => factory.createTenantConfig(validTenantInfo, validSandboxCredentials, invalidOverrides))
        .toThrow(new MpesaError('Rate limit must be greater than 0', 'INVALID_RATE_LIMIT', 400));
    });

    it('should warn about high timeout values', () => {
      const highTimeoutOverrides = { timeoutMs: 400000 }; // > 5 minutes

      const config = factory.createTenantConfig(validTenantInfo, validSandboxCredentials, highTimeoutOverrides);

      expect(config.timeoutMs).toBe(400000);
      const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('Very high timeout configured'))).toBe(true);
    });

    it('should warn about high retry attempts', () => {
      const highRetryOverrides = { retryAttempts: 15 };

      const config = factory.createTenantConfig(validTenantInfo, validSandboxCredentials, highRetryOverrides);

      expect(config.retryAttempts).toBe(15);
      const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('High retry attempts configured'))).toBe(true);
    });

    it('should handle optional timeout URL correctly', () => {
      const credentialsWithoutTimeoutUrl = { ...validSandboxCredentials };
      delete credentialsWithoutTimeoutUrl.timeoutUrl;

      const config = factory.createTenantConfig(validTenantInfo, credentialsWithoutTimeoutUrl);

      expect(config.credentials.timeoutUrl).toBeUndefined();
    });
  });

  describe('createBatchTenantConfigs', () => {
    const secondTenantInfo: TenantInfo = {
      tenantId: 'tenant-456',
      barId: 'bar-789',
      barName: 'Second Bar',
      isActive: true
    };

    const secondCredentials: MpesaCredentials = {
      ...validSandboxCredentials,
      businessShortCode: '654321'
    };

    it('should create multiple tenant configurations successfully', () => {
      const tenantCredentialPairs = [
        { tenantInfo: validTenantInfo, credentials: validSandboxCredentials },
        { tenantInfo: secondTenantInfo, credentials: secondCredentials }
      ];

      const configs = factory.createBatchTenantConfigs(tenantCredentialPairs);

      expect(configs).toHaveLength(2);
      expect(configs[0].tenantId).toBe(validTenantInfo.tenantId);
      expect(configs[1].tenantId).toBe(secondTenantInfo.tenantId);

      const infoLogs = mockLogger.logs.filter(log => log.level === 'info');
      expect(infoLogs.some(log => log.message.includes('Successfully created 2 tenant configurations'))).toBe(true);
    });

    it('should throw error if any configuration fails', () => {
      const invalidTenantInfo = { ...validTenantInfo, tenantId: '' };
      const tenantCredentialPairs = [
        { tenantInfo: validTenantInfo, credentials: validSandboxCredentials },
        { tenantInfo: invalidTenantInfo, credentials: validSandboxCredentials }
      ];

      expect(() => factory.createBatchTenantConfigs(tenantCredentialPairs))
        .toThrow(MpesaError);
    });

    it('should apply overrides to all configurations in batch', () => {
      const overrides = { timeoutMs: 45000 };
      const tenantCredentialPairs = [
        { tenantInfo: validTenantInfo, credentials: validSandboxCredentials },
        { tenantInfo: secondTenantInfo, credentials: secondCredentials }
      ];

      const configs = factory.createBatchTenantConfigs(tenantCredentialPairs, overrides);

      expect(configs).toHaveLength(2);
      expect(configs[0].timeoutMs).toBe(45000);
      expect(configs[1].timeoutMs).toBe(45000);
    });
  });

  describe('updateOptions', () => {
    it('should update factory options', () => {
      const newOptions = {
        defaultTimeoutMs: 45000,
        defaultRetryAttempts: 5
      };

      factory.updateOptions(newOptions);
      const currentOptions = factory.getOptions();

      expect(currentOptions.defaultTimeoutMs).toBe(45000);
      expect(currentOptions.defaultRetryAttempts).toBe(5);

      const infoLogs = mockLogger.logs.filter(log => log.level === 'info');
      expect(infoLogs.some(log => log.message.includes('Updated tenant config factory options'))).toBe(true);
    });

    it('should update logger', () => {
      const newLogger = new MockLogger();
      factory.updateOptions({ logger: newLogger });

      // Create a config to test the new logger is being used
      factory.createTenantConfig(validTenantInfo, validSandboxCredentials);

      // The new logger should have logs, old logger should not have new logs
      expect(newLogger.logs.length).toBeGreaterThan(0);
    });
  });

  describe('getOptions', () => {
    it('should return current options without logger', () => {
      const options = factory.getOptions();

      expect(options).toBeDefined();
      expect(options.defaultTimeoutMs).toBe(30000);
      expect(options.defaultRetryAttempts).toBe(3);
      expect(options.defaultRateLimitPerMinute).toBe(60);
      expect(options).not.toHaveProperty('logger');
    });
  });

  describe('factory function', () => {
    it('should create factory instance with default options', () => {
      const factoryInstance = createTenantMpesaConfigFactory();

      expect(factoryInstance).toBeInstanceOf(TenantMpesaConfigFactory);
    });

    it('should create factory instance with custom options', () => {
      const options = {
        defaultTimeoutMs: 60000,
        logger: mockLogger
      };

      const factoryInstance = createTenantMpesaConfigFactory(options);

      expect(factoryInstance).toBeInstanceOf(TenantMpesaConfigFactory);
      
      // Test that options were applied
      const config = factoryInstance.createTenantConfig(validTenantInfo, validSandboxCredentials);
      expect(config.timeoutMs).toBe(60000);
    });
  });

  describe('error handling', () => {
    it('should wrap unexpected errors in MpesaError', () => {
      // Create a scenario that would cause an unexpected error
      const factoryWithBadOptions = new TenantMpesaConfigFactory({
        supabaseUrl: 'not-a-url'
      });

      expect(() => factoryWithBadOptions.createTenantConfig(validTenantInfo, validSandboxCredentials))
        .toThrow(MpesaError);
    });
  });

  describe('edge cases', () => {
    it('should handle tenant info with whitespace-only fields', () => {
      const whitespaceInfo = {
        ...validTenantInfo,
        tenantId: '   ',
        barId: '\t\t',
        barName: '\n\n'
      };

      expect(() => factory.createTenantConfig(whitespaceInfo, validSandboxCredentials))
        .toThrow(MpesaError);
    });

    it('should handle credentials with whitespace-only fields', () => {
      const whitespaceCredentials = {
        ...validSandboxCredentials,
        consumerKey: '   ',
        consumerSecret: '\t\t'
      };

      expect(() => factory.createTenantConfig(validTenantInfo, whitespaceCredentials))
        .toThrow(MpesaError);
    });

    it('should validate Supabase URL format in overrides', () => {
      const invalidSupabaseOverrides = {
        supabaseUrl: 'not-a-valid-url'
      };

      expect(() => factory.createTenantConfig(validTenantInfo, validSandboxCredentials, invalidSupabaseOverrides))
        .toThrow(new MpesaError('Invalid Supabase URL format', 'INVALID_SUPABASE_URL', 400));
    });

    it('should warn about short Supabase service keys', () => {
      const shortKeyOverrides = {
        supabaseServiceKey: 'short'
      };

      const config = factory.createTenantConfig(validTenantInfo, validSandboxCredentials, shortKeyOverrides);

      expect(config.supabaseServiceKey).toBe('short');
      const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('Supabase service key seems too short'))).toBe(true);
    });
  });
});