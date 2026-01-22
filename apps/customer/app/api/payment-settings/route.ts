import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Create a service role client for this API endpoint
    // This is safe because it's a server-side API route
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;
    
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get bar payment settings using service role key
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled')
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

    // M-Pesa is available if mpesa_enabled is true
    // The staff app should sync this field when M-Pesa is enabled/disabled
    const mpesaAvailable = barData.mpesa_enabled === true;

    return NextResponse.json({
      success: true,
      barId: barData.id,
      barName: barData.name,
      paymentMethods: {
        mpesa: {
          available: mpesaAvailable,
          environment: 'sandbox' // Default to sandbox for customer app
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