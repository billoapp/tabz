import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadMpesaConfigFromBar, type BarMpesaData } from '@tabeza/shared/lib/services/mpesa-config';

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
    const { data: rawBarData, error: barError } = await supabase
      .from('bars')
      .select(`
        id,
        name,
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted,
        mpesa_callback_url,
        mpesa_setup_completed,
        mpesa_test_status,
        mpesa_last_test_at
      `)
      .eq('id', barId)
      .single() as { 
        data: {
          id: string;
          name: string;
          mpesa_enabled: boolean;
          mpesa_environment: string;
          mpesa_business_shortcode: string;
          mpesa_consumer_key_encrypted: string | null;
          mpesa_consumer_secret_encrypted: string | null;
          mpesa_passkey_encrypted: string | null;
          mpesa_callback_url: string;
          mpesa_setup_completed: boolean;
          mpesa_test_status: string;
          mpesa_last_test_at: string | null;
        } | null; 
        error: any;
      };

    if (barError || !rawBarData) {
      return NextResponse.json(
        { success: false, error: 'Bar not found' },
        { status: 404 }
      );
    }

    // Convert to BarMpesaData format (handle null values)
    const barData: BarMpesaData = {
      mpesa_enabled: rawBarData.mpesa_enabled || false,
      mpesa_environment: rawBarData.mpesa_environment || 'sandbox',
      mpesa_business_shortcode: rawBarData.mpesa_business_shortcode || '',
      mpesa_consumer_key_encrypted: rawBarData.mpesa_consumer_key_encrypted || '',
      mpesa_consumer_secret_encrypted: rawBarData.mpesa_consumer_secret_encrypted || '',
      mpesa_passkey_encrypted: rawBarData.mpesa_passkey_encrypted || '',
      mpesa_callback_url: rawBarData.mpesa_callback_url || `https://app.tabeza.co.ke/api/payments/mpesa/callback`
    };

    // Load M-Pesa configuration
    let mpesaConfig;
    try {
      console.log('Loading M-Pesa config for bar:', barId);
      console.log('Bar M-Pesa enabled:', barData.mpesa_enabled);
      console.log('Bar M-Pesa environment:', barData.mpesa_environment);
      console.log('Has consumer key encrypted:', !!barData.mpesa_consumer_key_encrypted);
      console.log('Has consumer secret encrypted:', !!barData.mpesa_consumer_secret_encrypted);
      
      mpesaConfig = loadMpesaConfigFromBar(barData);
      console.log('M-Pesa config loaded successfully');
    } catch (configError: any) {
      console.error('M-Pesa config error:', configError);
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