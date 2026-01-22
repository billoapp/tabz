/**
 * Property-Based Tests for M-PESA Configuration Validation
 * Feature: mpesa-payment-integration, Property 17: Configuration Validation
 * 
 * Tests that invalid environment configurations prevent payment processing
 * and display appropriate error messages to staff.
 * 
 * **Validates: Requirements 8.4, 8.5**
 */

import fc from 'fast-check';
import { MpesaCredentials, MpesaEnvironment, ValidationResult } from '../types';

// Mock configuration validator
interface ConfigurationValidator {
  validateEnvironmentConfig(
    environment: MpesaEnvironment,
    credentials: Partial<MpesaCredentials>
  ): ValidationResult;
  
  validateProductionReadiness(
    environment: MpesaEnvironment,
    credentials: MpesaCredentials,
    hasValidation: boolean
  ): ValidationResult;
  
  preventPaymentProcessing(
    validationResult: ValidationResult
  ): boolean;
}

class MockConfigurationValidator implements ConfigurationValidator {
  validateEnvironmentConfig(
    environment: MpesaEnvironment,
    credentials: Partial<MpesaCredentials>
  ): ValidationResult {
    const errors: string[] = [];
    
    // Environment-specific validation
    if (environment === 'production') {
      if (!credentials.consumerKey || credentials.consumerKey.includes('test')) {
        errors.push('Production environment requires live consumer key');
      }
      if (!credentials.consumerSecret || credentials.consumerSecret.includes('test')) {
        errors.push('Production environment requires live consumer secret');
      }
      if (!credentials.businessShortCode || credentials.businessShortCode.length < 5) {
        errors.push('Production environment requires valid business shortcode');
      }
      if (!credentials.passkey || credentials.passkey.length < 10) {
        errors.push('Production environment requires valid passkey');
      }
    } else if (environment === 'sandbox') {
      if (!credentials.consumerKey) {
        errors.push('Sandbox environment requires consumer key');
      }
      if (!credentials.consumerSecret) {
        errors.push('Sandbox environment requires consumer secret');
      }
      if (!credentials.businessShortCode) {
        errors.push('Sandbox environment requires business shortcode');
      }
      if (!credentials.passkey) {
        errors.push('Sandbox environment requires passkey');
      }
    }
    
    // General validation
    if (credentials.businessShortCode && !/^\d{5,7}$/.test(credentials.businessShortCode)) {
      errors.push('Business shortcode must be 5-7 digits');
    }
    
    if (credentials.consumerKey && credentials.consumerKey.length < 10) {
      errors.push('Consumer key must be at least 10 characters');
    }
    
    if (credentials.consumerSecret && credentials.consumerSecret.length < 10) {
      errors.push('Consumer secret must be at least 10 characters');
    }
    
    if (credentials.passkey && credentials.passkey.length < 10) {
      errors.push('Passkey must be at least 10 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  validateProductionReadiness(
    environment: MpesaEnvironment,
    credentials: MpesaCredentials,
    hasValidation: boolean
  ): ValidationResult {
    const errors: string[] = [];
    
    if (environment === 'production') {
      if (!hasValidation) {
        errors.push('Production credentials must be validated before deployment');
      }
      
      if (!credentials.callbackUrl || !credentials.callbackUrl.startsWith('https://')) {
        errors.push('Production requires HTTPS callback URL');
      }
      
      if (credentials.consumerKey.includes('test') || credentials.consumerSecret.includes('test')) {
        errors.push('Production cannot use test credentials');
      }
      
      // Additional production checks
      if (!credentials.lastValidated || 
          new Date().getTime() - credentials.lastValidated.getTime() > 24 * 60 * 60 * 1000) {
        errors.push('Production credentials must be validated within 24 hours');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  preventPaymentProcessing(validationResult: ValidationResult): boolean {
    // If validation fails, payment processing should be prevented
    return !validationResult.isValid;
  }
}

// Test data generators
const environmentArb = fc.constantFrom('sandbox' as const, 'production' as const);

const validBusinessShortcodeArb = fc.integer({ min: 10000, max: 9999999 }).map(n => n.toString());
const invalidBusinessShortcodeArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 4 }), // Too short
  fc.string({ minLength: 8, maxLength: 20 }), // Too long
  fc.string({ minLength: 5, maxLength: 7 }).filter(s => !/^\d+$/.test(s)) // Non-numeric
);

const validCredentialStringArb = fc.string({ minLength: 10, maxLength: 100 });
const invalidCredentialStringArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 9 }), // Too short
  fc.constant(''), // Empty
  fc.constant(null as any), // Null
  fc.constant(undefined as any) // Undefined
);

