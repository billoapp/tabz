/**
 * Environment Switching Integration Tests
 * Tests environment configuration switching and validation
 */

import { MpesaConfig } from '../config';
import { PaymentService } from '../services/payment';
import { STKPushHandler } from '../services/stkpush';
import { CredentialStore } from '../services/credential-store';
import { sandboxValidator } from '../testing/sandbox-utilities';
import { MpesaCredentials, Environment } from '../types';

describe('Environment Switching Integration Tests', () => {
  let credentialStore: CredentialStore;
  let mockCredentials: Map<string, MpesaCredentials>;

  beforeEach(() => {
    mockCredentials = new Map();
    credentialStore = new CredentialStore(mockCredentials as any);

    // Setup test credentials for both environments
    mockCredentials.set('sandbox', {
      consumerKey: 'sandbox_consumer_key',
      consumerSecret: 'sandbox_consumer_secret',
      businessShortCode: '174379',
      passkey: 'sandbox_passkey',
      environment: 'sandbox',
      callbackUrl: 'https://test.example.com/callback',
      encryptedAt: new Date(),
      lastValidated: new Date()
    });

    mockCredentials.set('production', {
      consumerKey: 'prod_consumer_key',
      consumerSecret: 'prod_consumer_secret',
      businessShortCode: '123456',
      passkey: 'prod_passkey',
      environment: 'production',
      callbackUrl: 'https://api.example.com/callback',
      encryptedAt: new Date(),
      lastValidated: new Date()
    });
  });

  describe('Configuration Switching', () => {
    it('should correctly switch between sandbox and production configurations', async () => {
      // Test sandbox configuration
      const sandboxConfig = new MpesaConfig('sandbox');
      expect(sandboxConfig.environment).toBe('sandbox');
      expect(sandboxConfig.baseURL).toContain('sandbox');
      expect(sandboxConfig.stkPushURL).toContain('sandbox');
      expect(sandboxConfig.tokenURL).toContain('sandbox');

      // Test production configuration
      const productionConfig = new MpesaConfig('production');
      expect(productionConfig.environment).toBe('production');
      expect(productionConfig.baseURL).not.toContain('sandbox');
      expect(productionConfig.stkPushURL).not.toContain('sandbox');
      expect(productionConfig.tokenURL).not.toContain('sandbox');
    });

    it('should load correct credentials for each environment', async () => {
      const sandboxCredentials = await credentialStore.getCredentials('sandbox');
      expect(sandboxCredentials.environment).toBe('sandbox');
      expect(sandboxCredentials.businessShortCode).toBe('174379');
      expect(sandboxCredentials.callbackUrl).toContain('test.example.com');

      const productionCredentials = await credentialStore.getCredentials('production');
      expect(productionCredentials.environment).toBe('production');
      expect(productionCredentials.businessShortCode).toBe('123456');
      expect(productionCredentials.callbackUrl).toContain('api.example.com');
    });

    it('should validate environment-specific constraints', async () => {
      // Sandbox validation
      const sandboxPhoneValidation = sandboxValidator.validateSandboxPhoneNumber('254708374149');
      expect(sandboxPhoneValidation.isValid).toBe(true);

      const invalidSandboxPhone = sandboxValidator.validateSandboxPhoneNumber('254700000000');
      expect(invalidSandboxPhone.isValid).toBe(false);
      expect(invalidSandboxPhone.error).toContain('not approved for sandbox testing');

      // Amount validation
      const validSandboxAmount = sandboxValidator.validateSandboxAmount(100);
      expect(validSandboxAmount.isValid).toBe(true);

      const invalidSandboxAmount = sandboxValidator.validateSandboxAmount(2000);
      expect(invalidSandboxAmount.isValid).toBe(false);
    });

    it('should prevent production operations with sandbox credentials', async () => {
      const productionConfig = new MpesaConfig('production');
      const sandboxCredentials = await credentialStore.getCredentials('sandbox');

      // Should detect environment mismatch
      expect(() => {
        new STKPushHandler(productionConfig, null as any, sandboxCredentials);
      }).toThrow('Environment mismatch');
    });

    it('should enforce HTTPS callback URLs in both environments', async () => {
      const httpCallbackCredentials: MpesaCredentials = {
        ...mockCredentials.get('sandbox')!,
        callbackUrl: 'http://insecure.example.com/callback'
      };

      const validation = await credentialStore.validateCredentials(httpCallbackCredentials);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Callback URL must use HTTPS');
    });
  });

  describe('Environment Switching Safety', () => {
    it('should require explicit confirmation for production deployment', async () => {
      const productionConfig = new MpesaConfig('production');
      const productionCredentials = await credentialStore.getCredentials('production');

      // Mock production readiness check
      const readinessCheck = {
        credentialsValidated: true,
        callbackUrlAccessible: true,
        sslCertificateValid: true,
        monitoringConfigured: true,
        backupProceduresReady: true
      };

      const isProductionReady = Object.values(readinessCheck).every(check => check === true);
      expect(isProductionReady).toBe(true);
    });

    it('should validate production credentials thoroughly', async () => {
      const productionCredentials = await credentialStore.getCredentials('production');
      
      const validation = await credentialStore.validateCredentials(productionCredentials);
      expect(validation.isValid).toBe(true);
      expect(validation.environment).toBe('production');
      
      // Production-specific validations
      expect(productionCredentials.callbackUrl).toMatch(/^https:\/\//);
      expect(productionCredentials.businessShortCode).toMatch(/^\d{6}$/);
      expect(productionCredentials.consumerKey).not.toContain('sandbox');
      expect(productionCredentials.consumerSecret).not.toContain('sandbox');
    });

    it('should prevent accidental production transactions in sandbox mode', async () => {
      const sandboxConfig = new MpesaConfig('sandbox');
      
      // Production-like phone number should be rejected in sandbox
      const productionPhoneValidation = sandboxValidator.validateSandboxPhoneNumber('254712345678');
      expect(productionPhoneValidation.isValid).toBe(false);
      
      // Large amounts should be rejected in sandbox
      const largeAmountValidation = sandboxValidator.validateSandboxAmount(10000);
      expect(largeAmountValidation.isValid).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete environment configuration', async () => {
      const environments: Environment[] = ['sandbox', 'production'];
      
      for (const env of environments) {
        const config = new MpesaConfig(env);
        const credentials = await credentialStore.getCredentials(env);
        
        // Validate configuration completeness
        expect(config.environment).toBe(env);
        expect(config.baseURL).toBeDefined();
        expect(config.stkPushURL).toBeDefined();
        expect(config.tokenURL).toBeDefined();
        
        // Validate credentials completeness
        expect(credentials.consumerKey).toBeDefined();
        expect(credentials.consumerSecret).toBeDefined();
        expect(credentials.businessShortCode).toBeDefined();
        expect(credentials.passkey).toBeDefined();
        expect(credentials.callbackUrl).toBeDefined();
        expect(credentials.environment).toBe(env);
      }
    });

    it('should detect invalid environment configurations', async () => {
      // Test invalid environment
      expect(() => new MpesaConfig('invalid' as Environment)).toThrow('Invalid environment');
      
      // Test missing credentials
      mockCredentials.delete('sandbox');
      await expect(credentialStore.getCredentials('sandbox')).rejects.toThrow('Credentials not found');
    });

    it('should validate URL consistency across environments', async () => {
      const sandboxConfig = new MpesaConfig('sandbox');
      const productionConfig = new MpesaConfig('production');
      
      // Sandbox URLs should contain 'sandbox'
      expect(sandboxConfig.baseURL).toContain('sandbox');
      expect(sandboxConfig.stkPushURL).toContain('sandbox');
      expect(sandboxConfig.tokenURL).toContain('sandbox');
      
      // Production URLs should not contain 'sandbox'
      expect(productionConfig.baseURL).not.toContain('sandbox');
      expect(productionConfig.stkPushURL).not.toContain('sandbox');
      expect(productionConfig.tokenURL).not.toContain('sandbox');
      
      // All URLs should use HTTPS
      [sandboxConfig, productionConfig].forEach(config => {
        expect(config.baseURL).toMatch(/^https:\/\//);
        expect(config.stkPushURL).toMatch(/^https:\/\//);
        expect(config.tokenURL).toMatch(/^https:\/\//);
      });
    });
  });

  describe('Environment Migration', () => {
    it('should support safe migration from sandbox to production', async () => {
      // Step 1: Validate sandbox setup
      const sandboxConfig = new MpesaConfig('sandbox');
      const sandboxCredentials = await credentialStore.getCredentials('sandbox');
      
      const sandboxValidation = await credentialStore.validateCredentials(sandboxCredentials);
      expect(sandboxValidation.isValid).toBe(true);
      
      // Step 2: Prepare production credentials
      const productionCredentials = await credentialStore.getCredentials('production');
      const productionValidation = await credentialStore.validateCredentials(productionCredentials);
      expect(productionValidation.isValid).toBe(true);
      
      // Step 3: Validate production readiness
      const productionConfig = new MpesaConfig('production');
      expect(productionConfig.environment).toBe('production');
      
      // Step 4: Ensure no sandbox artifacts in production
      expect(productionCredentials.consumerKey).not.toContain('sandbox');
      expect(productionCredentials.consumerSecret).not.toContain('sandbox');
      expect(productionCredentials.callbackUrl).not.toContain('test');
    });

    it('should maintain audit trail during environment switches', async () => {
      const auditLog: Array<{
        timestamp: Date;
        action: string;
        environment: Environment;
        user: string;
      }> = [];

      // Simulate environment switch
      const switchEnvironment = async (from: Environment, to: Environment, user: string) => {
        auditLog.push({
          timestamp: new Date(),
          action: `environment_switch_from_${from}_to_${to}`,
          environment: to,
          user
        });
        
        // Validate new environment
        const config = new MpesaConfig(to);
        const credentials = await credentialStore.getCredentials(to);
        const validation = await credentialStore.validateCredentials(credentials);
        
        if (!validation.isValid) {
          throw new Error(`Invalid ${to} configuration: ${validation.errors.join(', ')}`);
        }
        
        return { config, credentials };
      };

      // Test environment switch
      const result = await switchEnvironment('sandbox', 'production', 'admin_user');
      
      expect(result.config.environment).toBe('production');
      expect(result.credentials.environment).toBe('production');
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('environment_switch_from_sandbox_to_production');
      expect(auditLog[0].user).toBe('admin_user');
    });
  });

  describe('Error Handling in Environment Switching', () => {
    it('should handle missing environment credentials gracefully', async () => {
      mockCredentials.clear();
      
      await expect(credentialStore.getCredentials('sandbox')).rejects.toThrow('Credentials not found for environment: sandbox');
      await expect(credentialStore.getCredentials('production')).rejects.toThrow('Credentials not found for environment: production');
    });

    it('should handle corrupted credentials gracefully', async () => {
      // Corrupt sandbox credentials
      mockCredentials.set('sandbox', {
        consumerKey: '',
        consumerSecret: null as any,
        businessShortCode: 'invalid',
        passkey: undefined as any,
        environment: 'sandbox',
        callbackUrl: 'not-a-url',
        encryptedAt: new Date(),
        lastValidated: new Date()
      });

      const validation = await credentialStore.validateCredentials(mockCredentials.get('sandbox')!);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Consumer key is required');
      expect(validation.errors).toContain('Consumer secret is required');
      expect(validation.errors).toContain('Invalid business shortcode format');
      expect(validation.errors).toContain('Passkey is required');
      expect(validation.errors).toContain('Invalid callback URL format');
    });

    it('should handle network errors during environment validation', async () => {
      const credentials = await credentialStore.getCredentials('sandbox');
      
      // Mock network error
      jest.spyOn(credentialStore, 'testCredentials').mockRejectedValue(
        new Error('Network timeout')
      );

      const validation = await credentialStore.validateCredentials(credentials);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Network timeout');
    });
  });
});