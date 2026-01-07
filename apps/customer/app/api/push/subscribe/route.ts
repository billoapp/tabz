import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { deviceId, subscription } = await request.json();

    if (!deviceId || !subscription) {
      return NextResponse.json(
        { error: 'Missing deviceId or subscription data' },
        { status: 400 }
      );
    }

    // Store push subscription in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        device_id: deviceId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ Database error storing subscription:', error);
      return NextResponse.json(
        { error: 'Failed to store subscription' },
        { status: 500 }
      );
    }

    console.log('✅ Push subscription stored for device:', deviceId);

    return NextResponse.json(
      { 
        success: true,
        message: 'Successfully subscribed to push notifications',
        deviceId: deviceId
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Push subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
