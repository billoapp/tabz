/**
 * Unit tests for simplified phone number validation utility
 * Tests specific examples and edge cases for M-Pesa phone validation
 */

import {
  validateKenyanPhoneNumber,
  isValidKenyanPhoneNumber,
  normalizeKenyanPhoneNumber,
  formatKenyanPhoneNumber
} from '../phoneValidation';

describe('Phone Number Validation Utility', () => {
  describe('validateKenyanPhoneNumber', () => {
    test('should validate correct 254XXXXXXXXX format', () => {
      const result = validateKenyanPhoneNumber('254712345678');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('254712345678');
      expect(result.error).toBeUndefined();
    });

    test('should normalize 0XXXXXXXXX format to 254XXXXXXXXX', () => {
      const result = validateKenyanPhoneNumber('0712345678');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('254712345678');
    });

    test('should normalize XXXXXXXXX format to 254XXXXXXXXX', () => {
      const result = validateKenyanPhoneNumber('712345678');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('254712345678');
    });

    test('should handle phone numbers with formatting characters', () => {
      const result = validateKenyanPhoneNumber('+254-712-345-678');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('254712345678');
    });

    test('should reject empty or null input', () => {
      expect(validateKenyanPhoneNumber('').isValid).toBe(false);
      expect(validateKenyanPhoneNumber(null as any).isValid).toBe(false);
      expect(validateKenyanPhoneNumber(undefined as any).isValid).toBe(false);
    });

    test('should reject invalid length numbers', () => {
      expect(validateKenyanPhoneNumber('25471234567').isValid).toBe(false); // Too short
      expect(validateKenyanPhoneNumber('2547123456789').isValid).toBe(false); // Too long
      expect(validateKenyanPhoneNumber('071234567').isValid).toBe(false); // Too short
    });

    test('should reject non-Kenyan country codes', () => {
      const result = validateKenyanPhoneNumber('255712345678'); // Tanzania
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('254');
    });

    test('should reject invalid mobile prefixes', () => {
      const result = validateKenyanPhoneNumber('254612345678'); // Invalid prefix 61
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid Kenyan mobile prefix');
    });

    test('should accept all valid Kenyan mobile prefixes', () => {
      const validPrefixes = ['70', '71', '72', '73', '74', '75', '76', '77', '78', '79'];
      
      validPrefixes.forEach(prefix => {
        const phoneNumber = `254${prefix}1234567`;
        const result = validateKenyanPhoneNumber(phoneNumber);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(phoneNumber);
      });
    });

    test('should reject numbers with non-digit characters after normalization', () => {
      // This shouldn't happen with proper sanitization, but test edge case
      const result = validateKenyanPhoneNumber('254712345abc');
      expect(result.isValid).toBe(false);
    });
  });

  describe('isValidKenyanPhoneNumber', () => {
    test('should return true for valid numbers', () => {
      expect(isValidKenyanPhoneNumber('254712345678')).toBe(true);
      expect(isValidKenyanPhoneNumber('0712345678')).toBe(true);
      expect(isValidKenyanPhoneNumber('712345678')).toBe(true);
    });

    test('should return false for invalid numbers', () => {
      expect(isValidKenyanPhoneNumber('')).toBe(false);
      expect(isValidKenyanPhoneNumber('invalid')).toBe(false);
      expect(isValidKenyanPhoneNumber('254612345678')).toBe(false);
    });
  });

  describe('normalizeKenyanPhoneNumber', () => {
    test('should return normalized format for valid numbers', () => {
      expect(normalizeKenyanPhoneNumber('0712345678')).toBe('254712345678');
      expect(normalizeKenyanPhoneNumber('712345678')).toBe('254712345678');
      expect(normalizeKenyanPhoneNumber('254712345678')).toBe('254712345678');
      expect(normalizeKenyanPhoneNumber('+254 712 345 678')).toBe('254712345678');
    });

    test('should return null for invalid numbers', () => {
      expect(normalizeKenyanPhoneNumber('')).toBe(null);
      expect(normalizeKenyanPhoneNumber('invalid')).toBe(null);
      expect(normalizeKenyanPhoneNumber('254612345678')).toBe(null);
    });
  });

  describe('formatKenyanPhoneNumber', () => {
    test('should format valid numbers for display', () => {
      expect(formatKenyanPhoneNumber('254712345678')).toBe('+254 712 345 678');
      expect(formatKenyanPhoneNumber('0712345678')).toBe('+254 712 345 678');
      expect(formatKenyanPhoneNumber('712345678')).toBe('+254 712 345 678');
    });

    test('should return null for invalid numbers', () => {
      expect(formatKenyanPhoneNumber('')).toBe(null);
      expect(formatKenyanPhoneNumber('invalid')).toBe(null);
      expect(formatKenyanPhoneNumber('254612345678')).toBe(null);
    });
  });

  describe('Edge cases', () => {
    test('should handle various formatting characters', () => {
      const formats = [
        '254-712-345-678',
        '254.712.345.678',
        '254 712 345 678',
        '(254) 712 345 678',
        '+254712345678',
        'tel:254712345678'
      ];

      formats.forEach(format => {
        const result = validateKenyanPhoneNumber(format);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe('254712345678');
      });
    });

    test('should handle leading/trailing whitespace', () => {
      const result = validateKenyanPhoneNumber('  254712345678  ');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('254712345678');
    });

    test('should provide helpful error messages', () => {
      const testCases = [
        { input: '', expectedError: 'required' },
        { input: '25471234567', expectedError: '12 digits' },
        { input: '255712345678', expectedError: '254' },
        { input: '254612345678', expectedError: 'Invalid Kenyan mobile prefix' }
      ];

      testCases.forEach(({ input, expectedError }) => {
        const result = validateKenyanPhoneNumber(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain(expectedError);
      });
    });
  });
});