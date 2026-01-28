import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadMpesaConfigFromBar } from '@tabeza/shared/lib/services/mpesa-config';

/**
 * Test M-Pesa credentials by attempting OAuth token generation
 * This validates that the credentials are correct without making a payment
 */
export async function POST(request: NextRequest) {
  try {
    const { barId } = await request.json();

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar ID is required' },
        { status: 400 }
      );
    }

    // Get bar data from database
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('*')
      .eq('id', barId)
      .single();

    if (barError || !barData) {
      return NextResponse.json(
        { success: false, error: 'Bar not found' },
        { status: 404 }
      );
    }

    // Load M-Pesa configuration
    let mpesaConfig;
    try {
      mpesaConfig = loadMpesaConfigFromBar(barData);
    } catch (configError: any) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Configuration error: ${configError.message}`,
          details: configError.missingFields || []
        },
        { status: 400 }
      );
    }

    // Test OAuth token generation
    try {
      const authString = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
      
      const oauthResponse = await fetch(mpesaConfig.oauthUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      const oauthData = await oauthResponse.json();

      if (!oauthResponse.ok) {
        throw new Error(oauthData.error_description || oauthData.errorMessage || 'OAuth failed');
      }

      if (!oauthData.access_token) {
        throw new Error('No access token received from Safaricom');
      }

      // Update test status in database
      await (supabase as any)
        .from('bars')
        .update({
          mpesa_setup_completed: true,
          mpesa_test_status: 'success',
          mpesa_last_test_at: new Date().toISOString()
        })
        .eq('id', barId);

      return NextResponse.json({
        success: true,
        message: 'M-Pesa credentials validated successfully',
        environment: mpesaConfig.environment,
        businessShortcode: mpesaConfig.businessShortcode,
        testTimestamp: new Date().toISOString()
      });

    } catch (oauthError: any) {
      // Update test status as failed
      await (supabase as any)
        .from('bars')
        .update({
          mpesa_setup_completed: false,
          mpesa_test_status: 'failed',
          mpesa_last_test_at: new Date().toISOString()
        })
        .eq('id', barId);

      return NextResponse.json(
        { 
          success: false, 
          error: `Authentication failed: ${oauthError.message}`,
          environment: mpesaConfig.environment,
          suggestion: mpesaConfig.environment === 'sandbox' 
            ? 'Please check your Consumer Key and Consumer Secret from Safaricom Developer Portal'
            : 'Please verify all your production credentials are correct'
        },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('M-Pesa test error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}