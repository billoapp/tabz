// M-Pesa settings API endpoint with server-side encryption
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Encryption key from environment
const ENCRYPTION_KEY = process.env.MPESA_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';

function encryptCredential(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
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
      try {
        updateData.mpesa_consumer_key_encrypted = encryptCredential(mpesa_consumer_key);
        updateData.mpesa_consumer_secret_encrypted = encryptCredential(mpesa_consumer_secret);
        updateData.mpesa_passkey_encrypted = encryptCredential(mpesa_passkey);
        console.log('✅ Credentials encrypted successfully');
      } catch (encryptError) {
        console.error('❌ Encryption error:', encryptError);
        return NextResponse.json({
          error: 'Failed to encrypt credentials'
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

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}