import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { validateMpesaPhoneNumber, sanitizePhoneNumber } from '@tabeza/shared/lib/phoneValidation';
import { 
  MpesaRateLimiter, 
  extractIpAddress, 
  TransactionService, 
  MpesaError, 
  createTabResolutionService,
  createCredentialRetrievalService,
  createTenantMpesaConfigFactory,
  ServiceFactory,
  MpesaEnvironment
} from '@tabeza/shared';

export async function POST(request: NextRequest) {
  const result: any = {
    success: false,
    steps: {},
    error: null,
    timestamp: new Date().toISOString()
  };

  try {
    console.log('🔍 Payment Step-by-Step Debug - Starting');
    
    // Step 1: Parse request body
    console.log('🔍 Step 1: Parsing request body');
    let requestBody;
    try {
      requestBody = await request.json();
      result.steps.step1 = { success: true, message: 'Request body parsed' };
      console.log('✅ Step 1: Request body parsed successfully');
    } catch (jsonError) {
      result.steps.step1 = { success: false, error: 'Failed to parse JSON' };
      result.error = { message: 'Invalid JSON in request body', step: 1 };
      return NextResponse.json(result, { status: 400 });
    }

    const { barId, phoneNumber, amount, customerIdentifier } = requestBody;

    // Step 2: Validate input fields
    console.log('🔍 Step 2: Validating input fields');
    const missingFields = [];
    if (!barId) missingFields.push('barId');
    if (!customerIdentifier) missingFields.push('customerIdentifier');
    if (!phoneNumber) missingFields.push('phoneNumber');
    if (!amount) missingFields.push('amount');

    if (missingFields.length > 0) {
      result.steps.step2 = { success: false, error: `Missing fields: ${missingFields.join(', ')}` };
      result.error = { message: 'Missing required fields', step: 2, missingFields };
      return NextResponse.json(result, { status: 400 });
    }

    result.steps.step2 = { success: true, message: 'Input validation passed' };
    console.log('✅ Step 2: Input validation passed');

    // Step 3: Validate and sanitize phone number
    console.log('🔍 Step 3: Validating phone number');
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
    const phoneValidation = validateMpesaPhoneNumber(sanitizedPhone);
    
    if (!phoneValidation.isValid) {
      result.steps.step3 = { success: false, error: phoneValidation.error };
      result.error = { message: 'Invalid phone number', step: 3 };
      return NextResponse.json(result, { status: 400 });
    }

    const validatedPhoneNumber = phoneValidation.international;
    result.steps.step3 = { success: true, message: 'Phone number validated' };
    console.log('✅ Step 3: Phone number validated');

    // Step 4: Find customer tab
    console.log('🔍 Step 4: Finding customer tab');
    let customerTab: any;
    try {
      const tabResolutionService = createTabResolutionService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );
      
      customerTab = await tabResolutionService.findCustomerTab(barId, customerIdentifier);
      result.steps.step4 = { 
        success: true, 
        message: 'Customer tab found',
        data: { tabId: customerTab.id }
      };
      console.log('✅ Step 4: Customer tab found');
    } catch (error) {
      result.steps.step4 = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      result.error = { message: 'Tab resolution failed', step: 4 };
      return NextResponse.json(result, { status: 404 });
    }

    // Step 5: Get tab details from database
    console.log('🔍 Step 5: Getting tab details');
    const supabase = createServiceRoleClient();
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('id, status, owner_identifier')
      .eq('id', customerTab.id)
      .single();

    if (tabError || !tab) {
      result.steps.step5 = { success: false, error: 'Tab not found in database' };
      result.error = { message: 'Tab not found', step: 5 };
      return NextResponse.json(result, { status: 404 });
    }

    result.steps.step5 = { 
      success: true, 
      message: 'Tab details retrieved',
      data: { status: tab.status }
    };
    console.log('✅ Step 5: Tab details retrieved');

    // Step 6: Initialize rate limiter
    console.log('🔍 Step 6: Initializing rate limiter');
    try {
      const rateLimiter = new MpesaRateLimiter(
        undefined,
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      );

      const ipAddress = extractIpAddress(request);
      const rateLimitResult = await rateLimiter.checkCustomerRateLimit(
        tab.owner_identifier,
        validatedPhoneNumber!,
        amount,
        ipAddress
      );

      if (!rateLimitResult.allowed) {
        result.steps.step6 = { success: false, error: 'Rate limit exceeded' };
        result.error = { message: 'Rate limit exceeded', step: 6 };
        return NextResponse.json(result, { status: 429 });
      }

      result.steps.step6 = { success: true, message: 'Rate limit check passed' };
      console.log('✅ Step 6: Rate limit check passed');
    } catch (error) {
      result.steps.step6 = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rate limiter failed' 
      };
      result.error = { message: 'Rate limiter failed', step: 6 };
      return NextResponse.json(result, { status: 500 });
    }

    // Step 7: Create transaction
    console.log('🔍 Step 7: Creating transaction');
    try {
      const transactionService = new TransactionService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );

      const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as MpesaEnvironment;

      const transaction = await transactionService.createTransaction({
        tabId: customerTab.id,
        customerId: tab.owner_identifier,
        phoneNumber: validatedPhoneNumber!,
        amount: amount,
        environment: environment
      });

      result.steps.step7 = { 
        success: true, 
        message: 'Transaction created',
        data: { transactionId: transaction.id }
      };
      console.log('✅ Step 7: Transaction created');
    } catch (error) {
      result.steps.step7 = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Transaction creation failed' 
      };
      result.error = { message: 'Transaction creation failed', step: 7 };
      return NextResponse.json(result, { status: 500 });
    }

    // Step 8: Create service configuration (this is where it likely hangs)
    console.log('🔍 Step 8: Creating service configuration');
    try {
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

      const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as MpesaEnvironment;

      const serviceConfig = await ServiceFactory.createServiceConfigFromCustomerContext(
        barId,
        customerIdentifier,
        tabResolutionService,
        credentialRetrievalService,
        tenantConfigFactory,
        { environment }
      );

      result.steps.step8 = { 
        success: true, 
        message: 'Service configuration created',
        data: { environment: serviceConfig.environment }
      };
      console.log('✅ Step 8: Service configuration created');
    } catch (error) {
      result.steps.step8 = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Service config creation failed' 
      };
      result.error = { message: 'Service configuration failed', step: 8 };
      return NextResponse.json(result, { status: 500 });
    }

    // If we get here, all steps passed
    result.success = true;
    result.message = 'All payment preparation steps completed successfully';
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Payment step-by-step debug failed:', error);
    
    result.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      step: 'unknown'
    };
    
    return NextResponse.json(result, { status: 500 });
  }
}