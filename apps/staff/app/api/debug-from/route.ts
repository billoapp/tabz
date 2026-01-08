import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testEmail } = body;

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const supportEmail = process.env.RESEND_SUPPORT_EMAIL;

    console.log('🔍 Full debug:', {
      apiKeyPrefix: apiKey?.substring(0, 8) + '...',
      fromEmail,
      supportEmail,
      testEmail
    });

    const resend = new Resend(apiKey);

    // Test 1: Using environment variable directly
    console.log('📧 Test 1: Using env var fromEmail');
    const result1 = await resend.emails.send({
      from: `Tabeza Support <${fromEmail}>`,
      to: [testEmail || 'billo.mobile.app@gmail.com'],
      subject: 'Test 1 - Env Var',
      html: '<p>Test 1: Using environment variable</p>'
    });

    if (result1.error) {
      console.error('❌ Test 1 failed:', result1.error);
      return NextResponse.json({ 
        error: 'Test 1 failed', 
        details: result1.error,
        fromUsed: `Tabeza Support <${fromEmail}>`
      }, { status: 500 });
    }

    console.log('✅ Test 1 success:', result1.data);
    return NextResponse.json({ 
      success: true, 
      message: 'Test 1 successful',
      fromUsed: `Tabeza Support <${fromEmail}>`,
      data: result1.data
    });

  } catch (error: any) {
    console.error('🔍 Test error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to test with exact environment variables',
    body: { testEmail: 'your-email@example.com' }
  });
}
