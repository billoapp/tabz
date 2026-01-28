/**
 * Simplified M-Pesa Payment Initiation API
 * Replaces over-engineered implementation with simple, maintainable solution
 * Requirements: 1.1, 2.1, 2.2, 2.3, 5.1, 5.3, 5.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { 
  validateKenyanPhoneNumber,
  sendSTKPush,
  loadMpesaConfigFromBar, 
  MpesaConfigurationError,
  type BarMpesaData 
} from '@tabeza/shared';

interface MpesaPaymentRequest {
  tabId: string;
  phoneNumber: string;
  amount: number;
}

interface MpesaPaymentResponse {
  success: boolean;
  checkoutRequestId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<MpesaPaymentResponse>> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    let requestBody: MpesaPaymentRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { tabId, phoneNumber, amount } = requestBody;

    // Validate required fields
    const missingFields: string[] = [];
    if (!tabId) missingFields.push('tabId');
    if (!phoneNumber) missingFields.push('phoneNumber');
    if (amount === undefined || amount === null) missingFields.push('amount');

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate field types
    if (typeof tabId !== 'string' || tabId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'tabId must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    if (amount > 999999) {
      return NextResponse.json(
        { success: false, error: 'amount cannot exceed 999,999 KES' },
        { status: 400 }
      );
    }

    // Requirement 2.4: Validate phone number format
    const phoneValidation = validateKenyanPhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: phoneValidation.error || 'Invalid phone number format' 
        },
        { status: 400 }
      );
    }

    const normalizedPhoneNumber = phoneValidation.normalized!;

    // Verify tab exists and get bar M-Pesa configuration
    const supabase = createServiceRoleClient();
    const { data: tabWithBar, error: tabError } = await supabase
      .from('tabs')
      .select(`
        id, 
        status, 
        bar_id,
        bars!inner(
          id,
          mpesa_enabled,
          mpesa_environment,
          mpesa_business_shortcode,
          mpesa_consumer_key_encrypted,
          mpesa_consumer_secret_encrypted,
          mpesa_passkey_encrypted,
          mpesa_callback_url
        )
      `)
      .eq('id', tabId)
      .single();

    if (tabError || !tabWithBar) {
      console.error('Tab not found:', { tabId, error: tabError });
      return NextResponse.json(
        { success: false, error: 'Tab not found' },
        { status: 404 }
      );
    }

    // Validate tab status (allow both open and overdue tabs for payments)
    if (tabWithBar.status !== 'open' && tabWithBar.status !== 'overdue') {
      return NextResponse.json(
        { success: false, error: 'Tab is not available for payments' },
        { status: 400 }
      );
    }

    // Load M-Pesa configuration for this bar
    const barData = tabWithBar.bars[0] as BarMpesaData;
    let mpesaConfig;
    
    // Check if mock mode is enabled BEFORE trying to load real config
    if (process.env.MPESA_MOCK_MODE === 'true') {
      console.log('🧪 M-Pesa Mock Mode: Skipping real configuration loading');
      // Create a mock config to satisfy the interface
      mpesaConfig = {
        environment: 'sandbox',
        businessShortcode: 'mock_shortcode',
        consumerKey: 'mock_key',
        consumerSecret: 'mock_secret',
        passkey: 'mock_passkey',
        callbackUrl: 'http://localhost:3002/api/mpesa/callback',
        oauthUrl: 'mock_oauth_url',
        stkPushUrl: 'mock_stk_url'
      };
    } else {
      // Only load real config if not in mock mode
      try {
        mpesaConfig = loadMpesaConfigFromBar(barData);
      } catch (error) {
        console.error('M-Pesa configuration error for bar:', { 
          barId: tabWithBar.bar_id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        if (error instanceof MpesaConfigurationError) {
          return NextResponse.json(
            { success: false, error: 'M-Pesa payment not available for this location' },
            { status: 503 }
          );
        }
        
        return NextResponse.json(
          { success: false, error: 'Payment service temporarily unavailable' },
          { status: 503 }
        );
      }
    }

    // Requirement 1.1: Create pending payment record in tab_payments table
    const { data: payment, error: paymentError } = await supabase
      .from('tab_payments')
      .insert({
        tab_id: tabId,
        amount: amount,
        method: 'mpesa',
        status: 'pending'
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error('Failed to create payment record:', paymentError);
      return NextResponse.json(
        { success: false, error: 'Failed to create payment record' },
        { status: 500 }
      );
    }

    console.log('Payment record created:', { paymentId: payment.id, tabId, amount });

    try {
      // Handle mock mode
      if (process.env.MPESA_MOCK_MODE === 'true') {
        console.log('🧪 M-Pesa Mock Mode: Simulating successful payment');
        
        // Generate mock checkout request ID
        const mockCheckoutRequestId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Update payment record with mock checkout request ID
        const { error: updateError } = await supabase
          .from('tab_payments')
          .update({ 
            reference: mockCheckoutRequestId,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        if (updateError) {
          console.error('Failed to update payment with mock checkout request ID:', updateError);
        }

        // Simulate successful STK push response
        const responseTime = Date.now() - startTime;
        console.log('🧪 Mock M-Pesa payment initiated successfully:', {
          paymentId: payment.id,
          checkoutRequestId: mockCheckoutRequestId,
          responseTime: `${responseTime}ms`,
          mockMode: true
        });

        return NextResponse.json({
          success: true,
          checkoutRequestId: mockCheckoutRequestId,
          mockMode: true // Indicate this is a mock response
        });
      }

      // Requirement 2.1: Send STK Push request to Safaricom
      const stkResponse = await sendSTKPush({
        phoneNumber: normalizedPhoneNumber,
        amount: Math.round(amount), // Ensure integer amount
        accountReference: `TAB${tabId.slice(-8)}`, // Use last 8 chars of tab ID
        transactionDesc: 'Tab Payment'
      }, mpesaConfig);

      // Requirement 2.2: Update payment record with checkout request ID
      const { error: updateError } = await supabase
        .from('tab_payments')
        .update({ 
          reference: stkResponse.CheckoutRequestID,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Failed to update payment with checkout request ID:', updateError);
        // Don't fail the request since STK Push was successful
      }

      const responseTime = Date.now() - startTime;
      console.log('M-Pesa payment initiated successfully:', {
        paymentId: payment.id,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        responseTime: `${responseTime}ms`
      });

      // Requirement 5.3: Return checkout request ID on success
      return NextResponse.json({
        success: true,
        checkoutRequestId: stkResponse.CheckoutRequestID
      });

    } catch (stkError) {
      console.error('STK Push failed:', stkError);

      // Update payment status to failed
      await supabase
        .from('tab_payments')
        .update({ 
          status: 'failed',
          metadata: { 
            error: stkError instanceof Error ? stkError.message : 'STK Push failed',
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      // Requirement 2.3 & 5.4: Return descriptive error message
      let errorMessage = 'STK Push request failed';
      
      if (stkError instanceof Error) {
        if (stkError.message.includes('invalid or expired credentials')) {
          errorMessage = 'M-Pesa service temporarily unavailable. Please try again later or pay at the bar.';
        } else if (stkError.message.includes('sandbox API is not responding correctly')) {
          errorMessage = 'M-Pesa service temporarily unavailable. Please try again later or pay at the bar.';
        } else if (stkError.message.includes('Invalid phone number')) {
          errorMessage = stkError.message;
        } else if (stkError.message.includes('Authentication failed')) {
          errorMessage = 'M-Pesa service temporarily unavailable. Please try again later or pay at the bar.';
        } else {
          errorMessage = stkError.message;
        }
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('M-Pesa payment initiation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime: `${responseTime}ms`
    });

    // Requirement 8.1: Ensure response within 5 seconds (log if exceeded)
    if (responseTime > 5000) {
      console.warn(`Payment initiation exceeded 5 second limit: ${responseTime}ms`);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}