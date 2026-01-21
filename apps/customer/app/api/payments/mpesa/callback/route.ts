import { NextRequest, NextResponse } from 'next/server';
import { CallbackHandler } from '@tabeza/shared/lib/mpesa/services/callback';
import { TransactionService } from '@tabeza/shared/lib/mpesa/services/transaction';
import { OrderStatusUpdateService } from '@tabeza/shared/lib/mpesa/services/order-sync';
import { MpesaConfig } from '@tabeza/shared/lib/mpesa/config';
import { STKCallbackData, MpesaError, MpesaValidationError } from '@tabeza/shared/lib/mpesa/types';
import { getAuditLogger } from '@tabeza/shared/lib/mpesa/middleware/audit-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auditLogger = getAuditLogger();
  
  try {
    // Parse callback data
    const callbackData: STKCallbackData = await request.json();
    
    // Extract headers for authentication
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Log callback received
    console.log('M-PESA callback received:', {
      merchantRequestId: callbackData.Body?.stkCallback?.MerchantRequestID,
      checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
      resultCode: callbackData.Body?.stkCallback?.ResultCode,
      timestamp: new Date().toISOString()
    });

    // Initialize services
    const transactionService = new TransactionService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const orderSyncService = new OrderStatusUpdateService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const mpesaConfig = new MpesaConfig();
    const callbackHandler = new CallbackHandler(
      mpesaConfig.getServiceConfig(),
      transactionService,
      orderSyncService
    );

    // Process the callback
    const result = await callbackHandler.handleSTKCallback(callbackData, headers);

    const processingTime = Date.now() - startTime;

    if (result.success) {
      console.log('Callback processed successfully:', {
        transactionId: result.transactionId,
        status: result.status,
        processingTimeMs: processingTime
      });

      // Log successful callback processing
      await auditLogger.logEvent({
        eventType: 'callback_processed',
        eventData: {
          transactionId: result.transactionId,
          status: result.status,
          processingTimeMs: processingTime,
          checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
          resultCode: callbackData.Body?.stkCallback?.ResultCode,
          processedAt: new Date().toISOString()
        },
        environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
        severity: 'info',
        category: 'payment'
      });

      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Callback processed successfully'
      });
    } else {
      console.error('Callback processing failed:', {
        error: result.error,
        processingTimeMs: processingTime
      });

      // Log failed callback processing
      await auditLogger.logEvent({
        eventType: 'callback_processing_failed',
        eventData: {
          error: result.error,
          processingTimeMs: processingTime,
          checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
          resultCode: callbackData.Body?.stkCallback?.ResultCode,
          failedAt: new Date().toISOString()
        },
        environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
        severity: 'error',
        category: 'payment'
      });

      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: result.error || 'Callback processing failed'
      }, { status: 500 });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('Callback endpoint error:', {
      error: error instanceof Error ? error.message : error,
      processingTimeMs: processingTime
    });

    // Log callback endpoint error
    try {
      await auditLogger.logEvent({
        eventType: 'callback_endpoint_error',
        eventData: {
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: processingTime,
          errorAt: new Date().toISOString()
        },
        environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
        severity: 'error',
        category: 'system'
      });
    } catch (auditError) {
      console.error('Failed to log audit event:', auditError);
    }

    // Handle different error types
    if (error instanceof MpesaValidationError) {
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Invalid callback data'
      }, { status: 400 });
    }

    if (error instanceof MpesaError) {
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Callback processing error'
      }, { status: 500 });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Invalid JSON in callback'
      }, { status: 400 });
    }

    // Generic error response
    return NextResponse.json({
      ResultCode: 1,
      ResultDesc: 'Internal server error'
    }, { status: 500 });
  }
}

// Handle GET requests (for health checks or debugging)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'M-PESA callback endpoint is active',
    timestamp: new Date().toISOString(),
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox'
  });
}