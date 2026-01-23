/**
 * Property-based tests for CredentialRetrievalService
 * Tests universal properties that should hold across all valid inputs
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

import fc from 'fast-check';
import { 
  DatabaseCredentialRetrievalService
} from '../services/credential-retrieval';
import { MpesaEnvironment, MpesaError } from '../types';
import * as encryption from '../services/encryption';

// Mock Supabase client for property testing
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

describe('CredentialRetrievalService Property Tests', () => {
  let service: DatabaseCredentialRetrievalService;

  beforeEach(() => {
    service = new DatabaseCredentialRetrievalService('test-url', 'test-key');
    jest.clearAllMocks();
  });

  // Arbitraries for generating test data
  const tenantIdArbitrary = fc.uuid();
  const environmentArbitrary = fc.constantFrom('sandbox', 'production') as fc.Arbitrary<MpesaEnvironment>;
  const credentialIdArbitrary = fc.uuid();
  const timestampArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

  // Generate valid encrypted credential data that matches existing database schema
  const validEncryptedCredentialArbitrary = fc.record({
    id: credentialIdArbitrary,
    tenant_id: tenantIdArbitrary,
    environment: environmentArbitrary,
    consumer_key_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    consumer_secret_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    business_shortcode: fc.string({ minLength: 5, maxLength: 10 }).filter(s => /^\d+$/.test(s)),
    passkey_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    callback_url: fc.webUrl({ validSchemes: ['https'] }),
    timeout_url: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: null }),
    is_active: fc.constant(true),
    created_at: timestampArbitrary.map(d => d.toISOString()),
    updated_at: timestampArbitrary.map(d => d.toISOString())
  });

  // Generate inactive credential records
  const inactiveEncryptedCredentialArbitrary = fc.record({
    id: credentialIdArbitrary,
    tenant_id: tenantIdArbitrary,
    environment: environmentArbitrary,
    consumer_key_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    consumer_secret_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    business_shortcode: fc.string({ minLength: 5, maxLength: 10 }).filter(s => /^\d+$/.test(s)),
    passkey_enc: fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)),
    callback_url: fc.webUrl({ validSchemes: ['https'] }),
    timeout_url: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: null }),
    is_active: fc.constant(false),
    created_at: timestampArbitrary.map(d => d.toISOString()),
    updated_at: timestampArbitrary.map(d => d.toISOString())
  });

  // Generate incomplete credential records (missing required fields)
  const incompleteEncryptedCredentialArbitrary = fc.record({
    id: credentialIdArbitrary,
    tenant_id: tenantIdArbitrary,
    environment: environmentArbitrary,
    consumer_key_enc: fc.option(fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)), { nil: null }),
    consumer_secret_enc: fc.option(fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)), { nil: null }),
    business_shortcode: fc.option(fc.string({ minLength: 5, maxLength: 10 }).filter(s => /^\d+$/.test(s)), { nil: null }),
    passkey_enc: fc.option(fc.uint8Array({ minLength: 28, maxLength: 100 }).map(arr => Buffer.from(arr)), { nil: null }),
    callback_url: fc.webUrl({ validSchemes: ['https'] }),
    timeout_url: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: null }),
    is_active: fc.constant(true),
    created_at: timestampArbitrary.map(d => d.toISOString()),
    updated_at: timestampArbitrary.map(d => d.toISOString())
  }).filter(record => 
    // Ensure at least one required field is missing
    !record.consumer_key_enc || 
    !record.consumer_secret_enc || 
    !record.business_shortcode || 
    !record.passkey_enc
  );

  // Generate valid decrypted credentials
  const validDecryptedCredentialsArbitrary = fc.record({
    consumerKey: fc.constantFrom(
      'TestConsumerKey123456789',
      'ValidConsumerKey987654321',
      'SampleConsumerKey111222333'
    ),
    consumerSecret: fc.constantFrom(
      'TestConsumerSecret123456789',
      'ValidConsumerSecret987654321',
      'SampleConsumerSecret111222333'
    ),
    businessShortCode: fc.constantFrom('123456', '654321', '999888'),
    passkey: fc.constantFrom(
      'TestPasskey123456789012345678901234567890',
      'ValidPasskey987654321098765432109876543210',
      'SamplePasskey111222333444555666777888999000'
    ),
    environment: environmentArbitrary,
    callbackUrl: fc.webUrl({ validSchemes: ['https'] }),
    timeoutUrl: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined }),
    encryptedAt: timestampArbitrary,
    lastValidated: fc.option(timestampArbitrary, { nil: undefined })
  });

  /**
   * Property 5: Database Schema Compatibility
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any existing credential record in the mpesa_credentials table, the new credential 
   * retrieval service should successfully query, decrypt, and use the credentials while 
   * maintaining backward compatibility with the existing database schema.
   */
  it('Property 5: Should successfully retrieve and decrypt any valid credential record from existing schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEncryptedCredentialArbitrary,
        validDecryptedCredentialsArbitrary,
        async (encryptedRecord, expectedDecrypted) => {
          // Arrange - Mock database response with existing schema structure
          mockSupabase.maybeSingle.mockResolvedValue({
            data: encryptedRecord,
            error: null
          });

          // Mock decryption to return expected values
          mockDecryptCredential
            .mockReturnValueOnce(expectedDecrypted.consumerKey)
            .mockReturnValueOnce(expectedDecrypted.consumerSecret)
            .mockReturnValueOnce(expectedDecrypted.passkey);

          // Act
          const result = await service.getTenantCredentials(
            encryptedRecord.tenant_id, 
            encryptedRecord.environment
          );

          // Assert - Universal properties for database schema compatibility
          expect(result).toBeDefined();
          expect(result.consumerKey).toBe(expectedDecrypted.consumerKey);
          expect(result.consumerSecret).toBe(expectedDecrypted.consumerSecret);
          expect(result.businessShortCode).toBe(encryptedRecord.business_shortcode);
          expect(result.passkey).toBe(expectedDecrypted.passkey);
          expect(result.environment).toBe(encryptedRecord.environment);
          expect(result.callbackUrl).toBe(encryptedRecord.callback_url);
          expect(result.timeoutUrl).toBe(encryptedRecord.timeout_url);
          expect(result.encryptedAt).toEqual(new Date(encryptedRecord.created_at));
          expect(result.lastValidated).toEqual(new Date(encryptedRecord.updated_at));

          // Verify correct database query structure for existing schema
          expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
          expect(mockSupabase.select).toHaveBeenCalledWith(`
          id,
          tenant_id,
          environment,
          consumer_key_enc,
          consumer_secret_enc,
          business_shortcode,
          passkey_enc,
          callback_url,
          timeout_url,
          is_active,
          created_at,
          updated_at
        `);
          expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', encryptedRecord.tenant_id);
          expect(mockSupabase.eq).toHaveBeenCalledWith('environment', encryptedRecord.environment);

          // Verify decryption was called for encrypted fields only
          expect(mockDecryptCredential).toHaveBeenCalledTimes(3);
          expect(mockDecryptCredential).toHaveBeenCalledWith(encryptedRecord.consumer_key_enc);
          expect(mockDecryptCredential).toHaveBeenCalledWith(encryptedRecord.consumer_secret_enc);
          expect(mockDecryptCredential).toHaveBeenCalledWith(encryptedRecord.passkey_enc);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Inactive credentials should always be rejected
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any credential record with is_active=false in the existing schema,
   * the service should always reject the credentials with CREDENTIALS_INACTIVE error.
   */
  it('Property 6: Should always reject inactive credentials from existing schema', async () => {
    await fc.assert(
      fc.asyncProperty(inactiveEncryptedCredentialArbitrary, async (inactiveRecord) => {
        // Arrange
        mockSupabase.maybeSingle.mockResolvedValue({
          data: inactiveRecord,
          error: null
        });

        // Act & Assert
        await expect(service.getTenantCredentials(
          inactiveRecord.tenant_id, 
          inactiveRecord.environment
        )).rejects.toThrow(new MpesaError(
          `M-Pesa credentials for tenant ${inactiveRecord.tenant_id} are inactive`,
          'CREDENTIALS_INACTIVE',
          403
        ));

        // Verify database query was made correctly
        expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
        expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', inactiveRecord.tenant_id);
        expect(mockSupabase.eq).toHaveBeenCalledWith('environment', inactiveRecord.environment);

        // Verify decryption was never attempted for inactive credentials
        expect(mockDecryptCredential).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Incomplete credentials should always be rejected
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any credential record missing required fields in the existing schema,
   * the service should always reject the credentials with CREDENTIALS_INCOMPLETE error.
   */
  it('Property 7: Should always reject incomplete credentials from existing schema', async () => {
    await fc.assert(
      fc.asyncProperty(incompleteEncryptedCredentialArbitrary, async (incompleteRecord) => {
        // Arrange
        mockSupabase.maybeSingle.mockResolvedValue({
          data: incompleteRecord,
          error: null
        });

        // Act & Assert
        await expect(service.getTenantCredentials(
          incompleteRecord.tenant_id, 
          incompleteRecord.environment
        )).rejects.toThrow(new MpesaError(
          `Incomplete M-Pesa credentials for tenant ${incompleteRecord.tenant_id}`,
          'CREDENTIALS_INCOMPLETE',
          500
        ));

        // Verify database query was made correctly
        expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
        expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', incompleteRecord.tenant_id);
        expect(mockSupabase.eq).toHaveBeenCalledWith('environment', incompleteRecord.environment);

        // Verify decryption was never attempted for incomplete credentials
        expect(mockDecryptCredential).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Non-existent credentials should always return not found error
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any tenant/environment combination that doesn't exist in the existing schema,
   * the service should always return CREDENTIALS_NOT_FOUND error.
   */
  it('Property 8: Should always return not found for non-existent credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArbitrary,
        environmentArbitrary,
        async (tenantId, environment) => {
          // Arrange
          mockSupabase.maybeSingle.mockResolvedValue({
            data: null,
            error: null
          });

          // Act & Assert
          await expect(service.getTenantCredentials(tenantId, environment))
            .rejects
            .toThrow(new MpesaError(
              `No M-Pesa credentials found for tenant ${tenantId} in ${environment} environment`,
              'CREDENTIALS_NOT_FOUND',
              404
            ));

          // Verify correct database query was made
          expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
          expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', tenantId);
          expect(mockSupabase.eq).toHaveBeenCalledWith('environment', environment);

          // Verify decryption was never attempted
          expect(mockDecryptCredential).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Database errors should always be wrapped appropriately
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any database error during credential retrieval from the existing schema,
   * the service should always wrap the error in a DATABASE_ERROR with status code 500.
   */
  it('Property 9: Should always wrap database errors appropriately', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArbitrary,
        environmentArbitrary,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (tenantId, environment, errorMessage) => {
          // Arrange
          mockSupabase.maybeSingle.mockResolvedValue({
            data: null,
            error: { message: errorMessage }
          });

          // Act & Assert
          await expect(service.getTenantCredentials(tenantId, environment))
            .rejects
            .toThrow(new MpesaError(
              `Database query failed for tenant ${tenantId}: ${errorMessage}`,
              'DATABASE_ERROR',
              500
            ));

          // Verify correct database query was attempted
          expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
          expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', tenantId);
          expect(mockSupabase.eq).toHaveBeenCalledWith('environment', environment);

          // Verify decryption was never attempted
          expect(mockDecryptCredential).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Decryption errors should always be handled gracefully
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any decryption failure with existing encrypted data from the schema,
   * the service should always wrap the error in a DECRYPTION_ERROR with status code 500.
   */
  it('Property 10: Should always handle decryption errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEncryptedCredentialArbitrary,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (encryptedRecord, decryptionError) => {
          // Arrange
          mockSupabase.maybeSingle.mockResolvedValue({
            data: encryptedRecord,
            error: null
          });

          // Mock decryption failure
          mockDecryptCredential.mockImplementation(() => {
            throw new Error(decryptionError);
          });

          // Act & Assert
          await expect(service.getTenantCredentials(
            encryptedRecord.tenant_id, 
            encryptedRecord.environment
          )).rejects.toThrow(new MpesaError(
            `Failed to decrypt credentials for tenant ${encryptedRecord.tenant_id}: ${decryptionError}`,
            'DECRYPTION_ERROR',
            500
          ));

          // Verify database query was made correctly
          expect(mockSupabase.from).toHaveBeenCalledWith('mpesa_credentials');
          expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', encryptedRecord.tenant_id);
          expect(mockSupabase.eq).toHaveBeenCalledWith('environment', encryptedRecord.environment);

          // Verify decryption was attempted
          expect(mockDecryptCredential).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Business shortcode should never be encrypted in existing schema
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any credential record in the existing schema, the business_shortcode field
   * should always be stored as plain text and returned without decryption.
   */
  it('Property 11: Should handle business shortcode as plain text in existing schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEncryptedCredentialArbitrary,
        validDecryptedCredentialsArbitrary,
        async (encryptedRecord, expectedDecrypted) => {
          // Arrange
          mockSupabase.maybeSingle.mockResolvedValue({
            data: encryptedRecord,
            error: null
          });

          mockDecryptCredential
            .mockReturnValueOnce(expectedDecrypted.consumerKey)
            .mockReturnValueOnce(expectedDecrypted.consumerSecret)
            .mockReturnValueOnce(expectedDecrypted.passkey);

          // Act
          const result = await service.getTenantCredentials(
            encryptedRecord.tenant_id, 
            encryptedRecord.environment
          );

          // Assert - Business shortcode should be returned as-is from database
          expect(result.businessShortCode).toBe(encryptedRecord.business_shortcode);

          // Verify decryption was only called for encrypted fields (not business_shortcode)
          expect(mockDecryptCredential).toHaveBeenCalledTimes(3);
          expect(mockDecryptCredential).toHaveBeenCalledWith(encryptedRecord.consumer_key_enc);
          expect(mockDecryptCredential).toHaveBeenCalledWith(encryptedRecord.consumer_secret_enc);
          expect(mockDecryptCredential).toHaveBeenCalledWith(encryptedRecord.passkey_enc);
          
          // Verify business_shortcode was never passed to decryption
          expect(mockDecryptCredential).not.toHaveBeenCalledWith(encryptedRecord.business_shortcode);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Credential validation should work with existing schema data
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * For any credentials retrieved from the existing schema, the validation logic
   * should correctly identify valid vs invalid credential formats.
   */
  it('Property 12: Should validate credentials correctly from existing schema', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEncryptedCredentialArbitrary,
        validDecryptedCredentialsArbitrary,
        async (encryptedRecord, validDecrypted) => {
          // Arrange
          mockSupabase.maybeSingle.mockResolvedValue({
            data: encryptedRecord,
            error: null
          });

          mockDecryptCredential
            .mockReturnValueOnce(validDecrypted.consumerKey)
            .mockReturnValueOnce(validDecrypted.consumerSecret)
            .mockReturnValueOnce(validDecrypted.passkey);

          // Act
          const result = await service.getTenantCredentials(
            encryptedRecord.tenant_id, 
            encryptedRecord.environment
          );

          // Assert - Credentials should be valid after retrieval from existing schema
          const isValid = await service.validateCredentials(result);
          expect(isValid).toBe(true);

          // Verify all required fields are present and properly formatted
          expect(result.consumerKey).toBeTruthy();
          expect(result.consumerSecret).toBeTruthy();
          expect(result.businessShortCode).toBeTruthy();
          expect(result.passkey).toBeTruthy();
          expect(result.callbackUrl).toBeTruthy();
          expect(['sandbox', 'production']).toContain(result.environment);
        }
      ),
      { numRuns: 100 }
    );
  });
});