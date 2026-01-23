/**
 * Property-based tests for complete M-PESA credential resolution flow
 * Feature: mpesa-tenant-credentials-fix, Property 1: Tenant Credential Resolution Flow (complete)
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * Tests that for any valid tab with an associated bar/tenant, when a payment is initiated,
 * the system should successfully resolve the tab to tenant, retrieve encrypted credentials,
 * decrypt them, and use them for STK Push without accessing environment variables for
 * tenant-specific credentials.
 */

import * as fc from 'fast-check';
import { ServiceFactory } from '../services/base';
import { DatabaseTabResolutionService, TenantInfo } from '../services/tab-resolution';
import { DatabaseCredentialRetrievalService } from '../services/credential-retrieval';
import { SystemKMSDecryptionService } from '../services/kms-decryption';
import { TenantMpesaConfigFactory } from '../services/tenant-config-factory';
import { MpesaCredentials, MpesaEnvironment, MpesaError, ServiceConfig } from '../types';
import { encryptCredential } from '../services/encryption';

// Mock Supabase client for property testing
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn()
};

// Mock createClient to return our mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Property 1: Complete Tenant Credential Resolution Flow', () => {
  let tabResolutionService: DatabaseTabResolutionService;
  let credentialRetrievalService: DatabaseCredentialRetrievalService;
  let kmsDecryptionService: SystemKMSDecryptionService;
  let tenantConfigFactory: TenantMpesaConfigFactory;
  
  const originalEnv = process.env.MPESA_KMS_KEY;
  const testKey = 'test-key-32-bytes-long-for-aes!'; // Exactly 32 bytes

  beforeEach(() => {
    // Set up test environment
    process.env.MPESA_KMS_KEY = testKey;
    
    // Initialize services
    tabResolutionService = new DatabaseTabResolutionService('test-url', 'test-key');
    credentialRetrievalService = new DatabaseCredentialRetrievalService('test-url', 'test-key');
    kmsDecryptionService = new SystemKMSDecryptionService();
    tenantConfigFactory = new TenantMpesaConfigFactory();
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (kmsDecryptionService && typeof kmsDecryptionService.dispose === 'function') {
      kmsDecryptionService.dispose();
    }
    
    if (originalEnv) {
      process.env.MPESA_KMS_KEY = originalEnv;
    } else {
      delete process.env.MPESA_KMS_KEY;
    }
  });

  // Arbitraries for generating test data
  const tabIdArbitrary = fc.uuid();
  const tenantIdArbitrary = fc.uuid();
  const barIdArbitrary = fc.uuid();
  const barNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
  const phoneNumberArbitrary = fc.stringMatching(/^254[0-9]{9}$/);
  const amountArbitrary = fc.integer({ min: 1, max: 100000 });
  const environmentArbitrary = fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>;
  const timestampArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

  // Generate valid tenant information
  const validTenantInfoArbitrary = fc.record({
    tenantId: tenantIdArbitrary,
    barId: barIdArbitrary,
    barName: barNameArbitrary,
    isActive: fc.constant(true)
  });

  // Generate valid M-Pesa credentials
  const validCredentialsArbitrary = fc.record({
    consumerKey: fc.string({ minLength: 15, maxLength: 50 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
    consumerSecret: fc.string({ minLength: 15, maxLength: 50 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
    businessShortCode: fc.stringMatching(/^\d{5,7}$/),
    passkey: fc.string({ minLength: 25, maxLength: 100 }).filter(s => /^[a-zA-Z0-9+/=]+$/.test(s)),
    environment: environmentArbitrary,
    callbackUrl: fc.webUrl({ validSchemes: ['https'] }),
    timeoutUrl: fc.option(fc.webUrl({ validSchemes: ['https'] })),
    encryptedAt: timestampArbitrary,
    lastValidated: fc.option(timestampArbitrary)
  });

  // Generate valid tab data with associated bar
  const validTabDataArbitrary = fc.record({
    id: tabIdArbitrary,
    bar_id: barIdArbitrary,
    tab_number: fc.integer({ min: 1, max: 999 }),
    status: fc.constantFrom('open', 'closing'),
    owner_identifier: fc.option(fc.uuid(), { nil: null }),
    opened_at: timestampArbitrary.map(d => d.toISOString()),
    closed_at: fc.option(timestampArbitrary.map(d => d.toISOString()), { nil: null }),
    bars: fc.record({
      id: barIdArbitrary,
      name: barNameArbitrary,
      active: fc.constant(true)
    })
  });

  // Generate encrypted credential records
  const validEncryptedCredentialArbitrary = fc.record({
    id: fc.uuid(),
    tenant_id: tenantIdArbitrary,
    environment: environmentArbitrary,
    consumer_key_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    consumer_secret_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    business_shortcode: fc.stringMatching(/^\d{5,7}$/),
    passkey_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    callback_url: fc.webUrl({ validSchemes: ['https'] }),
    timeout_url: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: null }),
    is_active: fc.constant(true),
    created_at: timestampArbitrary.map(d => d.toISOString()),
    updated_at: timestampArbitrary.map(d => d.toISOString())
  });

  // Generate payment request data
  const paymentRequestArbitrary = fc.record({
    tabId: tabIdArbitrary,
    phoneNumber: phoneNumberArbitrary,
    amount: amountArbitrary,
    accountReference: fc.string({ minLength: 1, maxLength: 12 }),
    transactionDesc: fc.string({ minLength: 1, maxLength: 13 })
  });

  /**
   * Property 1: Complete Tenant Credential Resolution Flow
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   * 
   * For any valid tab with an associated bar/tenant, when a payment is initiated,
   * the system should successfully resolve the tab to tenant, retrieve encrypted credentials,
   * decrypt them, and use them for STK Push without accessing environment variables for
   * tenant-specific credentials.
   */
  it('Property 1: Should complete end-to-end credential resolution flow for any valid tab and tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTabDataArbitrary,
        validCredentialsArbitrary,
        paymentRequestArbitrary,
        async (tabData, originalCredentials, paymentRequest) => {
          // Ensure consistent IDs across test data
          const consistentTabData = {
            ...tabData,
            id: paymentRequest.tabId,
            bars: {
              ...tabData.bars,
              id: tabData.bar_id
            }
          };

          const consistentCredentials = {
            ...originalCredentials,
            businessShortCode: tabData.bars ? tabData.bars.id.slice(-6).padStart(6, '1') : '123456'
          };

          // Step 1: Mock tab resolution
          mockSupabase.single.mockResolvedValueOnce({
            data: consistentTabData,
            error: null
          });

          // Step 2: Mock credential retrieval with encrypted data
          const encryptedCredentials = {
            id: fc.sample(fc.uuid(), 1)[0],
            tenant_id: consistentTabData.bar_id,
            environment: consistentCredentials.environment,
            consumer_key_enc: encryptCredential(consistentCredentials.consumerKey),
            consumer_secret_enc: encryptCredential(consistentCredentials.consumerSecret),
            business_shortcode: consistentCredentials.businessShortCode,
            passkey_enc: encryptCredential(consistentCredentials.passkey),
            callback_url: consistentCredentials.callbackUrl,
            timeout_url: consistentCredentials.timeoutUrl,
            is_active: true,
            created_at: consistentCredentials.encryptedAt.toISOString(),
            updated_at: (consistentCredentials.lastValidated || consistentCredentials.encryptedAt).toISOString()
          };

          mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: encryptedCredentials,
            error: null
          });

          // Act: Execute complete credential resolution flow
          const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
            paymentRequest.tabId,
            tabResolutionService,
            credentialRetrievalService,
            tenantConfigFactory,
            { environment: consistentCredentials.environment }
          );

          // Assert: Universal properties that must hold for complete flow
          
          // 1. Service configuration should be created successfully
          expect(serviceConfig).toBeDefined();
          expect(serviceConfig).toMatchObject({
            environment: consistentCredentials.environment,
            timeoutMs: expect.any(Number),
            retryAttempts: expect.any(Number),
            rateLimitPerMinute: expect.any(Number)
          });

          // 2. Credentials should be properly decrypted and available
          expect(serviceConfig.credentials).toBeDefined();
          expect(serviceConfig.credentials.consumerKey).toBe(consistentCredentials.consumerKey);
          expect(serviceConfig.credentials.consumerSecret).toBe(consistentCredentials.consumerSecret);
          expect(serviceConfig.credentials.businessShortCode).toBe(consistentCredentials.businessShortCode);
          expect(serviceConfig.credentials.passkey).toBe(consistentCredentials.passkey);
          expect(serviceConfig.credentials.callbackUrl).toBe(consistentCredentials.callbackUrl);
          expect(serviceConfig.credentials.environment).toBe(consistentCredentials.environment);

          // 3. Tab resolution should have been called correctly
          expect(mockSupabase.from).toHaveBeenCalledWith('tabs');
          expect(mockSupabase.eq).toHaveBeenCalledWith('id', paymentRequest.tabId);

          // 4. Credential retrieval should have been called correctly
          expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
          expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', consistentTabData.bar_id);
          expect(mockSupabase.eq).toHaveBeenCalledWith('environment', consistentCredentials.environment);

          // 5. No environment variables should be used for tenant-specific credentials
          // (This is validated by the fact that we're using database-retrieved credentials)
          expect(serviceConfig.credentials.consumerKey).not.toBe(process.env.MPESA_CONSUMER_KEY);
          expect(serviceConfig.credentials.consumerSecret).not.toBe(process.env.MPESA_CONSUMER_SECRET);
          expect(serviceConfig.credentials.businessShortCode).not.toBe(process.env.MPESA_BUSINESS_SHORTCODE);
          expect(serviceConfig.credentials.passkey).not.toBe(process.env.MPESA_PASSKEY);

          // 6. Service configuration should be valid for STK Push operations
          expect(serviceConfig.credentials.consumerKey.length).toBeGreaterThan(10);
          expect(serviceConfig.credentials.consumerSecret.length).toBeGreaterThan(10);
          expect(serviceConfig.credentials.businessShortCode).toMatch(/^\d{5,7}$/);
          expect(serviceConfig.credentials.passkey.length).toBeGreaterThan(20);
          expect(serviceConfig.credentials.callbackUrl).toMatch(/^https:\/\//);

          // 7. Environment consistency should be maintained throughout the flow
          expect(serviceConfig.environment).toBe(consistentCredentials.environment);
          expect(serviceConfig.credentials.environment).toBe(consistentCredentials.environment);

          // 8. Configuration should have reasonable defaults
          expect(serviceConfig.timeoutMs).toBeGreaterThan(0);
          expect(serviceConfig.retryAttempts).toBeGreaterThanOrEqual(0);
          expect(serviceConfig.rateLimitPerMinute).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.1: Flow should handle different environments consistently
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   * 
   * The complete credential resolution flow should work consistently for both
   * sandbox and production environments, using the appropriate credentials
   * and endpoints for each environment.
   */
  it('Property 1.1: Should handle both sandbox and production environments in complete flow', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTabDataArbitrary,
        validCredentialsArbitrary,
        fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>,
        async (tabData, baseCredentials, targetEnvironment) => {
          // Create environment-specific credentials
          const environmentCredentials = {
            ...baseCredentials,
            environment: targetEnvironment,
            callbackUrl: targetEnvironment === 'production' 
              ? 'https://secure.example.com/callback'
              : 'https://test.example.com/callback'
          };

          // Mock tab resolution
          mockSupabase.single.mockResolvedValueOnce({
            data: tabData,
            error: null
          });

          // Mock credential retrieval with environment-specific data
          const encryptedCredentials = {
            id: fc.sample(fc.uuid(), 1)[0],
            tenant_id: tabData.bar_id,
            environment: targetEnvironment,
            consumer_key_enc: encryptCredential(environmentCredentials.consumerKey),
            consumer_secret_enc: encryptCredential(environmentCredentials.consumerSecret),
            business_shortcode: environmentCredentials.businessShortCode,
            passkey_enc: encryptCredential(environmentCredentials.passkey),
            callback_url: environmentCredentials.callbackUrl,
            timeout_url: environmentCredentials.timeoutUrl,
            is_active: true,
            created_at: environmentCredentials.encryptedAt.toISOString(),
            updated_at: (environmentCredentials.lastValidated || environmentCredentials.encryptedAt).toISOString()
          };

          mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: encryptedCredentials,
            error: null
          });

          // Act: Execute flow with specific environment
          const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
            tabData.id,
            tabResolutionService,
            credentialRetrievalService,
            tenantConfigFactory,
            { environment: targetEnvironment }
          );

          // Assert: Environment-specific properties
          expect(serviceConfig.environment).toBe(targetEnvironment);
          expect(serviceConfig.credentials.environment).toBe(targetEnvironment);
          
          // Production should require HTTPS
          if (targetEnvironment === 'production') {
            expect(serviceConfig.credentials.callbackUrl).toMatch(/^https:\/\//);
            if (serviceConfig.credentials.timeoutUrl) {
              expect(serviceConfig.credentials.timeoutUrl).toMatch(/^https:\/\//);
            }
          }

          // Verify correct environment was requested from database
          expect(mockSupabase.eq).toHaveBeenCalledWith('environment', targetEnvironment);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.2: Flow should maintain data integrity through encryption/decryption
   * **Validates: Requirements 1.2, 1.3**
   * 
   * Throughout the complete credential resolution flow, sensitive credential data
   * should maintain integrity when encrypted in the database and decrypted for use.
   */
  it('Property 1.2: Should maintain credential data integrity through complete flow', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTabDataArbitrary,
        validCredentialsArbitrary,
        async (tabData, originalCredentials) => {
          // Mock tab resolution
          mockSupabase.single.mockResolvedValueOnce({
            data: tabData,
            error: null
          });

          // Create encrypted credentials that would be stored in database
          const encryptedCredentials = {
            id: fc.sample(fc.uuid(), 1)[0],
            tenant_id: tabData.bar_id,
            environment: originalCredentials.environment,
            consumer_key_enc: encryptCredential(originalCredentials.consumerKey),
            consumer_secret_enc: encryptCredential(originalCredentials.consumerSecret),
            business_shortcode: originalCredentials.businessShortCode, // Not encrypted
            passkey_enc: encryptCredential(originalCredentials.passkey),
            callback_url: originalCredentials.callbackUrl,
            timeout_url: originalCredentials.timeoutUrl,
            is_active: true,
            created_at: originalCredentials.encryptedAt.toISOString(),
            updated_at: (originalCredentials.lastValidated || originalCredentials.encryptedAt).toISOString()
          };

          mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: encryptedCredentials,
            error: null
          });

          // Act: Execute complete flow
          const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
            tabData.id,
            tabResolutionService,
            credentialRetrievalService,
            tenantConfigFactory,
            { environment: originalCredentials.environment }
          );

          // Assert: Data integrity is maintained
          expect(serviceConfig.credentials.consumerKey).toBe(originalCredentials.consumerKey);
          expect(serviceConfig.credentials.consumerSecret).toBe(originalCredentials.consumerSecret);
          expect(serviceConfig.credentials.businessShortCode).toBe(originalCredentials.businessShortCode);
          expect(serviceConfig.credentials.passkey).toBe(originalCredentials.passkey);
          expect(serviceConfig.credentials.callbackUrl).toBe(originalCredentials.callbackUrl);
          expect(serviceConfig.credentials.timeoutUrl).toBe(originalCredentials.timeoutUrl);

          // Verify encrypted data was different from plaintext
          expect(encryptedCredentials.consumer_key_enc.toString()).not.toBe(originalCredentials.consumerKey);
          expect(encryptedCredentials.consumer_secret_enc.toString()).not.toBe(originalCredentials.consumerSecret);
          expect(encryptedCredentials.passkey_enc.toString()).not.toBe(originalCredentials.passkey);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: Flow should fail gracefully for invalid inputs
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   * 
   * The complete credential resolution flow should fail gracefully and provide
   * appropriate error messages for various invalid input scenarios.
   */
  it('Property 1.3: Should fail gracefully for invalid tabs, tenants, or credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Invalid tab scenarios
          fc.record({
            type: fc.constant('invalid_tab'),
            tabId: fc.uuid(),
            error: fc.constantFrom('TAB_NOT_FOUND', 'ORPHANED_TAB', 'INVALID_TAB_STATUS', 'INACTIVE_BAR')
          }),
          // Invalid credential scenarios
          fc.record({
            type: fc.constant('invalid_credentials'),
            tabId: fc.uuid(),
            tabData: validTabDataArbitrary,
            error: fc.constantFrom('CREDENTIALS_NOT_FOUND', 'CREDENTIALS_INACTIVE', 'CREDENTIALS_INCOMPLETE', 'DECRYPTION_ERROR')
          })
        ),
        async (scenario) => {
          if (scenario.type === 'invalid_tab') {
            // Mock tab resolution failure
            switch (scenario.error) {
              case 'TAB_NOT_FOUND':
                mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'No rows returned' } });
                break;
              case 'ORPHANED_TAB':
                mockSupabase.single.mockResolvedValueOnce({
                  data: { ...fc.sample(validTabDataArbitrary, 1)[0], bar_id: null, bars: null },
                  error: null
                });
                break;
              case 'INVALID_TAB_STATUS':
                mockSupabase.single.mockResolvedValueOnce({
                  data: { ...fc.sample(validTabDataArbitrary, 1)[0], status: 'closed' },
                  error: null
                });
                break;
              case 'INACTIVE_BAR':
                const tabData = fc.sample(validTabDataArbitrary, 1)[0];
                mockSupabase.single.mockResolvedValueOnce({
                  data: { ...tabData, bars: { ...tabData.bars, active: false } },
                  error: null
                });
                break;
            }

            // Act & Assert
            await expect(
              ServiceFactory.createServiceConfigFromTab(
                scenario.tabId,
                tabResolutionService,
                credentialRetrievalService,
                tenantConfigFactory
              )
            ).rejects.toThrow(MpesaError);

          } else if (scenario.type === 'invalid_credentials') {
            // Mock successful tab resolution
            mockSupabase.single.mockResolvedValueOnce({
              data: scenario.tabData,
              error: null
            });

            // Mock credential retrieval failure
            switch (scenario.error) {
              case 'CREDENTIALS_NOT_FOUND':
                mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
                break;
              case 'CREDENTIALS_INACTIVE':
                mockSupabase.maybeSingle.mockResolvedValueOnce({
                  data: { ...fc.sample(validEncryptedCredentialArbitrary, 1)[0], is_active: false },
                  error: null
                });
                break;
              case 'CREDENTIALS_INCOMPLETE':
                mockSupabase.maybeSingle.mockResolvedValueOnce({
                  data: { ...fc.sample(validEncryptedCredentialArbitrary, 1)[0], consumer_key_enc: null },
                  error: null
                });
                break;
              case 'DECRYPTION_ERROR':
                mockSupabase.maybeSingle.mockResolvedValueOnce({
                  data: { ...fc.sample(validEncryptedCredentialArbitrary, 1)[0], consumer_key_enc: Buffer.from('invalid') },
                  error: null
                });
                break;
            }

            // Act & Assert
            await expect(
              ServiceFactory.createServiceConfigFromTab(
                scenario.tabId,
                tabResolutionService,
                credentialRetrievalService,
                tenantConfigFactory
              )
            ).rejects.toThrow(MpesaError);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.4: Flow should work with configuration overrides
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   * 
   * The complete credential resolution flow should properly apply configuration
   * overrides while maintaining the core tenant-specific credential resolution.
   */
  it('Property 1.4: Should apply configuration overrides while maintaining tenant credential resolution', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTabDataArbitrary,
        validCredentialsArbitrary,
        fc.record({
          timeoutMs: fc.integer({ min: 5000, max: 120000 }),
          retryAttempts: fc.integer({ min: 0, max: 10 }),
          rateLimitPerMinute: fc.integer({ min: 10, max: 1000 })
        }),
        async (tabData, credentials, overrides) => {
          // Mock tab resolution
          mockSupabase.single.mockResolvedValueOnce({
            data: tabData,
            error: null
          });

          // Mock credential retrieval
          const encryptedCredentials = {
            id: fc.sample(fc.uuid(), 1)[0],
            tenant_id: tabData.bar_id,
            environment: credentials.environment,
            consumer_key_enc: encryptCredential(credentials.consumerKey),
            consumer_secret_enc: encryptCredential(credentials.consumerSecret),
            business_shortcode: credentials.businessShortCode,
            passkey_enc: encryptCredential(credentials.passkey),
            callback_url: credentials.callbackUrl,
            timeout_url: credentials.timeoutUrl,
            is_active: true,
            created_at: credentials.encryptedAt.toISOString(),
            updated_at: (credentials.lastValidated || credentials.encryptedAt).toISOString()
          };

          mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: encryptedCredentials,
            error: null
          });

          // Act: Execute flow with overrides
          const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
            tabData.id,
            tabResolutionService,
            credentialRetrievalService,
            tenantConfigFactory,
            overrides
          );

          // Assert: Overrides are applied
          expect(serviceConfig.timeoutMs).toBe(overrides.timeoutMs);
          expect(serviceConfig.retryAttempts).toBe(overrides.retryAttempts);
          expect(serviceConfig.rateLimitPerMinute).toBe(overrides.rateLimitPerMinute);

          // Assert: Tenant credentials are still resolved correctly
          expect(serviceConfig.credentials.consumerKey).toBe(credentials.consumerKey);
          expect(serviceConfig.credentials.consumerSecret).toBe(credentials.consumerSecret);
          expect(serviceConfig.credentials.businessShortCode).toBe(credentials.businessShortCode);
          expect(serviceConfig.credentials.passkey).toBe(credentials.passkey);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.5: Flow should not access environment variables for tenant credentials
   * **Validates: Requirements 1.5**
   * 
   * The complete credential resolution flow should never access environment variables
   * for tenant-specific M-Pesa credentials, ensuring proper multi-tenancy.
   */
  it('Property 1.5: Should never use environment variables for tenant-specific credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTabDataArbitrary,
        validCredentialsArbitrary,
        async (tabData, credentials) => {
          // Set environment variables that should NOT be used
          const originalEnvVars = {
            MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
            MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
            MPESA_BUSINESS_SHORTCODE: process.env.MPESA_BUSINESS_SHORTCODE,
            MPESA_PASSKEY: process.env.MPESA_PASSKEY,
            MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL
          };

          // Set different values in environment variables
          process.env.MPESA_CONSUMER_KEY = 'env-consumer-key';
          process.env.MPESA_CONSUMER_SECRET = 'env-consumer-secret';
          process.env.MPESA_BUSINESS_SHORTCODE = '999999';
          process.env.MPESA_PASSKEY = 'env-passkey';
          process.env.MPESA_CALLBACK_URL = 'https://env.example.com/callback';

          try {
            // Mock tab resolution
            mockSupabase.single.mockResolvedValueOnce({
              data: tabData,
              error: null
            });

            // Mock credential retrieval
            const encryptedCredentials = {
              id: fc.sample(fc.uuid(), 1)[0],
              tenant_id: tabData.bar_id,
              environment: credentials.environment,
              consumer_key_enc: encryptCredential(credentials.consumerKey),
              consumer_secret_enc: encryptCredential(credentials.consumerSecret),
              business_shortcode: credentials.businessShortCode,
              passkey_enc: encryptCredential(credentials.passkey),
              callback_url: credentials.callbackUrl,
              timeout_url: credentials.timeoutUrl,
              is_active: true,
              created_at: credentials.encryptedAt.toISOString(),
              updated_at: (credentials.lastValidated || credentials.encryptedAt).toISOString()
            };

            mockSupabase.maybeSingle.mockResolvedValueOnce({
              data: encryptedCredentials,
              error: null
            });

            // Act: Execute complete flow
            const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
              tabData.id,
              tabResolutionService,
              credentialRetrievalService,
              tenantConfigFactory,
              { environment: credentials.environment }
            );

            // Assert: Environment variables are NOT used for tenant credentials
            expect(serviceConfig.credentials.consumerKey).not.toBe(process.env.MPESA_CONSUMER_KEY);
            expect(serviceConfig.credentials.consumerSecret).not.toBe(process.env.MPESA_CONSUMER_SECRET);
            expect(serviceConfig.credentials.businessShortCode).not.toBe(process.env.MPESA_BUSINESS_SHORTCODE);
            expect(serviceConfig.credentials.passkey).not.toBe(process.env.MPESA_PASSKEY);
            expect(serviceConfig.credentials.callbackUrl).not.toBe(process.env.MPESA_CALLBACK_URL);

            // Assert: Database credentials are used instead
            expect(serviceConfig.credentials.consumerKey).toBe(credentials.consumerKey);
            expect(serviceConfig.credentials.consumerSecret).toBe(credentials.consumerSecret);
            expect(serviceConfig.credentials.businessShortCode).toBe(credentials.businessShortCode);
            expect(serviceConfig.credentials.passkey).toBe(credentials.passkey);
            expect(serviceConfig.credentials.callbackUrl).toBe(credentials.callbackUrl);

          } finally {
            // Restore original environment variables
            for (const [key, value] of Object.entries(originalEnvVars)) {
              if (value !== undefined) {
                process.env[key] = value;
              } else {
                delete process.env[key];
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});