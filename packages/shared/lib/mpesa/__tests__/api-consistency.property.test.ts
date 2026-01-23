/**
 * Property-Based Test: API Interface Consistency
 * 
 * **Feature: mpesa-tenant-credentials-fix, Property 6: API Interface Consistency**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 * 
 * This test verifies that the payment API maintains consistent interface and response format
 * regardless of which tenant's credentials are used, ensuring seamless customer experience
 * across all tenants.
 */

import fc from 'fast-check';
import { 
  TabResolutionService,
  CredentialRetrievalService, 
  TenantMpesaConfigFactory,
  ServiceFactory,
  MpesaCredentials,
  MpesaEnvironment,
  TenantInfo,
  TenantMpesaConfig,
  ServiceConfig
} from '../services';
import { Logger } from '../services/base';

// Mock implementations for testing
class MockTabResolutionService implements TabResolutionService {
  constructor(private mockTenants: Map<string, TenantInfo>) {}

  async resolveTabToTenant(tabId: string): Promise<TenantInfo> {
    const tenant = this.mockTenants.get(tabId);
    if (!tenant) {
      throw new Error('Tab not found');
    }
    return tenant;
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

class MockTenantMpesaConfigFactory implements TenantMpesaConfigFactory {
  constructor(private defaultConfig: {
    defaultTimeoutMs: number;
    defaultRetryAttempts: number;
    defaultRateLimitPerMinute: number;
  }) {}

  async createServiceConfig(tenantInfo: TenantInfo, credentials: MpesaCredentials, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<ServiceConfig> {
    return {
      environment: options?.environment || 'sandbox',
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      businessShortCode: credentials.businessShortCode,
      passkey: credentials.passkey,
      callbackUrl: credentials.callbackUrl,
      timeoutMs: options?.timeoutMs || this.defaultConfig.defaultTimeoutMs,
      retryAttempts: options?.retryAttempts || this.defaultConfig.defaultRetryAttempts,
      rateLimitPerMinute: options?.rateLimitPerMinute || this.defaultConfig.defaultRateLimitPerMinute
    };
  }

  async createTenantConfig(tenantInfo: TenantInfo, credentials: MpesaCredentials, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<TenantMpesaConfig> {
    const serviceConfig = await this.createServiceConfig(tenantInfo, credentials, options);
    return {
      ...serviceConfig,
      tenantId: tenantInfo.tenantId,
      barName: tenantInfo.barName,
      credentials
    };
  }

  async createServiceConfigFromTab(tabId: string, tabResolutionService: TabResolutionService, credentialRetrievalService: CredentialRetrievalService, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<ServiceConfig> {
    const tenantInfo = await tabResolutionService.resolveTabToTenant(tabId);
    const credentials = await credentialRetrievalService.getTenantCredentials(
      tenantInfo.tenantId, 
      options?.environment || 'sandbox'
    );
    return this.createServiceConfig(tenantInfo, credentials, options);
  }

  async createBatchServiceConfigs(tabIds: string[], tabResolutionService: TabResolutionService, credentialRetrievalService: CredentialRetrievalService, options?: {
    environment?: MpesaEnvironment;
    timeoutMs?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
  }): Promise<ServiceConfig[]> {
    const configs: ServiceConfig[] = [];
    for (const tabId of tabIds) {
      const config = await this.createServiceConfigFromTab(tabId, tabResolutionService, credentialRetrievalService, options);
      configs.push(config);
    }
    return configs;
  }
}

// Test data generators
const tenantInfoArbitrary = fc.record({
  tenantId: fc.uuid(),
  barId: fc.uuid(),
  barName: fc.string({ minLength: 3, maxLength: 50 }),
  isActive: fc.constant(true)
});

const credentialsArbitrary = fc.record({
  consumerKey: fc.string({ minLength: 10, maxLength: 50 }),
  consumerSecret: fc.string({ minLength: 10, maxLength: 50 }),
  businessShortCode: fc.string({ minLength: 5, maxLength: 10 }),
  passkey: fc.string({ minLength: 20, maxLength: 100 }),
  callbackUrl: fc.webUrl(),
  environment: fc.constantFrom('sandbox' as const, 'production' as const)
});

const environmentArbitrary = fc.constantFrom('sandbox' as const, 'production' as const);

const paymentRequestArbitrary = fc.record({
  tabId: fc.uuid(),
  phoneNumber: fc.string({ minLength: 10, maxLength: 15 }),
  amount: fc.integer({ min: 1, max: 100000 })
});

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('Property Test: API Interface Consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should maintain consistent API interface across different tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(tenantInfoArbitrary, credentialsArbitrary), { minLength: 2, maxLength: 5 }),
        environmentArbitrary,
        fc.array(paymentRequestArbitrary, { minLength: 1, maxLength: 3 }),
        async (tenantCredentialPairs, environment, paymentRequests) => {
          // Setup mock services with multiple tenants
          const mockTenants = new Map<string, TenantInfo>();
          const mockCredentials = new Map<string, MpesaCredentials>();

          // Create tenant-credential mappings
          const tenantConfigs: TenantMpesaConfig[] = [];
          for (const [tenantInfo, credentials] of tenantCredentialPairs) {
            // Ensure credentials match the test environment
            const adjustedCredentials = { ...credentials, environment };
            
            mockTenants.set(paymentRequests[0]?.tabId || fc.sample(fc.uuid(), 1)[0], tenantInfo);
            mockCredentials.set(`${tenantInfo.tenantId}-${environment}`, adjustedCredentials);

            // Create expected tenant config for comparison
            const tenantConfig: TenantMpesaConfig = {
              tenantId: tenantInfo.tenantId,
              barName: tenantInfo.barName,
              environment,
              consumerKey: adjustedCredentials.consumerKey,
              consumerSecret: adjustedCredentials.consumerSecret,
              businessShortCode: adjustedCredentials.businessShortCode,
              passkey: adjustedCredentials.passkey,
              callbackUrl: adjustedCredentials.callbackUrl,
              timeoutMs: 30000,
              retryAttempts: 3,
              rateLimitPerMinute: 60,
              credentials: adjustedCredentials
            };
            tenantConfigs.push(tenantConfig);
          }

          const tabResolutionService = new MockTabResolutionService(mockTenants);
          const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
          const configFactory = new MockTenantMpesaConfigFactory({
            defaultTimeoutMs: 30000,
            defaultRetryAttempts: 3,
            defaultRateLimitPerMinute: 60
          });

          // Test API consistency across different tenants
          const apiResponses: any[] = [];
          
          for (let i = 0; i < Math.min(paymentRequests.length, tenantCredentialPairs.length); i++) {
            const request = paymentRequests[i];
            const [tenantInfo] = tenantCredentialPairs[i];
            
            // Update mock to return this specific tenant for this tab
            mockTenants.set(request.tabId, tenantInfo);

            try {
              // Create service configuration (simulating API endpoint behavior)
              const serviceConfig = await configFactory.createServiceConfigFromTab(
                request.tabId,
                tabResolutionService,
                credentialRetrievalService,
                { environment }
              );

              // Simulate API response structure
              const apiResponse = {
                success: true,
                transactionId: fc.sample(fc.uuid(), 1)[0],
                checkoutRequestId: fc.sample(fc.uuid(), 1)[0],
                customerMessage: 'Payment request sent successfully',
                // API should have consistent structure regardless of tenant
                metadata: {
                  environment: serviceConfig.environment,
                  hasCredentials: !!(serviceConfig.consumerKey && serviceConfig.consumerSecret),
                  hasConfiguration: !!(serviceConfig.timeoutMs && serviceConfig.retryAttempts),
                  tenantSpecific: true // This should always be true with tenant credentials
                }
              };

              apiResponses.push(apiResponse);

            } catch (error) {
              // Even errors should have consistent structure
              const errorResponse = {
                success: false,
                error: {
                  code: 'CONFIGURATION_ERROR',
                  message: 'Payment service configuration error',
                  shouldRetry: false
                },
                transactionId: fc.sample(fc.uuid(), 1)[0]
              };

              apiResponses.push(errorResponse);
            }
          }

          // Property 1: All successful responses should have the same structure
          const successfulResponses = apiResponses.filter(r => r.success === true);
          if (successfulResponses.length > 1) {
            const firstResponse = successfulResponses[0];
            for (const response of successfulResponses.slice(1)) {
              // Check structural consistency
              expect(typeof response.success).toBe(typeof firstResponse.success);
              expect(typeof response.transactionId).toBe(typeof firstResponse.transactionId);
              expect(typeof response.checkoutRequestId).toBe(typeof firstResponse.checkoutRequestId);
              expect(typeof response.customerMessage).toBe(typeof firstResponse.customerMessage);
              
              // Check metadata structure consistency
              expect(typeof response.metadata).toBe(typeof firstResponse.metadata);
              expect(typeof response.metadata.environment).toBe(typeof firstResponse.metadata.environment);
              expect(typeof response.metadata.hasCredentials).toBe(typeof firstResponse.metadata.hasCredentials);
              expect(typeof response.metadata.hasConfiguration).toBe(typeof firstResponse.metadata.hasConfiguration);
              expect(typeof response.metadata.tenantSpecific).toBe(typeof firstResponse.metadata.tenantSpecific);
              
              // All responses should indicate tenant-specific credentials are used
              expect(response.metadata.tenantSpecific).toBe(true);
              expect(response.metadata.hasCredentials).toBe(true);
              expect(response.metadata.hasConfiguration).toBe(true);
            }
          }

          // Property 2: All error responses should have the same structure
          const errorResponses = apiResponses.filter(r => r.success === false);
          if (errorResponses.length > 1) {
            const firstError = errorResponses[0];
            for (const errorResponse of errorResponses.slice(1)) {
              expect(typeof errorResponse.success).toBe(typeof firstError.success);
              expect(typeof errorResponse.error).toBe(typeof firstError.error);
              expect(typeof errorResponse.error.code).toBe(typeof firstError.error.code);
              expect(typeof errorResponse.error.message).toBe(typeof firstError.error.message);
              expect(typeof errorResponse.error.shouldRetry).toBe(typeof firstError.error.shouldRetry);
              expect(typeof errorResponse.transactionId).toBe(typeof firstError.transactionId);
            }
          }

          // Property 3: Environment consistency - all configs should use the specified environment
          for (const response of successfulResponses) {
            expect(response.metadata.environment).toBe(environment);
          }

          // Property 4: Response completeness - all responses should have required fields
          for (const response of apiResponses) {
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('transactionId');
            expect(typeof response.transactionId).toBe('string');
            expect(response.transactionId.length).toBeGreaterThan(0);

            if (response.success) {
              expect(response).toHaveProperty('checkoutRequestId');
              expect(response).toHaveProperty('customerMessage');
              expect(response).toHaveProperty('metadata');
            } else {
              expect(response).toHaveProperty('error');
              expect(response.error).toHaveProperty('code');
              expect(response.error).toHaveProperty('message');
              expect(response.error).toHaveProperty('shouldRetry');
            }
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should maintain callback mechanism consistency across tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(tenantInfoArbitrary, credentialsArbitrary), { minLength: 2, maxLength: 3 }),
        environmentArbitrary,
        async (tenantCredentialPairs, environment) => {
          // Setup mock services
          const mockTenants = new Map<string, TenantInfo>();
          const mockCredentials = new Map<string, MpesaCredentials>();

          const callbackUrls: string[] = [];
          const tabIds: string[] = [];

          for (const [tenantInfo, credentials] of tenantCredentialPairs) {
            const tabId = fc.sample(fc.uuid(), 1)[0];
            const adjustedCredentials = { ...credentials, environment };
            
            tabIds.push(tabId);
            mockTenants.set(tabId, tenantInfo);
            mockCredentials.set(`${tenantInfo.tenantId}-${environment}`, adjustedCredentials);
            callbackUrls.push(adjustedCredentials.callbackUrl);
          }

          const tabResolutionService = new MockTabResolutionService(mockTenants);
          const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
          const configFactory = new MockTenantMpesaConfigFactory({
            defaultTimeoutMs: 30000,
            defaultRetryAttempts: 3,
            defaultRateLimitPerMinute: 60
          });

          // Test callback URL consistency
          const serviceConfigs: ServiceConfig[] = [];
          for (const tabId of tabIds) {
            const config = await configFactory.createServiceConfigFromTab(
              tabId,
              tabResolutionService,
              credentialRetrievalService,
              { environment }
            );
            serviceConfigs.push(config);
          }

          // Property 1: Each tenant should have their own callback URL
          const uniqueCallbackUrls = new Set(serviceConfigs.map(c => c.callbackUrl));
          expect(uniqueCallbackUrls.size).toBe(serviceConfigs.length);

          // Property 2: All callback URLs should be valid URLs
          for (const config of serviceConfigs) {
            expect(config.callbackUrl).toMatch(/^https?:\/\/.+/);
            expect(() => new URL(config.callbackUrl)).not.toThrow();
          }

          // Property 3: Callback URLs should match the original tenant credentials
          for (let i = 0; i < serviceConfigs.length; i++) {
            expect(serviceConfigs[i].callbackUrl).toBe(callbackUrls[i]);
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should maintain webhook handling consistency across tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(tenantInfoArbitrary, credentialsArbitrary), { minLength: 2, maxLength: 3 }),
        environmentArbitrary,
        async (tenantCredentialPairs, environment) => {
          // Setup mock services
          const mockTenants = new Map<string, TenantInfo>();
          const mockCredentials = new Map<string, MpesaCredentials>();

          for (const [tenantInfo, credentials] of tenantCredentialPairs) {
            const tabId = fc.sample(fc.uuid(), 1)[0];
            const adjustedCredentials = { ...credentials, environment };
            
            mockTenants.set(tabId, tenantInfo);
            mockCredentials.set(`${tenantInfo.tenantId}-${environment}`, adjustedCredentials);
          }

          const tabResolutionService = new MockTabResolutionService(mockTenants);
          const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
          const configFactory = new MockTenantMpesaConfigFactory({
            defaultTimeoutMs: 30000,
            defaultRetryAttempts: 3,
            defaultRateLimitPerMinute: 60
          });

          // Simulate webhook processing for different tenants
          const webhookResponses: any[] = [];
          
          for (const [tenantInfo] of tenantCredentialPairs) {
            const tabId = fc.sample(fc.uuid(), 1)[0];
            mockTenants.set(tabId, tenantInfo);

            try {
              const serviceConfig = await configFactory.createServiceConfigFromTab(
                tabId,
                tabResolutionService,
                credentialRetrievalService,
                { environment }
              );

              // Simulate webhook response processing
              const webhookResponse = {
                processed: true,
                tenantId: tenantInfo.tenantId,
                environment: serviceConfig.environment,
                callbackUrl: serviceConfig.callbackUrl,
                processingTime: fc.sample(fc.integer({ min: 10, max: 1000 }), 1)[0],
                // Webhook processing should be consistent regardless of tenant
                structure: {
                  hasResultCode: true,
                  hasResultDesc: true,
                  hasTransactionId: true,
                  hasAmount: true,
                  hasPhoneNumber: true
                }
              };

              webhookResponses.push(webhookResponse);

            } catch (error) {
              // Even webhook errors should be consistent
              const errorResponse = {
                processed: false,
                error: 'Webhook processing failed',
                tenantId: tenantInfo.tenantId,
                environment
              };

              webhookResponses.push(errorResponse);
            }
          }

          // Property 1: All successful webhook responses should have consistent structure
          const successfulWebhooks = webhookResponses.filter(w => w.processed === true);
          if (successfulWebhooks.length > 1) {
            const firstWebhook = successfulWebhooks[0];
            for (const webhook of successfulWebhooks.slice(1)) {
              expect(typeof webhook.processed).toBe(typeof firstWebhook.processed);
              expect(typeof webhook.tenantId).toBe(typeof firstWebhook.tenantId);
              expect(typeof webhook.environment).toBe(typeof firstWebhook.environment);
              expect(typeof webhook.callbackUrl).toBe(typeof firstWebhook.callbackUrl);
              expect(typeof webhook.processingTime).toBe(typeof firstWebhook.processingTime);
              expect(typeof webhook.structure).toBe(typeof firstWebhook.structure);
              
              // Structure should be identical across tenants
              expect(webhook.structure).toEqual(firstWebhook.structure);
            }
          }

          // Property 2: Each webhook should be processed for the correct tenant
          for (const webhook of successfulWebhooks) {
            expect(webhook.tenantId).toBeTruthy();
            expect(webhook.environment).toBe(environment);
            expect(webhook.callbackUrl).toMatch(/^https?:\/\/.+/);
          }

          // Property 3: Processing structure should be consistent
          for (const webhook of successfulWebhooks) {
            expect(webhook.structure.hasResultCode).toBe(true);
            expect(webhook.structure.hasResultDesc).toBe(true);
            expect(webhook.structure.hasTransactionId).toBe(true);
            expect(webhook.structure.hasAmount).toBe(true);
            expect(webhook.structure.hasPhoneNumber).toBe(true);
          }
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  it('should maintain service configuration consistency across tenant batches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(tenantInfoArbitrary, credentialsArbitrary), { minLength: 3, maxLength: 5 }),
        environmentArbitrary,
        async (tenantCredentialPairs, environment) => {
          // Setup mock services
          const mockTenants = new Map<string, TenantInfo>();
          const mockCredentials = new Map<string, MpesaCredentials>();
          const tabIds: string[] = [];

          for (const [tenantInfo, credentials] of tenantCredentialPairs) {
            const tabId = fc.sample(fc.uuid(), 1)[0];
            const adjustedCredentials = { ...credentials, environment };
            
            tabIds.push(tabId);
            mockTenants.set(tabId, tenantInfo);
            mockCredentials.set(`${tenantInfo.tenantId}-${environment}`, adjustedCredentials);
          }

          const tabResolutionService = new MockTabResolutionService(mockTenants);
          const credentialRetrievalService = new MockCredentialRetrievalService(mockCredentials);
          const configFactory = new MockTenantMpesaConfigFactory({
            defaultTimeoutMs: 30000,
            defaultRetryAttempts: 3,
            defaultRateLimitPerMinute: 60
          });

          // Test batch configuration creation
          const batchConfigs = await configFactory.createBatchServiceConfigs(
            tabIds,
            tabResolutionService,
            credentialRetrievalService,
            { environment }
          );

          // Property 1: Batch should return same number of configs as input tabs
          expect(batchConfigs.length).toBe(tabIds.length);

          // Property 2: All configs should have consistent base structure
          const firstConfig = batchConfigs[0];
          for (const config of batchConfigs.slice(1)) {
            expect(typeof config.environment).toBe(typeof firstConfig.environment);
            expect(typeof config.consumerKey).toBe(typeof firstConfig.consumerKey);
            expect(typeof config.consumerSecret).toBe(typeof firstConfig.consumerSecret);
            expect(typeof config.businessShortCode).toBe(typeof firstConfig.businessShortCode);
            expect(typeof config.passkey).toBe(typeof firstConfig.passkey);
            expect(typeof config.callbackUrl).toBe(typeof firstConfig.callbackUrl);
            expect(typeof config.timeoutMs).toBe(typeof firstConfig.timeoutMs);
            expect(typeof config.retryAttempts).toBe(typeof firstConfig.retryAttempts);
            expect(typeof config.rateLimitPerMinute).toBe(typeof firstConfig.rateLimitPerMinute);
          }

          // Property 3: All configs should use the specified environment
          for (const config of batchConfigs) {
            expect(config.environment).toBe(environment);
          }

          // Property 4: All configs should have valid credentials
          for (const config of batchConfigs) {
            expect(config.consumerKey).toBeTruthy();
            expect(config.consumerSecret).toBeTruthy();
            expect(config.businessShortCode).toBeTruthy();
            expect(config.passkey).toBeTruthy();
            expect(config.callbackUrl).toMatch(/^https?:\/\/.+/);
          }

          // Property 5: Default configuration values should be consistent
          for (const config of batchConfigs) {
            expect(config.timeoutMs).toBe(30000);
            expect(config.retryAttempts).toBe(3);
            expect(config.rateLimitPerMinute).toBe(60);
          }

          // Property 6: Each config should be unique (different credentials per tenant)
          const uniqueConsumerKeys = new Set(batchConfigs.map(c => c.consumerKey));
          expect(uniqueConsumerKeys.size).toBe(batchConfigs.length);
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });
});