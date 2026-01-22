/**
 * Property-based tests for phone number validation
 * Feature: mpesa-payment-integration, Property 9: Phone Number Validation
 * Validates: Requirements 3.3
 */

import fc from 'fast-check';
import {
  validateKenyanPhoneNumber,
  validateMpesaPhoneNumber,
  formatPhoneNumberDisplay,
  convertToInternationalFormat,
  sanitizePhoneNumber,
  formatPhoneNumberInput,
  getNetworkProvider
} from '../phoneValidation';

describe('Phone Number Validation Properties', () => {
  // Property 9: Phone Number Validation
  // For any phone number input, the validation should correctly identify valid 254XXXXXXXX format numbers and reject invalid formats
  describe('Property 9: Phone Number Validation Format Recognition', () => {
    test('should correctly validate valid Kenyan phone number formats', () => {
      fc.assert(
        fc.property(
          // Generate valid Kenyan phone numbers - 10 digits starting with 0
          fc.oneof(
            fc.constant('0712345678'), // Safaricom
            fc.constant('0723456789'), // Safaricom
            fc.constant('0734567890'), // Airtel
            fc.constant('0745678901'), // Safaricom
            fc.constant('0756789012'), // Safaricom
            fc.constant('0767890123'), // Safaricom/Equitel
            fc.constant('0778901234'), // Safaricom/Telkom
            fc.constant('0789012345'), // Safaricom/Airtel
            fc.constant('0790123456'), // Safaricom/Airtel
            // Also test international format conversion
            fc.constant('254712345678'),
            fc.constant('254723456789'),
            // And raw 9-digit format
            fc.constant('712345678'),
            fc.constant('723456789')
          ),
          (phoneNumber) => {
            const result = validateKenyanPhoneNumber(phoneNumber);
            
            // Valid phone numbers should pass validation
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.international).toBeDefined();
            expect(result.formatted).toBeDefined();
            
            // International format should always be 254XXXXXXXXX
            expect(result.international).toMatch(/^254\d{9}$/);
            
            // Formatted version should be in 0XXX XXX XXX format
            expect(result.formatted).toMatch(/^0\d{3} \d{3} \d{3}$/);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should correctly reject invalid phone number formats', () => {
      fc.assert(
        fc.property(
          // Generate invalid phone numbers
          fc.oneof(
            fc.constant(''),
            fc.constant('123'), // Too short
            fc.constant('12345678901234567890'), // Too long
            fc.constant('abc123'), // Non-numeric
            fc.constant('1234567890'), // Doesn't start with 0 or 254
            fc.constant('255712345678'), // Wrong country code
            fc.constant('0612345678'), // Invalid prefix (should start with 07)
            fc.constant('071234567'), // Too short (9 digits instead of 10)
            fc.constant('07123456789'), // Too long (11 digits)
            fc.constant('0812345678') // Invalid network prefix
          ),
          (invalidPhone) => {
            const result = validateKenyanPhoneNumber(invalidPhone);
            
            // Invalid phone numbers should fail validation
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle sanitization correctly for any input', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const sanitized = sanitizePhoneNumber(input);
            
            // Sanitized output should only contain digits
            expect(sanitized).toMatch(/^\d*$/);
            
            // Should not exceed reasonable length
            expect(sanitized.length).toBeLessThanOrEqual(15);
            
            // Should preserve all digits from input
            const inputDigits = input.replace(/\D/g, '');
            const expectedSanitized = inputDigits.substring(0, 15);
            expect(sanitized).toBe(expectedSanitized);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should format phone numbers consistently', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('712345678'),
            fc.constant('254712345678'),
            fc.constant('0712345678'),
            fc.constant('123456789012')
          ),
          (phoneDigits) => {
            const formatted = formatPhoneNumberDisplay(phoneDigits);
            
            // Formatted output should contain only digits and spaces
            expect(formatted).toMatch(/^[\d\s]*$/);
            
            // Should not start or end with space
            if (formatted.length > 0) {
              expect(formatted).not.toMatch(/^\s/);
              expect(formatted).not.toMatch(/\s$/);
            }
            
            // Should not have consecutive spaces
            expect(formatted).not.toMatch(/\s{2,}/);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should convert to international format consistently', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('0712345678'),
            fc.constant('254712345678'),
            fc.constant('712345678')
          ),
          (phoneNumber) => {
            const international = convertToInternationalFormat(phoneNumber);
            
            // Should always result in 254XXXXXXXXX format for valid inputs
            if (phoneNumber.length >= 9) {
              expect(international).toMatch(/^254\d{9}$/);
              expect(international.length).toBe(12);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should provide network provider information for valid numbers', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('254712345678'), // Safaricom
            fc.constant('254732345678'), // Airtel
            fc.constant('254772345678')  // Telkom/Safaricom
          ),
          (phoneNumber) => {
            const provider = getNetworkProvider(phoneNumber);
            
            // Should return a valid provider name or null
            if (provider !== null) {
              expect(typeof provider).toBe('string');
              expect(provider.length).toBeGreaterThan(0);
              expect(['Safaricom', 'Airtel', 'Telkom', 'Equitel']).toContain(provider);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should maintain validation consistency between Kenyan and M-PESA validators', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('0712345678'),
            fc.constant('invalid'),
            fc.constant(''),
            fc.constant('254712345678')
          ),
          (phoneNumber) => {
            const kenyanResult = validateKenyanPhoneNumber(phoneNumber);
            const mpesaResult = validateMpesaPhoneNumber(phoneNumber);
            
            // If Kenyan validation fails, M-PESA validation should also fail
            if (!kenyanResult.isValid) {
              expect(mpesaResult.isValid).toBe(false);
            }
            
            // Both should have consistent error reporting
            if (!kenyanResult.isValid && !mpesaResult.isValid) {
              expect(kenyanResult.error).toBeDefined();
              expect(mpesaResult.error).toBeDefined();
            }
            
            // If both are valid, international formats should match
            if (kenyanResult.isValid && mpesaResult.isValid) {
              expect(kenyanResult.international).toBe(mpesaResult.international);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle input formatting without data loss', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('0712345678'),
            fc.constant('254712345678'),
            fc.constant('712345678'), // This will be converted to 0712345678
            fc.constant('abc123def')
          ),
          fc.oneof(
            fc.constant(''),
            fc.constant('071234'),
            fc.constant('254712')
          ),
          (currentValue, previousValue) => {
            const formatted = formatPhoneNumberInput(currentValue, previousValue);
            
            // Formatted result should contain only digits and spaces
            expect(formatted).toMatch(/^[\d\s]*$/);
            
            // Should not lose digits (but may add leading 0 for 9-digit numbers)
            const currentDigits = sanitizePhoneNumber(currentValue);
            const formattedDigits = sanitizePhoneNumber(formatted);
            
            // Handle the special case where 9-digit numbers get converted to 10-digit
            if (currentDigits.length === 9 && currentDigits.startsWith('7')) {
              // 9-digit number starting with 7 should become 10-digit starting with 07
              expect(formattedDigits).toBe('0' + currentDigits);
            } else if (currentDigits.length <= 12) {
              // For other cases, digits should be preserved
              expect(formattedDigits).toBe(currentDigits);
            } else {
              // Very long numbers may be truncated
              expect(formattedDigits).toBe(currentDigits.substring(0, 12));
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Edge cases and boundary conditions
  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(() => sanitizePhoneNumber(null as any)).not.toThrow();
      expect(() => sanitizePhoneNumber(undefined as any)).not.toThrow();
      expect(sanitizePhoneNumber(null as any)).toBe('');
      expect(sanitizePhoneNumber(undefined as any)).toBe('');
    });

    test('should handle very long inputs without crashing', () => {
      const veryLongInput = '1'.repeat(1000);
      expect(() => sanitizePhoneNumber(veryLongInput)).not.toThrow();
      expect(() => validateKenyanPhoneNumber(veryLongInput)).not.toThrow();
      expect(() => formatPhoneNumberDisplay(veryLongInput)).not.toThrow();
    });

    test('should handle special characters and unicode', () => {
      const specialInputs = [
        '📱254712345678',
        '+254-712-345-678',
        '(254) 712 345 678',
        '254.712.345.678',
        '254 712 345 678',
        'tel:+254712345678'
      ];

      specialInputs.forEach(input => {
        expect(() => sanitizePhoneNumber(input)).not.toThrow();
        expect(() => validateKenyanPhoneNumber(input)).not.toThrow();
        
        const sanitized = sanitizePhoneNumber(input);
        expect(sanitized).toMatch(/^\d*$/);
      });
    });
  });
});