import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { title, body, icon, badge, tag, data, deviceIds } = await request.json();

    if (!title || !deviceIds || !deviceIds.length) {
      return NextResponse.json(
        { error: 'Missing required fields: title, deviceIds' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get subscriptions for the specified devices
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('device_id', deviceIds);

    if (error) {
      console.error('❌ Database error fetching subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    // Send push notifications to all specified devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Authorization': `key=${process.env.FIREBASE_SERVER_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              to: subscription.endpoint,
              notification: {
                title: title,
                body: body,
                icon: icon,
                badge: badge,
                tag: tag,
                data: data,
                actions: data?.actions || []
              }
            })
          });

          if (!response.ok) {
            console.error('❌ Failed to send push notification to:', subscription.endpoint);
            return { success: false, error: 'Failed to send' };
          }

          const result = await response.json();
          console.log('✅ Push notification sent to:', subscription.endpoint);
          return { success: true, messageId: result.message_id };
        } catch (error) {
          console.error('❌ Error sending push notification to:', subscription.endpoint);
          return { success: false, error: (error as Error).message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return NextResponse.json({
      message: `Push notifications sent to ${successful} devices, ${failed} failed`,
      success: successful > 0,
      failed: failed,
      results: results
    });
  } catch (error) {
    console.error('❌ Push notification send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
