/**
 * Property-Based Test: Customer Payment Confirmation Completeness
 * Feature: mpesa-payment-notifications
 * Task: 5.2 Write property test for customer payment confirmations
 * Property 8: Customer Payment Confirmation Completeness
 * 
 * For any M-Pesa payment (successful or failed), customers should receive complete 
 * confirmation messages containing payment status, updated balance, transaction reference, 
 * and appropriate action options.
 * 
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import * as fc from 'fast-check';

// Mock the customer menu page payment subscription handler
interface PaymentNotificationPayload {
  eventType: 'INSERT' | 'UPDATE';
  new: {
    id: string;
    tab_id: string;
    amount: number;
    method: 'mpesa' | 'cash' | 'card';
    status: 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';
    reference?: string;
    metadata?: {
      Body?: {
        stkCallback?: {
          ResultDesc?: string;
          CallbackMetadata?: {
            Item?: Array<{
              Name: string;
              Value: string | number;
            }>;
          };
        };
      };
      failure_reason?: string;
      mpesa_receipt_number?: string;
    };
    created_at: string;
    updated_at: string;
  };
  old?: {
    id: string;
    status: 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';
  };
}

interface Tab {
  id: string;
  bar_id: string;
  status: 'open' | 'overdue' | 'closed';
  tab_number?: number;
}

interface Order {
  id: string;
  tab_id: string;
  total: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface Payment {
  id: string;
  tab_id: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
}

interface NotificationPrefs {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface ToastMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number;
}

// Mock implementations
let mockToastMessages: ToastMessage[] = [];
let mockVibrationPatterns: number[][] = [];
let mockSoundPlayed = false;

const mockShowToast = (toast: ToastMessage) => {
  mockToastMessages.push(toast);
};

const mockBuzz = (pattern: number[]) => {
  mockVibrationPatterns.push(pattern);
};

const mockPlayAcceptanceSound = () => {
  mockSoundPlayed = true;
};

// Helper function to format currency
const tempFormatCurrency = (amount: number): string => {
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

// Simulate the customer payment subscription handler
const simulateCustomerPaymentSubscriptionHandler = (
  payload: PaymentNotificationPayload,
  tab: Tab,
  orders: Order[],
  payments: Payment[],
  notificationPrefs: NotificationPrefs
): {
  toastShown: boolean;
  toastMessage?: ToastMessage;
  vibrationTriggered: boolean;
  soundTriggered: boolean;
  balanceCalculated: boolean;
  updatedBalance?: number;
  autoCloseDetected: boolean;
} => {
  // Reset mocks
  mockToastMessages = [];
  mockVibrationPatterns = [];
  mockSoundPlayed = false;

  const payment = payload.new;
  const previousPayment = payload.old;

  // Handle successful payment confirmations (Requirement 2.2)
  if (payment?.status === 'success' && 
      (!previousPayment || previousPayment.status !== 'success')) {
    
    // Extract payment details
    const paymentAmount = parseFloat(payment.amount.toString());
    const paymentMethod = payment.method || 'unknown';
    let mpesaReceipt = null;
    let transactionDate = null;
    
    // Extract M-Pesa specific details from metadata
    if (paymentMethod === 'mpesa' && payment.metadata) {
      try {
        const metadata = payment.metadata;
        if (metadata.Body?.stkCallback?.CallbackMetadata?.Item) {
          const items = metadata.Body.stkCallback.CallbackMetadata.Item;
          const receiptItem = items.find((item: any) => item.Name === 'MpesaReceiptNumber');
          const dateItem = items.find((item: any) => item.Name === 'TransactionDate');
          
          if (receiptItem) mpesaReceipt = receiptItem.Value.toString();
          if (dateItem) {
            const dateStr = dateItem.Value.toString();
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const hour = parseInt(dateStr.substring(8, 10));
            const minute = parseInt(dateStr.substring(10, 12));
            const second = parseInt(dateStr.substring(12, 14));
            transactionDate = new Date(year, month, day, hour, minute, second);
          }
        }
      } catch (error) {
        // Error parsing metadata
      }
    }
    
    // Calculate updated balance (Requirement 2.2)
    const tabTotal = orders
      .filter(order => order.status === 'confirmed')
      .reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
    const paidTotal = payments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) + paymentAmount;
    const updatedBalance = Math.max(0, tabTotal - paidTotal);
    
    // Check if tab should be auto-closed (Requirement 2.4)
    const shouldAutoClose = updatedBalance <= 0 && tab?.status === 'overdue';
    
    // Show comprehensive payment confirmation (Requirement 2.2)
    const confirmationMessage = [
      `${tempFormatCurrency(paymentAmount)} payment successful`,
      mpesaReceipt ? `Receipt: ${mpesaReceipt}` : null,
      updatedBalance > 0 ? `Balance: ${tempFormatCurrency(updatedBalance)}` : 'Tab fully paid!',
      shouldAutoClose ? 'Tab will be closed automatically' : null
    ].filter(Boolean).join(' • ');
    
    mockShowToast({
      type: 'success',
      title: '✅ Payment Confirmed!',
      message: confirmationMessage,
      duration: shouldAutoClose ? 12000 : 8000
    });
    
    // Trigger notification sounds and vibration (Requirement 2.1)
    if (notificationPrefs.soundEnabled) {
      mockPlayAcceptanceSound();
    }
    if (notificationPrefs.vibrationEnabled) {
      mockBuzz([200, 100, 200]); // Success vibration pattern
    }

    return {
      toastShown: true,
      toastMessage: mockToastMessages[0],
      vibrationTriggered: mockVibrationPatterns.length > 0,
      soundTriggered: mockSoundPlayed,
      balanceCalculated: true,
      updatedBalance,
      autoCloseDetected: shouldAutoClose
    };
  }
  
  // Handle failed payment notifications (Requirement 2.3)
  else if (payment?.status === 'failed' && 
           (!previousPayment || previousPayment.status !== 'failed')) {
    
    const paymentAmount = parseFloat(payment.amount.toString());
    let failureReason = 'Payment was declined';
    
    // Extract failure reason from metadata
    if (payment.metadata) {
      try {
        if (payment.metadata.Body?.stkCallback?.ResultDesc) {
          failureReason = payment.metadata.Body.stkCallback.ResultDesc;
        } else if (payment.metadata.failure_reason) {
          failureReason = payment.metadata.failure_reason;
        }
      } catch (error) {
        // Error parsing failure metadata
      }
    }
    
    // Show payment failure notification with retry option (Requirement 2.3)
    mockShowToast({
      type: 'error',
      title: '❌ Payment Failed',
      message: `${tempFormatCurrency(paymentAmount)} payment failed: ${failureReason}. Please try again or use a different payment method.`,
      duration: 10000
    });
    
    // Trigger error notification
    if (notificationPrefs.vibrationEnabled) {
      mockBuzz([100, 50, 100, 50, 100]); // Error vibration pattern
    }

    return {
      toastShown: true,
      toastMessage: mockToastMessages[0],
      vibrationTriggered: mockVibrationPatterns.length > 0,
      soundTriggered: false,
      balanceCalculated: false,
      autoCloseDetected: false
    };
  }
  
  // Handle processing/pending status updates (Requirement 2.5)
  else if (payment?.status === 'pending' && 
           (!previousPayment || previousPayment.status !== 'pending')) {
    
    const paymentAmount = parseFloat(payment.amount.toString());
    
    // Show processing notification (Requirement 2.5)
    mockShowToast({
      type: 'info',
      title: '⏳ Payment Processing',
      message: `${tempFormatCurrency(paymentAmount)} payment is being processed. Please wait for confirmation.`,
      duration: 5000
    });

    return {
      toastShown: true,
      toastMessage: mockToastMessages[0],
      vibrationTriggered: false,
      soundTriggered: false,
      balanceCalculated: false,
      autoCloseDetected: false
    };
  }
  
  // Handle timeout/cancelled payments
  else if ((payment?.status === 'cancelled' || payment?.status === 'timeout') && 
           previousPayment && previousPayment.status !== payment.status) {
    
    const paymentAmount = parseFloat(payment.amount.toString());
    const statusText = payment.status === 'timeout' ? 'timed out' : 'was cancelled';
    
    mockShowToast({
      type: 'error',
      title: '❌ Payment Not Completed',
      message: `${tempFormatCurrency(paymentAmount)} payment ${statusText}. Please try again.`,
      duration: 8000
    });

    return {
      toastShown: true,
      toastMessage: mockToastMessages[0],
      vibrationTriggered: false,
      soundTriggered: false,
      balanceCalculated: false,
      autoCloseDetected: false
    };
  }

  return {
    toastShown: false,
    vibrationTriggered: false,
    soundTriggered: false,
    balanceCalculated: false,
    autoCloseDetected: false
  };
};

describe('Customer Payment Confirmation Property Tests', () => {
  /**
   * Property 8: Customer Payment Confirmation Completeness
   * For any M-Pesa payment (successful or failed), customers should receive complete 
   * confirmation messages containing payment status, updated balance, transaction reference, 
   * and appropriate action options.
   * Validates: Requirements 2.2, 2.3, 2.4
   */
  test('Property 8: Customer Payment Confirmation Completeness', () => {
    fc.assert(fc.property(
      fc.record({
        // Payment data
        paymentId: fc.string({ minLength: 10, maxLength: 50 }),
        tabId: fc.string({ minLength: 10, maxLength: 50 }),
        amount: fc.integer({ min: 50, max: 10000 }),
        method: fc.constantFrom('mpesa', 'cash', 'card'),
        status: fc.constantFrom('success', 'failed', 'pending', 'cancelled', 'timeout'),
        previousStatus: fc.option(fc.constantFrom('pending', 'success', 'failed'), { nil: undefined }),
        
        // M-Pesa specific data
        mpesaReceiptNumber: fc.option(fc.string({ minLength: 8, maxLength: 15 }), { nil: undefined }),
        failureReason: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
        
        // Tab data
        tabStatus: fc.constantFrom('open', 'overdue', 'closed'),
        tabNumber: fc.option(fc.integer({ min: 1, max: 999 }), { nil: undefined }),
        
        // Orders and payments for balance calculation
        confirmedOrdersTotal: fc.integer({ min: 0, max: 20000 }),
        existingPaymentsTotal: fc.integer({ min: 0, max: 15000 }),
        
        // Notification preferences
        notificationsEnabled: fc.boolean(),
        soundEnabled: fc.boolean(),
        vibrationEnabled: fc.boolean()
      }),
      (config) => {
        // Create test data
        const tab: Tab = {
          id: config.tabId,
          bar_id: 'test-bar-id',
          status: config.tabStatus,
          tab_number: config.tabNumber
        };

        const orders: Order[] = config.confirmedOrdersTotal > 0 ? [{
          id: 'order-1',
          tab_id: config.tabId,
          total: config.confirmedOrdersTotal,
          status: 'confirmed'
        }] : [];

        const payments: Payment[] = config.existingPaymentsTotal > 0 ? [{
          id: 'payment-1',
          tab_id: config.tabId,
          amount: config.existingPaymentsTotal,
          status: 'success'
        }] : [];

        const notificationPrefs: NotificationPrefs = {
          notificationsEnabled: config.notificationsEnabled,
          soundEnabled: config.soundEnabled,
          vibrationEnabled: config.vibrationEnabled
        };

        // Create payment metadata
        const metadata: any = {};
        if (config.method === 'mpesa') {
          if (config.status === 'success' && config.mpesaReceiptNumber) {
            metadata.Body = {
              stkCallback: {
                CallbackMetadata: {
                  Item: [
                    { Name: 'MpesaReceiptNumber', Value: config.mpesaReceiptNumber },
                    { Name: 'TransactionDate', Value: '20240101120000' }
                  ]
                }
              }
            };
          } else if (config.status === 'failed' && config.failureReason) {
            metadata.Body = {
              stkCallback: {
                ResultDesc: config.failureReason
              }
            };
          }
        }

        // Create payment payload
        const payload: PaymentNotificationPayload = {
          eventType: 'UPDATE',
          new: {
            id: config.paymentId,
            tab_id: config.tabId,
            amount: config.amount,
            method: config.method,
            status: config.status,
            reference: `ref-${config.paymentId}`,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          old: config.previousStatus ? {
            id: config.paymentId,
            status: config.previousStatus
          } : undefined
        };

        // Execute the payment subscription handler
        const result = simulateCustomerPaymentSubscriptionHandler(
          payload,
          tab,
          orders,
          payments,
          notificationPrefs
        );

        // Property assertions based on payment status
        if (config.status === 'success' && (!config.previousStatus || config.previousStatus !== 'success')) {
          // Successful payment properties
          expect(result.toastShown).toBe(true);
          expect(result.toastMessage?.type).toBe('success');
          expect(result.toastMessage?.title).toBe('✅ Payment Confirmed!');
          
          // Message should contain payment amount
          expect(result.toastMessage?.message).toContain(tempFormatCurrency(config.amount));
          
          // Message should contain receipt number if available
          if (config.method === 'mpesa' && config.mpesaReceiptNumber) {
            expect(result.toastMessage?.message).toContain(`Receipt: ${config.mpesaReceiptNumber}`);
          }
          
          // Balance should be calculated
          expect(result.balanceCalculated).toBe(true);
          expect(result.updatedBalance).toBeDefined();
          
          // Balance calculation should be correct
          const expectedBalance = Math.max(0, config.confirmedOrdersTotal - (config.existingPaymentsTotal + config.amount));
          expect(result.updatedBalance).toBe(expectedBalance);
          
          // Message should indicate balance status
          if (expectedBalance > 0) {
            expect(result.toastMessage?.message).toContain(`Balance: ${tempFormatCurrency(expectedBalance)}`);
          } else {
            expect(result.toastMessage?.message).toContain('Tab fully paid!');
          }
          
          // Auto-close detection for overdue tabs
          if (config.tabStatus === 'overdue' && expectedBalance <= 0) {
            expect(result.autoCloseDetected).toBe(true);
            expect(result.toastMessage?.message).toContain('Tab will be closed automatically');
            expect(result.toastMessage?.duration).toBe(12000);
          } else {
            expect(result.autoCloseDetected).toBe(false);
            expect(result.toastMessage?.duration).toBe(8000);
          }
          
          // Notification preferences should be respected
          expect(result.soundTriggered).toBe(config.soundEnabled);
          expect(result.vibrationTriggered).toBe(config.vibrationEnabled);
          
        } else if (config.status === 'failed' && (!config.previousStatus || config.previousStatus !== 'failed')) {
          // Failed payment properties
          expect(result.toastShown).toBe(true);
          expect(result.toastMessage?.type).toBe('error');
          expect(result.toastMessage?.title).toBe('❌ Payment Failed');
          
          // Message should contain payment amount
          expect(result.toastMessage?.message).toContain(tempFormatCurrency(config.amount));
          
          // Message should contain failure reason
          const expectedReason = config.failureReason || 'Payment was declined';
          expect(result.toastMessage?.message).toContain(expectedReason);
          
          // Message should suggest retry
          expect(result.toastMessage?.message).toContain('Please try again or use a different payment method');
          
          // Duration should be longer for error messages
          expect(result.toastMessage?.duration).toBe(10000);
          
          // Vibration should be triggered if enabled (different pattern for errors)
          expect(result.vibrationTriggered).toBe(config.vibrationEnabled);
          expect(result.soundTriggered).toBe(false); // No sound for failures
          
        } else if (config.status === 'pending' && (!config.previousStatus || config.previousStatus !== 'pending')) {
          // Processing payment properties
          expect(result.toastShown).toBe(true);
          expect(result.toastMessage?.type).toBe('info');
          expect(result.toastMessage?.title).toBe('⏳ Payment Processing');
          
          // Message should contain payment amount
          expect(result.toastMessage?.message).toContain(tempFormatCurrency(config.amount));
          
          // Message should indicate processing
          expect(result.toastMessage?.message).toContain('is being processed');
          expect(result.toastMessage?.message).toContain('Please wait for confirmation');
          
          // Duration should be shorter for info messages
          expect(result.toastMessage?.duration).toBe(5000);
          
          // No notifications for processing status
          expect(result.vibrationTriggered).toBe(false);
          expect(result.soundTriggered).toBe(false);
          
        } else if ((config.status === 'cancelled' || config.status === 'timeout') && 
                   config.previousStatus && config.previousStatus !== config.status) {
          // Cancelled/timeout payment properties
          expect(result.toastShown).toBe(true);
          expect(result.toastMessage?.type).toBe('error');
          expect(result.toastMessage?.title).toBe('❌ Payment Not Completed');
          
          // Message should contain payment amount
          expect(result.toastMessage?.message).toContain(tempFormatCurrency(config.amount));
          
          // Message should indicate status
          const expectedStatusText = config.status === 'timeout' ? 'timed out' : 'was cancelled';
          expect(result.toastMessage?.message).toContain(expectedStatusText);
          
          // Message should suggest retry
          expect(result.toastMessage?.message).toContain('Please try again');
          
          // Duration should be moderate
          expect(result.toastMessage?.duration).toBe(8000);
          
        } else {
          // No notification should be shown for unchanged status
          expect(result.toastShown).toBe(false);
        }
      }
    ), { 
      numRuns: 100,
      verbose: true
    });
  });

  /**
   * Additional property test for M-Pesa specific metadata parsing
   */
  test('Property: M-Pesa Metadata Parsing Robustness', () => {
    fc.assert(fc.property(
      fc.record({
        paymentId: fc.string({ minLength: 10, maxLength: 50 }),
        tabId: fc.string({ minLength: 10, maxLength: 50 }),
        amount: fc.integer({ min: 50, max: 10000 }),
        receiptNumber: fc.option(fc.string({ minLength: 8, maxLength: 15 }), { nil: undefined }),
        malformedMetadata: fc.boolean(),
        soundEnabled: fc.boolean(),
        vibrationEnabled: fc.boolean()
      }),
      (config) => {
        const tab: Tab = {
          id: config.tabId,
          bar_id: 'test-bar-id',
          status: 'open'
        };

        const notificationPrefs: NotificationPrefs = {
          notificationsEnabled: true,
          soundEnabled: config.soundEnabled,
          vibrationEnabled: config.vibrationEnabled
        };

        // Create metadata - sometimes malformed
        let metadata: any = undefined;
        if (config.receiptNumber && !config.malformedMetadata) {
          metadata = {
            Body: {
              stkCallback: {
                CallbackMetadata: {
                  Item: [
                    { Name: 'MpesaReceiptNumber', Value: config.receiptNumber },
                    { Name: 'TransactionDate', Value: '20240101120000' }
                  ]
                }
              }
            }
          };
        } else if (config.malformedMetadata) {
          // Intentionally malformed metadata
          metadata = {
            Body: {
              stkCallback: {
                CallbackMetadata: "invalid structure"
              }
            }
          };
        }

        const payload: PaymentNotificationPayload = {
          eventType: 'UPDATE',
          new: {
            id: config.paymentId,
            tab_id: config.tabId,
            amount: config.amount,
            method: 'mpesa',
            status: 'success',
            metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          old: {
            id: config.paymentId,
            status: 'pending'
          }
        };

        // Execute handler - should not crash even with malformed metadata
        const result = simulateCustomerPaymentSubscriptionHandler(
          payload,
          tab,
          [],
          [],
          notificationPrefs
        );

        // Should always show success notification
        expect(result.toastShown).toBe(true);
        expect(result.toastMessage?.type).toBe('success');
        
        // Should contain payment amount regardless of metadata issues
        expect(result.toastMessage?.message).toContain(tempFormatCurrency(config.amount));
        
        // Should contain receipt number only if metadata is valid
        if (config.receiptNumber && !config.malformedMetadata) {
          expect(result.toastMessage?.message).toContain(`Receipt: ${config.receiptNumber}`);
        } else {
          expect(result.toastMessage?.message).not.toContain('Receipt:');
        }
        
        // Should respect notification preferences regardless of metadata
        expect(result.soundTriggered).toBe(config.soundEnabled);
        expect(result.vibrationTriggered).toBe(config.vibrationEnabled);
      }
    ), { 
      numRuns: 50,
      verbose: true
    });
  });
});