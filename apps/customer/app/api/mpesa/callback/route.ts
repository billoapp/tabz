/**
 * Simplified M-Pesa Callback Handler
 * Replaces over-engineered implementation with simple, maintainable solution
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

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

    // Create database client
    const supabase = createServiceRoleClient();

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

    // Requirement 3.4: Auto-close overdue tabs with zero/negative balance after successful payment
    if (paymentStatus === 'success') {
      try {
        // Check if tab is overdue and calculate balance
        const { data: tabData, error: tabError } = await supabase
          .from('tabs')
          .select('id, status')
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

    // Extract additional payment details for successful payments
    if (paymentStatus === 'success' && stkCallback.CallbackMetadata?.Item) {
      const metadata = stkCallback.CallbackMetadata.Item;
      const mpesaReceiptNumber = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = metadata.find(item => item.Name === 'PhoneNumber')?.Value;
      
      console.log('Payment details:', {
        mpesaReceiptNumber,
        transactionDate,
        phoneNumber,
        paymentId: payment.id
      });
    }

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