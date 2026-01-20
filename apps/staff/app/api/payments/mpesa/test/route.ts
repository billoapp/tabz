// M-Pesa test endpoint for validating setup
// This endpoint tests M-Pesa credentials without creating actual payments

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Minimal M-Pesa utilities inlined to avoid import issues
const ENCRYPTION_KEY = (process.env.MPESA_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!').slice(0, 32).padEnd(32, '0');

function decryptCredential(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format - expected iv:encrypted_data');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateMpesaToken(
  consumerKey: string,
  consumerSecret: string,
  environment: 'sandbox' | 'production'
): Promise<string> {
  const baseUrl = environment === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate M-Pesa token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

function validateMpesaCredentials(credentials: {
  businessShortCode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!/^\d{5,7}$/.test(credentials.businessShortCode)) {
    errors.push('Business shortcode must be 5-7 digits');
  }
  
  if (!credentials.consumerKey || credentials.consumerKey.length < 10) {
    errors.push('Consumer key is required and must be at least 10 characters');
  }
  
  if (!credentials.consumerSecret || credentials.consumerSecret.length < 10) {
    errors.push('Consumer secret is required and must be at least 10 characters');
  }
  
  if (!credentials.passkey || credentials.passkey.length < 10) {
    errors.push('Passkey is required and must be at least 10 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function POST(request: NextRequest) {
  try {
    const { barId } = await request.json();

    if (!barId) {
      return NextResponse.json({ error: 'Bar ID is required' }, { status: 400 });
    }

    // Get bar's M-Pesa configuration
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
        mpesa_passkey_encrypted
      `)
      .eq('id', barId)
      .single();

    if (barError || !barData) {
      return NextResponse.json({ error: 'Bar not found' }, { status: 404 });
    }

    // Check if credentials exist
    if (!barData.mpesa_consumer_key_encrypted || 
        !barData.mpesa_consumer_secret_encrypted || 
        !barData.mpesa_passkey_encrypted) {
      return NextResponse.json({ 
        error: 'M-Pesa credentials not configured' 
      }, { status: 400 });
    }

    // Decrypt credentials
    let consumerKey: string;
    let consumerSecret: string;
    let passkey: string;

    try {
      consumerKey = decryptCredential(barData.mpesa_consumer_key_encrypted);
      consumerSecret = decryptCredential(barData.mpesa_consumer_secret_encrypted);
      passkey = decryptCredential(barData.mpesa_passkey_encrypted);
    } catch (error) {
      console.error('Failed to decrypt M-Pesa credentials:', error);
      return NextResponse.json({
        error: 'Failed to decrypt M-Pesa credentials'
      }, { status: 500 });
    }

    // Validate credentials format
    const validation = validateMpesaCredentials({
      businessShortCode: barData.mpesa_business_shortcode,
      consumerKey,
      consumerSecret,
      passkey
    });

    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Invalid credentials format',
        details: validation.errors
      }, { status: 400 });
    }

    // Test OAuth token generation
    try {
      const accessToken = await generateMpesaToken(
        consumerKey,
        consumerSecret,
        barData.mpesa_environment as 'sandbox' | 'production'
      );

      if (!accessToken) {
        throw new Error('Failed to generate access token');
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
        environment: barData.mpesa_environment,
        businessShortcode: barData.mpesa_business_shortcode
      });

    } catch (error: any) {
      console.error('M-Pesa token generation failed:', error);

      // Update test status to failed
      await (supabase as any)
        .from('bars')
        .update({
          mpesa_setup_completed: false,
          mpesa_test_status: 'failed',
          mpesa_last_test_at: new Date().toISOString()
        })
        .eq('id', barId);

      return NextResponse.json({
        error: 'Failed to validate M-Pesa credentials',
        details: error.message
      }, { status: 400 });
    }

  } catch (error) {
    console.error('M-Pesa test error:', error);
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