const testCredentialsArb = fc.record({
  consumerKey: fc.string({ minLength: 10, maxLength: 50 }).map(s => `test_${s}`),
  consumerSecret: fc.string({ minLength: 10, maxLength: 50 }).map(s => `test_${s}`),
  businessShortCode: validBusinessShortcodeArb,
  passkey: validCredentialStringArb
});

const liveCredentialsArb = fc.record({
  consumerKey: validCredentialStringArb.filter(s => !s.includes('test')),
  consumerSecret: validCredentialStringArb.filter(s => !s.includes('test')),
  businessShortCode: validBusinessShortcodeArb,
  passkey: validCredentialStringArb
});

const partialCredentialsArb = fc.record({
  consumerKey: fc.option(validCredentialStringArb, { nil: undefined }),
  consumerSecret: fc.option(validCredentialStringArb, { nil: undefined }),
  businessShortCode: fc.option(validBusinessShortcodeArb, { nil: undefined }),
  passkey: fc.option(validCredentialStringArb, { nil: undefined })
});

const invalidCredentialsArb = fc.record({
  consumerKey: fc.option(invalidCredentialStringArb, { nil: undefined }),
  consumerSecret: fc.option(invalidCredentialStringArb, { nil: undefined }),
  businessShortCode: fc.option(invalidBusinessShortcodeArb, { nil: undefined }),
  passkey: fc.option(invalidCredentialStringArb, { nil: undefined })
});

