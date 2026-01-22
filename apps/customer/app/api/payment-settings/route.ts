import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');

    if (!barId) {
      return NextResponse.json(
        { error: 'Bar ID is required' },
        { status: 400 }
      );
    }

    // Get bar payment settings
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();

    if (barError) {
      console.error('Error fetching bar data:', barError);
      return NextResponse.json(
        { error: 'Failed to fetch bar settings' },
        { status: 500 }
      );
    }

    if (!barData) {
      return NextResponse.json(
        { error: 'Bar not found' },
        { status: 404 }
      );
    }

    // Check M-Pesa credentials to see if it's properly configured
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('is_active, environment, business_shortcode')
      .eq('tenant_id', barId)
      .maybeSingle();

    // M-Pesa is available if:
    // 1. Credentials exist and are active
    // 2. Bar has mpesa_enabled set to true (for backward compatibility)
    const mpesaAvailable = (credData?.is_active === true) || (barData.mpesa_enabled === true) || (barData.payment_mpesa_enabled === true);

    return NextResponse.json({
      success: true,
      barId: barData.id,
      barName: barData.name,
      paymentMethods: {
        mpesa: {
          available: mpesaAvailable,
          environment: credData?.environment || 'sandbox'
        },
        card: {
          available: false, // Coming soon
          reason: 'Coming soon'
        },
        airtel: {
          available: false, // Coming soon
          reason: 'Coming soon'
        }
      }
    });

  } catch (error) {
    console.error('Payment settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}