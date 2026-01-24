import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  MpesaRateLimiter, 
  extractIpAddress, 
  STKPushService, 
  TransactionService, 
  MpesaError, 
  MpesaNetworkError, 
  MpesaValidationError, 
  ServiceFactory,
  createTabResolutionService,
  createCredentialRetrievalService,
  createTenantMpesaConfigFactory,
  MpesaEnvironment
} from '@tabeza/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Extract IP address for rate limiting
    const ipAddress = extractIpAddress(request);

    // Get existing transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if transaction can be retried
    const retryableStatuses = ['failed', 'cancelled', 'timeout'];
    if (!retryableStatuses.includes(transaction.status)) {
      return NextResponse.json(
        { 
          error: `Transaction cannot be retried. Current status: ${transaction.status}`,
          currentStatus: transaction.status
        },
        { status: 400 }
      );
    }

    // Get tab information for rate limiting
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('id, customer_id, status')
      .eq('id', transaction.tab_id)
      .single();

    if (tabError || !tab) {
      return NextResponse.json(
        { error: 'Associated tab not found' },
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
      process.env.SUPABASE_SECRET_KEY
    );

    // Check rate limits for retry attempts
    const rateLimitResult = await rateLimiter.checkCustomerRateLimit(
      tab.customer_id,
      transaction.phone_number,
      transaction.amount,
      ipAddress
    );

    if (!rateLimitResult.allowed) {
      // Log the rate limit violation
      await rateLimiter.recordFailedAttempt(
        tab.customer_id,
        transaction.phone_number,
        transaction.amount,
        rateLimitResult.reason || 'Rate limit exceeded on retry',
        ipAddress
      );

      return NextResponse.json(
        { 
          error: rateLimitResult.reason || 'Too many retry attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
          remainingAttempts: rateLimitResult.remainingAttempts
        },
        { status: 429 }
      );
    }

    // Initialize transaction service
    const transactionService = new TransactionService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    // Reset transaction to pending status for retry
    await transactionService.updateTransactionStatus(transactionId, 'pending', {
      failureReason: undefined,
      resultCode: undefined
    });

    // Determine environment (default to sandbox for safety)
    const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as MpesaEnvironment;

    // Initialize M-PESA configuration and STK Push service using tenant credentials
    let stkPushService: STKPushService;
    
    try {
      // Create tenant-aware services
      const tabResolutionService = createTabResolutionService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );

      const credentialRetrievalService = createCredentialRetrievalService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );

      const tenantConfigFactory = createTenantMpesaConfigFactory({
        defaultTimeoutMs: 30000,
        defaultRetryAttempts: 3,
        defaultRateLimitPerMinute: 60,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SECRET_KEY!
      });

      // Create service configuration from tab ID with tenant credential resolution
      const serviceConfig = await ServiceFactory.createServiceConfigFromTab(
        transaction.tab_id,
        tabResolutionService,
        credentialRetrievalService,
        tenantConfigFactory,
        { environment }
      );

      // Create STK Push service with tenant-specific configuration
      const logger = ServiceFactory.createLogger();
      const httpClient = ServiceFactory.createHttpClient(serviceConfig.timeoutMs);
      stkPushService = new STKPushService(serviceConfig, logger, httpClient);

    } catch (credentialError) {
      console.error('Tenant credential resolution error during retry:', credentialError);

      // Update transaction status to failed
      await transactionService.updateTransactionStatus(transactionId, 'failed', {
        failureReason: 'Payment service configuration error during retry'
      });

      // Record failed attempt
      await rateLimiter.recordFailedAttempt(
        tab.customer_id,
        transaction.phone_number,
        transaction.amount,
        'Payment service configuration error during retry',
        ipAddress
      );

      // Return user-friendly error based on the specific credential error
      if (credentialError instanceof MpesaError) {
        switch (credentialError.code) {
          case 'TAB_NOT_FOUND':
          case 'ORPHANED_TAB':
          case 'INVALID_TAB_STATUS':
            return NextResponse.json(
              { 
                error: 'Tab is not available for payment retry',
                transactionId: transactionId
              },
              { status: 400 }
            );
          
          case 'CREDENTIALS_NOT_FOUND':
          case 'CREDENTIALS_INACTIVE':
            return NextResponse.json(
              { 
                error: 'Payment service not configured for this location',
                transactionId: transactionId
              },
              { status: 503 }
            );
          
          case 'DECRYPTION_ERROR':
          case 'CREDENTIALS_INVALID':
            return NextResponse.json(
              { 
                error: 'Payment service temporarily unavailable',
                transactionId: transactionId
              },
              { status: 503 }
            );
          
          default:
            return NextResponse.json(
              { 
                error: 'Payment service temporarily unavailable',
                transactionId: transactionId
              },
              { status: 503 }
            );
        }
      }

      // Generic error for unknown credential issues
      return NextResponse.json(
        { 
          error: 'Payment service temporarily unavailable',
          transactionId: transactionId
        },
        { status: 503 }
      );
    }

    try {
      // Send STK Push retry request using tenant-specific credentials and callback URL
      const stkResponse = await stkPushService.sendSTKPush({
        phoneNumber: transaction.phone_number,
        amount: transaction.amount,
        accountReference: `TAB${transaction.tab_id.slice(-8)}`, // Use last 8 chars of tab ID
        transactionDesc: `Tab Payment Retry`
        // Note: callbackUrl is automatically used from tenant credentials in the service
      });

      // Update transaction with STK Push response
      await transactionService.updateTransactionStatus(transactionId, 'sent', {
        checkoutRequestId: stkResponse.CheckoutRequestID,
        merchantRequestId: stkResponse.MerchantRequestID
      });

      // Record successful retry initiation
      await rateLimiter.recordSuccessfulPayment(
        tab.customer_id,
        transaction.phone_number,
        transaction.amount,
        ipAddress
      );

      return NextResponse.json({
        success: true,
        transactionId: transactionId,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        customerMessage: stkResponse.CustomerMessage,
        remainingAttempts: rateLimitResult.remainingAttempts,
        resetTime: rateLimitResult.resetTime
      });

    } catch (error) {
      console.error('STK Push retry error:', error);

      // Update transaction status to failed
      let failureReason = 'STK Push retry failed';
      if (error instanceof MpesaError) {
        failureReason = error.message;
      } else if (error instanceof MpesaNetworkError) {
        failureReason = 'Network error during payment retry';
      } else if (error instanceof MpesaValidationError) {
        failureReason = 'Payment retry validation failed';
      }

      await transactionService.updateTransactionStatus(transactionId, 'failed', {
        failureReason: failureReason
      });

      // Record failed attempt
      await rateLimiter.recordFailedAttempt(
        tab.customer_id,
        transaction.phone_number,
        transaction.amount,
        failureReason,
        ipAddress
      );

      // Return appropriate error response
      if (error instanceof MpesaValidationError) {
        return NextResponse.json(
          { 
            error: 'Payment retry validation failed',
            details: error.validationErrors,
            transactionId: transactionId
          },
          { status: 400 }
        );
      } else if (error instanceof MpesaNetworkError) {
        return NextResponse.json(
          { 
            error: 'Payment service temporarily unavailable. Please try again later.',
            transactionId: transactionId
          },
          { status: 503 }
        );
      } else {
        return NextResponse.json(
          { 
            error: 'Payment retry failed. Please try again.',
            transactionId: transactionId
          },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('M-PESA retry error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}