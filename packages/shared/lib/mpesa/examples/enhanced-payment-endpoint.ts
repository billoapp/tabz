/**
 * Enhanced Payment Endpoint Example
 * Demonstrates comprehensive error handling for tenant credential operations
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 6.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createTabResolutionService,
  createCredentialRetrievalService,
  createTenantMpesaConfigFactory,
  ServiceFactory
} from '../services';
import { 
  TenantCredentialErrorHandler,
  createTenantCredentialErrorHandler,
  withTenantErrorHandling
} from '../services/error-handling';
import { MpesaEnvironment, MpesaError } from '../types';
import { ConsoleLogger } from '../services/base';

/**
 * Enhanced payment initiation endpoint with comprehensive error handling
 */
export async function enhancedPaymentEndpoint(request: NextRequest) {
  const logger = new ConsoleLogger();
  const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT as MpesaEnvironment) || 'sandbox';
  const errorHandler = createTenantCredentialErrorHandler(logger, environment);

  try {
    // Parse and validate request body
    const requestBody = await request.json();
    const { tabId, phoneNumber, amount, description = 'Tab payment' } = requestBody;

    // Basic input validation
    if (!tabId || !phoneNumber || !amount) {
      const errorInfo = errorHandler.handleTenantError(
        new MpesaError('Missing required fields: tabId, phoneNumber, amount', 'VALIDATION_ERROR', 400),
        { operation: 'validateInput' }
      );
      
      return NextResponse.json(
        errorHandler.createErrorResponse(errorInfo),
        { status: errorInfo.statusCode }
      );
    }

    // Validate phone number format
    if (!validateMpesaPhoneNumber(phoneNumber)) {
      const errorInfo = errorHandler.handleTenantError(
        new MpesaError('Invalid phone number format. Use 254XXXXXXXXX or 07XXXXXXXX', 'INVALID_PHONE_NUMBER', 400),
        { operation: 'validatePhoneNumber' }
      );
      
      return NextResponse.json(
        errorHandler.createErrorResponse(errorInfo),
        { status: errorInfo.statusCode }
      );
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      const errorInfo = errorHandler.handleTenantError(
        new MpesaError('Amount must be a positive number', 'INVALID_AMOUNT', 400),
        { operation: 'validateAmount' }
      );
      
      return NextResponse.json(
        errorHandler.createErrorResponse(errorInfo),
        { status: errorInfo.statusCode }
      );
    }

    // Initialize services with error handling
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const tabResolutionService = createTabResolutionService(supabaseUrl, supabaseServiceKey, logger);
    const credentialRetrievalService = createCredentialRetrievalService(supabaseUrl, supabaseServiceKey, logger);
    const tenantConfigFactory = createTenantMpesaConfigFactory();

    // Step 1: Resolve tab to tenant with comprehensive error handling
    const tenantInfo = await withTenantErrorHandling(
      () => tabResolutionService.resolveTabToTenant(tabId),
      errorHandler,
      {
        tabId,
        operation: 'resolveTabToTenant'
      }
    );

    // Step 2: Retrieve tenant credentials with error handling
    const credentials = await withTenantErrorHandling(
      () => credentialRetrievalService.getTenantCredentials(tenantInfo.tenantId, environment),
      errorHandler,
      {
        tenantId: tenantInfo.tenantId,
        barId: tenantInfo.barId,
        tabId,
        environment,
        operation: 'getTenantCredentials'
      }
    );

    // Step 3: Create tenant configuration with error handling
    const tenantConfig = await withTenantErrorHandling(
      () => tenantConfigFactory.createTenantConfig(tenantInfo, credentials),
      errorHandler,
      {
        tenantId: tenantInfo.tenantId,
        barId: tenantInfo.barId,
        tabId,
        environment,
        operation: 'createTenantConfig'
      }
    );

    // Step 4: Create service configuration with error handling
    const serviceConfig = await withTenantErrorHandling(
      () => ServiceFactory.createTenantServiceConfig(tenantConfig),
      errorHandler,
      {
        tenantId: tenantInfo.tenantId,
        barId: tenantInfo.barId,
        tabId,
        environment,
        operation: 'createServiceConfig'
      }
    );

    // Step 5: Initiate payment with the tenant-specific configuration
    // This would integrate with your existing STK Push service
    const paymentResult = await initiateSTKPush({
      config: serviceConfig,
      phoneNumber: formatMpesaPhoneNumber(phoneNumber),
      amount: Math.round(numAmount),
      accountReference: `${tenantInfo.barId}|${tabId}`,
      description,
      tabId,
      barId: tenantInfo.barId
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentId: paymentResult.paymentId,
        merchantRequestId: paymentResult.merchantRequestId,
        checkoutRequestId: paymentResult.checkoutRequestId,
        customerMessage: paymentResult.customerMessage,
        tenantInfo: {
          barName: tenantInfo.barName,
          environment: credentials.environment
        }
      }
    });

  } catch (error) {
    // Handle any unhandled errors with comprehensive error handling
    const errorInfo = errorHandler.handleTenantError(error, {
      operation: 'paymentEndpoint',
      environment
    });

    logger.error('Payment endpoint error', {
      error: errorInfo,
      requestUrl: request.url,
      method: request.method
    });

    return NextResponse.json(
      errorHandler.createErrorResponse(errorInfo),
      { status: errorInfo.statusCode }
    );
  }
}

