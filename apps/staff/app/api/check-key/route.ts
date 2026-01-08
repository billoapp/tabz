import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  
  const keyInfo = {
    hasKey: !!apiKey,
    keyPrefix: apiKey?.substring(0, 12) + '...',
    isTestKey: apiKey?.startsWith('re_test_') || false,
    isProductionKey: apiKey?.startsWith('re_') && !apiKey?.startsWith('re_test_') || false,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    supportEmail: process.env.RESEND_SUPPORT_EMAIL
  };

  console.log('🔑 API Key analysis:', keyInfo);

  return NextResponse.json(keyInfo);
}
