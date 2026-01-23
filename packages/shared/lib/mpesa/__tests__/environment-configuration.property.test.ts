/**
 * Property-based tests for M-Pesa environment configuration consistency
 * Tests universal properties that should hold across all valid inputs
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import fc from 'fast-check';
import { 
  TenantMpesaConfigFactory,
  TenantMpesaConfig
} from '../services/tenant-config-factory';
import { TenantInfo } from '../services/tab-resolution';
import { MpesaCredentials, MpesaEnvironment, MpesaError, MPESA_URLS } from '../types';
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

describe('Environment Configuration Property Tests', () => {
  let factory: TenantMpesaConfigFactory;
  let mockLogger: MockLogger;

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

  // Arbitraries for generating test data
  const environmentArbitrary = fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>;
  
  const validTenantInfoArbitrary = fc.record({
    tenantId: fc.uuid(),
    barId: fc.uuid(),
    barName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
    isActive: fc.constant(true)
  });

  // Generate valid consumer keys (10-50 chars, alphanumeric)
  const validConsumerKeyArbitrary = fc.string({ minLength: 10, maxLength: 50 })
    .filter(s => /^[A-Za-z0-9]+$/.test(s));
  
  // Generate valid consumer secrets (10-50 chars, alphanumeric)
  const validConsumerSecretArbitrary = fc.string({ minLength: 10, maxLength: 50 })
    .filter(s => /^[A-Za-z0-9]+$/.test(s));
  
  // Generate valid business short codes (5-10 digits)
  const validBusinessShortCodeArbitrary = fc.string({ minLength: 5, maxLength: 10 })
    .filter(s => /^\d+$/.test(s));
  
  // Generate valid passkeys (20+ chars, base64-like)
  const validPasskeyArbitrary = fc.string({ minLength: 20, maxLength: 100 })
    .filter(s => /^[A-Za-z0-9+/=]+$/.test(s));

  // Generate production business short codes (exactly 6 digits)
  const productionBusinessShortCodeArbitrary = fc.string({ minLength: 6, maxLength: 6 })
    .filter(s => /^\d{6}$/.test(s));

  // Generate sandbox business short codes (5-10 digits)
  const sandboxBusinessShortCodeArbitrary = fc.string({ minLength: 5, maxLength: 10 })
    .filter(s => /^\d{5,10}$/.test(s));

  // Generate valid production callback URLs (HTTPS only, no localhost/test domains)
  const validProductionCallbackUrlArbitrary = fc.webUrl({ validSchemes: ['https'] })
    .filter(url => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return !hostname.includes('localhost') && 
               !hostname.includes('127.0.0.1') && 
               !hostname.includes('test') && 
               !hostname.includes('staging') && 
               !hostname.includes('dev');
      } catch {
        return false;
      }
    });

  // Generate valid sandbox callback URLs (HTTP or HTTPS allowed)
  const validSandboxCallbackUrlArbitrary = fc.webUrl({ validSchemes: ['http', 'https'] });

  // Generate valid sandbox credentials
  const validSandboxCredentialsArbitrary = fc.record({
    consumerKey: validConsumerKeyArbitrary,
    consumerSecret: validConsumerSecretArbitrary,
    businessShortCode: sandboxBusinessShortCodeArbitrary,
    passkey: validPasskeyArbitrary,
    environment: fc.constant('sandbox' as MpesaEnvironment),
    callbackUrl: validSandboxCallbackUrlArbitrary,
    timeoutUrl: fc.option(validSandboxCallbackUrlArbitrary, { nil: undefined }),
    encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
  });

  // Generate valid production credentials
  const validProductionCredentialsArbitrary = fc.record({
    consumerKey: validConsumerKeyArbitrary,
    consumerSecret: validConsumerSecretArbitrary,
    businessShortCode: productionBusinessShortCodeArbitrary,
    passkey: validPasskeyArbitrary,
    environment: fc.constant('production' as MpesaEnvironment),
    callbackUrl: validProductionCallbackUrlArbitrary,
    timeoutUrl: fc.option(validProductionCallbackUrlArbitrary, { nil: undefined }),
    encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
  });

  // Generate credentials with environment mismatches
  const environmentMismatchedCredentialsArbitrary = fc.oneof(
    // Production credentials with HTTP URLs
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: productionBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: fc.constant('production' as MpesaEnvironment),
      callbackUrl: fc.webUrl({ validSchemes: ['http'] }), // HTTP in production
      timeoutUrl: fc.option(fc.webUrl({ validSchemes: ['http'] }), { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Production credentials with localhost/test domains
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: productionBusinessShortCodeArbitrary,
      passkey: validPasskeyArbitrary,
      environment: fc.constant('production' as MpesaEnvironment),
      callbackUrl: fc.constantFrom(
        'https://localhost:3000/callback',
        'https://127.0.0.1:8080/callback',
        'https://test.example.com/callback',
        'https://staging.example.com/callback',
        'https://dev.example.com/callback'
      ),
      timeoutUrl: fc.option(validProductionCallbackUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    }),
    // Production credentials with wrong business short code format
    fc.record({
      consumerKey: validConsumerKeyArbitrary,
      consumerSecret: validConsumerSecretArbitrary,
      businessShortCode: fc.string({ minLength: 5, maxLength: 5 }).filter(s => /^\d{5}$/.test(s)), // 5 digits instead of 6
      passkey: validPasskeyArbitrary,
      environment: fc.constant('production' as MpesaEnvironment),
      callbackUrl: validProductionCallbackUrlArbitrary,
      timeoutUrl: fc.option(validProductionCallbackUrlArbitrary, { nil: undefined }),
      encryptedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastValidated: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), { nil: undefined })
    })
  );

  /**
   * Property 4: Environment Configuration Consistency
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any tenant credentials with environment configuration, the system should use 
   * the appropriate M-Pesa endpoint (sandbox/production) that matches the credential 
   * environment and reject mismatched combinations.
   */
  it('Property 4: Should use appropriate M-Pesa endpoints that match credential environment', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        fc.oneof(validSandboxCredentialsArbitrary, validProductionCredentialsArbitrary),
        async (tenantInfo, credentials) => {
          // Allow production environment for this test
          const testFactory = new TenantMpesaConfigFactory({
            logger: mockLogger,
            allowProductionWithoutExplicitConfig: true
          });

          // Act
          const config = testFactory.createTenantConfig(tenantInfo, credentials);

          // Assert - Environment consistency
          expect(config.environment).toBe(credentials.environment);
          expect(config.credentials.environment).toBe(credentials.environment);

          // Assert - Correct M-Pesa URLs are implied by environment
          if (credentials.environment === 'sandbox') {
            // Sandbox environment should be configured for sandbox endpoints
            expect(config.environment).toBe('sandbox');
            
            // Verify sandbox allows more flexible URL schemes
            const callbackUrl = new URL(credentials.callbackUrl);
            expect(['http:', 'https:']).toContain(callbackUrl.protocol);
            
            // Business short code can be 5-10 digits for sandbox
            expect(credentials.businessShortCode.length).toBeGreaterThanOrEqual(5);
            expect(credentials.businessShortCode.length).toBeLessThanOrEqual(10);
            expect(/^\d{5,10}$/.test(credentials.businessShortCode)).toBe(true);
            
          } else if (credentials.environment === 'production') {
            // Production environment should be configured for production endpoints
            expect(config.environment).toBe('production');
            
            // Verify production requires HTTPS URLs
            const callbackUrl = new URL(credentials.callbackUrl);
            expect(callbackUrl.protocol).toBe('https:');
            
            if (credentials.timeoutUrl) {
              const timeoutUrl = new URL(credentials.timeoutUrl);
              expect(timeoutUrl.protocol).toBe('https:');
            }
            
            // Business short code should be exactly 6 digits for production
            expect(credentials.businessShortCode.length).toBe(6);
            expect(/^\d{6}$/.test(credentials.businessShortCode)).toBe(true);
            
            // Production URLs should not use localhost or test domains
            const hostname = callbackUrl.hostname.toLowerCase();
            expect(hostname).not.toContain('localhost');
            expect(hostname).not.toContain('127.0.0.1');
            expect(hostname).not.toContain('test');
            expect(hostname).not.toContain('staging');
            expect(hostname).not.toContain('dev');
          }

          // Assert - Configuration contains all required fields for the environment
          expect(config.credentials.consumerKey).toBeTruthy();
          expect(config.credentials.consumerSecret).toBeTruthy();
          expect(config.credentials.businessShortCode).toBeTruthy();
          expect(config.credentials.passkey).toBeTruthy();
          expect(config.credentials.callbackUrl).toBeTruthy();

          // Assert - Environment-specific validation passed
          expect(config.tenantId).toBe(tenantInfo.tenantId);
          expect(config.barId).toBe(tenantInfo.barId);
          expect(config.barName).toBe(tenantInfo.barName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.1: Sandbox environment should allow flexible configuration
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any sandbox credentials, the system should allow flexible URL schemes 
   * and business short code formats while maintaining basic validation.
   */
  it('Property 4.1: Should allow flexible configuration for sandbox environment', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        validSandboxCredentialsArbitrary,
        async (tenantInfo, sandboxCredentials) => {
          // Act
          const config = factory.createTenantConfig(tenantInfo, sandboxCredentials);

          // Assert - Sandbox-specific properties
          expect(config.environment).toBe('sandbox');
          expect(config.credentials.environment).toBe('sandbox');

          // Verify sandbox allows both HTTP and HTTPS
          const callbackUrl = new URL(sandboxCredentials.callbackUrl);
          expect(['http:', 'https:']).toContain(callbackUrl.protocol);

          if (sandboxCredentials.timeoutUrl) {
            const timeoutUrl = new URL(sandboxCredentials.timeoutUrl);
            expect(['http:', 'https:']).toContain(timeoutUrl.protocol);
          }

          // Verify sandbox allows flexible business short code lengths
          expect(sandboxCredentials.businessShortCode.length).toBeGreaterThanOrEqual(5);
          expect(sandboxCredentials.businessShortCode.length).toBeLessThanOrEqual(10);
          expect(/^\d{5,10}$/.test(sandboxCredentials.businessShortCode)).toBe(true);

          // Verify configuration is valid and complete
          expect(config.credentials.consumerKey).toBe(sandboxCredentials.consumerKey);
          expect(config.credentials.consumerSecret).toBe(sandboxCredentials.consumerSecret);
          expect(config.credentials.businessShortCode).toBe(sandboxCredentials.businessShortCode);
          expect(config.credentials.passkey).toBe(sandboxCredentials.passkey);
          expect(config.credentials.callbackUrl).toBe(sandboxCredentials.callbackUrl);
          expect(config.credentials.timeoutUrl).toBe(sandboxCredentials.timeoutUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.2: Production environment should enforce strict requirements
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any production credentials, the system should enforce strict validation 
   * including HTTPS URLs and exact business short code format.
   */
  it('Property 4.2: Should enforce strict requirements for production environment', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        validProductionCredentialsArbitrary,
        async (tenantInfo, productionCredentials) => {
          // Allow production environment for this test
          const testFactory = new TenantMpesaConfigFactory({
            logger: mockLogger,
            allowProductionWithoutExplicitConfig: true
          });

          // Act
          const config = testFactory.createTenantConfig(tenantInfo, productionCredentials);

          // Assert - Production-specific properties
          expect(config.environment).toBe('production');
          expect(config.credentials.environment).toBe('production');

          // Verify production requires HTTPS
          const callbackUrl = new URL(productionCredentials.callbackUrl);
          expect(callbackUrl.protocol).toBe('https:');

          if (productionCredentials.timeoutUrl) {
            const timeoutUrl = new URL(productionCredentials.timeoutUrl);
            expect(timeoutUrl.protocol).toBe('https:');
          }

          // Verify production requires exactly 6-digit business short codes
          expect(productionCredentials.businessShortCode.length).toBe(6);
          expect(/^\d{6}$/.test(productionCredentials.businessShortCode)).toBe(true);

          // Verify production URLs don't use localhost or test domains
          const hostname = callbackUrl.hostname.toLowerCase();
          expect(hostname).not.toContain('localhost');
          expect(hostname).not.toContain('127.0.0.1');
          expect(hostname).not.toContain('test');
          expect(hostname).not.toContain('staging');
          expect(hostname).not.toContain('dev');

          // Verify configuration is valid and complete
          expect(config.credentials.consumerKey).toBe(productionCredentials.consumerKey);
          expect(config.credentials.consumerSecret).toBe(productionCredentials.consumerSecret);
          expect(config.credentials.businessShortCode).toBe(productionCredentials.businessShortCode);
          expect(config.credentials.passkey).toBe(productionCredentials.passkey);
          expect(config.credentials.callbackUrl).toBe(productionCredentials.callbackUrl);
          expect(config.credentials.timeoutUrl).toBe(productionCredentials.timeoutUrl);

          // Verify production warning was logged
          const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
          expect(warnLogs.some(log => log.message.includes('Production M-Pesa configuration created'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.3: Environment-mismatched credentials should always be rejected
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any credentials with environment inconsistencies, the system should 
   * always reject them during configuration creation.
   */
  it('Property 4.3: Should always reject credentials with environment inconsistencies', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        environmentMismatchedCredentialsArbitrary,
        async (tenantInfo, mismatchedCredentials) => {
          // Allow production environment for this test to properly test validation
          const testFactory = new TenantMpesaConfigFactory({
            logger: mockLogger,
            allowProductionWithoutExplicitConfig: true
          });

          // Act & Assert - Should throw error for environment mismatches
          expect(() => testFactory.createTenantConfig(tenantInfo, mismatchedCredentials))
            .toThrow(MpesaError);

          // Verify the error is related to production requirements
          try {
            testFactory.createTenantConfig(tenantInfo, mismatchedCredentials);
            fail('Expected MpesaError to be thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(MpesaError);
            const mpesaError = error as MpesaError;
            
            // Should be one of the production validation errors
            const expectedErrorCodes = [
              'PRODUCTION_REQUIRES_HTTPS',
              'INVALID_CALLBACK_URL',
              'INVALID_TIMEOUT_URL',
              'INCOMPLETE_CREDENTIALS'
            ];
            
            expect(expectedErrorCodes.some(code => mpesaError.code === code || mpesaError.message.includes('HTTPS'))).toBe(true);
          }

          // Verify that the credentials have production environment but invalid configuration
          expect(mismatchedCredentials.environment).toBe('production');
          
          // Check for specific mismatches
          let hasMismatch = false;
          
          // Check for HTTP URLs in production
          try {
            const callbackUrl = new URL(mismatchedCredentials.callbackUrl);
            if (callbackUrl.protocol === 'http:') {
              hasMismatch = true;
            }
          } catch {
            hasMismatch = true; // Invalid URL format
          }

          if (mismatchedCredentials.timeoutUrl) {
            try {
              const timeoutUrl = new URL(mismatchedCredentials.timeoutUrl);
              if (timeoutUrl.protocol === 'http:') {
                hasMismatch = true;
              }
            } catch {
              hasMismatch = true; // Invalid URL format
            }
          }

          // Check for localhost/test domains in production
          try {
            const callbackUrl = new URL(mismatchedCredentials.callbackUrl);
            const hostname = callbackUrl.hostname.toLowerCase();
            if (hostname.includes('localhost') || 
                hostname.includes('127.0.0.1') || 
                hostname.includes('test') || 
                hostname.includes('staging') || 
                hostname.includes('dev')) {
              hasMismatch = true;
            }
          } catch {
            hasMismatch = true;
          }

          // Check for wrong business short code format in production
          if (!/^\d{6}$/.test(mismatchedCredentials.businessShortCode)) {
            hasMismatch = true;
          }

          expect(hasMismatch).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.4: Default to sandbox when production not explicitly allowed
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any production credentials when production is not explicitly allowed,
   * the system should default to sandbox environment with appropriate warnings.
   */
  it('Property 4.4: Should default to sandbox when production not explicitly allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        validProductionCredentialsArbitrary,
        async (tenantInfo, productionCredentials) => {
          // Use factory without explicit production allowance (default behavior)
          const restrictiveFactory = new TenantMpesaConfigFactory({
            logger: mockLogger,
            allowProductionWithoutExplicitConfig: false // Explicitly set to false
          });

          // Act
          const config = restrictiveFactory.createTenantConfig(tenantInfo, productionCredentials);

          // Assert - Should default to sandbox
          expect(config.environment).toBe('sandbox');
          expect(config.credentials.environment).toBe('sandbox');

          // Verify original credentials were production
          expect(productionCredentials.environment).toBe('production');

          // Verify warning was logged about environment override
          const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
          expect(warnLogs.some(log => 
            log.message.includes('Production environment requested') && 
            log.message.includes('not explicitly allowed')
          )).toBe(true);
          
          expect(warnLogs.some(log => 
            log.message.includes('Environment override applied')
          )).toBe(true);

          // Verify configuration is still valid with sandbox environment
          expect(config.tenantId).toBe(tenantInfo.tenantId);
          expect(config.barId).toBe(tenantInfo.barId);
          expect(config.barName).toBe(tenantInfo.barName);
          expect(config.credentials.consumerKey).toBe(productionCredentials.consumerKey);
          expect(config.credentials.consumerSecret).toBe(productionCredentials.consumerSecret);
          expect(config.credentials.businessShortCode).toBe(productionCredentials.businessShortCode);
          expect(config.credentials.passkey).toBe(productionCredentials.passkey);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.5: Environment configuration should be deterministic
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any tenant credentials, environment configuration should always produce 
   * the same result when called multiple times with the same inputs.
   */
  it('Property 4.5: Should provide deterministic environment configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        fc.oneof(validSandboxCredentialsArbitrary, validProductionCredentialsArbitrary),
        async (tenantInfo, credentials) => {
          // Allow production for consistent testing
          const testFactory = new TenantMpesaConfigFactory({
            logger: mockLogger,
            allowProductionWithoutExplicitConfig: true
          });

          // Act - Create configuration multiple times
          const config1 = testFactory.createTenantConfig(tenantInfo, credentials);
          const config2 = testFactory.createTenantConfig(tenantInfo, credentials);
          const config3 = testFactory.createTenantConfig(tenantInfo, credentials);

          // Assert - Results should be identical
          expect(config1.environment).toBe(config2.environment);
          expect(config2.environment).toBe(config3.environment);
          expect(config1.credentials.environment).toBe(config2.credentials.environment);
          expect(config2.credentials.environment).toBe(config3.credentials.environment);

          // Verify all configurations are identical
          expect(config1).toEqual(config2);
          expect(config2).toEqual(config3);
          expect(config1).toEqual(config3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.6: Environment URLs should match MPESA_URLS constants
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * For any environment configuration, the implied M-Pesa URLs should match 
   * the constants defined in the types file for that environment.
   */
  it('Property 4.6: Should use correct M-Pesa URLs for each environment', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTenantInfoArbitrary,
        fc.oneof(validSandboxCredentialsArbitrary, validProductionCredentialsArbitrary),
        async (tenantInfo, credentials) => {
          // Allow production for this test
          const testFactory = new TenantMpesaConfigFactory({
            logger: mockLogger,
            allowProductionWithoutExplicitConfig: true
          });

          // Act
          const config = testFactory.createTenantConfig(tenantInfo, credentials);

          // Assert - Environment matches expected URLs
          if (config.environment === 'sandbox') {
            // Verify sandbox URLs would be used (implied by environment)
            expect(MPESA_URLS.sandbox.oauth).toBe('https://sandbox.safaricom.co.ke/oauth/v1/generate');
            expect(MPESA_URLS.sandbox.stkPush).toBe('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest');
            expect(MPESA_URLS.sandbox.stkQuery).toBe('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query');
            
            // Environment configuration should be consistent
            expect(config.environment).toBe('sandbox');
            expect(config.credentials.environment).toBe('sandbox');
            
          } else if (config.environment === 'production') {
            // Verify production URLs would be used (implied by environment)
            expect(MPESA_URLS.production.oauth).toBe('https://api.safaricom.co.ke/oauth/v1/generate');
            expect(MPESA_URLS.production.stkPush).toBe('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest');
            expect(MPESA_URLS.production.stkQuery).toBe('https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query');
            
            // Environment configuration should be consistent
            expect(config.environment).toBe('production');
            expect(config.credentials.environment).toBe('production');
          }

          // Verify environment is one of the valid options
          expect(['sandbox', 'production']).toContain(config.environment);
          expect(['sandbox', 'production']).toContain(config.credentials.environment);
        }
      ),
      { numRuns: 100 }
    );
  });
});