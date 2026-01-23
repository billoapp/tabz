/**
 * Customer Payment Integration Example
 * Shows how to integrate M-Pesa payments in the customer app
 */

import { generateCustomerIdentifier, validateCustomerPaymentContext } from '../utils/customer-context';

/**
 * Example: Initiate M-Pesa payment from customer app
 * This shows how the customer app should call the payment API
 */
export async function initiateCustomerPayment(
  deviceId: string,
  barId: string,
  phoneNumber: string,
  amount: number
): Promise<{
  success: boolean;
  transactionId?: string;
  checkoutRequestId?: string;
  customerMessage?: string;
  error?: string;
}> {
  try {
    // Step 1: Generate customer identifier
    const customerIdentifier = generateCustomerIdentifier(deviceId, barId);
    
    // Step 2: Validate payment context
    const validation = validateCustomerPaymentContext({
      barId,
      customerIdentifier,
      deviceId,
      phoneNumber,
      amount
    });
    
    if (!validation.isValid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }
    
    // Step 3: Call the payment API with customer context
    const response = await fetch('/api/payments/mpesa/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barId,
        customerIdentifier,
        phoneNumber,
        amount
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Payment initiation failed'
      };
    }
    
    return {
      success: true,
      transactionId: result.transactionId,
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage
    };
    
  } catch (error) {
    console.error('Payment initiation error:', error);
    return {
      success: false,
      error: 'Network error during payment initiation'
    };
  }
}

/**
 * Example: Get customer's current tab information
 * This shows how to get the customer's tab before initiating payment
 */
export async function getCustomerTab(
  deviceId: string,
  barId: string
): Promise<{
  success: boolean;
  tab?: {
    id: string;
    tabNumber: number;
    status: string;
    balance: number;
  };
  error?: string;
}> {
  try {
    const customerIdentifier = generateCustomerIdentifier(deviceId, barId);
    
    const response = await fetch(`/api/tabs/customer?barId=${barId}&customerIdentifier=${customerIdentifier}`);
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to get tab information'
      };
    }
    
    return {
      success: true,
      tab: result.tab
    };
    
  } catch (error) {
    console.error('Get tab error:', error);
    return {
      success: false,
      error: 'Network error getting tab information'
    };
  }
}

/**
 * Example: Complete payment flow with validation
 * This shows the complete flow from tab validation to payment initiation
 */
export async function completePaymentFlow(
  deviceId: string,
  barId: string,
  phoneNumber: string,
  amount: number
): Promise<{
  success: boolean;
  transactionId?: string;
  checkoutRequestId?: string;
  customerMessage?: string;
  error?: string;
  tabInfo?: any;
}> {
  try {
    // Step 1: Get customer's tab information
    const tabResult = await getCustomerTab(deviceId, barId);
    
    if (!tabResult.success) {
      return {
        success: false,
        error: tabResult.error || 'No active tab found'
      };
    }
    
    // Step 2: Validate tab status
    if (tabResult.tab?.status !== 'open') {
      return {
        success: false,
        error: 'Tab is not open for payments'
      };
    }
    
    // Step 3: Validate payment amount against tab balance (optional)
    if (tabResult.tab?.balance && amount > tabResult.tab.balance) {
      console.warn(`Payment amount (${amount}) exceeds tab balance (${tabResult.tab.balance})`);
      // Allow overpayment but warn the user
    }
    
    // Step 4: Initiate payment
    const paymentResult = await initiateCustomerPayment(deviceId, barId, phoneNumber, amount);
    
    return {
      ...paymentResult,
      tabInfo: tabResult.tab
    };
    
  } catch (error) {
    console.error('Complete payment flow error:', error);
    return {
      success: false,
      error: 'Payment flow failed'
    };
  }
}

/**
 * Example: React hook for customer payments (pseudo-code)
 * This shows how to integrate payments in a React component
 */
export function useCustomerPayment() {
  // This would be implemented in the actual customer app
  // using React hooks and the functions above
  
  return {
    initiatePayment: initiateCustomerPayment,
    getTab: getCustomerTab,
    completePaymentFlow
  };
}

/**
 * Example: Error handling for customer payments
 * This shows how to handle different types of payment errors
 */
export function handlePaymentError(error: string): {
  userMessage: string;
  shouldRetry: boolean;
  action?: string;
} {
  // Map technical errors to user-friendly messages
  const errorMappings: Record<string, { message: string; retry: boolean; action?: string }> = {
    'No open tab found': {
      message: 'Please create a tab first before making a payment.',
      retry: false,
      action: 'create_tab'
    },
    'Tab is not open for payments': {
      message: 'Your tab is not available for payments. Please contact staff.',
      retry: false,
      action: 'contact_staff'
    },
    'Payment service not configured': {
      message: 'Mobile payments are not available at this location.',
      retry: false
    },
    'Payment service temporarily unavailable': {
      message: 'Mobile payments are temporarily unavailable. Please try again later.',
      retry: true
    },
    'Rate limit exceeded': {
      message: 'Too many payment attempts. Please wait a moment before trying again.',
      retry: true
    },
    'Invalid phone number': {
      message: 'Please enter a valid phone number.',
      retry: false,
      action: 'fix_phone'
    }
  };
  
  // Find matching error or use default
  for (const [key, mapping] of Object.entries(errorMappings)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return {
        userMessage: mapping.message,
        shouldRetry: mapping.retry,
        action: mapping.action
      };
    }
  }
  
  // Default error handling
  return {
    userMessage: 'Payment failed. Please try again or contact staff for assistance.',
    shouldRetry: true
  };
}