/**
 * Simple integration test for ServiceFactory with tenant credentials
 * Tests the core integration functionality
 * 
 * Requirements: 5.4, 6.1
 */

import { ServiceFactory } from '../services/base';
import { TenantMpesaConfig } from '../services/tenant-config-factory';
import { MpesaCredentials, MpesaEnvironment, ServiceConfig } from '../types';

describe('ServiceFactory Integration - Core Functionality', () => {
  const sampleCredentials: MpesaCredentials = {
    consumerKey: 'test-consumer-key',
    consumerSecret: 'test-consumer-secret',
    businessShortCode: '174379',
    passkey: 'test-passkey-12345',
    callbackUrl: 'https://example.com/callback',
    environment: 'sandbox' as MpesaEnvironment,
    encryptedAt: new Date()
  };

  const sampleTenantConfig: TenantMpesaConfig = {
    tenantId: 'tenant-123',
    barId: 'bar-456',
    barName: 'Test Bar',
    environment: 'sandbox',
    credentials: sampleCredentials,
    timeoutMs: 30000,
    retryAttempts: 3,
    rateLimitPerMinute: 60
  };

  describe('createTenantServiceConfig', () => {
    it('should create service config from tenant config', () => {
      // Act
      const serviceConfig = ServiceFactory.createTenantServiceConfig(sampleTenantConfig);

      // Assert
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig.environment).toBe('sandbox');
      expect(serviceConfig.credentials).toEqual(sampleCredentials);
      expect(serviceConfig.timeoutMs).toBe(30000);
      expect(serviceConfig.retryAttempts).toBe(3);
      expect(serviceConfig.rateLimitPerMinute).toBe(60);
    });

    it('should apply overrides correctly', () => {
      // Arrange
      const overrides: Partial<ServiceConfig> = {
        timeoutMs: 45000,
        retryAttempts: 5
      };

      // Act
      const serviceConfig = ServiceFactory.createTenantServiceConfig(sampleTenantConfig, overrides);

      // Assert
      expect(serviceConfig.timeoutMs).toBe(45000);
      expect(serviceConfig.retryAttempts).toBe(5);
      expect(serviceConfig.rateLimitPerMinute).toBe(60); // Not overridden
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
    });
  });

  describe('createBatchServiceConfigs', () => {
    it('should create multiple service configs', () => {
      // Arrange
      const tenantConfigs: TenantMpesaConfig[] = [
        sampleTenantConfig,
        {
          ...sampleTenantConfig,
          tenantId: 'tenant-456',
          barId: 'bar-789',
          barName: 'Another Bar'
        }
      ];

      // Act
      const serviceConfigs = ServiceFactory.createBatchServiceConfigs(tenantConfigs);

      // Assert
      expect(serviceConfigs).toHaveLength(2);
      expect(serviceConfigs[0].credentials).toEqual(sampleCredentials);
      expect(serviceConfigs[1].credentials).toEqual(sampleCredentials);
    });
  });
});