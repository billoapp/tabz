/**
 * M-Pesa STK Push Status Check API
 * GET /api/payments/mpesa/status/[checkoutRequestId]
 * 
 * Checks the status of an M-Pesa STK Push payment using Daraja API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { querySTKPushStatus, parsePaymentStatus, STKQueryError } from '@tabeza/shared';
import { loadMpesaConfigFromBar, MpesaConfigurationError } from '@tabeza/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { checkoutRequestId: string } }
) {
  const startTime = Date.now();
  
  try {
    const { checkoutRequestId } = params;
    
    if (!checkoutRequestId) {
      return NextResponse.json(
        { error: 'Checkout request ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking M-Pesa payment status for checkout: ${checkoutRequestId}`);

    // Find the payment record to get bar information
    const { data: payment, error: paymentError } = await supabase
      .from('tab_payments')
      .select(`
        id,
        tab_id,
        amount,
        status,
        reference,
        metadata,
        tabs!inner (
          id,
          bar_id,
          tab_number,
          bars!inner (
            id,
            name,
            mpesa_enabled,
            mpesa_environment,
            mpesa_business_shortcode,
            mpesa_consumer_key_encrypted,
            mpesa_consumer_secret_encrypted,
            mpesa_passkey_encrypted,
            mpesa_callback_url
          )
        )
      `)
      .eq('reference', checkoutRequestId)
      .eq('method', 'mpesa')
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', paymentError);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    const bar = payment.tabs.bars;
    
    // Load M-Pesa configuration for this bar
    let mpesaConfig;
    try {
      mpesaConfig = loadMpesaConfigFromBar(bar);
    } catch (configError) {
      console.error('M-Pesa configuration error:', configError);
      
      if (configError instanceof MpesaConfigurationError) {
        return NextResponse.json(
          { 
            error: 'M-Pesa not configured for this bar',
            details: configError.message
          },
          { status: 400 }
        );
      }
      
      throw configError;
    }

    // Query STK Push status from Safaricom
    let queryResponse;
    try {
      queryResponse = await querySTKPushStatus(
        { checkoutRequestId },
        mpesaConfig
      );
    } catch (queryError) {
      console.error('STK Query error:', queryError);
      
      if (queryError instanceof STKQueryError) {
        return NextResponse.json(
          {
            error: 'Failed to check payment status',
            details: queryError.message,
            responseCode: queryError.responseCode,
            responseDescription: queryError.responseDescription
          },
          { status: queryError.statusCode || 500 }
        );
      }
      
      throw queryError;
    }

    // Parse the payment status
    const paymentStatus = parsePaymentStatus(queryResponse);
    
    // Update payment record if status has changed
    const newStatus = paymentStatus.status === 'completed' ? 'success' : 
                     paymentStatus.status === 'failed' || paymentStatus.status === 'cancelled' ? 'failed' : 
                     payment.status; // Keep current status for pending

    if (newStatus !== payment.status) {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Add metadata for completed payments
      if (paymentStatus.status === 'completed') {
        updateData.metadata = {
          ...payment.metadata,
          mpesa_receipt_number: queryResponse.MerchantRequestID,
          transaction_date: new Date().toISOString(),
          query_response: queryResponse
        };
      } else if (paymentStatus.status === 'failed' || paymentStatus.status === 'cancelled') {
        updateData.metadata = {
          ...payment.metadata,
          failure_reason: paymentStatus.message,
          query_response: queryResponse
        };
      }

      const { error: updateError } = await supabase
        .from('tab_payments')
        .update(updateData)
        .eq('id', payment.id);

      if (updateError) {
        console.error('Failed to update payment status:', updateError);
        // Don't fail the request, just log the error
      } else {
        console.log(`✅ Updated payment ${payment.id} status: ${payment.status} → ${newStatus}`);
      }
    }

    const responseTime = Date.now() - startTime;
    console.log(`⏱️ STK status check completed in ${responseTime}ms`);

    // Return status information
    return NextResponse.json({
      success: true,
      checkoutRequestId,
      merchantRequestId: queryResponse.MerchantRequestID,
      status: paymentStatus.status,
      message: paymentStatus.message,
      amount: payment.amount,
      tabNumber: payment.tabs.tab_number,
      barName: bar.name,
      responseTime,
      rawResponse: queryResponse
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('STK status check error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      },
      { status: 500 }
    );
  }
}