/**
 * Validate M-Pesa phone number format
 */
function validateMpesaPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
  const kenyanFormat = /^254[17]\d{8}$/;
  const localFormat = /^07\d{8}$/;
  
  return kenyanFormat.test(cleaned) || localFormat.test(cleaned);
}

/**
 * Format phone number for M-Pesa
 */
function formatMpesaPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
  
  if (cleaned.startsWith('254')) {
    return cleaned;
  } else if (cleaned.startsWith('07')) {
    return '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '254' + cleaned;
  } else {
    throw new MpesaError('Invalid phone number format', 'INVALID_PHONE_NUMBER', 400);
  }
}

/**
 * Mock STK Push initiation (replace with actual implementation)
 */
async function initiateSTKPush(params: {
  config: any;
  phoneNumber: string;
  amount: number;
  accountReference: string;
  description: string;
  tabId: string;
  barId: string;
}): Promise<{
  paymentId: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}> {
  // This would be replaced with actual STK Push implementation
  // using the tenant-specific configuration
  
  return {
    paymentId: `pay_${Date.now()}`,
    merchantRequestId: `mer_${Date.now()}`,
    checkoutRequestId: `chk_${Date.now()}`,
    customerMessage: 'Please check your phone and enter your M-PESA PIN to complete the payment.'
  };
}

/**
 * Express.js middleware version of the enhanced error handling
 */
export function createEnhancedPaymentMiddleware() {
  return async (req: any, res: any, next: any) => {
    const logger = new ConsoleLogger();
    const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT as MpesaEnvironment) || 'sandbox';
    const errorHandler = createTenantCredentialErrorHandler(logger, environment);

    try {
      // Your payment logic here
      // Use withTenantErrorHandling for all operations
      
      // Example:
      // const result = await withTenantErrorHandling(
      //   () => somePaymentOperation(),
      //   errorHandler,
      //   { operation: 'paymentOperation', tabId: req.body.tabId }
      // );
      
      next();
    } catch (error) {
      const errorInfo = errorHandler.handleTenantError(error, {
        operation: 'paymentMiddleware',
        method: req.method,
        url: req.url
      });

      res.status(errorInfo.statusCode).json(
        errorHandler.createErrorResponse(errorInfo)
      );
    }
  };
}

/**
 * Rate limiting with enhanced error handling
 */
export async function checkRateLimitWithErrorHandling(
  identifier: string,
  errorHandler: TenantCredentialErrorHandler
): Promise<void> {
  return withTenantErrorHandling(
    async () => {
      // Implement your rate limiting logic here
      // Throw MpesaError with 'RATE_LIMIT_ERROR' code if limit exceeded
      
      // Example:
      // if (rateLimitExceeded(identifier)) {
      //   throw new MpesaError(
      //     'Too many payment attempts. Please wait before trying again.',
      //     'RATE_LIMIT_ERROR',
      //     429
      //   );
      // }
    },
    errorHandler,
    {
      operation: 'checkRateLimit',
      identifier
    }
  );
}

/**
 * Database operation with enhanced error handling
 */
export async function performDatabaseOperationWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorHandler: TenantCredentialErrorHandler,
  context: {
    tenantId?: string;
    barId?: string;
    tabId?: string;
    operation: string;
  }
): Promise<T> {
  return withTenantErrorHandling(
    operation,
    errorHandler,
    context
  );
}

/**
 * Example of how to handle specific error scenarios
 */
export function handleSpecificErrorScenarios() {
  const logger = new ConsoleLogger();
  const errorHandler = createTenantCredentialErrorHandler(logger, 'sandbox');

  // Example 1: Handle missing credentials
  try {
    throw new MpesaError('No credentials found', 'CREDENTIALS_NOT_FOUND', 404);
  } catch (error) {
    const errorInfo = errorHandler.handleTenantError(error, {
      tenantId: 'tenant-123',
      operation: 'getCredentials'
    });
    
    // User sees: "Payment service is not configured for this location. Please contact the establishment."
    // Admin sees: "No M-Pesa credentials found for tenant in specified environment"
    // Logs contain full context without sensitive data
  }

  // Example 2: Handle decryption failure
  try {
    throw new MpesaError('Decryption failed', 'DECRYPTION_FAILED', 500);
  } catch (error) {
    const errorInfo = errorHandler.handleTenantError(error, {
      tenantId: 'tenant-123',
      operation: 'decryptCredentials'
    });
    
    // User sees: "Unable to access payment credentials. Please try again later."
    // Admin sees: "AES decryption failed - check key validity"
    // No sensitive data exposed in any response
  }

  // Example 3: Handle configuration error
  try {
    throw new MpesaError('Invalid tenant config', 'INVALID_TENANT_CONFIG', 400);
  } catch (error) {
    const errorInfo = errorHandler.handleTenantError(error, {
      tenantId: 'tenant-123',
      operation: 'validateConfig'
    });
    
    // User sees: "Payment service configuration is invalid. Please contact support."
    // Admin sees: "Tenant configuration object is invalid or missing"
    // Proper categorization and logging for debugging
  }
}