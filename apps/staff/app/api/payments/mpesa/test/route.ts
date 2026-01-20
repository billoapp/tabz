// Production-grade M-Pesa test endpoint with secure credential handling
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptCredential, validateMpesaCredentials, generateMpesaToken } from '@/lib/mpesa-encryption';

// Use service role for backend operations (bypasses RLS)
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!, // Service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Regular supabase client for user operations
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log('🧪 M-Pesa test API called (secure mode)');
  
  try {
    const { barId } = await request.json();

    if (!barId) {
      return NextResponse.json({ error: 'Bar ID is required' }, { status: 400 });
    }

    console.log('🔍 Testing M-Pesa credentials for bar:', barId);

    // Validate user has access to this bar (using regular client with RLS)
    const { data: userBar, error: userBarError } = await supabase
      .from('user_bars')
      .select('bar_id')
      .eq('bar_id', barId)
      .single();

    if (userBarError || !userBar) {
      console.error('❌ User does not have access to this bar:', userBarError);
      return NextResponse.json({
        error: 'Access denied to this bar'
      }, { status: 403 });
    }

    // Get encrypted credentials using service role (bypasses RLS)
    const { data: credData, error: credError } = await supabaseServiceRole
      .from('mpesa_credentials')
      .select(`
        id,
        environment,
        business_shortcode,
        consumer_key_enc,
        consumer_secret_enc,
        passkey_enc,
        is_active
      `)
      .eq('tenant_id', barId)
      .eq('is_active', true)
      .single();

    if (credError || !credData) {
      console.error('❌ No active M-Pesa credentials found:', credError);
      return NextResponse.json({ 
        error: 'M-Pesa credentials not configured or not active' 
      }, { status: 400 });
    }

    // Check if all required credentials exist
    if (!credData.consumer_key_enc || !credData.consumer_secret_enc || !credData.passkey_enc) {
      return NextResponse.json({ 
        error: 'Incomplete M-Pesa credentials' 
      }, { status: 400 });
    }

    // Decrypt credentials in memory (server-side only)
    let consumerKey: string;
    let consumerSecret: string;
    let passkey: string;

    try {
      console.log('🔓 Decrypting credentials...');
      consumerKey = decryptCredential(credData.consumer_key_enc);
      consumerSecret = decryptCredential(credData.consumer_secret_enc);
      passkey = decryptCredential(credData.passkey_enc);
      console.log('✅ Credentials decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt M-Pesa credentials:', error);
      return NextResponse.json({
        error: 'Failed to decrypt M-Pesa credentials'
      }, { status: 500 });
    }

    // Validate decrypted credentials format
    const validation = validateMpesaCredentials({
      businessShortCode: credData.business_shortcode,
      consumerKey,
      consumerSecret,
      passkey
    });

    if (!validation.isValid) {
      console.error('❌ Invalid decrypted credentials:', validation.errors);
      return NextResponse.json({
        error: 'Invalid credentials format',
        details: validation.errors
      }, { status: 400 });
    }

    // Test OAuth token generation with Daraja
    try {
      console.log('🔑 Testing OAuth token generation...');
      const accessToken = await generateMpesaToken(
        consumerKey,
        consumerSecret,
        credData.environment as 'sandbox' | 'production'
      );

      if (!accessToken) {
        throw new Error('Failed to generate access token');
      }

      console.log('✅ M-Pesa OAuth test successful');

      // Log successful test event
      await supabaseServiceRole
        .from('mpesa_credential_events')
        .insert({
          credential_id: credData.id,
          tenant_id: barId,
          event_type: 'tested',
          event_data: {
            result: 'success',
            environment: credData.environment,
            business_shortcode: credData.business_shortcode
          }
        });

      return NextResponse.json({
        success: true,
        message: 'M-Pesa credentials validated successfully',
        environment: credData.environment,
        businessShortcode: credData.business_shortcode
      });

    } catch (error: any) {
      console.error('❌ M-Pesa OAuth test failed:', error);

      // Log failed test event
      await supabaseServiceRole
        .from('mpesa_credential_events')
        .insert({
          credential_id: credData.id,
          tenant_id: barId,
          event_type: 'tested',
          event_data: {
            result: 'failed',
            error: error.message,
            environment: credData.environment,
            business_shortcode: credData.business_shortcode
          }
        });

      return NextResponse.json({
        error: 'Failed to validate M-Pesa credentials',
        details: error.message
      }, { status: 400 });
    } finally {
      // Clear sensitive data from memory
      consumerKey = '';
      consumerSecret = '';
      passkey = '';
    }

  } catch (error) {
    console.error('❌ M-Pesa test error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}