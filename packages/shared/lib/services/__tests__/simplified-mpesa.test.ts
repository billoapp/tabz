/**
 * Simple tests for the NEW simplified M-Pesa system
 * Tests the core functionality without over-engineering
 */

import { validateKenyanPhoneNumber } from '../phoneValidation';
import { loadMpesaConfig, isMpesaConfigured } from '../mpesa-config';
import { getOAuthToken } from '../mpesa-oauth';
import { sendSTKPush } from '../mpesa-stk-push';

// Mock fetch for OAuth and STK Push tests
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Simplified M-Pesa System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockFetch.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * Test 1: Phone number validation works correctly
   */
  test('1. Phone validation normalizes Kenyan numbers correctly', () => {
    // Test various input formats
    expect(validateKenyanPhoneNumber('254712345678').isValid).toBe(true);
    expect(validateKenyanPhoneNumber('0712345678').normalized).toBe('254712345678');
    expect(validateKenyanPhoneNumber('712345678').normalized).toBe('254712345678');
    expect(validateKenyanPhoneNumber('+254-712-345-678').normalized).toBe('254712345678');
    
    // Test invalid numbers
    expect(validateKenyanPhoneNumber('255712345678').isValid).toBe(false); // Wrong country code
    expect(validateKenyanPhoneNumber('254612345678').isValid).toBe(false); // Invalid prefix
    expect(validateKenyanPhoneNumber('').isValid).toBe(false); // Empty
  });

  /**
   * Test 2: M-Pesa configuration loads from environment variables
   */
  test('2. M-Pesa config loads from environment variables', () => {
    // Set up valid environment
    process.env.MPESA_ENVIRONMENT = 'sandbox';
    process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
    process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
    process.env.MPESA_BUSINESS_SHORTCODE = '174379';
    process.env.MPESA_PASSKEY = 'test_passkey_123456';
    process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

    const config = loadMpesaConfig();
    
    expect(config.environment).toBe('sandbox');
    expect(config.consumerKey).toBe('test_consumer_key_123');
    expect(config.businessShortcode).toBe('174379');
    expect(config.oauthUrl).toContain('sandbox.safaricom.co.ke');
    expect(isMpesaConfigured()).toBe(true);
  });

  /**
   * Test 3: OAuth token service gets tokens from Safaricom
   */
  test('3. OAuth service gets access tokens', async () => {
    // Set up environment
    process.env.MPESA_ENVIRONMENT = 'sandbox';
    process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
    process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
    process.env.MPESA_BUSINESS_SHORTCODE = '174379';
    process.env.MPESA_PASSKEY = 'test_passkey_123456';
    process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

    // Mock successful OAuth response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test_access_token_123',
        expires_in: '3600',
      }),
    } as Response);

    const token = await getOAuthToken({
      environment: 'sandbox',
      consumerKey: 'test_consumer_key_123',
      consumerSecret: 'test_consumer_secret_123',
      businessShortcode: '174379',
      passkey: 'test_passkey_123456',
      callbackUrl: 'https://example.com/callback',
      oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    });
    
    expect(token).toBe('test_access_token_123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sandbox.safaricom.co.ke/oauth'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Basic '),
        }),
      })
    );
  });

  /**
   * Test 4: STK Push service sends payment requests
   */
  test('4. STK Push sends payment requests to Safaricom', async () => {
    // Clear token cache to ensure fresh OAuth request
    jest.resetModules();
    const { clearTokenCache } = require('../mpesa-oauth');
    const { sendSTKPush: freshSendSTKPush } = require('../mpesa-stk-push');
    clearTokenCache();
    
    // Set up environment
    process.env.MPESA_ENVIRONMENT = 'sandbox';
    process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
    process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
    process.env.MPESA_BUSINESS_SHORTCODE = '174379';
    process.env.MPESA_PASSKEY = 'test_passkey_123456';
    process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

    // Clear previous mocks
    mockFetch.mockClear();

    // Mock OAuth response (first call)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test_token_123456',
        expires_in: '3600',
      }),
    } as Response);

    // Mock STK Push response (second call)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        MerchantRequestID: 'merchant123',
        CheckoutRequestID: 'checkout123',
      }),
    } as Response);

    const result = await freshSendSTKPush({
      phoneNumber: '254712345678',
      amount: 100,
      accountReference: 'TAB123',
      transactionDesc: 'Tab Payment',
    }, {
      environment: 'sandbox',
      consumerKey: 'test_consumer_key_123',
      consumerSecret: 'test_consumer_secret_123',
      businessShortcode: '174379',
      passkey: 'test_passkey_123456',
      callbackUrl: 'https://example.com/callback',
      oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    });

    expect(result.ResponseCode).toBe('0');
    expect(result.CheckoutRequestID).toBe('checkout123');
    expect(mockFetch).toHaveBeenCalledTimes(2); // OAuth + STK Push
  });

  /**
   * Test 5: System handles errors gracefully
   */
  test('5. System handles errors gracefully', async () => {
    // Test missing environment variables
    delete process.env.MPESA_ENVIRONMENT;
    expect(() => loadMpesaConfig()).toThrow('Missing required environment variable');
    expect(isMpesaConfigured()).toBe(false);

    // Test invalid phone numbers
    const phoneResult = validateKenyanPhoneNumber('invalid');
    expect(phoneResult.isValid).toBe(false);
    expect(phoneResult.error).toContain('254');

    // Test OAuth failure - clear cache and set up fresh environment
    const { clearTokenCache } = require('../mpesa-oauth');
    clearTokenCache();
    
    // Set up fresh environment for OAuth test
    process.env = { ...originalEnv };
    process.env.MPESA_ENVIRONMENT = 'sandbox';
    process.env.MPESA_CONSUMER_KEY = 'test_consumer_key_123';
    process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret_123';
    process.env.MPESA_BUSINESS_SHORTCODE = '174379';
    process.env.MPESA_PASSKEY = 'test_passkey_123456';
    process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';

    // Clear any previous mocks and set up failure response
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // Missing required fields to trigger "Invalid token response format" error
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      }),
    } as Response);

    // Re-import the module to get fresh instance after clearing cache
    jest.resetModules();
    const { getOAuthToken: freshGetOAuthToken } = require('../mpesa-oauth');
    
    await expect(freshGetOAuthToken({
      environment: 'sandbox',
      consumerKey: 'test_consumer_key_123',
      consumerSecret: 'test_consumer_secret_123',
      businessShortcode: '174379',
      passkey: 'test_passkey_123456',
      callbackUrl: 'https://example.com/callback',
      oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    })).rejects.toThrow('Invalid token response format');
  });
});