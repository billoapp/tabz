/**
 * Unit tests for M-Pesa STK Push Service
 * Tests specific examples, error conditions, and retry logic
 */

import { 
  sendSTKPush, 
  STKPushError, 
  getSTKPushStats, 
  resetSTKPushStats,
  sendSTKPushWithStats 
} from '../mpesa-stk-push';
import { getOAuthToken } from '../mpesa-oauth';
import { loadMpesaConfig } from '../mpesa-config';

// Mock dependencies
jest.mock('../mpesa-oauth');
jest.mock('../mpesa-config');

const mockGetOAuthToken = getOAuthToken as jest.MockedFunction<typeof getOAuthToken>;
const mockLoadMpesaConfig = loadMpesaConfig as jest.MockedFunction<typeof loadMpesaConfig>;

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock config
const mockConfig = {
  environment: 'sandbox' as const,
  consumerKey: 'test_key',
  consumerSecret: 'test_secret',
  businessShortcode: '174379',
  passkey: 'test_passkey',
  callbackUrl: 'https://example.com/callback',
  oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
  stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
};

describe('STK Push Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadMpesaConfig.mockReturnValue(mockConfig);
    mockGetOAuthToken.mockResolvedValue('test_access_token');
    resetSTKPushStats();
  });

  describe('sendSTKPush', () => {
    const validRequest = {
      phoneNumber: '254712345678',
      amount: 100,
      accountReference: 'TAB123',
      transactionDesc: 'Tab Payment',
    };

    const successResponse = {
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      MerchantRequestID: 'merchant123',
      CheckoutRequestID: 'checkout123',
    };

    it('should successfully send STK Push request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      } as Response);

      const result = await sendSTKPush(validRequest);

      expect(result).toEqual(successResponse);
      expect(mockGetOAuthToken).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        mockConfig.stkPushUrl,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test_access_token',
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"BusinessShortCode":"174379"'),
        })
      );
    });

    it('should normalize phone number format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      } as Response);

      // Test with local format
      await sendSTKPush({
        ...validRequest,
        phoneNumber: '0712345678',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.PartyA).toBe('254712345678');
      expect(requestBody.PhoneNumber).toBe('254712345678');
    });

    it('should generate correct password and timestamp', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      } as Response);

      await sendSTKPush(validRequest);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      // Verify timestamp format (YYYYMMDDHHMMSS)
      expect(requestBody.Timestamp).toMatch(/^\d{14}$/);
      
      // Verify password is base64 encoded
      expect(requestBody.Password).toMatch(/^[A-Za-z0-9+/]+=*$/);
      
      // Verify password can be decoded
      const decodedPassword = Buffer.from(requestBody.Password, 'base64').toString();
      expect(decodedPassword).toContain(mockConfig.businessShortcode);
      expect(decodedPassword).toContain(mockConfig.passkey);
      expect(decodedPassword).toContain(requestBody.Timestamp);
    });

    it('should validate request parameters', async () => {
      // Test missing phone number
      await expect(sendSTKPush({
        ...validRequest,
        phoneNumber: '',
      })).rejects.toThrow(STKPushError);

      // Test invalid amount
      await expect(sendSTKPush({
        ...validRequest,
        amount: -100,
      })).rejects.toThrow('Amount must be a positive number');

      // Test amount too large
      await expect(sendSTKPush({
        ...validRequest,
        amount: 1000000,
      })).rejects.toThrow('Amount cannot exceed 999,999 KES');

      // Test account reference too long
      await expect(sendSTKPush({
        ...validRequest,
        accountReference: 'ThisIsWayTooLongForAccountReference',
      })).rejects.toThrow('Account reference cannot exceed 12 characters');

      // Test transaction description too long
      await expect(sendSTKPush({
        ...validRequest,
        transactionDesc: 'This description is way too long',
      })).rejects.toThrow('Transaction description cannot exceed 13 characters');
    });

    it('should validate phone number format', async () => {
      await expect(sendSTKPush({
        ...validRequest,
        phoneNumber: '123456789', // Invalid format
      })).rejects.toThrow(STKPushError);

      await expect(sendSTKPush({
        ...validRequest,
        phoneNumber: '254812345678', // Invalid prefix (81)
      })).rejects.toThrow(STKPushError);
    });

    it('should handle Safaricom API errors', async () => {
      const errorResponse = {
        ResponseCode: '1',
        ResponseDescription: 'Insufficient funds',
        MerchantRequestID: 'merchant123',
        CheckoutRequestID: 'checkout123', // Include required fields
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => errorResponse,
      } as Response);

      await expect(sendSTKPush(validRequest)).rejects.toThrow(
        'STK Push rejected by Safaricom: Insufficient funds'
      );
      
      // Should not retry Safaricom API errors
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request format',
      } as Response);

      await expect(sendSTKPush(validRequest)).rejects.toThrow(
        'STK Push request failed: 400 Bad Request'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(sendSTKPush(validRequest)).rejects.toThrow(
        'Network error: STK Push failed after 3 attempts'
      );
      
      // Should retry network errors
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry failed requests with exponential backoff', async () => {
      // Mock timer functions for testing delays
      jest.useFakeTimers();
      
      // First two attempts fail with server error
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error',
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successResponse,
        } as Response);

      // Start the request
      const requestPromise = sendSTKPush(validRequest);

      // Fast-forward through the delays
      await jest.advanceTimersByTimeAsync(1000); // First retry after 1s
      await jest.advanceTimersByTimeAsync(2000); // Second retry after 2s

      const result = await requestPromise;

      expect(result).toEqual(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should not retry client errors (4xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      } as Response);

      await expect(sendSTKPush(validRequest)).rejects.toThrow(
        'STK Push request failed: 400 Bad Request'
      );

      // Should not retry
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fail after maximum retries', async () => {
      // All attempts fail with server error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      } as Response);

      await expect(sendSTKPush(validRequest)).rejects.toThrow(
        /STK Push failed after 3 attempts/
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      } as Response);

      await expect(sendSTKPush(validRequest)).rejects.toThrow(
        'Invalid STK Push response format from Safaricom API'
      );
      
      // Should not retry invalid response format
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should round amount to integer', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      } as Response);

      await sendSTKPush({
        ...validRequest,
        amount: 100.75, // Decimal amount
      });

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]?.body as string);
      
      expect(requestBody.Amount).toBe(101); // Rounded up
    });
  });

  describe('Statistics tracking', () => {
    const validRequest = {
      phoneNumber: '254712345678',
      amount: 100,
      accountReference: 'TAB123',
      transactionDesc: 'Tab Payment',
    };

    const successResponse = {
      ResponseCode: '0',
      ResponseDescription: 'Success',
      MerchantRequestID: 'merchant123',
      CheckoutRequestID: 'checkout123',
    };

    it('should track successful requests', async () => {
      mockFetch.mockImplementationOnce(async () => {
        // Add small delay to ensure timing is captured
        await new Promise(resolve => setTimeout(resolve, 1));
        return {
          ok: true,
          json: async () => successResponse,
        } as Response;
      });

      await sendSTKPushWithStats(validRequest);

      const stats = getSTKPushStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track failed requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      } as Response);

      await expect(sendSTKPushWithStats(validRequest)).rejects.toThrow();

      const stats = getSTKPushStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(1);
    });

    it('should reset statistics', () => {
      // Make some requests first
      const stats1 = getSTKPushStats();
      stats1.totalRequests = 5;

      resetSTKPushStats();

      const stats2 = getSTKPushStats();
      expect(stats2.totalRequests).toBe(0);
      expect(stats2.successfulRequests).toBe(0);
      expect(stats2.failedRequests).toBe(0);
      expect(stats2.averageResponseTime).toBe(0);
    });
  });
});