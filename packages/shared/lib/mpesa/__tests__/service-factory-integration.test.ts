/**
 * Unit tests for ServiceFactory integration with tenant-specific credentials
 * Tests the integration between ServiceFactory and tenant credential resolution
 * 
 * Requirements: 5.4, 6.1
 */

import { ServiceFactory } from '../services/base';
import { TenantMpesaConfigFactory, TenantMpesaConfig } from '../services/tenant-config-factory';
import { TabResolutionService, TenantInfo } from '../services/tab-resolution';
import { CredentialRetrievalService } from '../services/credential-retrieval';
import { MpesaCredentials, MpesaEnvironment, ServiceConfig, MpesaError } from '../types';

// Mock implementations for testing
class MockTabResolutionService implements TabResolutionService {
  private mockTenants: Map<string, TenantInfo> = new Map();

  addMockTenant(tabId: string, tenantInfo: TenantInfo): void {
    this.mockTenants.set(tabId, tenantInfo);
  }

  async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
    const tenant = this.mockTenants.get(tabId);
    if (!tenant) {
      throw new MpesaError(`Tab ${tabId} not found`, 'TAB_NOT_FOUND', 404);
    }
    return tenant;
  }
}

class MockCredentialRetrievalService implements CredentialRetrievalService {
  private mockCredentials: Map<string, MpesaCredentials> = new Map();

  addMockCredentials(key: string, credentials: MpesaCredentials): void {
    this.mockCredentials.set(key, credentials);
  }

  async getTenantCredentials(tenantId: string, environment: MpesaEnvironment): Promise<MpesaCredentials> {
    const key = `${tenantId}-${environment}`;
    const credentials = this.mockCredentials.get(key);
    if (!credentials) {
      throw new MpesaError(`Credentials not found for tenant ${tenantId} in ${environment}`, 'CREDENTIALS_NOT_FOUND', 404);
    }
    return credentials;
  }

  async validateCredentials(credentials: MpesaCredentials): Promise<boolean> {
    return true;
  }
}

