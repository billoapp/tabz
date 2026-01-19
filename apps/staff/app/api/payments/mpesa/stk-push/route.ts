// M-Pesa STK Push API endpoint
// Multi-tenant safe implementation integrated with tab_payments

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// Inline utility functions to avoid import path issues
import crypto from 'crypto';

// M-Pesa configuration
const MPESA_CONFIG = {
  SANDBOX_BASE_URL: 'https://sandbox.safaricom.co.ke',
  PRODUCTION_BASE_URL: 'https://api.safaricom.co.ke',
  OAUTH_ENDPOINT: '/oauth/v1/generate?grant_type=client_credentials',
  STK_PUSH_ENDPOINT: '/mpesa/stkpush/v1/processrequest',
  CALLBACK_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.tabeza.co.ke',
} as const;

// Encryption key from environment
const ENCRYPTION_KEY = process.env.MPESA_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here!!';

function decryptCredential(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function generateMpesaToken(
  consumerKey: string,
  consumerSecret: string,
  environment: 'sandbox' | 'production'
): Promise<string> {
  const baseUrl = environment === 'production' 
    ? MPESA_CONFIG.PRODUCTION_BASE_URL 
    : MPESA_CONFIG.SANDBOX_BASE_URL;
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  
  const response = await fetch(`${baseUrl}${MPESA_CONFIG.OAUTH_ENDPOINT}`, {
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

function generateMpesaPassword(
  businessShortCode: string,
  passkey: string,
  timestamp: string
): string {
  const concatenated = businessShortCode + passkey + timestamp;
  return Buffer.from(concatenated).toString('base64');
}

function generateMpesaTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generateCallbackUrl(): string {
  return `${MPESA_CONFIG.CALLBACK_BASE_URL}/api/payments/mpesa/callback`;
}

function generateAccountReference(
  barId: string,
  tabId: string
): string {
  return `${barId}|${tabId}`;
}

function validateMpesaPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
  const kenyanFormat = /^254[17]\d{8}$/;
  const localFormat = /^07\d{8}$/;
  
  return kenyanFormat.test(cleaned) || localFormat.test(cleaned);
}

function formatMpesaPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
  
  if (cleaned.startsWith('254')) {
    return cleaned;
  } else if (cleaned.startsWith('07')) {
    return '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '254' + cleaned;
  } else {
    throw new Error('Invalid phone number format');
  }
}

interface StkPushRequest {
  businessShortCode: string;
  password: string;
  timestamp: string;
  transactionType: 'CustomerPayBillOnline';
  amount: number;
  partyA: string;
  partyB: string;
  phoneNumber: string;
  callBackURL: string;
  accountReference: string;
  transactionDesc: string;
}

interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      barId,
      tabId,
      phoneNumber,
      amount,
      description = 'Tab payment'
    } = await request.json();

    // Validate required fields
    if (!barId || !tabId || !phoneNumber || !amount) {
      return NextResponse.json({
        error: 'Missing required fields: barId, tabId, phoneNumber, amount'
      }, { status: 400 });
    }

    // Validate phone number
    if (!validateMpesaPhoneNumber(phoneNumber)) {
      return NextResponse.json({
        error: 'Invalid phone number format. Use 254XXXXXXXXX or 07XXXXXXXX'
      }, { status: 400 });
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({
        error: 'Amount must be a positive number'
      }, { status: 400 });
    }

    // Verify tab exists and belongs to the bar
    const { data: tabData, error: tabError } = await (supabase as any)
      .from('tabs')
      .select('id, bar_id, balance')
      .eq('id', tabId)
      .eq('bar_id', barId)
      .single();

    if (tabError || !tabData) {
      return NextResponse.json({ error: 'Tab not found or does not belong to this bar' }, { status: 404 });
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
        mpesa_passkey_encrypted,
        mpesa_setup_completed
      `)
      .eq('id', barId)
      .single();

    if (barError || !barData) {
      return NextResponse.json({ error: 'Bar not found' }, { status: 404 });
    }

    // Check if M-Pesa is enabled and configured
    if (!barData.mpesa_enabled || !barData.mpesa_setup_completed) {
      return NextResponse.json({
        error: 'M-Pesa is not enabled or configured for this business'
      }, { status: 400 });
    }

    // Create payment record first
    const { data: payment, error: paymentError } = await (supabase as any)
      .from('tab_payments')
      .insert({
        tab_id: tabId,
        amount: numAmount,
        method: 'mpesa',
        status: 'pending',
        metadata: {
          phone_number: phoneNumber,
          description: description,
          initiated_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 });
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
      
      // Update payment status to failed
      await (supabase as any)
        .from('tab_payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);
      
      return NextResponse.json({
        error: 'Failed to decrypt M-Pesa credentials'
      }, { status: 500 });
    }

    // Generate OAuth token
    const accessToken = await generateMpesaToken(
      consumerKey,
      consumerSecret,
      barData.mpesa_environment as 'sandbox' | 'production'
    );

    // Generate M-Pesa request parameters
    const timestamp = generateMpesaTimestamp();
    const password = generateMpesaPassword(
      barData.mpesa_business_shortcode,
      passkey,
      timestamp
    );
    const formattedPhone = formatMpesaPhoneNumber(phoneNumber);
    const accountReference = generateAccountReference(barId, tabId);
    const callbackUrl = generateCallbackUrl();

    // Prepare STK Push request
    const stkPushData: StkPushRequest = {
      businessShortCode: barData.mpesa_business_shortcode,
      password,
      timestamp,
      transactionType: 'CustomerPayBillOnline',
      amount: Math.round(numAmount), // M-Pesa requires integer amounts
      partyA: formattedPhone,
      partyB: barData.mpesa_business_shortcode,
      phoneNumber: formattedPhone,
      callBackURL: callbackUrl,
      accountReference,
      transactionDesc: description
    };

    // Send STK Push request
    const baseUrl = barData.mpesa_environment === 'production'
      ? MPESA_CONFIG.PRODUCTION_BASE_URL
      : MPESA_CONFIG.SANDBOX_BASE_URL;

    const stkResponse = await fetch(`${baseUrl}${MPESA_CONFIG.STK_PUSH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPushData)
    });

    const stkResult: StkPushResponse = await stkResponse.json();

    if (!stkResponse.ok || stkResult.ResponseCode !== '0') {
      console.error('STK Push failed:', stkResult);
      
      // Update payment status to failed
      await (supabase as any)
        .from('tab_payments')
        .update({ 
          status: 'failed',
          metadata: {
            ...payment.metadata,
            error: stkResult.ResponseDescription || 'STK Push failed'
          }
        })
        .eq('id', payment.id);
      
      return NextResponse.json({
        error: 'Failed to initiate M-Pesa payment',
        details: stkResult.ResponseDescription || 'Unknown error'
      }, { status: 400 });
    }

    // Store M-Pesa transaction record
    const { error: mpesaTransactionError } = await (supabase as any)
      .from('mpesa_transactions')
      .insert({
        payment_id: payment.id,
        bar_id: barId,
        merchant_request_id: stkResult.MerchantRequestID,
        checkout_request_id: stkResult.CheckoutRequestID,
        phone_number: formattedPhone,
        account_reference: accountReference,
        initiated_at: new Date().toISOString()
      });

    if (mpesaTransactionError) {
      console.error('Failed to store M-Pesa transaction:', mpesaTransactionError);
      // Don't fail the request, just log the error
    }

    // Update payment with M-Pesa reference
    await (supabase as any)
      .from('tab_payments')
      .update({
        reference: stkResult.CheckoutRequestID,
        metadata: {
          ...payment.metadata,
          merchant_request_id: stkResult.MerchantRequestID,
          checkout_request_id: stkResult.CheckoutRequestID
        }
      })
      .eq('id', payment.id);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'STK Push sent successfully',
      data: {
        paymentId: payment.id,
        merchantRequestId: stkResult.MerchantRequestID,
        checkoutRequestId: stkResult.CheckoutRequestID,
        customerMessage: stkResult.CustomerMessage
      }
    });

  } catch (error) {
    console.error('STK Push error:', error);
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