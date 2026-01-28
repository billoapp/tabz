/**
 * Mock M-Pesa Callback Simulator for Development Testing
 * Simulates successful payment callbacks when MPESA_MOCK_MODE is enabled
 * This allows testing the complete payment flow without Safaricom API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

interface MockCallbackRequest {
  checkoutRequestId: string;
  success?: boolean; // Default: true
  amount?: number; // Optional: for validation
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Only allow in mock mode
  if (process.env.MPESA_MOCK_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Mock callback only available in mock mode' },
      { status: 403 }
    );
  }

  try {
    const { checkoutRequestId, success = true, amount }: MockCallbackRequest = await request.json();

    if (!checkoutRequestId) {
      return NextResponse.json(
        { error: 'checkoutRequestId is required' },
        { status: 400 }
      );
    }

    // Find the payment record
    const supabase = createServiceRoleClient();
    const { data: payment, error: findError } = await supabase
      .from('tab_payments')
      .select('id, tab_id, amount')
      .eq('reference', checkoutRequestId)
      .eq('method', 'mpesa')
      .single();

    if (findError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found for checkout request ID' },
        { status: 404 }
      );
    }

    // Create mock callback data
    const mockCallbackData = {
      Body: {
        stkCallback: {
          MerchantRequestID: `mock_merchant_${Date.now()}`,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: success ? 0 : 1,
          ResultDesc: success ? 'The service request is processed successfully.' : 'Mock payment failed',
          CallbackMetadata: success ? {
            Item: [
              { Name: 'Amount', Value: payment.amount },
              { Name: 'MpesaReceiptNumber', Value: `MOCK${Date.now()}` },
              { Name: 'TransactionDate', Value: Date.now() },
              { Name: 'PhoneNumber', Value: '254708374149' }
            ]
          } : undefined
        }
      }
    };

    // Update payment status
    const paymentStatus = success ? 'success' : 'failed';
    const { error: updateError } = await supabase
      .from('tab_payments')
      .update({
        status: paymentStatus,
        metadata: mockCallbackData,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Failed to update mock payment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payment status' },
        { status: 500 }
      );
    }

    // Auto-close overdue tabs if payment successful and balance <= 0
    if (success) {
      try {
        const { data: tabData, error: tabError } = await supabase
          .from('tabs')
          .select('id, status, bar_id')
          .eq('id', payment.tab_id)
          .single();

        if (!tabError && tabData?.status === 'overdue') {
          const { data: balanceData, error: balanceError } = await supabase
            .from('tab_balances')
            .select('balance')
            .eq('tab_id', payment.tab_id)
            .single();

          if (!balanceError && balanceData && balanceData.balance <= 0) {
            await supabase
              .from('tabs')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: 'system'
              })
              .eq('id', payment.tab_id);

            console.log('🧪 Mock: Auto-closed overdue tab after payment:', {
              tabId: payment.tab_id,
              paymentId: payment.id,
              balance: balanceData.balance
            });
          }
        }
      } catch (autoCloseError) {
        console.error('Mock auto-close error (non-blocking):', autoCloseError);
      }
    }

    console.log('🧪 Mock M-Pesa callback processed:', {
      paymentId: payment.id,
      tabId: payment.tab_id,
      checkoutRequestId,
      status: paymentStatus,
      amount: payment.amount
    });

    return NextResponse.json({
      success: true,
      message: `Mock payment ${success ? 'completed' : 'failed'} successfully`,
      paymentId: payment.id,
      status: paymentStatus
    });

  } catch (error) {
    console.error('Mock callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  if (process.env.MPESA_MOCK_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Mock mode not enabled' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'Mock M-Pesa callback endpoint is active',
    mockMode: true,
    timestamp: new Date().toISOString(),
    usage: {
      endpoint: 'POST /api/mpesa/mock-callback',
      body: {
        checkoutRequestId: 'string (required)',
        success: 'boolean (optional, default: true)',
        amount: 'number (optional, for validation)'
      }
    }
  });
}