import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateMpesaPhoneNumber, sanitizePhoneNumber } from '@tabeza/shared/lib/phoneValidation';
import { MpesaRateLimiter, extractIpAddress, STKPushService, TransactionService, MpesaError, MpesaNetworkError, MpesaValidationError, ServiceFactory } from '@tabeza/shared';

export async function POST(request: NextRequest) {
  try {
    const { tabId, phoneNumber, amount } = await request.json();

    // Extract IP address for rate limiting
    const ipAddress = extractIpAddress(request);

    // Validate required fields
    if (!tabId || !phoneNumber || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: tabId, phoneNumber, amount' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate and sanitize phone number
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
    const phoneValidation = validateMpesaPhoneNumber(sanitizedPhone);
    
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { 
          error: phoneValidation.error || 'Invalid phone number format',
          suggestions: phoneValidation.suggestions 
        },
        { status: 400 }
      );
    }

    // Use the international format from validation
    const validatedPhoneNumber = phoneValidation.international;
    
    if (!validatedPhoneNumber) {
      return NextResponse.json(
        { error: 'Failed to format phone number' },
        { status: 400 }
      );
    }

    // Check if tab exists and get customer info
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('id, customer_id, status')
      .eq('id', tabId)
      .single();

    if (tabError || !tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      );
    }

    if (tab.status !== 'open') {
      return NextResponse.json(
        { error: 'Tab is not open for payments' },
        { status: 400 }
      );
    }

    // Initialize rate limiter
    const rateLimiter = new MpesaRateLimiter(
      undefined, // Use default config
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check rate limits and suspicious activity
    const rateLimitResult = await rateLimiter.checkCustomerRateLimit(
      tab.customer_id,
      validatedPhoneNumber,
      amount,
      ipAddress
    );

    if (!rateLimitResult.allowed) {
      // Log the rate limit violation
      await rateLimiter.recordFailedAttempt(
        tab.customer_id,
        validatedPhoneNumber,
        amount,
        rateLimitResult.reason || 'Rate limit exceeded',
        ipAddress
      );

      return NextResponse.json(
        { 
          error: rateLimitResult.reason || 'Too many payment attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
          remainingAttempts: rateLimitResult.remainingAttempts
        },
        { status: 429 }
      );
    }

    // Create transaction record
    const transactionService = new TransactionService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const transaction = await transactionService.createTransaction({
      tabId: tabId,
      customerId: tab.customer_id,
      phoneNumber: validatedPhoneNumber,
      amount: amount,
      environment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
    });

    // Initialize M-PESA configuration and STK Push service
    const serviceConfig = ServiceFactory.createServiceConfig(
      (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      {
        consumerKey: process.env.MPESA_CONSUMER_KEY!,
        consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
        businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE!,
        passkey: process.env.MPESA_PASSKEY!,
        callbackUrl: process.env.MPESA_CALLBACK_URL!,
        environment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
        encryptedAt: new Date()
      }
    );
    const stkPushService = new STKPushService(serviceConfig);

    try {
      // Send STK Push request
      const stkResponse = await stkPushService.sendSTKPush({
        phoneNumber: validatedPhoneNumber,
        amount: amount,
        accountReference: `TAB${tabId.slice(-8)}`, // Use last 8 chars of tab ID
        transactionDesc: `Tab Payment`,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mpesa/callback`
      });

      // Update transaction with STK Push response
      await transactionService.updateTransactionStatus(transaction.id, 'sent', {
        checkoutRequestId: stkResponse.CheckoutRequestID,
        merchantRequestId: stkResponse.MerchantRequestID
      });

      // Record successful payment initiation
      await rateLimiter.recordSuccessfulPayment(
        tab.customer_id,
        validatedPhoneNumber,
        amount,
        ipAddress
      );

      return NextResponse.json({
        success: true,
        transactionId: transaction.id,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        customerMessage: stkResponse.CustomerMessage,
        remainingAttempts: rateLimitResult.remainingAttempts,
        resetTime: rateLimitResult.resetTime
      });

    } catch (error) {
      console.error('STK Push error:', error);

      // Update transaction status to failed
      let failureReason = 'STK Push request failed';
      if (error instanceof MpesaError) {
        failureReason = error.message;
      } else if (error instanceof MpesaNetworkError) {
        failureReason = 'Network error during payment initiation';
      } else if (error instanceof MpesaValidationError) {
        failureReason = 'Payment validation failed';
      }

      await transactionService.updateTransactionStatus(transaction.id, 'failed', {
        failureReason: failureReason
      });

      // Record failed attempt
      await rateLimiter.recordFailedAttempt(
        tab.customer_id,
        validatedPhoneNumber,
        amount,
        failureReason,
        ipAddress
      );

      // Return appropriate error response
      if (error instanceof MpesaValidationError) {
        return NextResponse.json(
          { 
            error: 'Payment validation failed',
            details: error.validationErrors,
            transactionId: transaction.id
          },
          { status: 400 }
        );
      } else if (error instanceof MpesaNetworkError) {
        return NextResponse.json(
          { 
            error: 'Payment service temporarily unavailable. Please try again later.',
            transactionId: transaction.id
          },
          { status: 503 }
        );
      } else {
        return NextResponse.json(
          { 
            error: 'Payment initiation failed. Please try again.',
            transactionId: transaction.id
          },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('M-PESA initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}