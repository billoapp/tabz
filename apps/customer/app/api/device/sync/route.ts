import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, lastSeen } = body;

    console.log('🔄 Device sync request:', { deviceId, lastSeen });

    // Validate required fields
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    // Update last seen timestamp
    const { data: updatedDevice, error: updateError } = await (supabase as any)
      .from('devices')
      .update({
        last_seen: new Date().toISOString()
      })
      .eq('device_id', deviceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error syncing device:', updateError);
      return NextResponse.json(
        { error: 'Failed to sync device' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Device synced successfully',
      lastSeen: updatedDevice?.last_seen
    });

  } catch (error) {
    console.error('Device sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}