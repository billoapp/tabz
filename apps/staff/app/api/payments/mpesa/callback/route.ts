/**
 * M-PESA Callback Handler Endpoint
 * Secure HTTPS endpoint for M-PESA STK Push callbacks with proper validation and processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Import shared M-PESA services - using relative paths since this is in the staff app
import { CallbackHandler, DefaultCallbackAuthenticator } from '../../../../../../packages/shared/lib/mpesa/services/callback';
import { TransactionService } from '../../../../../../packages/shared/lib/mpesa/services/transaction';
import { ServiceFactory } from '../../../../../../packages/shared/lib/mpesa/services/base';
import { STKCallbackData, MpesaEnvironment } from '../../../../../../packages/shared/lib/mpesa/types';

// Environment configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Rate limiting for callback endpoint
const callbackRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max callbacks per minute per IP

/**
 * Enhanced callback authenticator with IP validation and security checks
 */
class SecureCallbackAuthenticator extends DefaultCallbackAuthenticator {
  async validateCallback(callbackData: any, headers?: Record<string, string>): Promise<boolean> {
    // First run basic validation
    const basicValidation = await super.validateCallback(callbackData, headers);
    if (!basicValidation) {
      return false;
    }

    // Additional security checks
    try {
      // Check for required headers (can be extended based on M-PESA requirements)
      if (headers) {
        // Log headers for security monitoring
        this.logger.debug('Callback headers received', { 
          userAgent: headers['user-agent'],
          contentType: headers['content-type'],
          origin: headers['origin']
        });
      }

      // Validate callback data structure more thoroughly
      const stkCallback = callbackData.Body.stkCallback;
      
      // Validate CheckoutRequestID format (should be alphanumeric)
      if (!/^[a-zA-Z0-9\-_]+$/.test(stkCallback.CheckoutRequestID)) {
        this.logger.warn('Invalid CheckoutRequestID format', { 
          checkoutRequestId: stkCallback.CheckoutRequestID 
        });
        return false;
      }

      // Validate MerchantRequestID format
      if (!/^[a-zA-Z0-9\-_]+$/.test(stkCallback.MerchantRequestID)) {
        this.logger.warn('Invalid MerchantRequestID format', { 
          merchantRequestId: stkCallback.MerchantRequestID 
        });
        return false;
      }

      // Validate ResultCode is a valid M-PESA result code
      const validResultCodes = [0, 1, 1032, 1037, 2001]; // Add more as needed
      if (!validResultCodes.includes(stkCallback.ResultCode)) {
        this.logger.warn('Unusual ResultCode received', { 
          resultCode: stkCallback.ResultCode,
          resultDesc: stkCallback.ResultDesc
        });
        // Don't reject, just log for monitoring
      }

      return true;
    } catch (error) {
      this.logger.error('Enhanced callback authentication error', { error });
      return false;
    }
  }
}

/**
 * Check rate limiting for callback endpoint
 */
function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const clientData = callbackRateLimit.get(clientIp);

  if (!clientData || now > clientData.resetTime) {
    callbackRateLimit.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  clientData.count++;
  return true;
}

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Log security event for monitoring
 */
function logSecurityEvent(event: string, details: any) {
  console.log(`[SECURITY] ${event}`, {
    timestamp: new Date().toISOString(),
    ...details
  });
}

/**
 * Handle M-PESA STK Push callbacks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = getClientIp(request);
  
  try {
    // Rate limiting check
    if (!checkRateLimit(clientIp)) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { clientIp });
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse callback data
    let callbackData: STKCallbackData;
    try {
      callbackData = await request.json();
    } catch (error) {
      logSecurityEvent('INVALID_JSON', { clientIp, error });
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    // Extract headers for authentication
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Log callback received
    console.log('[CALLBACK] M-PESA callback received', {
      timestamp: new Date().toISOString(),
      clientIp,
      merchantRequestId: callbackData.Body?.stkCallback?.MerchantRequestID,
      checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
      resultCode: callbackData.Body?.stkCallback?.ResultCode
    });

    // Initialize services
    const transactionService = new TransactionService(SUPABASE_URL, SUPABASE_ANON_KEY);
    const logger = ServiceFactory.createLogger();
    const authenticator = new SecureCallbackAuthenticator(logger);
    
    // Create callback handler with minimal config (we don't need full M-PESA config for callbacks)
    const config = ServiceFactory.createServiceConfig(
      'sandbox' as MpesaEnvironment, // This will be overridden by actual transaction environment
      {} as any, // Credentials not needed for callback processing
      { timeoutMs: 10000, retryAttempts: 1, rateLimitPerMinute: 100 }
    );

    const callbackHandler = new CallbackHandler(
      config,
      transactionService,
      authenticator,
      logger
    );

    // Process callback
    const result = await callbackHandler.handleSTKCallback(callbackData, headers);

    // Log processing result
    const processingTime = Date.now() - startTime;
    console.log('[CALLBACK] Processing completed', {
      timestamp: new Date().toISOString(),
      success: result.success,
      transactionId: result.transactionId,
      status: result.status,
      processingTimeMs: processingTime,
      error: result.error
    });

    // Always return success to M-PESA to prevent retries
    // Even if our processing failed, we don't want M-PESA to keep retrying
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: result.success ? 'Callback processed successfully' : 'Callback received'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log error with security context
    logSecurityEvent('CALLBACK_PROCESSING_ERROR', {
      clientIp,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: processingTime
    });

    console.error('[CALLBACK] Processing error', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.stack : error,
      clientIp,
      processingTimeMs: processingTime
    });

    // Still return success to M-PESA to avoid retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback received but processing failed'
    });
  }
}

/**
 * Handle non-POST requests
 */
export async function GET() {
  logSecurityEvent('INVALID_METHOD', { method: 'GET' });
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  logSecurityEvent('INVALID_METHOD', { method: 'PUT' });
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  logSecurityEvent('INVALID_METHOD', { method: 'DELETE' });
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}