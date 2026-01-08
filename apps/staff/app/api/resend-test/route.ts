import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Resend test API called');
    
    // Parse request body
    const body = await request.json();
    const { name, email, barName, message } = body;

    console.log('🧪 Test request data:', { name, email, barName, messageLength: message?.length });

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check environment variables
    console.log('🧪 Environment check:', {
      hasApiKey: !!process.env.RESEND_API_KEY,
      hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
      hasSupportEmail: !!process.env.RESEND_SUPPORT_EMAIL,
      fromEmail: process.env.RESEND_FROM_EMAIL,
      supportEmail: process.env.RESEND_SUPPORT_EMAIL
    });

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('🧪 Creating Resend instance...');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@tabeza.co.ke';
    const supportEmail = process.env.RESEND_SUPPORT_EMAIL || 'support@tabeza.co.ke';

    console.log('🧪 Sending test email...', {
      from: fromEmail,
      to: supportEmail,
      cc: email
    });

    // Simple test email
    const { data, error } = await resend.emails.send({
      from: `Tabeza Support <${fromEmail}>`,
      to: [supportEmail],
      cc: [email],
      subject: `Test: Tabeza Feedback from ${name}`,
      html: `
        <h1>Test Feedback</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Restaurant:</strong> ${barName || 'Not specified'}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
      replyTo: email
    });

    if (error) {
      console.error('🧪 Resend error:', error);
      console.error('🧪 Full error:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: `Resend error: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('🧪 Test email sent successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully!',
      emailId: data?.id
    });

  } catch (error: any) {
    console.error('🧪 Test API error:', error);
    console.error('🧪 Error stack:', error.stack);
    return NextResponse.json(
      { error: `Test error: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Resend test API - POST to test email sending'
  });
}
