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
  } else if (sanitized.length <= 12 && sanitized.startsWith('254')) {
    // International format: 254 XXX XXX XXX
    return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)} ${sanitized.slice(9)}`;
  } else {
    // Default formatting for longer numbers
    return `${sanitized.slice(0, 3)} ${sanitized.slice(3, 6)} ${sanitized.slice(6, 9)}`;
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
  
  // Check for minimum length
  if (sanitized.length < 9) {
    return {
      isValid: false,
      error: 'Phone number is too short',
      suggestions: ['Kenyan phone numbers have 9 digits after the prefix (e.g., 0712345678)']
    };
  }
  
  let normalizedNumber = sanitized;
  let displayFormat = '';
  
  // Handle different input formats
  if (sanitized.startsWith('254')) {
    // International format: 254XXXXXXXXX
    if (sanitized.length !== 12) {
      return {
        isValid: false,
        error: 'Invalid international format',
        suggestions: ['International format should be 254XXXXXXXXX (12 digits total)']
      };
    }
    normalizedNumber = sanitized.substring(3); // Remove 254 prefix
    displayFormat = `0${normalizedNumber}`;
  } else if (sanitized.startsWith('0')) {
    // Local format: 0XXXXXXXXX
    if (sanitized.length !== 10) {
      return {
        isValid: false,
        error: 'Invalid local format',
        suggestions: ['Local format should be 0XXXXXXXXX (10 digits total)']
      };
    }
    normalizedNumber = sanitized.substring(1); // Remove 0 prefix
    displayFormat = sanitized;
  } else if (sanitized.length === 9) {
    // Raw format: XXXXXXXXX
    normalizedNumber = sanitized;
    displayFormat = `0${sanitized}`;
  } else {
    return {
      isValid: false,
      error: 'Invalid phone number format',
      suggestions: [
        'Use format: 0712345678 (local)',
        'Or: 254712345678 (international)',
        'Or: 712345678 (without prefix)'
      ]
    };
  }
  
  // Validate the prefix (first two digits after country/local code)
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
  
  // All validations passed
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
    // Local format (assume 0XXXXXXXXX)
    if (sanitized.length === 0) {
      return '';
    } else if (sanitized.length === 1 && sanitized !== '0') {
      // Auto-prepend 0 for single digit that's not 0
      return `0${sanitized}`;
    } else {
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