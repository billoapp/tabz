import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      deviceId, 
      fingerprint, 
      version,
      integrity,
      userAgent, 
      timestamp,
      // Legacy fields for backward compatibility
      screenResolution, 
      timezone, 
      language,
      barId,
      // New fields from updated schema
      platform,
      hardwareConcurrency,
      deviceMemory,
      pwaInstalled
    } = body;

    console.log('📱 Device registration request:', { deviceId, fingerprint, version });

    // Validate required fields
    if (!deviceId || !fingerprint) {
      return NextResponse.json(
        { error: 'Device ID and fingerprint are required' },
        { status: 400 }
      );
    }

    // Check if device already exists
    const { data: existingDevice, error: checkError } = await (supabase as any)
      .from('devices')
      .select('id, device_id')
      .eq('device_id', deviceId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing device:', checkError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (existingDevice) {
      // First get the current install count
      const { data: currentDevice } = await (supabase as any)
        .from('devices')
        .select('install_count')
        .eq('device_id', deviceId)
        .single();

      const newInstallCount = (currentDevice?.install_count || 0) + 1;

      // Update existing device
      const { data: updatedDevice, error: updateError } = await (supabase as any)
        .from('devices')
        .update({
          fingerprint,
          user_agent: userAgent,
          platform: platform || null,
          screen_resolution: screenResolution,
          timezone,
          language,
          hardware_concurrency: hardwareConcurrency || null,
          device_memory: deviceMemory || null,
          last_bar_id: barId,
          pwa_installed: pwaInstalled || false,
          last_seen: new Date().toISOString(),
          last_install_at: new Date().toISOString(),
          install_count: newInstallCount
        })
        .eq('device_id', deviceId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating device:', updateError);
        return NextResponse.json(
          { error: 'Failed to update device' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        serverId: updatedDevice.id,
        message: 'Device updated successfully'
      });
    } else {
      // Create new device
      const { data: newDevice, error: createError } = await (supabase as any)
        .from('devices')
        .insert({
          device_id: deviceId,
          fingerprint,
          user_agent: userAgent,
          platform: platform || null,
          screen_resolution: screenResolution,
          timezone,
          language,
          hardware_concurrency: hardwareConcurrency || null,
          device_memory: deviceMemory || null,
          last_bar_id: barId,
          pwa_installed: pwaInstalled || false,
          is_active: true,
          suspicious_activity_count: 0,
          install_count: 1,
          total_tabs_created: 0,
          total_amount_spent: 0.00
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating device:', createError);
        return NextResponse.json(
          { error: 'Failed to register device' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        serverId: newDevice.id,
        message: 'Device registered successfully'
      });
    }

  } catch (error) {
    console.error('Device registration error:', error);
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