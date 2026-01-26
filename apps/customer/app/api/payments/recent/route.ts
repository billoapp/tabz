/**
 * Recent Payments API
 * GET /api/payments/recent?tabId=xxx&since=xxx
 * 
 * Checks for recent successful payments for a specific tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get('tabId');
    const since = searchParams.get('since');
    
    if (!tabId) {
      return NextResponse.json(
        { error: 'Tab ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking for recent payments for tab: ${tabId}`);

    // Build query for recent payments
    let query = supabase
      .from('tab_payments')
      .select('id, amount, method, status, reference, created_at, updated_at, metadata')
      .eq('tab_id', tabId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1);

    // Add time filter if provided
    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: payments, error: paymentError } = await query;

    if (paymentError) {
      console.error('Error fetching recent payments:', paymentError);
      return NextResponse.json(
        { error: 'Failed to fetch recent payments' },
        { status: 500 }
      );
    }

    const recentPayment = payments && payments.length > 0 ? payments[0] : null;

    console.log(`✅ Recent payment check completed:`, {
      tabId,
      since,
      foundPayment: !!recentPayment,
      paymentMethod: recentPayment?.method,
      paymentAmount: recentPayment?.amount
    });

    return NextResponse.json({
      success: true,
      recentPayment,
      tabId
    });

  } catch (error) {
    console.error('Recent payments API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}