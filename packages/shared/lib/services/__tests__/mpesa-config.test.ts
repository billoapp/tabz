/**
 * Unit tests for M-Pesa Configuration Loader
 * Tests environment variable loading and validation
 */

import { loadMpesaConfig, isMpesaConfigured, MpesaConfigurationError } from '../mpesa-config';

describe('M-Pesa Configuration Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadMpesaConfig', () => {
    it('should load valid sandbox configuration', () => {
      // Set up valid sandbox environment variables
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      const config = loadMpesaConfig();

      expect(config).toEqual({
        environment: 'sandbox',
        consumerKey: 'test_consumer_key_123',
        consumerSecret: 'test_consumer_secret_123',
        businessShortcode: '174379',
        passkey: 'test_passkey_123456',
        callbackUrl: 'https://example.com/callback',
        oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      });
    });

    it('should load valid production configuration', () => {
      // Set up valid production environment variables
      process.env.MPESA_ENVIRONMENT = 'production';
      process.env.MPESA_CONSUMER_KEY = 'prod_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'prod_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '123456';
      process.env.MPESA_PASSKEY = 'prod_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://myapp.com/api/mpesa/callback';

      const config = loadMpesaConfig();

      expect(config).toEqual({
        environment: 'production',
        consumerKey: 'prod_consumer_key_123',
        consumerSecret: 'prod_consumer_secret_123',
        businessShortcode: '123456',
        passkey: 'prod_passkey_123456',
        callbackUrl: 'https://myapp.com/api/mpesa/callback',
        oauthUrl: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPushUrl: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      });
    });

    it('should throw clear error for missing environment variable', () => {
      // Missing MPESA_ENVIRONMENT
      process.env.MPESA_CONSUMER_KEY = 'test_key';
      process.env.MPESA_CONSUMER_SECRET = 'test_secret';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'Missing required environment variable: MPESA_ENVIRONMENT'
      );
    });

    it('should throw clear error for multiple missing variables', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      // Missing MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'Missing required M-Pesa environment variables: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_BUSINESS_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL'
      );
    });

    it('should throw error for invalid environment value', () => {
      process.env.MPESA_ENVIRONMENT = 'invalid';
      process.env.MPESA_CONSUMER_KEY = 'test_key';
      process.env.MPESA_CONSUMER_SECRET = 'test_secret';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'Invalid MPESA_ENVIRONMENT: "invalid". Must be "sandbox" or "production"'
      );
    });

    it('should validate business shortcode format', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '123'; // Too short
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'MPESA_BUSINESS_SHORTCODE must be 5-7 digits'
      );
    });

    it('should validate consumer key length', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      process.env.MPESA_CONSUMER_KEY = 'short'; // Too short
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'MPESA_CONSUMER_KEY must be at least 10 characters'
      );
    });

    it('should validate callback URL format', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'invalid-url';

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'MPESA_CALLBACK_URL must be a valid URL'
      );
    });

    it('should require HTTPS callback URL in production', () => {
      process.env.MPESA_ENVIRONMENT = 'production';
      process.env.MPESA_CONSUMER_KEY = 'prod_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'prod_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '123456';
      process.env.MPESA_PASSKEY = 'prod_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'http://example.com/callback'; // HTTP not HTTPS

      expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
      expect(() => loadMpesaConfig()).toThrow(
        'MPESA_CALLBACK_URL must use HTTPS in production environment'
      );
    });

    it('should allow HTTP callback URL in sandbox', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'http://localhost:3000/callback';

      expect(() => loadMpesaConfig()).not.toThrow();
    });

    it('should validate environment-URL consistency', () => {
      // This test ensures production environment uses production URLs
      process.env.MPESA_ENVIRONMENT = 'production';
      process.env.MPESA_CONSUMER_KEY = 'prod_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'prod_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '123456';
      process.env.MPESA_PASSKEY = 'prod_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://myapp.com/callback';

      const config = loadMpesaConfig();
      
      expect(config.oauthUrl).toContain('api.safaricom.co.ke');
      expect(config.oauthUrl).not.toContain('sandbox');
    });
  });

  describe('isMpesaConfigured', () => {
    it('should return true when all required variables are present', () => {
      process.env.MPESA_ENVIRONMENT = 'sandbox';
      process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      expect(isMpesaConfigured()).toBe(true);
    });

    it('should return false when required variables are missing', () => {
      // No environment variables set
      expect(isMpesaConfigured()).toBe(false);
    });

    it('should return false when configuration is invalid', () => {
      process.env.MPESA_ENVIRONMENT = 'invalid';
      process.env.MPESA_CONSUMER_KEY = 'test_key';
      process.env.MPESA_CONSUMER_SECRET = 'test_secret';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      expect(isMpesaConfigured()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle case-insensitive environment values', () => {
      process.env.MPESA_ENVIRONMENT = 'SANDBOX'; // Uppercase
      process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
      process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
      process.env.MPESA_BUSINESS_SHORTCODE = '174379';
      process.env.MPESA_PASSKEY = 'test_passkey_123456';
      process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

      const config = loadMpesaConfig();
      expect(config.environment).toBe('sandbox');
    });

    it('should validate business shortcode with exact digit requirements', () => {
      const testCases = [
        { shortcode: '1234', shouldFail: true }, // Too short (4 digits)
        { shortcode: '12345', shouldFail: false }, // Valid (5 digits)
        { shortcode: '123456', shouldFail: false }, // Valid (6 digits)
        { shortcode: '1234567', shouldFail: false }, // Valid (7 digits)
        { shortcode: '12345678', shouldFail: true }, // Too long (8 digits)
        { shortcode: '12345a', shouldFail: true }, // Contains non-digit
      ];

      testCases.forEach(({ shortcode, shouldFail }) => {
        process.env.MPESA_ENVIRONMENT = 'sandbox';
        process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
        process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
        process.env.MPESA_BUSINESS_SHORTCODE = shortcode;
        process.env.MPESA_PASSKEY = 'test_passkey_123456';
        process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

        if (shouldFail) {
          expect(() => loadMpesaConfig()).toThrow(MpesaConfigurationError);
        } else {
          expect(() => loadMpesaConfig()).not.toThrow();
        }
      });
    });
  });
});