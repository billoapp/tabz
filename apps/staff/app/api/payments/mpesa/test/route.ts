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
      mpesa_passkey_encrypted: rawBarData.mpesa_passkey_encrypted || ''
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
      console.log('🔗 Testing M-Pesa OAuth token generation...');
      console.log('📋 Environment:', mpesaConfig.environment);
      console.log('🏷️ Business Shortcode:', mpesaConfig.businessShortcode);
      console.log('🔑 Consumer Key length:', mpesaConfig.consumerKey?.length || 0);
      console.log('🔒 Consumer Secret length:', mpesaConfig.consumerSecret?.length || 0);

      // Create Basic Auth header
      const authString = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');

      // Construct OAuth URL with query parameter (MUST be exactly this format)
      const oauthUrl = `${mpesaConfig.oauthUrl}?grant_type=client_credentials`;
      
      console.log('🔗 OAuth URL:', oauthUrl);
      console.log('🔑 Auth header (first 20 chars):', `Basic ${authString.substring(0, 20)}...`);
      
      // Make OAuth request with timeout and proper error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const oauthResponse = await fetch(oauthUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await oauthResponse.text();
      console.log('📊 OAuth Response Status:', oauthResponse.status);
      console.log('📋 OAuth Response (first 500 chars):', responseText.substring(0, 500));

      // Check if response is HTML (error page)
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        console.error('❌ Safaricom returned HTML error page instead of JSON');
        // Extract error message from HTML if possible
        const errorMatch = responseText.match(/<title[^>]*>(.*?)<\/title>/i) || 
                          responseText.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const errorMessage = errorMatch ? errorMatch[1] : 'Safaricom returned error HTML page';
        throw new Error(`HTTP ${oauthResponse.status}: ${errorMessage}`);
      }

      if (!oauthResponse.ok) {
        throw new Error(`HTTP ${oauthResponse.status}: ${responseText.substring(0, 200)}`);
      }

      let oauthData;
      try {
        oauthData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse OAuth response as JSON:', responseText.substring(0, 200));
        throw new Error(`OAuth returned non-JSON response: ${responseText.substring(0, 200)}`);
      }

      if (!oauthData.access_token) {
        console.error('❌ OAuth response missing access_token:', oauthData);
        throw new Error(`OAuth response missing access_token: ${JSON.stringify(oauthData)}`);
      }

      console.log('✅ OAuth Success!');
      console.log('🔑 Token type:', oauthData.token_type || 'N/A');
      console.log('⏰ Expires in:', oauthData.expires_in || 'N/A', 'seconds');
      console.log('📝 Access token (first 20 chars):', oauthData.access_token.substring(0, 20) + '...');

      // Update test status in database
      const { error: updateError } = await (supabase as any)
        .from('bars')
        .update({
          mpesa_setup_completed: true,
          mpesa_test_status: 'success',
          mpesa_last_test_at: new Date().toISOString()
        })
        .eq('id', barId);

      if (updateError) {
        console.error('Failed to update test status:', updateError);
      }

      return NextResponse.json({
        success: true,
        message: 'M-Pesa credentials validated successfully',
        environment: mpesaConfig.environment,
        businessShortcode: mpesaConfig.businessShortcode,
        testTimestamp: new Date().toISOString()
      });

    } catch (oauthError: any) {
      console.error('❌ OAuth Error:', oauthError.message);

      // Update test status as failed
      const { error: updateError } = await (supabase as any)
        .from('bars')
        .update({
          mpesa_setup_completed: false,
          mpesa_test_status: 'failed',
          mpesa_last_test_at: new Date().toISOString()
        })
        .eq('id', barId);

      if (updateError) {
        console.error('⚠️ Failed to update test status:', updateError);
      }

      // Provide helpful error messages
      let userMessage = oauthError.message;
      let suggestion = '';

      if (oauthError.message.includes('NetworkError') || oauthError.message.includes('Failed to fetch')) {
        suggestion = 'Network error. Check your internet connection and firewall settings.';
      } else if (oauthError.message.includes('401')) {
        suggestion = 'Invalid Consumer Key or Consumer Secret. Please verify your credentials from Safaricom Developer Portal.';
      } else if (oauthError.message.includes('404')) {
        suggestion = 'OAuth endpoint not found. Check if the environment URLs are correct.';
      } else if (oauthError.message.includes('HTML')) {
        suggestion = 'Safaricom returned an error page. Your credentials might be invalid or the service is down.';
      } else if (oauthError.message.includes('access_token')) {
        suggestion = 'Safaricom did not return an access token. Check your app permissions in the Developer Portal.';
      }

      return NextResponse.json(
        { 
          success: false, 
          error: userMessage,
          suggestion: suggestion,
          environment: mpesaConfig.environment,
          timestamp: new Date().toISOString()
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