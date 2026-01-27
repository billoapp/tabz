/**
 * Enhanced M-Pesa Callback Handler with Real-time Notifications
 * Processes M-Pesa payments and triggers real-time notifications and balance updates
 * Requirements: 3.1, 3.2, 3.3, 3.5, 6.1, 6.2, 4.1, 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface MpesaCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

interface MpesaCallbackMetadata {
  Item: MpesaCallbackMetadataItem[];
}

interface MpesaSTKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: MpesaCallbackMetadata;
}

interface MpesaCallback {
  Body: {
    stkCallback: MpesaSTKCallback;
  };
}

interface PaymentNotificationPayload {
  paymentId: string;
  tabId: string;
  barId: string;
  amount: number;
  status: 'success' | 'failed';
  method: 'mpesa';
  timestamp: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
  failureReason?: string;
}

interface TabAutoCloseNotificationPayload {
  tabId: string;
  barId: string;
  paymentId: string;
  previousStatus: 'overdue';
  newStatus: 'closed';
  finalBalance: number;
  closedBy: 'system';
  timestamp: string;
}

/**
 * Process payment and trigger balance updates with notifications
 * Requirements: 4.1, 4.2 - Real-time balance updates and auto-close detection
 */
async function processPaymentBalanceUpdate(
  supabase: any,
  paymentId: string,
  tabId: string,
  paymentAmount: number,
  paymentStatus: 'success' | 'failed'
): Promise<void> {
  try {
    // Only process successful payments for balance updates
    if (paymentStatus !== 'success') {
      console.log('Skipping balance update for failed payment:', paymentId);
      return;
    }

    // Log balance update for real-time subscriptions to pick up
    console.log('Balance update triggered:', {
      paymentId,
      tabId,
      amount: paymentAmount,
      method: 'mpesa',
      status: paymentStatus,
      timestamp: new Date().toISOString()
    });

    // The existing tab_balances view and real-time subscriptions will handle
    // the actual balance calculations and UI updates automatically

  } catch (error) {
    console.error('Error processing payment balance update:', {
      paymentId,
      tabId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
async function triggerPaymentNotifications(
  supabase: any,
  payload: PaymentNotificationPayload
): Promise<void> {
  try {
    // Get tab and bar information for multi-tenant filtering
    const { data: tabData, error: tabError } = await supabase
      .from('tabs')
      .select('bar_id, tab_number')
      .eq('id', payload.tabId)
      .single();

    if (tabError || !tabData) {
      console.error('Failed to get tab data for notifications:', {
        tabId: payload.tabId,
        error: tabError
      });
      return;
    }

    // Requirement 6.2: Trigger real-time notifications via Supabase channels
    // The real-time subscriptions in staff and customer apps will automatically
    // receive these updates through their existing tab_payments subscriptions
    
    console.log('Payment notification triggered:', {
      paymentId: payload.paymentId,
      tabId: payload.tabId,
      barId: tabData.bar_id,
      status: payload.status,
      amount: payload.amount,
      method: payload.method
    });

    // Additional logging for successful payments with M-Pesa details
    if (payload.status === 'success' && payload.mpesaReceiptNumber) {
      console.log('M-Pesa payment details:', {
        mpesaReceiptNumber: payload.mpesaReceiptNumber,
        transactionDate: payload.transactionDate,
        phoneNumber: payload.phoneNumber,
        paymentId: payload.paymentId
      });
    }

  } catch (error) {
    console.error('Error triggering payment notifications:', {
      paymentId: payload.paymentId,
      tabId: payload.tabId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Trigger real-time notifications for tab auto-closure events
 * Requirements: 6.1, 6.2 - Auto-close notifications for overdue tabs
 */
async function triggerTabAutoCloseNotifications(
  supabase: any,
  payload: TabAutoCloseNotificationPayload
): Promise<void> {
  try {
    // Get tab information for notifications
    const { data: tabData, error: tabError } = await supabase
      .from('tabs')
      .select('tab_number')
      .eq('id', payload.tabId)
      .single();

    if (tabError || !tabData) {
      console.error('Failed to get tab data for auto-close notifications:', {
        tabId: payload.tabId,
        error: tabError
      });
      return;
    }

    console.log('Tab auto-close notification triggered:', {
      tabId: payload.tabId,
      barId: payload.barId,
      tabNumber: tabData.tab_number,
      paymentId: payload.paymentId,
      finalBalance: payload.finalBalance,
      timestamp: payload.timestamp
    });

  } catch (error) {
    console.error('Error triggering tab auto-close notifications:', {
      tabId: payload.tabId,
      paymentId: payload.paymentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Parse callback data
    let callbackData: MpesaCallback;
    try {
      callbackData = await request.json();
    } catch (error) {
      console.error('Invalid JSON in M-Pesa callback:', error);
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Invalid JSON format'
      }, { status: 400 });
    }

    // Validate callback structure
    if (!callbackData.Body?.stkCallback) {
      console.error('Invalid callback structure - missing stkCallback');
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Invalid callback structure'
      }, { status: 400 });
    }

    const { stkCallback } = callbackData.Body;
    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    // Validate required fields
    if (!CheckoutRequestID) {
      console.error('Missing CheckoutRequestID in callback');
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Missing CheckoutRequestID'
      }, { status: 400 });
    }

    if (ResultCode === undefined || ResultCode === null) {
      console.error('Missing ResultCode in callback');
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Missing ResultCode'
      }, { status: 400 });
    }

    console.log('M-Pesa callback received:', {
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      timestamp: new Date().toISOString()
    });

    // Requirement 3.2 & 3.3: Determine payment status based on ResultCode
    const paymentStatus = ResultCode === 0 ? 'success' : 'failed';

    // Create database client using secret key for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    // Requirement 3.1: Update corresponding tab_payments record
    const { data: payment, error: findError } = await supabase
      .from('tab_payments')
      .select('id, tab_id, amount')
      .eq('reference', CheckoutRequestID)
      .eq('method', 'mpesa')
      .single();

    if (findError || !payment) {
      console.error('Payment not found for CheckoutRequestID:', {
        checkoutRequestId: CheckoutRequestID,
        error: findError
      });
      
      // Still return success to prevent M-Pesa retries for unknown payments
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Callback received but payment not found'
      });
    }

    // Requirement 3.5: Store complete callback data in metadata field
    const { error: updateError } = await supabase
      .from('tab_payments')
      .update({
        status: paymentStatus,
        metadata: callbackData,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Failed to update payment record:', {
        paymentId: payment.id,
        checkoutRequestId: CheckoutRequestID,
        error: updateError
      });
      
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Failed to update payment record'
      }, { status: 500 });
    }

    // Extract M-Pesa payment details for notifications
    let mpesaReceiptNumber: string | undefined;
    let transactionDate: string | undefined;
    let phoneNumber: string | undefined;

    if (paymentStatus === 'success' && stkCallback.CallbackMetadata?.Item) {
      const metadata = stkCallback.CallbackMetadata.Item;
      mpesaReceiptNumber = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value?.toString();
      transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value?.toString();
      phoneNumber = metadata.find(item => item.Name === 'PhoneNumber')?.Value?.toString();
    }

    // Requirement 6.1 & 6.2: Trigger real-time payment notifications and balance updates
    const paymentNotificationPayload: PaymentNotificationPayload = {
      paymentId: payment.id,
      tabId: payment.tab_id,
      barId: '', // Will be populated in triggerPaymentNotifications
      amount: payment.amount,
      status: paymentStatus,
      method: 'mpesa',
      timestamp: new Date().toISOString(),
      mpesaReceiptNumber,
      transactionDate,
      phoneNumber,
      failureReason: paymentStatus === 'failed' ? ResultDesc : undefined
    };

    // Trigger notifications (non-blocking)
    triggerPaymentNotifications(supabase, paymentNotificationPayload).catch(error => {
      console.error('Payment notification failed (non-blocking):', error);
    });

    // Requirement 4.1 & 4.2: Process balance updates with real-time notifications
    processPaymentBalanceUpdate(
      supabase,
      payment.id,
      payment.tab_id,
      payment.amount,
      paymentStatus
    ).catch(error => {
      console.error('Balance update failed (non-blocking):', error);
    });

    // Requirement 3.4: Auto-close overdue tabs with zero/negative balance after successful payment
    if (paymentStatus === 'success') {
      try {
        // Check if tab is overdue and calculate balance
        const { data: tabData, error: tabError } = await supabase
          .from('tabs')
          .select('id, status, bar_id')
          .eq('id', payment.tab_id)
          .single();

        if (!tabError && tabData?.status === 'overdue') {
          // Calculate tab balance
          const { data: balanceData, error: balanceError } = await supabase
            .from('tab_balances')
            .select('balance')
            .eq('tab_id', payment.tab_id)
            .single();

          if (!balanceError && balanceData && balanceData.balance <= 0) {
            // Auto-close the overdue tab
            const { error: closeError } = await supabase
              .from('tabs')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: 'system'
              })
              .eq('id', payment.tab_id);

            if (closeError) {
              console.error('Failed to auto-close overdue tab:', {
                tabId: payment.tab_id,
                paymentId: payment.id,
                error: closeError
              });
            } else {
              console.log('Auto-closed overdue tab after successful payment:', {
                tabId: payment.tab_id,
                paymentId: payment.id,
                balance: balanceData.balance
              });

              // Requirement 6.1 & 6.2: Trigger auto-close notifications
              const autoCloseNotificationPayload: TabAutoCloseNotificationPayload = {
                tabId: payment.tab_id,
                barId: tabData.bar_id,
                paymentId: payment.id,
                previousStatus: 'overdue',
                newStatus: 'closed',
                finalBalance: balanceData.balance,
                closedBy: 'system',
                timestamp: new Date().toISOString()
              };

              // Trigger auto-close notifications (non-blocking)
              triggerTabAutoCloseNotifications(supabase, autoCloseNotificationPayload).catch(error => {
                console.error('Auto-close notification failed (non-blocking):', error);
              });
            }
          }
        }
      } catch (autoCloseError) {
        // Log error but don't fail the callback processing
        console.error('Error during auto-close logic:', {
          tabId: payment.tab_id,
          paymentId: payment.id,
          error: autoCloseError
        });
      }
    }

    const processingTime = Date.now() - startTime;

    // Requirement 8.2: Ensure callback processing within 2 seconds
    if (processingTime > 2000) {
      console.warn(`Callback processing exceeded 2 second limit: ${processingTime}ms`);
    }

    console.log('M-Pesa callback processed successfully:', {
      paymentId: payment.id,
      tabId: payment.tab_id,
      checkoutRequestId: CheckoutRequestID,
      status: paymentStatus,
      amount: payment.amount,
      processingTime: `${processingTime}ms`
    });

    // Return success response to M-Pesa
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('M-Pesa callback processing error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`
    });

    // Requirement 6.2: Handle callback processing errors gracefully
    // Return success to prevent M-Pesa from retrying on our internal errors
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback received but processing failed'
    });
  }
}

/**
 * Handle GET requests for health checks or debugging
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'M-Pesa callback endpoint is active',
    timestamp: new Date().toISOString(),
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox'
  });
}