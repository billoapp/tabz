import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get transaction from database
    const { data: transaction, error } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if transaction has timed out (5 minutes)
    const createdAt = new Date(transaction.created_at);
    const now = new Date();
    const timeDiff = now.getTime() - createdAt.getTime();
    const timeoutMs = 5 * 60 * 1000; // 5 minutes

    if (transaction.status === 'sent' && timeDiff > timeoutMs) {
      // Update status to timeout
      const { error: updateError } = await supabase
        .from('mpesa_transactions')
        .update({
          status: 'timeout',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (!updateError) {
        transaction.status = 'timeout';
        transaction.updated_at = new Date().toISOString();
      }
    }

    // Return transaction status
    return NextResponse.json({
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      phoneNumber: transaction.phone_number,
      mpesaReceiptNumber: transaction.mpesa_receipt_number,
      transactionDate: transaction.transaction_date,
      failureReason: transaction.failure_reason,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}