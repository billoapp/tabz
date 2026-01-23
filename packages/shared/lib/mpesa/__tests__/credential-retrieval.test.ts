/**
 * Unit tests for CredentialRetrievalService
 * Tests specific examples and error conditions for credential retrieval
 */

import { 
  DatabaseCredentialRetrievalService,
  CredentialsNotFoundError,
  CredentialsInactiveError,
  CredentialDecryptionError
} from '../services/credential-retrieval';
import { MpesaCredentials, MpesaEnvironment, MpesaError } from '../types';
import * as encryption from '../services/encryption';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn()
};

// Mock createClient to return our mock
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock encryption service
jest.mock('../services/encryption');
const mockDecryptCredential = encryption.decryptCredential as jest.MockedFunction<typeof encryption.decryptCredential>;

describe('DatabaseCredentialRetrievalService', () => {
  let service: DatabaseCredentialRetrievalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DatabaseCredentialRetrievalService(
      'https://test.supabase.co',
      'test-service-key'
    );
  });

  describe('getTenantCredentials', () => {
    const tenantId = 'test-tenant-123';
    const environment: MpesaEnvironment = 'sandbox';

    const mockCredentialRecord = {
      id: 'cred-123',
      tenant_id: tenantId,
      environment,
      consumer_key_enc: Buffer.from('encrypted-consumer-key'),
      consumer_secret_enc: Buffer.from('encrypted-consumer-secret'),
      business_shortcode: '123456', // Not encrypted
      passkey_enc: Buffer.from('encrypted-passkey'),
      callback_url: 'https://example.com/callback',
      timeout_url: 'https://example.com/timeout',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    it('should successfully retrieve and decrypt credentials', async () => {
      // Setup mocks
      mockSupabase.maybeSingle.mockResolvedValue({
        data: mockCredentialRecord,
        error: null
      });

      mockDecryptCredential
        .mockReturnValueOnce('decrypted-consumer-key')
        .mockReturnValueOnce('decrypted-consumer-secret')
        .mockReturnValueOnce('decrypted-passkey');

      // Execute
      const result = await service.getTenantCredentials(tenantId, environment);

      // Verify
      expect(result).toEqual({
        consumerKey: 'decrypted-consumer-key',
        consumerSecret: 'decrypted-consumer-secret',
        businessShortCode: '123456',
        passkey: 'decrypted-passkey',
        environment: 'sandbox',
        callbackUrl: 'https://example.com/callback',
        timeoutUrl: 'https://example.com/timeout',
        encryptedAt: new Date('2024-01-01T00:00:00Z'),
        lastValidated: new Date('2024-01-01T00:00:00Z')
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('environment', environment);
      expect(mockDecryptCredential).toHaveBeenCalledTimes(3);
    });

    it('should throw CredentialsNotFoundError when no credentials exist', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(service.getTenantCredentials(tenantId, environment))
        .rejects
        .toThrow(CredentialsNotFoundError);
    });

    it('should throw CredentialsInactiveError when credentials are inactive', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { ...mockCredentialRecord, is_active: false },
        error: null
      });

      await expect(service.getTenantCredentials(tenantId, environment))
        .rejects
        .toThrow(CredentialsInactiveError);
    });

    it('should throw MpesaError when credentials are incomplete', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { 
          ...mockCredentialRecord, 
          consumer_key_enc: null // Missing required field
        },
        error: null
      });

      await expect(service.getTenantCredentials(tenantId, environment))
        .rejects
        .toThrow(MpesaError);
    });

    it('should throw CredentialDecryptionError when decryption fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: mockCredentialRecord,
        error: null
      });

      mockDecryptCredential.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(service.getTenantCredentials(tenantId, environment))
        .rejects
        .toThrow(CredentialDecryptionError);
    });

    it('should throw MpesaError when database query fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(service.getTenantCredentials(tenantId, environment))
        .rejects
        .toThrow(MpesaError);
    });

    it('should handle production environment correctly', async () => {
      const productionRecord = {
        ...mockCredentialRecord,
        environment: 'production' as MpesaEnvironment,
        business_shortcode: '654321'
      };

      mockSupabase.maybeSingle.mockResolvedValue({
        data: productionRecord,
        error: null
      });

      mockDecryptCredential
        .mockReturnValueOnce('prod-consumer-key')
        .mockReturnValueOnce('prod-consumer-secret')
        .mockReturnValueOnce('prod-passkey');

      const result = await service.getTenantCredentials(tenantId, 'production');

      expect(result.environment).toBe('production');
      expect(result.businessShortCode).toBe('654321');
      expect(mockSupabase.eq).toHaveBeenCalledWith('environment', 'production');
    });
  });

  describe('validateCredentials', () => {
    const validCredentials: MpesaCredentials = {
      consumerKey: 'validConsumerKey123', // 10+ chars, alphanumeric
      consumerSecret: 'validConsumerSecret456', // 10+ chars, alphanumeric
      businessShortCode: '123456', // 6 digits for sandbox
      passkey: 'validPasskeyWith20PlusChars123456789', // 20+ chars, base64-like
      environment: 'sandbox',
      callbackUrl: 'https://example.com/callback',
      timeoutUrl: 'https://example.com/timeout',
      encryptedAt: new Date(),
      lastValidated: new Date()
    };

    it('should return true for valid credentials', async () => {
      const result = await service.validateCredentials(validCredentials);
      expect(result).toBe(true);
    });

    it('should return false for missing consumer key', async () => {
      const invalidCredentials = { ...validCredentials, consumerKey: '' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for missing consumer secret', async () => {
      const invalidCredentials = { ...validCredentials, consumerSecret: '' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for missing business short code', async () => {
      const invalidCredentials = { ...validCredentials, businessShortCode: '' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for missing passkey', async () => {
      const invalidCredentials = { ...validCredentials, passkey: '' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for missing callback URL', async () => {
      const invalidCredentials = { ...validCredentials, callbackUrl: '' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for invalid environment', async () => {
      const invalidCredentials = { ...validCredentials, environment: 'invalid' as any };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for invalid callback URL format', async () => {
      const invalidCredentials = { ...validCredentials, callbackUrl: 'not-a-url' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for HTTP callback URL in production', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        environment: 'production' as MpesaEnvironment,
        callbackUrl: 'http://example.com/callback' 
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return true for HTTP callback URL in sandbox', async () => {
      const validSandboxCredentials = { 
        ...validCredentials, 
        environment: 'sandbox' as MpesaEnvironment,
        callbackUrl: 'http://example.com/callback' 
      };
      const result = await service.validateCredentials(validSandboxCredentials);
      expect(result).toBe(true);
    });

    it('should return false for non-numeric business short code', async () => {
      const invalidCredentials = { ...validCredentials, businessShortCode: 'abc123' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for invalid consumer key format', async () => {
      const invalidCredentials = { ...validCredentials, consumerKey: 'key-with-special-chars!' };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    // New tests for enhanced validation logic
    it('should return false for consumer key too short', async () => {
      const invalidCredentials = { ...validCredentials, consumerKey: 'short' }; // Less than 10 chars
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for consumer key too long', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        consumerKey: 'a'.repeat(51) // More than 50 chars
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for consumer secret too short', async () => {
      const invalidCredentials = { ...validCredentials, consumerSecret: 'short' }; // Less than 10 chars
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for consumer secret with special characters', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        consumerSecret: 'secret-with-special-chars!' 
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for business short code too short', async () => {
      const invalidCredentials = { ...validCredentials, businessShortCode: '123' }; // Less than 5 digits
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for business short code too long', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        businessShortCode: '12345678901' // More than 10 digits
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for passkey too short', async () => {
      const invalidCredentials = { ...validCredentials, passkey: 'shortpasskey' }; // Less than 20 chars
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for passkey with invalid characters', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        passkey: 'passkey-with-invalid-chars!' // Invalid characters for base64
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for production environment with localhost callback URL', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        environment: 'production' as MpesaEnvironment,
        callbackUrl: 'https://localhost:3000/callback' 
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for production environment with test domain callback URL', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        environment: 'production' as MpesaEnvironment,
        callbackUrl: 'https://test.example.com/callback' 
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return false for production environment with non-6-digit business short code', async () => {
      const invalidCredentials = { 
        ...validCredentials, 
        environment: 'production' as MpesaEnvironment,
        businessShortCode: '12345' // Not exactly 6 digits for production
      };
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });

    it('should return true for valid production credentials', async () => {
      const validProdCredentials = { 
        ...validCredentials, 
        environment: 'production' as MpesaEnvironment,
        businessShortCode: '123456', // Exactly 6 digits for production
        callbackUrl: 'https://api.example.com/callback' // Valid production URL
      };
      const result = await service.validateCredentials(validProdCredentials);
      expect(result).toBe(true);
    });

    it('should handle optional timeout URL validation', async () => {
      // Valid timeout URL
      const validWithTimeout = { 
        ...validCredentials, 
        timeoutUrl: 'https://example.com/timeout' 
      };
      expect(await service.validateCredentials(validWithTimeout)).toBe(true);

      // Invalid timeout URL format
      const invalidTimeout = { 
        ...validCredentials, 
        timeoutUrl: 'not-a-url' 
      };
      expect(await service.validateCredentials(invalidTimeout)).toBe(false);

      // HTTP timeout URL in production (should fail)
      const httpTimeoutProd = { 
        ...validCredentials, 
        environment: 'production' as MpesaEnvironment,
        timeoutUrl: 'http://example.com/timeout' 
      };
      expect(await service.validateCredentials(httpTimeoutProd)).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      // Pass invalid object that might cause validation to throw
      const invalidCredentials = null as any;
      const result = await service.validateCredentials(invalidCredentials);
      expect(result).toBe(false);
    });
  });

  describe('validateCredentialsWithDetails', () => {
    const validCredentials: MpesaCredentials = {
      consumerKey: 'validConsumerKey123', // 10+ chars, alphanumeric
      consumerSecret: 'validConsumerSecret456', // 10+ chars, alphanumeric
      businessShortCode: '123456', // 6 digits for sandbox
      passkey: 'validPasskeyWith20PlusChars123456789', // 20+ chars, base64-like
      environment: 'sandbox',
      callbackUrl: 'https://example.com/callback',
      timeoutUrl: 'https://example.com/timeout',
      encryptedAt: new Date(),
      lastValidated: new Date()
    };

    it('should return valid result for valid credentials', async () => {
      const result = await service.validateCredentialsWithDetails(validCredentials);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return detailed errors for invalid credentials', async () => {
      const invalidCredentials: MpesaCredentials = {
        consumerKey: '', // Empty
        consumerSecret: 'short', // Too short
        businessShortCode: 'abc', // Non-numeric and too short
        passkey: 'short', // Too short
        environment: 'invalid' as any, // Invalid environment
        callbackUrl: 'not-a-url', // Invalid URL
        timeoutUrl: 'also-not-a-url', // Invalid URL
        encryptedAt: new Date(),
        lastValidated: new Date()
      };

      const result = await service.validateCredentialsWithDetails(invalidCredentials);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check for specific error messages
      expect(result.errors).toContain('Consumer key is required and cannot be empty');
      expect(result.errors).toContain('Consumer secret must be between 10-50 characters');
      expect(result.errors).toContain('Business short code must contain only digits');
      expect(result.errors).toContain('Passkey must be at least 20 characters for security');
      expect(result.errors).toContain('Environment must be either "sandbox" or "production"');
      expect(result.errors).toContain('Callback URL must be a valid URL');
    });

    it('should return specific errors for production environment violations', async () => {
      const invalidProdCredentials: MpesaCredentials = {
        ...validCredentials,
        environment: 'production',
        businessShortCode: '12345', // Not exactly 6 digits for production
        callbackUrl: 'http://example.com/callback', // HTTP not allowed in production
        timeoutUrl: 'https://localhost:3000/timeout' // Localhost not allowed in production
      };

      const result = await service.validateCredentialsWithDetails(invalidProdCredentials);
      expect(result.isValid).toBe(false);
      
      expect(result.errors).toContain('Production environment requires HTTPS callback URL');
      expect(result.errors).toContain('Production environment requires business short code to be exactly 6 digits');
      expect(result.errors).toContain('Production environment should not use localhost, test, staging, or dev domains for callback URLs');
    });

    it('should handle null credentials gracefully', async () => {
      const result = await service.validateCredentialsWithDetails(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Validation failed');
    });
  });
});