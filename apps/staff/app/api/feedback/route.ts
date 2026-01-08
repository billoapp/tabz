// apps/staff/app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Email template for feedback
const getFeedbackEmailHTML = (data: {
  name: string;
  email: string;
  barName: string;
  message: string;
  timestamp: string;
}) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
      color: white;
      padding: 20px;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .field {
      margin-bottom: 20px;
    }
    .label {
      font-weight: bold;
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      margin-top: 5px;
      color: #111827;
      font-size: 16px;
    }
    .message {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #f97316;
      margin-top: 10px;
      white-space: pre-wrap;
    }
    .footer {
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">📬 New Feedback from Tabeza Staff</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">From</div>
        <div class="value">${data.name}</div>
      </div>
      
      <div class="field">
        <div class="label">Email</div>
        <div class="value">${data.email}</div>
      </div>
      
      <div class="field">
        <div class="label">Restaurant</div>
        <div class="value">${data.barName}</div>
      </div>
      
      <div class="field">
        <div class="label">Timestamp</div>
        <div class="value">${data.timestamp}</div>
      </div>
      
      <div class="field">
        <div class="label">Message</div>
        <div class="message">${data.message}</div>
      </div>
    </div>
    <div class="footer">
      <p>This feedback was sent from the Tabeza Staff Dashboard</p>
    </div>
  </div>
</body>
</html>
`;

// Confirmation email template for sender
const getConfirmationEmailHTML = (data: {
  name: string;
  message: string;
}) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 20px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f0fdf4;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .message {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">✅ Feedback Received</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px; margin-bottom: 10px;">Hi ${data.name},</p>
      <p>Thank you for your feedback! We've received your message and will review it shortly.</p>
      
      <div style="margin-top: 20px;">
        <strong>Your message:</strong>
        <div class="message">${data.message}</div>
      </div>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        We appreciate you taking the time to help us improve Tabeza. If your feedback requires a response, we'll get back to you as soon as possible.
      </p>
      
      <p style="margin-top: 20px; color: #059669; font-weight: bold;">
        - The Tabeza Team
      </p>
    </div>
  </div>
</body>
</html>
`;

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Feedback API called');
    
    // Parse request body
    const body = await request.json();
    const { name, email, barName, message } = body;

    console.log('📧 Request data:', { name, email, barName, messageLength: message?.length });

    // Validation
    if (!name || !email || !message) {
      console.log('❌ Validation failed: missing fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and message are required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Validation failed: invalid email');
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Check environment variables
    console.log('🔧 Environment check:', {
      hasApiKey: !!process.env.RESEND_API_KEY,
      hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
      hasSupportEmail: !!process.env.RESEND_SUPPORT_EMAIL,
      fromEmail: process.env.RESEND_FROM_EMAIL,
      supportEmail: process.env.RESEND_SUPPORT_EMAIL
    });

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service is not configured. Please contact administrator.' },
        { status: 500 }
      );
    }

    console.log('📧 Initializing Resend...');
    
    // Get timestamp
    const timestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Africa/Nairobi'
    });

    // Prepare email data
    const emailData = {
      name,
      email,
      barName: barName || 'Not specified',
      message,
      timestamp
    };

    // Support email (recipient)
    const supportEmail = process.env.RESEND_SUPPORT_EMAIL || 'conversationapps@gmail.com';
    
    // From email (must be verified domain in Resend)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    console.log('📧 Sending feedback emails...', {
      from: fromEmail,
      to: supportEmail,
      cc: email,
      subject: `Tabeza Feedback from ${name} (${barName})`
    });

    // Send email to support WITH copy to sender
    const { data: supportEmailData, error: supportError } = await resend.emails.send({
      from: fromEmail,
      to: [supportEmail],
      cc: [email], // Copy sender
      subject: `Tabeza Feedback from ${name} (${barName})`,
      html: getFeedbackEmailHTML(emailData),
      replyTo: email
    });

    if (supportError) {
      console.error('❌ Error sending feedback email:', supportError);
      console.error('❌ Full error details:', JSON.stringify(supportError, null, 2));
      return NextResponse.json(
        { error: `Failed to send feedback: ${supportError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('✅ Feedback emails sent successfully:', supportEmailData);

    // Return success
    return NextResponse.json(
      { 
        success: true, 
        message: 'Feedback sent successfully! You will receive a copy at your email.',
        emailId: supportEmailData?.id
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Unexpected error in feedback API:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    return NextResponse.json(
      { error: `An unexpected error occurred: ${error.message}` },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}