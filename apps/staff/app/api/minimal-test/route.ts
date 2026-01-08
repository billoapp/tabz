import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Minimal Resend test');
    
    const body = await request.json();
    const { email } = body;

    // Check environment variables
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    
    console.log('🧪 Env check:', {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 8) + '...',
      fromEmail
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'No API key' }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    // Test with hardcoded values to isolate the issue
    const { data, error } = await resend.emails.send({
      from: `Tabeza Support <${fromEmail}>`,
      to: [email || 'billo.mobile.app@gmail.com'],
      subject: 'Minimal Test',
      html: '<p>This is a minimal test</p>'
    });

    if (error) {
      console.error('🧪 Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('🧪 Success:', data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('🧪 Test error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'POST to test minimal Resend functionality',
    usage: { 
      method: 'POST',
      body: { email: 'your-email@example.com' }
    }
  });
}
