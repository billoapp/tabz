/**
 * Property-based tests for M-PESA environment configuration
 * Feature: mpesa-payment-integration, Property 4: Environment Configuration Consistency
 * 
 * Tests that environment configuration maintains consistency across all operations
 * and properly validates environment-specific settings.
 */

import * as fc from 'fast-check';
import { 
  EnvironmentConfigManager, 
  MpesaEnvironment, 
  MpesaCredentials, 
  MPESA_URLS,
  MpesaValidationError 
} from '../index';

describe('Environment Configuration Consistency Properties', () => {
  let configManager: EnvironmentConfigManager;

  beforeEach(() => {
    // Get fresh instance and reset for each test
    configManager = EnvironmentConfigManager.getInstance();
    configManager.reset();
  });

  afterEach(() => {
    // Clean up after each test
    configManager.reset();
  });

  // Property 4: Environment Configuration Consistency
  // For any environment setting (sandbox or production), the system should use 
  // the corresponding URLs, credentials, and validation rules consistently 
  // throughout the payment flow
  describe('Property 4: Environment Configuration Consistency', () => {
    
    it('should maintain URL consistency for any valid environment configuration', () => {
      fc.assert(
        fc.property(
          // Generate valid environment configurations
          fc.record({
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            businessShortCode: fc.oneof(
              fc.stringMatching(/^[1-4][0-9]{4,6}$/), // PayBill shortcodes (start with 1-4)
              fc.constant('174379'), // Known valid PayBill
              fc.constant('400200'), // Known valid PayBill
              fc.constant('123456')  // Known valid PayBill
            ),
            consumerKey: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/), // Alphanumeric only
            consumerSecret: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/), // Alphanumeric only
            passkey: fc.stringMatching(/^[A-Za-z0-9]{20,100}$/), // Alphanumeric only
            callbackUrl: fc.constantFrom(
              'https://api.example.com/callback',
              'https://secure.example.com/mpesa/callback',
              'https://app.example.com/payments/mpesa/callback'
            )
          }),
          (configData) => {
            // Create valid credentials
            const credentials: MpesaCredentials = {
              consumerKey: configData.consumerKey,
              consumerSecret: configData.consumerSecret,
              businessShortCode: configData.businessShortCode,
              passkey: configData.passkey,
              environment: configData.environment,
              callbackUrl: configData.callbackUrl,
              encryptedAt: new Date()
            };

            // Set environment configuration
            configManager.setEnvironmentConfig(configData.environment, credentials);

            // Get configuration
            const config = configManager.getCurrentConfig();

            // Verify URL consistency
            const expectedUrls = MPESA_URLS[configData.environment];
            expect(config.urls).toEqual(expectedUrls);
            expect(config.environment).toBe(configData.environment);
            expect(config.isProduction).toBe(configData.environment === 'production');

            // Verify credentials consistency
            expect(config.credentials.environment).toBe(configData.environment);
            expect(config.credentials.consumerKey).toBe(configData.consumerKey);
            expect(config.credentials.consumerSecret).toBe(configData.consumerSecret);
            expect(config.credentials.businessShortCode).toBe(configData.businessShortCode);
            expect(config.credentials.passkey).toBe(configData.passkey);
            expect(config.credentials.callbackUrl).toBe(configData.callbackUrl);

            // Verify validation rules consistency
            if (configData.environment === 'sandbox') {
              expect(config.validationRules.maxAmount).toBe(1000);
              expect(config.validationRules.minAmount).toBe(1);
              expect(config.validationRules.allowedPhoneNumbers).toBeDefined();
            } else {
              expect(config.validationRules.maxAmount).toBe(70000);
              expect(config.validationRules.minAmount).toBe(1);
              expect(config.validationRules.allowedPhoneNumbers).toBeUndefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should consistently reject invalid environment configurations', () => {
      fc.assert(
        fc.property(
          // Generate invalid configurations
          fc.record({
            environment: fc.constantFrom('sandbox' as const, 'production' as const),
            businessShortCode: fc.oneof(
              fc.string({ maxLength: 4 }), // Too short
              fc.string({ minLength: 8 }), // Too long
              fc.stringMatching(/^[a-zA-Z]+$/), // Non-numeric
              fc.constant('500000') // Till number pattern
            ),
            consumerKey: fc.oneof(
              fc.constant(''), // Empty
              fc.string({ maxLength: 9 }) // Too short
            ),
            consumerSecret: fc.oneof(
              fc.constant(''), // Empty
              fc.string({ maxLength: 9 }) // Too short
            ),
            passkey: fc.oneof(
              fc.constant(''), // Empty
              fc.string({ maxLength: 9 }) // Too short
            ),
            callbackUrl: fc.oneof(
              fc.constant(''), // Empty
              fc.constant('invalid-url'), // Invalid format
              fc.constant('http://insecure.com') // HTTP in production
            )
          }),
          (configData) => {
            const credentials: MpesaCredentials = {
              consumerKey: configData.consumerKey,
              consumerSecret: configData.consumerSecret,
              businessShortCode: configData.businessShortCode,
              passkey: configData.passkey,
              environment: configData.environment,
              callbackUrl: configData.callbackUrl,
              encryptedAt: new Date()
            };

            // Should throw validation error for invalid configurations
            expect(() => {
              configManager.setEnvironmentConfig(configData.environment, credentials);
            }).toThrow(MpesaValidationError);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain environment isolation when switching between environments', () => {
      fc.assert(
        fc.property(
          // Generate two different valid environment configurations
          fc.record({
            sandboxConfig: fc.record({
              businessShortCode: fc.oneof(
                fc.stringMatching(/^[1-4][0-9]{4,6}$/), // PayBill shortcodes
                fc.constant('174379'), // Known valid PayBill
                fc.constant('400200')  // Known valid PayBill
              ),
              consumerKey: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
              consumerSecret: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
              passkey: fc.stringMatching(/^[A-Za-z0-9]{20,100}$/),
              callbackUrl: fc.constant('https://sandbox.example.com/callback')
            }),
            productionConfig: fc.record({
              businessShortCode: fc.oneof(
                fc.stringMatching(/^[1-4][0-9]{4,6}$/), // PayBill shortcodes
                fc.constant('174379'), // Known valid PayBill
                fc.constant('400200')  // Known valid PayBill
              ),
              consumerKey: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
              consumerSecret: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
              passkey: fc.stringMatching(/^[A-Za-z0-9]{20,100}$/),
              callbackUrl: fc.constant('https://production.example.com/callback')
            })
          }),
          (configs) => {
            // Create sandbox credentials
            const sandboxCredentials: MpesaCredentials = {
              ...configs.sandboxConfig,
              environment: 'sandbox',
              encryptedAt: new Date()
            };

            // Create production credentials
            const productionCredentials: MpesaCredentials = {
              ...configs.productionConfig,
              environment: 'production',
              encryptedAt: new Date()
            };

            // Set up both environments
            configManager.setEnvironmentConfig('sandbox', sandboxCredentials);
            configManager.setEnvironmentConfig('production', productionCredentials);

            // Test sandbox configuration
            configManager.switchEnvironment('sandbox');
            const sandboxConfig = configManager.getCurrentConfig();
            expect(sandboxConfig.environment).toBe('sandbox');
            expect(sandboxConfig.urls).toEqual(MPESA_URLS.sandbox);
            expect(sandboxConfig.isProduction).toBe(false);
            expect(sandboxConfig.credentials.businessShortCode).toBe(configs.sandboxConfig.businessShortCode);

            // Test production configuration
            configManager.switchEnvironment('production');
            const productionConfig = configManager.getCurrentConfig();
            expect(productionConfig.environment).toBe('production');
            expect(productionConfig.urls).toEqual(MPESA_URLS.production);
            expect(productionConfig.isProduction).toBe(true);
            expect(productionConfig.credentials.businessShortCode).toBe(configs.productionConfig.businessShortCode);

            // Verify configurations remain isolated (only check if they're actually different)
            if (configs.sandboxConfig.businessShortCode !== configs.productionConfig.businessShortCode) {
              expect(sandboxConfig.credentials.businessShortCode).not.toBe(productionConfig.credentials.businessShortCode);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should consistently validate production-specific requirements', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessShortCode: fc.oneof(
              fc.stringMatching(/^[1-4][0-9]{4,6}$/), // PayBill shortcodes
              fc.constant('174379'), // Known valid PayBill
              fc.constant('400200')  // Known valid PayBill
            ),
            consumerKey: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
            consumerSecret: fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
            passkey: fc.stringMatching(/^[A-Za-z0-9]{20,100}$/),
            callbackUrl: fc.oneof(
              fc.constant('http://insecure.example.com/callback'), // HTTP - should fail
              fc.constant('https://secure.example.com/callback')   // HTTPS - should pass
            )
          }),
          (configData) => {
            const credentials: MpesaCredentials = {
              ...configData,
              environment: 'production',
              encryptedAt: new Date()
            };

            if (configData.callbackUrl.startsWith('http://')) {
              // Should fail for HTTP URLs in production
              expect(() => {
                configManager.setEnvironmentConfig('production', credentials);
              }).toThrow(MpesaValidationError);
            } else {
              // Should succeed for HTTPS URLs in production
              expect(() => {
                configManager.setEnvironmentConfig('production', credentials);
              }).not.toThrow();

              const config = configManager.getCurrentConfig();
              expect(config.environment).toBe('production');
              expect(config.isProduction).toBe(true);
              expect(config.validationRules.maxAmount).toBe(70000);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should maintain consistent validation rules across configuration operations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('sandbox' as const, 'production' as const),
          fc.oneof(
            fc.stringMatching(/^[1-4][0-9]{4,6}$/), // PayBill shortcodes
            fc.constant('174379'), // Known valid PayBill
            fc.constant('400200')  // Known valid PayBill
          ),
          fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
          fc.stringMatching(/^[A-Za-z0-9]{20,50}$/),
          fc.stringMatching(/^[A-Za-z0-9]{20,100}$/),
          (environment, businessShortCode, consumerKey, consumerSecret, passkey) => {
            const credentials: MpesaCredentials = {
              businessShortCode,
              consumerKey,
              consumerSecret,
              passkey,
              environment,
              callbackUrl: 'https://example.com/callback',
              encryptedAt: new Date()
            };

            configManager.setEnvironmentConfig(environment, credentials);
            const config = configManager.getCurrentConfig();

            // Validation rules should be consistent with environment
            if (environment === 'sandbox') {
              expect(config.validationRules.maxAmount).toBe(1000);
              expect(config.validationRules.minAmount).toBe(1);
              expect(config.validationRules.allowedPhoneNumbers).toEqual([
                '254708374149',
                '254711XXXXXX'
              ]);
            } else {
              expect(config.validationRules.maxAmount).toBe(70000);
              expect(config.validationRules.minAmount).toBe(1);
              expect(config.validationRules.allowedPhoneNumbers).toBeUndefined();
            }

            // URLs should be consistent with environment
            expect(config.urls).toEqual(MPESA_URLS[environment]);
            
            // Environment flags should be consistent
            expect(config.isProduction).toBe(environment === 'production');
            expect(config.environment).toBe(environment);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});