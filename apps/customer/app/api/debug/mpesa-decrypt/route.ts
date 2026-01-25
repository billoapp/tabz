import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { decryptCredential } from '@tabeza/shared/lib/mpesa/services/encryption';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables first
    const mpesaKmsKey = process.env.MPESA_KMS_KEY;
    
    if (!mpesaKmsKey) {
      return NextResponse.json({
        error: 'MPESA_KMS_KEY not set',
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV
        }
      }, { status: 500 });
    }
    
    // Try to fetch and decrypt credentials
    const supabase = createServiceRoleClient();
    
    const { data: credentialRecord, error: queryError } = await supabase
      .from('mpesa_credentials')
      .select('consumer_key_enc, consumer_secret_enc, passkey_enc, business_shortcode')
      .eq('tenant_id', '438c80c1-fe11-4ac5-8a48-2fc45104ba31')
      .eq('environment', 'sandbox')
      .single();

    if (queryError) {
      return NextResponse.json({
        error: 'Database query failed',
        details: queryError.message,
        environment: {
          MPESA_KMS_KEY_SET: !!mpesaKmsKey,
          MPESA_KMS_KEY_LENGTH: mpesaKmsKey.length
        }
      }, { status: 500 });
    }

    if (!credentialRecord) {
      return NextResponse.json({
        error: 'No credentials found',
        environment: {
          MPESA_KMS_KEY_SET: !!mpesaKmsKey,
          MPESA_KMS_KEY_LENGTH: mpesaKmsKey.length
        }
      }, { status: 404 });
    }

    // Analyze the credential data format
    const analysis = {
      consumerKeyType: typeof credentialRecord.consumer_key_enc,
      consumerKeyLength: credentialRecord.consumer_key_enc?.length || 0,
      consumerSecretType: typeof credentialRecord.consumer_secret_enc,
      consumerSecretLength: credentialRecord.consumer_secret_enc?.length || 0,
      passkeyType: typeof credentialRecord.passkey_enc,
      passkeyLength: credentialRecord.passkey_enc?.length || 0,
      businessShortcode: credentialRecord.business_shortcode
    };

    // Try to convert to Buffer and decrypt
    let decryptionResults = {
      consumerKey: { success: false, error: '', length: 0 },
      consumerSecret: { success: false, error: '', length: 0 },
      passkey: { success: false, error: '', length: 0 }
    };

    try {
      // Convert consumer key to Buffer
      let consumerKeyBuffer: Buffer;
      if (typeof credentialRecord.consumer_key_enc === 'string') {
        if (credentialRecord.consumer_key_enc.startsWith('\\x')) {
          consumerKeyBuffer = Buffer.from(credentialRecord.consumer_key_enc.slice(2), 'hex');
        } else {
          consumerKeyBuffer = Buffer.from(credentialRecord.consumer_key_enc, 'hex');
        }
      } else {
        consumerKeyBuffer = Buffer.from(credentialRecord.consumer_key_enc);
      }

      decryptionResults.consumerKey.length = consumerKeyBuffer.length;

      // Try to decrypt consumer key
      const decryptedConsumerKey = decryptCredential(consumerKeyBuffer);
      decryptionResults.consumerKey.success = true;
      decryptionResults.consumerKey.decryptedLength = decryptedConsumerKey.length;
      decryptionResults.consumerKey.startsWithExpected = decryptedConsumerKey.startsWith('QYM7B1LW9A');

    } catch (error) {
      decryptionResults.consumerKey.error = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      // Convert consumer secret to Buffer
      let consumerSecretBuffer: Buffer;
      if (typeof credentialRecord.consumer_secret_enc === 'string') {
        if (credentialRecord.consumer_secret_enc.startsWith('\\x')) {
          consumerSecretBuffer = Buffer.from(credentialRecord.consumer_secret_enc.slice(2), 'hex');
        } else {
          consumerSecretBuffer = Buffer.from(credentialRecord.consumer_secret_enc, 'hex');
        }
      } else {
        consumerSecretBuffer = Buffer.from(credentialRecord.consumer_secret_enc);
      }

      decryptionResults.consumerSecret.length = consumerSecretBuffer.length;

      // Try to decrypt consumer secret
      const decryptedConsumerSecret = decryptCredential(consumerSecretBuffer);
      decryptionResults.consumerSecret.success = true;
      decryptionResults.consumerSecret.decryptedLength = decryptedConsumerSecret.length;
      decryptionResults.consumerSecret.startsWithExpected = decryptedConsumerSecret.startsWith('Ku0hb9C966');

    } catch (error) {
      decryptionResults.consumerSecret.error = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      // Convert passkey to Buffer
      let passkeyBuffer: Buffer;
      if (typeof credentialRecord.passkey_enc === 'string') {
        if (credentialRecord.passkey_enc.startsWith('\\x')) {
          passkeyBuffer = Buffer.from(credentialRecord.passkey_enc.slice(2), 'hex');
        } else {
          passkeyBuffer = Buffer.from(credentialRecord.passkey_enc, 'hex');
        }
      } else {
        passkeyBuffer = Buffer.from(credentialRecord.passkey_enc);
      }

      decryptionResults.passkey.length = passkeyBuffer.length;

      // Try to decrypt passkey
      const decryptedPasskey = decryptCredential(passkeyBuffer);
      decryptionResults.passkey.success = true;
      decryptionResults.passkey.decryptedLength = decryptedPasskey.length;
      decryptionResults.passkey.startsWithExpected = decryptedPasskey.startsWith('bfb279f9aa');

    } catch (error) {
      decryptionResults.passkey.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const allDecryptionSuccessful = decryptionResults.consumerKey.success && 
                                   decryptionResults.consumerSecret.success && 
                                   decryptionResults.passkey.success;

    return NextResponse.json({
      success: allDecryptionSuccessful,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        MPESA_KMS_KEY_SET: !!mpesaKmsKey,
        MPESA_KMS_KEY_LENGTH: mpesaKmsKey.length,
        MPESA_KMS_KEY_FIRST_10: mpesaKmsKey.substring(0, 10),
        MPESA_KMS_KEY_LAST_10: mpesaKmsKey.substring(mpesaKmsKey.length - 10)
      },
      database: analysis,
      decryption: decryptionResults,
      timestamp: new Date().toISOString(),
      message: allDecryptionSuccessful ? 
        'All credentials decrypted successfully in Vercel environment!' :
        'Decryption failed in Vercel environment'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}