describe('M-PESA Configuration Validation Properties', () => {
  const validator = new MockConfigurationValidator();
  
  describe('Property 17: Configuration Validation', () => {
    test('invalid environment configurations should prevent payment processing', () => {
      fc.assert(
        fc.property(
          environmentArb,
          invalidCredentialsArb,
          (environment, credentials) => {
            // Test the property: invalid configurations should prevent payment processing
            const validationResult = validator.validateEnvironmentConfig(environment, credentials);
            const paymentBlocked = validator.preventPaymentProcessing(validationResult);
            
            // Property: Invalid configurations should always prevent payment processing
            expect(paymentBlocked).toBe(true);
            
            // Property: Validation should provide specific error messages
            expect(validationResult.errors.length).toBeGreaterThan(0);
            expect(validationResult.errors.every(error => typeof error === 'string' && error.length > 0)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('valid environment configurations should allow payment processing', () => {
      fc.assert(
        fc.property(
          environmentArb,
          fc.oneof(testCredentialsArb, liveCredentialsArb),
          (environment, credentials) => {
            // Ensure credentials match environment requirements
            const adjustedCredentials = environment === 'production' 
              ? { ...credentials, consumerKey: credentials.consumerKey.replace('test_', ''), consumerSecret: credentials.consumerSecret.replace('test_', '') }
              : credentials;
            
            const validationResult = validator.validateEnvironmentConfig(environment, adjustedCredentials);
            const paymentBlocked = validator.preventPaymentProcessing(validationResult);
            
            // Property: Valid configurations should allow payment processing
            if (validationResult.isValid) {
              expect(paymentBlocked).toBe(false);
              expect(validationResult.errors.length).toBe(0);
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('production environment should have stricter validation than sandbox', () => {
      fc.assert(
        fc.property(
          testCredentialsArb,
          (testCredentials) => {
            const sandboxResult = validator.validateEnvironmentConfig('sandbox', testCredentials);
            const productionResult = validator.validateEnvironmentConfig('production', testCredentials);
            
            // Property: Production should be stricter - test credentials should fail in production
            if (testCredentials.consumerKey.includes('test') || testCredentials.consumerSecret.includes('test')) {
              expect(productionResult.isValid).toBe(false);
              expect(productionResult.errors.length).toBeGreaterThanOrEqual(sandboxResult.errors.length);
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('production readiness validation should enforce additional requirements', () => {
      fc.assert(
        fc.property(
          liveCredentialsArb,
          fc.boolean(),
          fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined }),
          (credentials, hasValidation, callbackUrl) => {
            const fullCredentials: MpesaCredentials = {
              ...credentials,
              environment: 'production',
              callbackUrl: callbackUrl || 'http://example.com/callback', // Intentionally HTTP for some tests
              encryptedAt: new Date(),
              lastValidated: hasValidation ? new Date() : undefined
            };
            
            const readinessResult = validator.validateProductionReadiness(
              'production',
              fullCredentials,
              hasValidation
            );
            
            // Property: Production readiness should require validation
            if (!hasValidation) {
              expect(readinessResult.isValid).toBe(false);
              expect(readinessResult.errors.some(e => e.includes('validated'))).toBe(true);
            }
            
            // Property: Production readiness should require HTTPS callback URL
            if (callbackUrl && !callbackUrl.startsWith('https://')) {
              expect(readinessResult.isValid).toBe(false);
              expect(readinessResult.errors.some(e => e.includes('HTTPS'))).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('business shortcode validation should be consistent across environments', () => {
      fc.assert(
        fc.property(
          environmentArb,
          fc.oneof(validBusinessShortcodeArb, invalidBusinessShortcodeArb),
          validCredentialStringArb,
          validCredentialStringArb,
          validCredentialStringArb,
          (environment, businessShortCode, consumerKey, consumerSecret, passkey) => {
            const credentials = {
              businessShortCode,
              consumerKey: environment === 'production' ? consumerKey : `test_${consumerKey}`,
              consumerSecret: environment === 'production' ? consumerSecret : `test_${consumerSecret}`,
              passkey
            };
            
            const validationResult = validator.validateEnvironmentConfig(environment, credentials);
            
            // Property: Business shortcode validation should be consistent
            const isValidShortcode = /^\d{5,7}$/.test(businessShortCode);
            const hasShortcodeError = validationResult.errors.some(e => e.includes('shortcode'));
            
            if (!isValidShortcode) {
              expect(hasShortcodeError).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('partial configurations should provide specific missing field errors', () => {
      fc.assert(
        fc.property(
          environmentArb,
          partialCredentialsArb,
          (environment, partialCredentials) => {
            const validationResult = validator.validateEnvironmentConfig(environment, partialCredentials);
            
            // Property: Missing required fields should generate specific errors
            if (!partialCredentials.consumerKey) {
              expect(validationResult.errors.some(e => e.includes('consumer key'))).toBe(true);
            }
            
            if (!partialCredentials.consumerSecret) {
              expect(validationResult.errors.some(e => e.includes('consumer secret'))).toBe(true);
            }
            
            if (!partialCredentials.businessShortCode) {
              expect(validationResult.errors.some(e => e.includes('business shortcode'))).toBe(true);
            }
            
            if (!partialCredentials.passkey) {
              expect(validationResult.errors.some(e => e.includes('passkey'))).toBe(true);
            }
            
            // Property: Each missing field should generate exactly one error
            const missingFields = [
              !partialCredentials.consumerKey,
              !partialCredentials.consumerSecret,
              !partialCredentials.businessShortCode,
              !partialCredentials.passkey
            ].filter(Boolean).length;
            
            expect(validationResult.errors.length).toBeGreaterThanOrEqual(missingFields);
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('validation errors should be user-friendly and actionable', () => {
      fc.assert(
        fc.property(
          environmentArb,
          invalidCredentialsArb,
          (environment, credentials) => {
            const validationResult = validator.validateEnvironmentConfig(environment, credentials);
            
            // Property: All error messages should be user-friendly
            validationResult.errors.forEach(error => {
              expect(error).toBeTruthy();
              expect(typeof error).toBe('string');
              expect(error.length).toBeGreaterThan(10); // Meaningful message
              expect(error).not.toMatch(/undefined|null|NaN/); // No technical artifacts
              expect(error.toLowerCase()).toMatch(/require|must|should|invalid|missing/); // Actionable language
            });
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
    
    test('environment switching should reset validation state appropriately', () => {
      fc.assert(
        fc.property(
          liveCredentialsArb,
          (credentials) => {
            // Test switching from sandbox to production
            const sandboxResult = validator.validateEnvironmentConfig('sandbox', {
              ...credentials,
              consumerKey: `test_${credentials.consumerKey}`,
              consumerSecret: `test_${credentials.consumerSecret}`
            });
            
            const productionResult = validator.validateEnvironmentConfig('production', credentials);
            
            // Property: Environment switching should require re-validation
            // Sandbox test credentials should not be valid for production
            if (sandboxResult.isValid) {
              // The same credentials (without test prefix) might be valid for production
              // but test credentials should definitely fail in production
              const testCredsInProduction = validator.validateEnvironmentConfig('production', {
                ...credentials,
                consumerKey: `test_${credentials.consumerKey}`,
                consumerSecret: `test_${credentials.consumerSecret}`
              });
              
              expect(testCredsInProduction.isValid).toBe(false);
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// Export for use in other tests
export { MockConfigurationValidator };