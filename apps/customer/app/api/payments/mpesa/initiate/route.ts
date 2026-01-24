import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateMpesaPhoneNumber, sanitizePhoneNumber } from '@tabeza/shared/lib/phoneValidation';
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

export async function POST(request: NextRequest) {
  try {
    const { barId, phoneNumber, amount, customerIdentifier } = await request.json();

    // Extract IP address for rate limiting
    const ipAddress = extractIpAddress(request);

    // Enhanced validation with specific error messages for each field
    const missingFields = [];
    if (!barId) missingFields.push('barId');
    if (!customerIdentifier) missingFields.push('customerIdentifier');
    if (!phoneNumber) missingFields.push('phoneNumber');
    if (!amount) missingFields.push('amount');

    if (missingFields.length > 0) {
      console.error('Missing required fields in payment request:', {
        received: { barId, customerIdentifier, phoneNumber, amount },
        missing: missingFields,
        ipAddress
      });
      
      return NextResponse.json(
        { 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          details: {
            received: {
              barId: !!barId,
              customerIdentifier: !!customerIdentifier,
              phoneNumber: !!phoneNumber,
              amount: !!amount
            },
            missing: missingFields
          }
        },
        { status: 400 }
      );
    }

    // Validate field types and formats
    if (typeof barId !== 'string' || barId.trim().length === 0) {
      return NextResponse.json(
        { error: 'barId must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof customerIdentifier !== 'string' || customerIdentifier.trim().length === 0) {
      return NextResponse.json(
        { error: 'customerIdentifier must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
      return NextResponse.json(
        { error: 'phoneNumber must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
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

    // Create tenant-aware services for tab resolution
    const tabResolutionService = createTabResolutionService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find customer's tab using bar context and customer identifier
    let customerTab: any;
    try {
      customerTab = await tabResolutionService.findCustomerTab(barId, customerIdentifier);
    } catch (error) {
      console.error('Customer tab resolution error:', error);
      
      if (error instanceof MpesaError) {
        switch (error.code) {
          case 'CUSTOMER_TAB_NOT_FOUND':
            return NextResponse.json(
              { error: 'No open tab found. Please create a tab first.' },
              { status: 404 }
            );
          default:
            return NextResponse.json(
              { error: 'Unable to find your tab. Please try again.' },
              { status: 400 }
            );
        }
      }
      
      return NextResponse.json(
        { error: 'Unable to process payment. Please try again.' },
        { status: 500 }
      );
    }

    const tabId = customerTab.id;

    // Check if tab exists and get customer info (using resolved tabId)
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

    // Determine environment (default to sandbox for safety)
    const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as MpesaEnvironment;

    const transaction = await transactionService.createTransaction({
      tabId: tabId,
      customerId: tab.customer_id,
      phoneNumber: validatedPhoneNumber,
      amount: amount,
      environment: environment
    });

    // Initialize M-PESA configuration and STK Push service using tenant credentials
    let stkPushService: STKPushService;
    
    try {
      // Create tenant-aware services (reuse the already created tabResolutionService)
      const credentialRetrievalService = createCredentialRetrievalService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const tenantConfigFactory = createTenantMpesaConfigFactory({
        defaultTimeoutMs: 30000,
        defaultRetryAttempts: 3,
        defaultRateLimitPerMinute: 60,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
      });

      // Create service configuration using customer context (barId + customerIdentifier)
      const serviceConfig = await ServiceFactory.createServiceConfigFromCustomerContext(
        barId,
        customerIdentifier,
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
      console.error('Tenant credential resolution error:', credentialError);

      // Update transaction status to failed
      await transactionService.updateTransactionStatus(transaction.id, 'failed', {
        failureReason: 'Payment service configuration error'
      });

      // Record failed attempt
      await rateLimiter.recordFailedAttempt(
        tab.customer_id,
        validatedPhoneNumber,
        amount,
        'Payment service configuration error',
        ipAddress
      );

      // Return user-friendly error based on the specific credential error
      if (credentialError instanceof MpesaError) {
        switch (credentialError.code) {
          case 'CUSTOMER_TAB_NOT_FOUND':
          case 'ORPHANED_TAB':
          case 'INVALID_TAB_STATUS':
            return NextResponse.json(
              { 
                error: 'Tab is not available for payments',
                transactionId: transaction.id
              },
              { status: 400 }
            );
          
          case 'CREDENTIALS_NOT_FOUND':
          case 'CREDENTIALS_INACTIVE':
            return NextResponse.json(
              { 
                error: 'Payment service not configured for this location',
                transactionId: transaction.id
              },
              { status: 503 }
            );
          
          case 'DECRYPTION_ERROR':
          case 'CREDENTIALS_INVALID':
            return NextResponse.json(
              { 
                error: 'Payment service temporarily unavailable',
                transactionId: transaction.id
              },
              { status: 503 }
            );
          
          default:
            return NextResponse.json(
              { 
                error: 'Payment service temporarily unavailable',
                transactionId: transaction.id
              },
              { status: 503 }
            );
        }
      }

      // Generic error for unknown credential issues
      return NextResponse.json(
        { 
          error: 'Payment service temporarily unavailable',
          transactionId: transaction.id
        },
        { status: 503 }
      );
    }

    try {
      // Send STK Push request using tenant-specific credentials and callback URL
      const stkResponse = await stkPushService.sendSTKPush({
        phoneNumber: validatedPhoneNumber,
        amount: amount,
        accountReference: `TAB${tabId.slice(-8)}`, // Use last 8 chars of tab ID
        transactionDesc: `Tab Payment`
        // Note: callbackUrl is automatically used from tenant credentials in the service
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