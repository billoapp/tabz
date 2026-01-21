/**
 * Phone number validation and formatting utilities for M-PESA payments
 * Handles Kenyan phone number formats and provides security sanitization
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  international?: string;
  error?: string;
  suggestions?: string[];
}

/**
 * Kenyan mobile network prefixes
 */
const KENYAN_PREFIXES = {
  safaricom: ['70', '71', '72', '74', '75', '76', '77', '78', '79'],
  airtel: ['73', '78', '79'],
  telkom: ['77'],
  equitel: ['76']
};

/**
 * Get all valid Kenyan prefixes
 */
const getAllValidPrefixes = (): string[] => {
  return Object.values(KENYAN_PREFIXES).flat();
};

/**
 * Sanitize phone number input to prevent injection attacks
 * Removes all non-digit characters and limits length
 */
export const sanitizePhoneNumber = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove all non-digit characters
  const digits = input.replace(/\D/g, '');
  
  // Limit to reasonable length (max 15 digits for international format)
  return digits.substring(0, 15);
};

/**
 * Format phone number for display (0XXX XXX XXX)
 */
export const formatPhoneNumberDisplay = (phoneNumber: string): string => {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  if (sanitized.length === 0) {
    return '';
  }
  
  // Handle different input lengths
  if (sanitized.length <= 3) {
    return sanitized;
  } else if (sanitized.length <= 6) {
    return `${sanitized.slice(0, 3)} ${sanitized.slice(3)}`;
  } else if (sanitized.length <= 9) {
    return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6)}`;
  } else if (sanitized.length === 10 && sanitized.startsWith('0')) {
    // Standard Kenyan format: 0XXX XXX XXX (10 digits)
    return `${sanitized.slice(0, 4)} ${sanitized.slice(4, 7)} ${sanitized.slice(7)}`;
  } else if (sanitized.length === 12 && sanitized.startsWith('254')) {
    // International format: 254 XXX XXX XXX
    return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)} ${sanitized.slice(9)}`;
  } else {
    // Default formatting - preserve all digits but format appropriately
    if (sanitized.length <= 12) {
      if (sanitized.startsWith('254')) {
        // International format
        return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)} ${sanitized.slice(9)}`;
      } else if (sanitized.startsWith('0')) {
        // Local format
        return `${sanitized.slice(0, 4)} ${sanitized.slice(4, 7)} ${sanitized.slice(7)}`;
      } else {
        // Generic formatting
        return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)} ${sanitized.slice(9)}`;
      }
    } else {
      // Very long numbers - truncate to reasonable length
      return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)} ${sanitized.slice(9, 12)}`;
    }
  }
};

/**
 * Convert phone number to international format (254XXXXXXXXX)
 */
export const convertToInternationalFormat = (phoneNumber: string): string => {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  if (sanitized.startsWith('254')) {
    return sanitized;
  } else if (sanitized.startsWith('0') && sanitized.length === 10) {
    return '254' + sanitized.substring(1);
  } else if (sanitized.length === 9) {
    return '254' + sanitized;
  }
  
  return sanitized;
};

/**
 * Validate Kenyan phone number format and provide detailed feedback
 */
export const validateKenyanPhoneNumber = (phoneNumber: string): PhoneValidationResult => {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  if (sanitized.length === 0) {
    return {
      isValid: false,
      error: 'Phone number is required',
      suggestions: ['Enter your M-PESA phone number (e.g., 0712345678)']
    };
  }
  
  let normalizedNumber = sanitized;
  let displayFormat = '';
  
  // Handle different input formats and convert to standard 10-digit format
  if (sanitized.startsWith('254')) {
    // International format: 254XXXXXXXXX -> 0XXXXXXXXX
    if (sanitized.length !== 12) {
      return {
        isValid: false,
        error: 'Invalid international format',
        suggestions: ['International format should be 254XXXXXXXXX (12 digits total)', 'Or use local format: 0XXXXXXXXX (10 digits)']
      };
    }
    normalizedNumber = sanitized.substring(3); // Remove 254 prefix
    displayFormat = `0${normalizedNumber}`;
  } else if (sanitized.startsWith('0')) {
    // Local format: 0XXXXXXXXX (preferred format)
    if (sanitized.length !== 10) {
      return {
        isValid: false,
        error: 'Phone number must be exactly 10 digits',
        suggestions: ['Kenyan phone numbers should be 10 digits starting with 0 (e.g., 0712345678)']
      };
    }
    normalizedNumber = sanitized.substring(1); // Remove 0 prefix for validation
    displayFormat = sanitized;
  } else if (sanitized.length === 9) {
    // Raw format: XXXXXXXXX -> 0XXXXXXXXX
    normalizedNumber = sanitized;
    displayFormat = `0${sanitized}`;
  } else {
    return {
      isValid: false,
      error: 'Invalid phone number format',
      suggestions: [
        'Use format: 0712345678 (10 digits starting with 0)',
        'Or: 254712345678 (international format)',
        'Or: 712345678 (9 digits without prefix)'
      ]
    };
  }
  
  // Validate that it starts with 7 (Kenyan mobile numbers)
  if (!normalizedNumber.startsWith('7')) {
    return {
      isValid: false,
      error: 'Kenyan mobile numbers must start with 07',
      suggestions: ['Phone number should start with 07 (e.g., 0712345678, 0723456789)']
    };
  }
  
  // Validate the prefix (first two digits after 7)
  const prefix = normalizedNumber.substring(0, 2);
  const validPrefixes = getAllValidPrefixes();
  
  if (!validPrefixes.includes(prefix)) {
    const suggestions = [
      'Safaricom: 070X, 071X, 072X, 074X, 075X, 076X, 077X, 078X, 079X',
      'Airtel: 073X, 078X, 079X',
      'Telkom: 077X',
      'Equitel: 076X'
    ];
    
    return {
      isValid: false,
      error: `Invalid network prefix: ${prefix}`,
      suggestions
    };
  }
  
  // All validations passed - return 10-digit format starting with 0
  const internationalFormat = `254${normalizedNumber}`;
  const formattedDisplay = formatPhoneNumberDisplay(displayFormat);
  
  return {
    isValid: true,
    formatted: formattedDisplay,
    international: internationalFormat
  };
};

/**
 * Get network provider from phone number
 */
export const getNetworkProvider = (phoneNumber: string): string | null => {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  let normalizedNumber = sanitized;
  
  // Normalize to 9-digit format
  if (sanitized.startsWith('254') && sanitized.length === 12) {
    normalizedNumber = sanitized.substring(3);
  } else if (sanitized.startsWith('0') && sanitized.length === 10) {
    normalizedNumber = sanitized.substring(1);
  }
  
  if (normalizedNumber.length !== 9) {
    return null;
  }
  
  const prefix = normalizedNumber.substring(0, 2);
  
  for (const [provider, prefixes] of Object.entries(KENYAN_PREFIXES)) {
    if (prefixes.includes(prefix)) {
      return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  }
  
  return null;
};

/**
 * Real-time input formatter for phone number fields
 * Returns formatted string suitable for display in input field
 */
export const formatPhoneNumberInput = (value: string, previousValue: string = ''): string => {
  const sanitized = sanitizePhoneNumber(value);
  
  // Handle deletion - if user is deleting, don't reformat aggressively
  if (value.length < previousValue.length) {
    return formatPhoneNumberDisplay(sanitized);
  }
  
  // Format based on current length and detected format
  if (sanitized.startsWith('254')) {
    // International format
    if (sanitized.length <= 3) {
      return sanitized;
    } else if (sanitized.length <= 6) {
      return `${sanitized.slice(0, 3)} ${sanitized.slice(3)}`;
    } else if (sanitized.length <= 9) {
      return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6)}`;
    } else {
      return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)} ${sanitized.slice(9)}`;
    }
  } else {
    // Local format (prefer 0XXXXXXXXX - 10 digits)
    if (sanitized.length === 0) {
      return '';
    } else if (sanitized.length === 1 && sanitized !== '0') {
      // Auto-prepend 0 for single digit that's not 0
      return `0${sanitized}`;
    } else if (sanitized.startsWith('0') && sanitized.length <= 10) {
      // Standard Kenyan format: 0XXX XXX XXX
      return formatPhoneNumberDisplay(sanitized);
    } else if (sanitized.length === 9 && sanitized.startsWith('7')) {
      // Convert 9-digit format to 10-digit format
      return formatPhoneNumberDisplay(`0${sanitized}`);
    } else {
      // Use general formatting
      return formatPhoneNumberDisplay(sanitized);
    }
  }
};

/**
 * Validate phone number for M-PESA payments specifically
 * Includes additional M-PESA specific validations
 */
export const validateMpesaPhoneNumber = (phoneNumber: string): PhoneValidationResult => {
  const baseValidation = validateKenyanPhoneNumber(phoneNumber);
  
  if (!baseValidation.isValid) {
    return baseValidation;
  }
  
  // Additional M-PESA specific validations
  const provider = getNetworkProvider(phoneNumber);
  
  // M-PESA is primarily Safaricom, but other networks also support mobile money
  if (provider && !['Safaricom', 'Airtel', 'Telkom'].includes(provider)) {
    return {
      isValid: false,
      error: `${provider} may not support M-PESA`,
      suggestions: ['M-PESA is available on Safaricom, Airtel Money on Airtel, and T-Kash on Telkom']
    };
  }
  
  return baseValidation;
};

/**
 * Get helpful formatting guidance based on current input
 */
export const getPhoneNumberGuidance = (phoneNumber: string): string[] => {
  const sanitized = sanitizePhoneNumber(phoneNumber);
  const guidance: string[] = [];
  
  if (sanitized.length === 0) {
    guidance.push('Enter your M-PESA phone number');
    guidance.push('Format: 0712345678 or 254712345678');
  } else if (sanitized.length < 9) {
    guidance.push('Continue typing your phone number');
    if (sanitized.startsWith('254')) {
      guidance.push(`Need ${12 - sanitized.length} more digits`);
    } else {
      guidance.push(`Need ${10 - sanitized.length} more digits`);
    }
  } else {
    const validation = validateMpesaPhoneNumber(phoneNumber);
    if (validation.isValid) {
      const provider = getNetworkProvider(phoneNumber);
      if (provider) {
        guidance.push(`${provider} number detected`);
      }
      guidance.push('Phone number looks good!');
    } else if (validation.suggestions) {
      guidance.push(...validation.suggestions);
    }
  }
  
  return guidance;
};