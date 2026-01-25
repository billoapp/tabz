import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const mpesaKmsKey = process.env.MPESA_KMS_KEY;
    const nodeEnv = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;
    
    return NextResponse.json({
      environment: {
        NODE_ENV: nodeEnv,
        VERCEL_ENV: vercelEnv,
        MPESA_KMS_KEY_SET: !!mpesaKmsKey,
        MPESA_KMS_KEY_LENGTH: mpesaKmsKey?.length || 0,
        MPESA_KMS_KEY_FIRST_10: mpesaKmsKey?.substring(0, 10) || 'NOT_SET',
        MPESA_KMS_KEY_LAST_10: mpesaKmsKey?.substring(mpesaKmsKey.length - 10) || 'NOT_SET',
        EXPECTED_KEY: 'f96e963596ff777eb4cd1a5425480909',
        KEY_MATCHES_EXPECTED: mpesaKmsKey === 'f96e963596ff777eb4cd1a5425480909'
      },
      timestamp: new Date().toISOString(),
      message: 'M-Pesa environment diagnostic'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}