describe('ServiceFactory Integration', () => {
  let mockTabResolutionService: MockTabResolutionService;
  let mockCredentialRetrievalService: MockCredentialRetrievalService;
  let tenantConfigFactory: TenantMpesaConfigFactory;

  const sampleTenantInfo: TenantInfo = {
    tenantId: 'tenant-123',
    barId: 'bar-456',
    barName: 'Test Bar',
    isActive: true
  };

  const sampleCredentials: MpesaCredentials = {
    consumerKey: 'test-consumer-key',
    consumerSecret: 'test-consumer-secret',
    businessShortCode: '174379',
    passkey: 'test-passkey-12345',
    callbackUrl: 'https://example.com/callback',
    environment: 'sandbox' as MpesaEnvironment,
    encryptedAt: new Date()
  };

  beforeEach(() => {
    mockTabResolutionService = new MockTabResolutionService();
    mockCredentialRetrievalService = new MockCredentialRetrievalService();
    tenantConfigFactory = new TenantMpesaConfigFactory();

    // Set up mock data
    mockTabResolutionService.addMockTenant('tab-123', sampleTenantInfo);
    mockCredentialRetrievalService.addMockCredentials('tenant-123-sandbox', sampleCredentials);
  });

  describe('createTenantServiceConfig', () => {
    it('should create service config from tenant config', () => {
      // Arrange
      const tenantConfig: TenantMpesaConfig = {
        tenantId: sampleTenantInfo.tenantId,
        barId: sampleTenantInfo.barId,
        barName: sampleTenantInfo.barName,
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      };

      // Act
      const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig);

      // Assert
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig.environment).toBe('sandbox');
      expect(serviceConfig.credentials).toEqual(sampleCredentials);
      expect(serviceConfig.timeoutMs).toBe(30000);
      expect(serviceConfig.retryAttempts).toBe(3);
      expect(serviceConfig.rateLimitPerMinute).toBe(60);
    });

    it('should apply overrides to tenant config', () => {
      // Arrange
      const tenantConfig: TenantMpesaConfig = {
        tenantId: sampleTenantInfo.tenantId,
        barId: sampleTenantInfo.barId,
        barName: sampleTenantInfo.barName,
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      };

      const overrides: Partial<ServiceConfig> = {
        timeoutMs: 45000,
        retryAttempts: 5
      };

      // Act
      const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig, overrides);

      // Assert
      expect(serviceConfig.timeoutMs).toBe(45000);
      expect(serviceConfig.retryAttempts).toBe(5);
      expect(serviceConfig.rateLimitPerMinute).toBe(60); // Not overridden
    });

    it('should throw error for invalid tenant config', () => {
      // Arrange
      const invalidTenantConfig = {
        tenantId: '',
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as TenantMpesaConfig;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(invalidTenantConfig);
      }).toThrow(MpesaError);
    });

    it('should throw error for missing credentials', () => {
      // Arrange
      const tenantConfigWithoutCredentials = {
        tenantId: sampleTenantInfo.tenantId,
        barId: sampleTenantInfo.barId,
        barName: sampleTenantInfo.barName,
        environment: 'sandbox',
        credentials: null,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as any;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfigWithoutCredentials);
      }).toThrow(MpesaError);
    });
  });

  describe('createServiceConfigFromTab', () => {
    it('should create service config from tab ID through complete resolution flow', async () => {
      // Act
      const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
        'tab-123',
        mockTabResolutionService,
        mockCredentialRetrievalService,
        tenantConfigFactory
      );

      // Assert
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig.environment).toBe('sandbox');
      expect(serviceConfig.credentials).toEqual(sampleCredentials);
      expect(serviceConfig.timeoutMs).toBe(30000);
      expect(serviceConfig.retryAttempts).toBe(3);
      expect(serviceConfig.rateLimitPerMinute).toBe(60);
    });

    it('should apply overrides in complete resolution flow', async () => {
      // Arrange
      const overrides: Partial<ServiceConfig> = {
        environment: 'sandbox' as MpesaEnvironment,
        timeoutMs: 60000,
        retryAttempts: 5
      };

      // Act
      const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
        'tab-123',
        mockTabResolutionService,
        mockCredentialRetrievalService,
        tenantConfigFactory,
        overrides
      );

      // Assert
      expect(serviceConfig.timeoutMs).toBe(60000);
      expect(serviceConfig.retryAttempts).toBe(5);
      expect(serviceConfig.environment).toBe('sandbox');
    });

    it('should throw error for non-existent tab', async () => {
      // Act & Assert
      await expect(
        ServiceFactory.createServiceConfigFromTab(
          'non-existent-tab',
          mockTabResolutionService,
          mockCredentialRetrievalService,
          tenantConfigFactory
        )
      ).rejects.toThrow(MpesaError);
    });

    it('should throw error when credentials not found', async () => {
      // Arrange - Add tenant but no credentials
      mockTabResolutionService.addMockTenant('tab-no-creds', sampleTenantInfo);

      // Act & Assert
      await expect(
        ServiceFactory.createServiceConfigFromTab(
          'tab-no-creds',
          mockTabResolutionService,
          mockCredentialRetrievalService,
          tenantConfigFactory,
          { environment: 'production' as MpesaEnvironment }
        )
      ).rejects.toThrow(MpesaError);
    });

    it('should handle production environment correctly', async () => {
      // Arrange
      const productionCredentials: MpesaCredentials = {
        ...sampleCredentials,
        environment: 'production',
        callbackUrl: 'https://secure.example.com/callback'
      };

      mockCredentialRetrievalService.addMockCredentials('tenant-123-production', productionCredentials);

      // Act
      const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
        'tab-123',
        mockTabResolutionService,
        mockCredentialRetrievalService,
        tenantConfigFactory,
        { environment: 'production' as MpesaEnvironment }
      );

      // Assert
      expect(serviceConfig.environment).toBe('production');
      expect(serviceConfig.credentials.environment).toBe('production');
      expect(serviceConfig.credentials.callbackUrl).toBe('https://secure.example.com/callback');
    });
  });

  describe('createBatchServiceConfigs', () => {
    it('should create multiple service configs from tenant configs', () => {
      // Arrange
      const tenantConfigs: TenantMpesaConfig[] = [
        {
          tenantId: 'tenant-1',
          barId: 'bar-1',
          barName: 'Bar One',
          environment: 'sandbox',
          credentials: sampleCredentials,
          timeoutMs: 30000,
          retryAttempts: 3,
          rateLimitPerMinute: 60
        },
        {
          tenantId: 'tenant-2',
          barId: 'bar-2',
          barName: 'Bar Two',
          environment: 'sandbox',
          credentials: { ...sampleCredentials, businessShortCode: '174380' },
          timeoutMs: 30000,
          retryAttempts: 3,
          rateLimitPerMinute: 60
        }
      ];

      // Act
      const serviceConfigs = ServiceFactory.createBatchServiceConfigs(tenantConfigs);

      // Assert
      expect(serviceConfigs).toHaveLength(2);
      expect(serviceConfigs[0].credentials.businessShortCode).toBe('174379');
      expect(serviceConfigs[1].credentials.businessShortCode).toBe('174380');
    });

    it('should apply overrides to all configs in batch', () => {
      // Arrange
      const tenantConfigs: TenantMpesaConfig[] = [
        {
          tenantId: 'tenant-1',
          barId: 'bar-1',
          barName: 'Bar One',
          environment: 'sandbox',
          credentials: sampleCredentials,
          timeoutMs: 30000,
          retryAttempts: 3,
          rateLimitPerMinute: 60
        }
      ];

      const overrides: Partial<ServiceConfig> = {
        timeoutMs: 45000
      };

      // Act
      const serviceConfigs = ServiceFactory.createBatchServiceConfigs(tenantConfigs, overrides);

      // Assert
      expect(serviceConfigs[0].timeoutMs).toBe(45000);
    });

    it('should throw error if any config in batch is invalid', () => {
      // Arrange
      const tenantConfigs: TenantMpesaConfig[] = [
        {
          tenantId: 'tenant-1',
          barId: 'bar-1',
          barName: 'Bar One',
          environment: 'sandbox',
          credentials: sampleCredentials,
          timeoutMs: 30000,
          retryAttempts: 3,
          rateLimitPerMinute: 60
        },
        {
          tenantId: '', // Invalid
          barId: 'bar-2',
          barName: 'Bar Two',
          environment: 'sandbox',
          credentials: sampleCredentials,
          timeoutMs: 30000,
          retryAttempts: 3,
          rateLimitPerMinute: 60
        }
      ];

      // Act & Assert
      expect(() => {
        ServiceFactory.createBatchServiceConfigs(tenantConfigs);
      }).toThrow(MpesaError);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain existing createServiceConfig method', () => {
      // Act
      const serviceConfig = ServiceFactory.createServiceConfig('sandbox', sampleCredentials);

      // Assert
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig.environment).toBe('sandbox');
      expect(serviceConfig.credentials).toEqual(sampleCredentials);
      expect(serviceConfig.timeoutMs).toBe(30000);
      expect(serviceConfig.retryAttempts).toBe(3);
      expect(serviceConfig.rateLimitPerMinute).toBe(60);
    });

    it('should apply overrides in legacy method', () => {
      // Arrange
      const overrides: Partial<ServiceConfig> = {
        timeoutMs: 45000,
        retryAttempts: 5
      };

      // Act
      const serviceConfig = ServiceFactory.createServiceConfig('sandbox', sampleCredentials, overrides);

      // Assert
      expect(serviceConfig.timeoutMs).toBe(45000);
      expect(serviceConfig.retryAttempts).toBe(5);
    });

    it('should maintain createLogger method', () => {
      // Act
      const logger = ServiceFactory.createLogger();

      // Assert
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should maintain createHttpClient method', () => {
      // Act
      const httpClient = ServiceFactory.createHttpClient();

      // Assert
      expect(httpClient).toBeDefined();
      expect(typeof httpClient.get).toBe('function');
      expect(typeof httpClient.post).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should provide detailed error messages for configuration failures', () => {
      // Arrange
      const invalidTenantConfig = {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'invalid-env',
        credentials: sampleCredentials,
        timeoutMs: -1, // Invalid
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as any;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(invalidTenantConfig);
      }).toThrow(MpesaError);
    });

    it('should handle async errors in tab resolution flow', async () => {
      // Arrange
      const errorTabResolutionService = {
        async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
          throw new Error('Database connection failed');
        }
      };

      // Act & Assert
      await expect(
        ServiceFactory.createServiceConfigFromTab(
          'tab-123',
          errorTabResolutionService as TabResolutionService,
          mockCredentialRetrievalService,
          tenantConfigFactory
        )
      ).rejects.toThrow(MpesaError);
    });

    it('should handle credential retrieval errors', async () => {
      // Arrange
      const errorCredentialService = {
        async getTenantCredentials(tenantId: string, environment: MpesaEnvironment): Promise<MpesaCredentials> {
          throw new Error('Decryption failed');
        },
        async validateCredentials(credentials: MpesaCredentials): Promise<boolean> {
          return true;
        }
      };

      // Act & Assert
      await expect(
        ServiceFactory.createServiceConfigFromTab(
          'tab-123',
          mockTabResolutionService,
          errorCredentialService as CredentialRetrievalService,
          tenantConfigFactory
        )
      ).rejects.toThrow(MpesaError);
    });
  });

  describe('validation', () => {
    it('should validate tenant ID is not empty', () => {
      // Arrange
      const tenantConfig = {
        tenantId: '   ', // Whitespace only
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as TenantMpesaConfig;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfig);
      }).toThrow(MpesaError);
    });

    it('should validate bar ID is not empty', () => {
      // Arrange
      const tenantConfig = {
        tenantId: 'tenant-123',
        barId: '',
        barName: 'Test Bar',
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as TenantMpesaConfig;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfig);
      }).toThrow(MpesaError);
    });

    it('should validate environment is valid', () => {
      // Arrange
      const tenantConfig = {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'invalid',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as any;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfig);
      }).toThrow(MpesaError);
    });

    it('should validate timeout is positive', () => {
      // Arrange
      const tenantConfig = {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 0,
        retryAttempts: 3,
        rateLimitPerMinute: 60
      } as TenantMpesaConfig;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfig);
      }).toThrow(MpesaError);
    });

    it('should validate retry attempts is not negative', () => {
      // Arrange
      const tenantConfig = {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: -1,
        rateLimitPerMinute: 60
      } as TenantMpesaConfig;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfig);
      }).toThrow(MpesaError);
    });

    it('should validate rate limit is positive', () => {
      // Arrange
      const tenantConfig = {
        tenantId: 'tenant-123',
        barId: 'bar-456',
        barName: 'Test Bar',
        environment: 'sandbox',
        credentials: sampleCredentials,
        timeoutMs: 30000,
        retryAttempts: 3,
        rateLimitPerMinute: 0
      } as TenantMpesaConfig;

      // Act & Assert
      expect(() => {
        ServiceFactory.createTenantServiceConfig(tenantConfig);
      }).toThrow(MpesaError);
    });
  });
});