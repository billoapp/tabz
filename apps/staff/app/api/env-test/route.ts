import { NextResponse } from 'next/server';

export async function GET() {
  // Log exact environment variable values (without exposing the API key)
  const envDebug = {
    resendApiKeySet: !!process.env.RESEND_API_KEY,
    resendApiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8) + '...',
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    resendSupportEmail: process.env.RESEND_SUPPORT_EMAIL,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    allResendVars: Object.keys(process.env)
      .filter(key => key.includes('RESEND'))
      .reduce((acc, key) => {
        acc[key] = key.includes('KEY') 
          ? (process.env[key]?.substring(0, 8) + '...' || 'not-set')
          : (process.env[key] || 'not-set');
        return acc;
      }, {} as Record<string, string>)
  };

  console.log('🔍 Detailed env debug:', envDebug);

  return NextResponse.json(envDebug);
}
