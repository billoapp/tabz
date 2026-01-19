// M-Pesa callback handler
// Handles STK Push callbacks and updates payment status

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// Inline utility functions to avoid import path issues
interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: any;
        }>;
      };
    };
  };
}

function parseAccountReference(accountReference: string): {
  barId: string;
  tabId: string;
} {
  const parts = accountReference.split('|');
  if (parts.length !== 2) {
    throw new Error('Invalid account reference format');
  }
  
  return {
    barId: parts[0],
    tabId: parts[1]
  };
}

export async function POST(request: NextRequest) {
  try {
    const callbackData: MpesaCallback = await request.json();
    
    console.log('M-Pesa callback received:', JSON.stringify(callbackData, null, 2));

    // Extract callback information
    const stkCallback = callbackData.Body?.stkCallback;
    if (!stkCallback) {
      console.error('Invalid callback format - missing stkCallback');
      return NextResponse.json({ error: 'Invalid callback format' }, { status: 400 });
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = stkCallback;

    // Find the M-Pesa transaction
    const { data: mpesaTransaction, error: mpesaError } = await (supabase as any)
      .from('mpesa_transactions')
      .select(`
        id,
        payment_id,
        bar_id,
        account_reference,
        tab_payments!inner(id, tab_id, amount, status)
      `)
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (mpesaError || !mpesaTransaction) {
      console.error('M-Pesa transaction not found:', CheckoutRequestID);
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Parse callback metadata
    let mpesaReceiptNumber: string | null = null;
    let phoneNumber: string | null = null;
    let amount: number | null = null;

    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = item.Value;
            break;
          case 'PhoneNumber':
            phoneNumber = item.Value?.toString();
            break;
          case 'Amount':
            amount = parseFloat(item.Value);
            break;
        }
      }
    }

    // Determine payment status based on result code
    let paymentStatus: 'success' | 'failed';
    if (ResultCode === 0) {
      paymentStatus = 'success';
    } else {
      paymentStatus = 'failed';
    }

    // Update M-Pesa transaction record
    const { error: updateMpesaError } = await (supabase as any)
      .from('mpesa_transactions')
      .update({
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        callback_received_at: new Date().toISOString(),
        callback_data: callbackData,
        updated_at: new Date().toISOString()
      })
      .eq('id', mpesaTransaction.id);

    if (updateMpesaError) {
      console.error('Failed to update M-Pesa transaction:', updateMpesaError);
    }

    // Update payment status in tab_payments
    const { error: updatePaymentError } = await (supabase as any)
      .from('tab_payments')
      .update({
        status: paymentStatus,
        metadata: {
          ...mpesaTransaction.tab_payments.metadata,
          mpesa_receipt_number: mpesaReceiptNumber,
          result_code: ResultCode,
          result_desc: ResultDesc,
          callback_received_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', mpesaTransaction.payment_id);

    if (updatePaymentError) {
      console.error('Failed to update payment status:', updatePaymentError);
    }

    // If payment was successful, update tab balance
    if (paymentStatus === 'success' && amount) {
      try {
        // Parse account reference to get tab info
        const { tabId } = parseAccountReference(mpesaTransaction.account_reference);
        
        // Get current tab balance
        const { data: tabData, error: tabError } = await (supabase as any)
          .from('tabs')
          .select('balance')
          .eq('id', tabId)
          .single();

        if (!tabError && tabData) {
          const newBalance = Math.max(0, tabData.balance - amount);
          
          // Update tab balance
          const { error: balanceError } = await (supabase as any)
            .from('tabs')
            .update({ 
              balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', tabId);

          if (balanceError) {
            console.error('Failed to update tab balance:', balanceError);
          } else {
            console.log(`Tab ${tabId} balance updated: ${tabData.balance} -> ${newBalance}`);
          }
        }
      } catch (error) {
        console.error('Error updating tab balance:', error);
      }
    }

    // Log the result
    if (paymentStatus === 'success') {
      console.log(`✅ M-Pesa payment successful: ${mpesaReceiptNumber} - Amount: ${amount}`);
    } else {
      console.log(`❌ M-Pesa payment failed: ${ResultDesc} (Code: ${ResultCode})`);
    }

    // Always return success to M-Pesa to avoid retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    });

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    
    // Still return success to avoid M-Pesa retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback received but processing failed'
    });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}