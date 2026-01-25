import { NextRequest, NextResponse } from 'next/server';
import { 
  ServiceFactory,
  createTabResolutionService,
  createCredentialRetrievalService,
  createTenantMpesaConfigFactory,
  MpesaEnvironment,
  MpesaError
} from '@tabeza/shared';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Payment API Mimic - Starting');
    
    const { barId, customerIdentifier } = await request.json();
    
    const result: any = {
      success: false,
      steps: {},
      error: null
    };
    
    try {
      // Step 1: Create services (same as payment API)
      console.log('🔍 Step 1: Creating services (same as payment API)');
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
      
      result.steps.step1 = { success: true, message: 'Services created (payment API style)' };
      console.log('✅ Step 1: Services created successfully');
      
      // Step 2: Use the EXACT ServiceFactory method that payment API uses
      console.log('🔍 Step 2: Using ServiceFactory.createServiceConfigFromCustomerContext (EXACT payment API call)');
      const environment: MpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as MpesaEnvironment;
      
      const serviceConfig = await ServiceFactory.createServiceConfigFromCustomerContext(
        barId,
        customerIdentifier,
        tabResolutionService,
        credentialRetrievalService,
        tenantConfigFactory,
        { environment }
      );
      
      result.steps.step2 = { 
        success: true, 
        message: 'ServiceFactory.createServiceConfigFromCustomerContext succeeded',
        data: {
          environment: serviceConfig.environment,
          timeoutMs: serviceConfig.timeoutMs,
          retryAttempts: serviceConfig.retryAttempts,
          hasConsumerKey: !!serviceConfig.consumerKey,
          hasConsumerSecret: !!serviceConfig.consumerSecret,
          hasPasskey: !!serviceConfig.passkey,
          businessShortCode: serviceConfig.businessShortCode,
          callbackUrl: serviceConfig.callbackUrl
        }
      };
      console.log('✅ Step 2: ServiceFactory call succeeded');
      
      result.success = true;
      result.message = 'Payment API mimic completed successfully - this means the issue is elsewhere';
      
    } catch (stepError) {
      console.error('❌ Step failed:', stepError);
      
      result.error = {
        message: stepError instanceof Error ? stepError.message : 'Unknown error',
        code: stepError instanceof MpesaError ? stepError.code : 'UNKNOWN_ERROR',
        stack: stepError instanceof Error ? stepError.stack : undefined
      };
      
      if (stepError instanceof MpesaError) {
        result.error.mpesaCode = stepError.code;
        result.error.statusCode = stepError.statusCode;
      }
      
      result.message = 'Payment API mimic failed - this reproduces the payment API issue';
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Payment API Mimic failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}