/**
 * Simplified phone number validation utility for M-Pesa payments
 * Validates and normalizes Kenyan phone numbers to 254XXXXXXXXX format
 * 
 * Requirements: 2.4 - THE System SHALL validate phone numbers are in correct Kenyan format (254XXXXXXXXX)
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string; // Always in 254XXXXXXXXX format
  formatted?: string; // Display format: +254 XXX XXX XXX
  error?: string;
}

/**
 * Valid Kenyan mobile network prefixes (after 254)
 * These are the first two digits after the country code
 */
const VALID_KENYAN_PREFIXES = [
  '70', '71', '72', '73', '74', '75', '76', '77', '78', '79'
];

/**
 * Sanitize phone number input by removing all non-digit characters
 */
function sanitizePhoneNumber(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/\D/g, '');
}

/**
 * Normalize phone number to 254XXXXXXXXX format
 * Handles various input formats:
 * - 0712345678 → 254712345678
 * - 712345678 → 254712345678  
 * - 254712345678 → 254712345678
 * - +254712345678 → 254712345678
 */
function normalizeToInternationalFormat(phoneNumber: string): string {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  // Already in international format
  if (sanitized.startsWith('254') && sanitized.length === 12) {
    return sanitized;
  }
  
  // Local format: 0XXXXXXXXX (10 digits)
  if (sanitized.startsWith('0') && sanitized.length === 10) {
    return '254' + sanitized.substring(1);
  }
  
  // Raw format: XXXXXXXXX (9 digits)
  if (sanitized.length === 9 && sanitized.startsWith('7')) {
    return '254' + sanitized;
  }
  
  // Return as-is if format is unrecognized
  return sanitized;
}

/**
 * Validate that a phone number is in correct Kenyan format
 * Returns validation result with normalized 254XXXXXXXXX format
 */
export function validateKenyanPhoneNumber(phoneNumber: string): PhoneValidationResult {
  // Handle empty or invalid input
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      error: 'Phone number is required'
    };
  }
  
  const normalized = normalizeToInternationalFormat(phoneNumber);
  
  // Check if normalized format is correct length
  if (normalized.length !== 12) {
    return {
      isValid: false,
      error: 'Phone number must be in format 254XXXXXXXXX (12 digits)'
    };
  }
  
  // Check if it starts with 254
  if (!normalized.startsWith('254')) {
    return {
      isValid: false,
      error: 'Phone number must start with 254 (Kenya country code)'
    };
  }
  
  // Check if the mobile prefix is valid (first two digits after 254)
  const mobilePrefix = normalized.substring(3, 5);
  if (!VALID_KENYAN_PREFIXES.includes(mobilePrefix)) {
    return {
      isValid: false,
      error: `Invalid Kenyan mobile prefix: ${mobilePrefix}. Must be one of: ${VALID_KENYAN_PREFIXES.join(', ')}`
    };
  }
  
  // Check if all characters are digits
  if (!/^\d{12}$/.test(normalized)) {
    return {
      isValid: false,
      error: 'Phone number must contain only digits'
    };
  }
  
  return {
    isValid: true,
    normalized,
    formatted: formatKenyanPhoneNumber(normalized) || undefined
  };
}

/**
 * Quick validation function that returns boolean
 * Useful for simple validation checks
 */
export function isValidKenyanPhoneNumber(phoneNumber: string): boolean {
  return validateKenyanPhoneNumber(phoneNumber).isValid;
}

/**
 * Normalize phone number to 254XXXXXXXXX format
 * Returns the normalized number or null if invalid
 */
export function normalizeKenyanPhoneNumber(phoneNumber: string): string | null {
  const result = validateKenyanPhoneNumber(phoneNumber);
  return result.isValid ? result.normalized! : null;
}

/**
 * Format phone number for display purposes
 * Returns format: +254 XXX XXX XXX
 */
export function formatKenyanPhoneNumber(phoneNumber: string): string | null {
  const normalized = normalizeKenyanPhoneNumber(phoneNumber);
  if (!normalized) {
    return null;
  }
  
  // Format as: +254 XXX XXX XXX
  return `+${normalized.substring(0, 3)} ${normalized.substring(3, 6)} ${normalized.substring(6, 9)} ${normalized.substring(9)}`;
}

// ===== COMPATIBILITY FUNCTIONS FOR EXISTING COMPONENTS =====

/**
 * Legacy function name for validateKenyanPhoneNumber
 * @deprecated Use validateKenyanPhoneNumber instead
 */
