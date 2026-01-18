// Close Tab API
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tabId, writeOffAmount } = await request.json();

    if (!tabId) {
      return NextResponse.json(
        { error: 'Tab ID is required' },
        { status: 400 }
      );
    }

    console.log('🔒 Closing tab:', { tabId, writeOffAmount });

    // Use the Supabase function to close the tab
    const { data, error } = await supabase.rpc('close_tab', {
      p_tab_id: tabId,
      p_write_off_amount: writeOffAmount || null
    });

    if (error) {
      console.error('❌ Error closing tab:', error);
      return NextResponse.json(
        { error: 'Failed to close tab', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Tab closed successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'Tab closed successfully',
      data
    });

  } catch (error: any) {
    console.error('❌ Close tab API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}