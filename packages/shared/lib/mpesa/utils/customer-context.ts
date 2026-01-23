/**
 * Customer Context Utilities for M-Pesa Payments
 * Helps resolve customer context for payment processing
 */

/**
 * Generate customer identifier from device ID and bar ID
 * This matches the format used in the customer app's tab creation
 * @param deviceId - The customer's device ID
 * @param barId - The bar ID where the customer has a tab
 * @returns Customer identifier string
 */
export function generateCustomerIdentifier(deviceId: string, barId: string): string {
  return `${deviceId}_${barId}`;
}

/**
 * Parse customer identifier to extract device ID and bar ID
 * @param customerIdentifier - The customer identifier string
 * @returns Object with deviceId and barId, or null if invalid format
 */
export function parseCustomerIdentifier(customerIdentifier: string): { deviceId: string; barId: string } | null {
  const parts = customerIdentifier.split('_');
  if (parts.length < 2) {
    return null;
  }
  
  // The last part is the bar ID, everything before is the device ID
  const barId = parts[parts.length - 1];
  const deviceId = parts.slice(0, -1).join('_');
  
  return { deviceId, barId };
}

/**
 * Validate customer identifier format
 * @param customerIdentifier - The customer identifier to validate
 * @returns boolean indicating if the format is valid
 */
export function isValidCustomerIdentifier(customerIdentifier: string): boolean {
  if (!customerIdentifier || typeof customerIdentifier !== 'string') {
    return false;
  }
  
  const parsed = parseCustomerIdentifier(customerIdentifier);
  return parsed !== null && parsed.deviceId.length > 0 && parsed.barId.length > 0;
}

/**
 * Customer payment context interface
 */
export interface CustomerPaymentContext {
  barId: string;
  customerIdentifier: string;
  deviceId: string;
  phoneNumber: string;
  amount: number;
}

/**
 * Validate customer payment context
 * @param context - The customer payment context to validate
 * @returns Object with validation result and errors
 */
export function validateCustomerPaymentContext(context: Partial<CustomerPaymentContext>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!context.barId || typeof context.barId !== 'string') {
    errors.push('Bar ID is required');
  }
  
  if (!context.customerIdentifier || typeof context.customerIdentifier !== 'string') {
    errors.push('Customer identifier is required');
  } else if (!isValidCustomerIdentifier(context.customerIdentifier)) {
    errors.push('Customer identifier format is invalid');
  }
  
  if (!context.deviceId || typeof context.deviceId !== 'string') {
    errors.push('Device ID is required');
  }
  
  if (!context.phoneNumber || typeof context.phoneNumber !== 'string') {
    errors.push('Phone number is required');
  }
  
  if (!context.amount || typeof context.amount !== 'number' || context.amount <= 0) {
    errors.push('Amount must be a positive number');
  }
  
  // Validate that customer identifier matches device ID and bar ID
  if (context.customerIdentifier && context.deviceId && context.barId) {
    const expectedIdentifier = generateCustomerIdentifier(context.deviceId, context.barId);
    if (context.customerIdentifier !== expectedIdentifier) {
      errors.push('Customer identifier does not match device ID and bar ID');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}