export function validateMpesaPhoneNumber(phoneNumber: string): PhoneValidationResult {
  return validateKenyanPhoneNumber(phoneNumber);
}

/**
 * Format phone number input with basic formatting
 * Adds spaces for readability: 0712 345 678
 */
export function formatPhoneNumberInput(newValue: string, previousValue: string = ''): string {
  // Remove all non-digits
  const digits = newValue.replace(/\D/g, '');
  
  // Limit to 12 digits (international format)
  const limitedDigits = digits.substring(0, 12);
  
  // Format based on length and starting digits
  if (limitedDigits.startsWith('254')) {
    // International format: 254 712 345 678
    if (limitedDigits.length <= 3) return limitedDigits;
    if (limitedDigits.length <= 6) return `${limitedDigits.substring(0, 3)} ${limitedDigits.substring(3)}`;
    if (limitedDigits.length <= 9) return `${limitedDigits.substring(0, 3)} ${limitedDigits.substring(3, 6)} ${limitedDigits.substring(6)}`;
    return `${limitedDigits.substring(0, 3)} ${limitedDigits.substring(3, 6)} ${limitedDigits.substring(6, 9)} ${limitedDigits.substring(9)}`;
  } else if (limitedDigits.startsWith('0')) {
    // Local format: 0712 345 678
    if (limitedDigits.length <= 4) return limitedDigits;
    if (limitedDigits.length <= 7) return `${limitedDigits.substring(0, 4)} ${limitedDigits.substring(4)}`;
    return `${limitedDigits.substring(0, 4)} ${limitedDigits.substring(4, 7)} ${limitedDigits.substring(7)}`;
  } else if (limitedDigits.startsWith('7')) {
    // Raw format: 712 345 678
    if (limitedDigits.length <= 3) return limitedDigits;
    if (limitedDigits.length <= 6) return `${limitedDigits.substring(0, 3)} ${limitedDigits.substring(3)}`;
    return `${limitedDigits.substring(0, 3)} ${limitedDigits.substring(3, 6)} ${limitedDigits.substring(6)}`;
  }
  
  // Default: just return the digits
  return limitedDigits;
}

/**
 * Get phone number guidance messages
 * Returns array of guidance strings
 */
export function getPhoneNumberGuidance(phoneNumber: string): string[] {
  if (!phoneNumber || phoneNumber.trim().length === 0) {
    return ['Enter your M-PESA phone number', 'Supported formats: 0712345678 or 254712345678'];
  }
  
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  if (sanitized.length < 9) {
    return ['Phone number too short', 'Enter at least 9 digits'];
  }
  
  if (sanitized.length > 12) {
    return ['Phone number too long', 'Maximum 12 digits allowed'];
  }
  
  if (!sanitized.startsWith('254') && !sanitized.startsWith('0') && !sanitized.startsWith('7')) {
    return ['Invalid format', 'Use 0712345678 or 254712345678'];
  }
  
  return ['Continue typing...', 'Format will be validated automatically'];
}

/**
 * Get network provider from phone number
 * Returns provider name or null if unknown
 */
export function getNetworkProvider(phoneNumber: string): string | null {
  const normalized = normalizeKenyanPhoneNumber(phoneNumber);
  if (!normalized) {
    return null;
  }
  
  // Get the mobile prefix (first two digits after 254)
  const prefix = normalized.substring(3, 5);
  
  // Map prefixes to providers
  const providerMap: Record<string, string> = {
    '70': 'Safaricom',
    '71': 'Safaricom', 
    '72': 'Safaricom',
    '74': 'Safaricom',
    '75': 'Airtel',
    '73': 'Airtel',
    '78': 'Airtel',
    '76': 'Safaricom',
    '77': 'Telkom',
    '79': 'Safaricom'
  };
  
  return providerMap[prefix] || 'Unknown Provider';
}

/**
 * Export sanitizePhoneNumber for external use
 */
export { sanitizePhoneNumber };

/**
 * Convert phone number to international format (254XXXXXXXXX)
 * Alias for normalizeKenyanPhoneNumber
 */
export function convertToInternationalFormat(phoneNumber: string): string {
  const normalized = normalizeKenyanPhoneNumber(phoneNumber);
  if (!normalized) {
    throw new Error('Invalid phone number format');
  }
  return normalized;
}

/**
 * Export normalizeToInternationalFormat for external use
 */
export { normalizeToInternationalFormat };