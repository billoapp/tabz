// M-Pesa settings API endpoint with server-side encryption
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Encryption key from environment - ensure it's exactly 32 bytes
const ENCRYPTION_KEY = (process.env.MPESA_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!').slice(0, 32).padEnd(32, '0');

function encryptCredential(plaintext: string): string {
  try {
    // Use modern crypto API
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error details:', error);
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  console.log('🔧 M-Pesa settings API called');
  
  try {
    const body = await request.json();
    console.log('📝 Request body received:', { 
      ...body, 
      mpesa_consumer_key: body.mpesa_consumer_key ? '[REDACTED]' : undefined,
      mpesa_consumer_secret: body.mpesa_consumer_secret ? '[REDACTED]' : undefined,
      mpesa_passkey: body.mpesa_passkey ? '[REDACTED]' : undefined
    });

    const {
      barId,
      mpesa_enabled,
      mpesa_environment,
      mpesa_business_shortcode,
      mpesa_consumer_key,
      mpesa_consumer_secret,
      mpesa_passkey
    } = body;

    // Validate required fields
    if (!barId) {
      console.error('❌ Bar ID is missing');
      return NextResponse.json({
        error: 'Bar ID is required'
      }, { status: 400 });
    }

    console.log('✅ Bar ID validated:', barId);

    // Validate M-Pesa credentials if enabled
    if (mpesa_enabled) {
      if (!mpesa_business_shortcode || !mpesa_consumer_key || !mpesa_consumer_secret || !mpesa_passkey) {
        console.error('❌ Missing M-Pesa credentials');
        return NextResponse.json({
          error: 'All M-Pesa credentials are required when M-Pesa is enabled'
        }, { status: 400 });
      }

      // Validate business shortcode format
      if (!/^\d{5,7}$/.test(mpesa_business_shortcode)) {
        console.error('❌ Invalid business shortcode format:', mpesa_business_shortcode);
        return NextResponse.json({
          error: 'Business shortcode must be 5-7 digits'
        }, { status: 400 });
      }
    }

    console.log('✅ Validation passed');

    // Prepare update data
    const updateData: any = {
      mpesa_enabled,
      mpesa_environment,
      mpesa_business_shortcode,
      mpesa_setup_completed: false, // Reset until tested
      mpesa_test_status: 'pending'
    };

    // Only update credentials if they were provided
    if (mpesa_consumer_key && mpesa_consumer_secret && mpesa_passkey) {
      console.log('🔐 Encrypting credentials...');
      console.log('Encryption key length:', ENCRYPTION_KEY.length);
      console.log('Sample credential length:', mpesa_consumer_key.length);
      
      try {
        console.log('Encrypting consumer key...');
        updateData.mpesa_consumer_key_encrypted = encryptCredential(mpesa_consumer_key);
        console.log('✅ Consumer key encrypted');
        
        console.log('Encrypting consumer secret...');
        updateData.mpesa_consumer_secret_encrypted = encryptCredential(mpesa_consumer_secret);
        console.log('✅ Consumer secret encrypted');
        
        console.log('Encrypting passkey...');
        updateData.mpesa_passkey_encrypted = encryptCredential(mpesa_passkey);
        console.log('✅ Passkey encrypted');
        
        console.log('✅ All credentials encrypted successfully');
      } catch (encryptError) {
        console.error('❌ Encryption error:', encryptError);
        console.error('Error stack:', encryptError instanceof Error ? encryptError.stack : 'No stack trace');
        return NextResponse.json({
          error: 'Failed to encrypt credentials: ' + (encryptError instanceof Error ? encryptError.message : 'Unknown encryption error')
        }, { status: 500 });
      }
    }

    console.log('💾 Updating database...');
    console.log('Update data:', { ...updateData, mpesa_consumer_key_encrypted: '[REDACTED]', mpesa_consumer_secret_encrypted: '[REDACTED]', mpesa_passkey_encrypted: '[REDACTED]' });

    // Update database with error handling for missing columns
    const { error } = await (supabase as any)
      .from('bars')
      .update(updateData)
      .eq('id', barId);

    if (error) {
      console.error('❌ Database error:', error);
      
      // Check if error is due to missing columns
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        return NextResponse.json({
          error: 'Database schema not updated. Please run the M-Pesa migration first. Missing columns: ' + error.message
        }, { status: 500 });
      }
      
      return NextResponse.json({
        error: 'Failed to save M-Pesa settings: ' + error.message
      }, { status: 500 });
    }

    console.log('✅ M-Pesa settings saved successfully');

    return NextResponse.json({
      success: true,
      message: 'M-Pesa settings saved successfully'
    });

  } catch (error) {
    console.error('❌ M-Pesa settings save error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const barId = url.searchParams.get('barId');

    if (!barId) {
      return NextResponse.json({ error: 'Bar ID is required' }, { status: 400 });
    }

    console.log('🔍 Fetching M-Pesa settings for bar:', barId);

    // Get bar's M-Pesa configuration (without decrypting credentials)
    const { data: barData, error: barError } = await (supabase as any)
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
        mpesa_last_test_at,
        mpesa_test_status
      `)
      .eq('id', barId)
      .single();

    if (barError || !barData) {
      console.error('❌ Bar not found:', barError);
      return NextResponse.json({ error: 'Bar not found' }, { status: 404 });
    }

    console.log('✅ M-Pesa settings fetched:', {
      mpesa_enabled: barData.mpesa_enabled,
      mpesa_environment: barData.mpesa_environment,
      mpesa_business_shortcode: barData.mpesa_business_shortcode,
      has_consumer_key: !!barData.mpesa_consumer_key_encrypted,
      has_consumer_secret: !!barData.mpesa_consumer_secret_encrypted,
      has_passkey: !!barData.mpesa_passkey_encrypted,
      mpesa_setup_completed: barData.mpesa_setup_completed,
      mpesa_test_status: barData.mpesa_test_status
    });

    // Return settings with masked credentials
    return NextResponse.json({
      success: true,
      settings: {
        mpesa_enabled: barData.mpesa_enabled ?? false,
        mpesa_environment: barData.mpesa_environment ?? 'sandbox',
        mpesa_business_shortcode: barData.mpesa_business_shortcode ?? '',
        mpesa_consumer_key: barData.mpesa_consumer_key_encrypted ? '••••••••••••••••' : '',
        mpesa_consumer_secret: barData.mpesa_consumer_secret_encrypted ? '••••••••••••••••' : '',
        mpesa_passkey: barData.mpesa_passkey_encrypted ? '••••••••••••••••' : '',
        mpesa_setup_completed: barData.mpesa_setup_completed ?? false,
        mpesa_last_test_at: barData.mpesa_last_test_at,
        mpesa_test_status: barData.mpesa_test_status ?? 'pending',
        // Indicate which credentials are saved
        has_credentials: !!(barData.mpesa_consumer_key_encrypted && 
                           barData.mpesa_consumer_secret_encrypted && 
                           barData.mpesa_passkey_encrypted)
      }
    });

  } catch (error) {
    console.error('❌ M-Pesa settings fetch error:', error);
    return NextResponse.json({
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}