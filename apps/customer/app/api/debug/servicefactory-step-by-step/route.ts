import { NextRequest, NextResponse } from 'next/server';
import { 
  ServiceFactory,
  createTabResolutionService,
  createCredentialRetrievalService,
  createTenantMpesaConfigFactory,
  MpesaError,
  MpesaEnvironment
} from '@tabeza/shared';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let step = 'initialization';
  
  try {
    const requestBody = await request.json();
    const { barId, customerIdentifier } = requestBody;
    
    console.log('🔍 ServiceFactory Step-by-Step Debug');
    console.log('📋 Input:', { barId, customerIdentifier });
    
    // Validate inputs
    if (!barId || !customerIdentifier) {
      return NextResponse.json({
        success: false,
        step: 'input_validation',
        error: 'Missing barId or customerIdentifier',
        details: { barId: !!barId, customerIdentifier: !!customerIdentifier }
      }, { status: 400 });
    }

    const environment: MpesaEnvironment = 'sandbox';
    const results: any = {
      steps: {},
      timing: {},
      success: false
    };

    // Step 1: Create Services
    step = 'create_services';
    const stepStart = Date.now();
    console.log(`🔍 Step 1: ${step}`);
    
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

    results.steps.create_services = { success: true };
    results.timing.create_services = Date.now() - stepStart;
    console.log(`✅ Step 1 completed in ${results.timing.create_services}ms`);

    // Step 2: Resolve Customer Tab to Tenant
    step = 'resolve_customer_tab_to_tenant';
    const step2Start = Date.now();
    console.log(`🔍 Step 2: ${step}`);
    
    let tenantInfo;
    try {
      tenantInfo = await tabResolutionService.resolveCustomerTabToTenant(barId, customerIdentifier);
      results.steps.resolve_customer_tab_to_tenant = { 
        success: true, 
        tenantInfo: {
          tenantId: tenantInfo.tenantId,
          barId: tenantInfo.barId,
          barName: tenantInfo.barName,
          isActive: tenantInfo.isActive
        }
      };
      results.timing.resolve_customer_tab_to_tenant = Date.now() - step2Start;
      console.log(`✅ Step 2 completed in ${results.timing.resolve_customer_tab_to_tenant}ms`);
      console.log('📋 Tenant Info:', tenantInfo);
    } catch (error) {
      results.steps.resolve_customer_tab_to_tenant = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof MpesaError ? error.code : 'UNKNOWN_ERROR'
      };
      results.timing.resolve_customer_tab_to_tenant = Date.now() - step2Start;
      console.log(`❌ Step 2 failed in ${results.timing.resolve_customer_tab_to_tenant}ms:`, error);
      
      return NextResponse.json({
        success: false,
        step,
        error: 'Tab resolution failed',
        details: results
      }, { status: 500 });
    }

    // Step 3: Get Tenant Credentials
    step = 'get_tenant_credentials';
    const step3Start = Date.now();
    console.log(`🔍 Step 3: ${step}`);
    
    let credentials;
    try {
      credentials = await credentialRetrievalService.getTenantCredentials(tenantInfo.tenantId, environment);
      results.steps.get_tenant_credentials = { 
        success: true,
        credentialsInfo: {
          environment: credentials.environment,
          businessShortCode: credentials.businessShortCode,
          hasConsumerKey: !!credentials.consumerKey,
          hasConsumerSecret: !!credentials.consumerSecret,
          hasPasskey: !!credentials.passkey,
          callbackUrl: credentials.callbackUrl,
          encryptedAt: credentials.encryptedAt,
          lastValidated: credentials.lastValidated
        }
      };
      results.timing.get_tenant_credentials = Date.now() - step3Start;
      console.log(`✅ Step 3 completed in ${results.timing.get_tenant_credentials}ms`);
      console.log('📋 Credentials Info:', results.steps.get_tenant_credentials.credentialsInfo);
    } catch (error) {
      results.steps.get_tenant_credentials = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof MpesaError ? error.code : 'UNKNOWN_ERROR'
      };
      results.timing.get_tenant_credentials = Date.now() - step3Start;
      console.log(`❌ Step 3 failed in ${results.timing.get_tenant_credentials}ms:`, error);
      
      return NextResponse.json({
        success: false,
        step,
        error: 'Credential retrieval failed',
        details: results
      }, { status: 500 });
    }

    // Step 4: Create Tenant Config
    step = 'create_tenant_config';
    const step4Start = Date.now();
    console.log(`🔍 Step 4: ${step}`);
    
    let tenantConfig;
    try {
      const overrides = { environment };
      tenantConfig = tenantConfigFactory.createTenantConfig(tenantInfo, credentials, overrides);
      results.steps.create_tenant_config = { 
        success: true,
        configInfo: {
          tenantId: tenantConfig.tenantId,
          barName: tenantConfig.barName,
          barId: tenantConfig.barId,
          environment: tenantConfig.environment,
          timeoutMs: tenantConfig.timeoutMs,
          retryAttempts: tenantConfig.retryAttempts,
          rateLimitPerMinute: tenantConfig.rateLimitPerMinute,
          hasCredentials: !!tenantConfig.credentials
        }
      };
      results.timing.create_tenant_config = Date.now() - step4Start;
      console.log(`✅ Step 4 completed in ${results.timing.create_tenant_config}ms`);
      console.log('📋 Tenant Config Info:', results.steps.create_tenant_config.configInfo);
    } catch (error) {
      results.steps.create_tenant_config = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof MpesaError ? error.code : 'UNKNOWN_ERROR',
        stack: error instanceof Error ? error.stack : undefined
      };
      results.timing.create_tenant_config = Date.now() - step4Start;
      console.log(`❌ Step 4 failed in ${results.timing.create_tenant_config}ms:`, error);
      
      return NextResponse.json({
        success: false,
        step,
        error: 'Tenant config creation failed',
        details: results
      }, { status: 500 });
    }

    // Step 5: Create Service Config
    step = 'create_service_config';
    const step5Start = Date.now();
    console.log(`🔍 Step 5: ${step}`);
    
    let serviceConfig;
    try {
      const overrides = { environment };
      serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig, overrides);
      results.steps.create_service_config = { 
        success: true,
        serviceConfigInfo: {
          environment: serviceConfig.environment,
          businessShortCode: serviceConfig.businessShortCode,
          hasConsumerKey: !!serviceConfig.consumerKey,
          hasConsumerSecret: !!serviceConfig.consumerSecret,
          hasPasskey: !!serviceConfig.passkey,
          callbackUrl: serviceConfig.callbackUrl,
          timeoutMs: serviceConfig.timeoutMs,
          retryAttempts: serviceConfig.retryAttempts,
          rateLimitPerMinute: serviceConfig.rateLimitPerMinute
        }
      };
      results.timing.create_service_config = Date.now() - step5Start;
      console.log(`✅ Step 5 completed in ${results.timing.create_service_config}ms`);
      console.log('📋 Service Config Info:', results.steps.create_service_config.serviceConfigInfo);
    } catch (error) {
      results.steps.create_service_config = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof MpesaError ? error.code : 'UNKNOWN_ERROR',
        stack: error instanceof Error ? error.stack : undefined
      };
      results.timing.create_service_config = Date.now() - step5Start;
      console.log(`❌ Step 5 failed in ${results.timing.create_service_config}ms:`, error);
      
      return NextResponse.json({
        success: false,
        step,
        error: 'Service config creation failed',
        details: results
      }, { status: 500 });
    }

    // Step 6: Test Full ServiceFactory Method
    step = 'full_servicefactory_method';
    const step6Start = Date.now();
    console.log(`🔍 Step 6: ${step} (This is what fails in the main API)`);
    
    try {
      const overrides = { environment };
      const fullServiceConfig = await ServiceFactory.createServiceConfigFromCustomerContext(
        barId,
        customerIdentifier,
        tabResolutionService,
        credentialRetrievalService,
        tenantConfigFactory,
        overrides
      );
      
      results.steps.full_servicefactory_method = { 
        success: true,
        fullConfigInfo: {
          environment: fullServiceConfig.environment,
          businessShortCode: fullServiceConfig.businessShortCode,
          hasConsumerKey: !!fullServiceConfig.consumerKey,
          hasConsumerSecret: !!fullServiceConfig.consumerSecret,
          hasPasskey: !!fullServiceConfig.passkey,
          callbackUrl: fullServiceConfig.callbackUrl,
          timeoutMs: fullServiceConfig.timeoutMs,
          retryAttempts: fullServiceConfig.retryAttempts,
          rateLimitPerMinute: fullServiceConfig.rateLimitPerMinute
        }
      };
      results.timing.full_servicefactory_method = Date.now() - step6Start;
      console.log(`✅ Step 6 completed in ${results.timing.full_servicefactory_method}ms`);
      console.log('📋 Full Service Config Info:', results.steps.full_servicefactory_method.fullConfigInfo);
      
    } catch (error) {
      results.steps.full_servicefactory_method = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof MpesaError ? error.code : 'UNKNOWN_ERROR',
        stack: error instanceof Error ? error.stack : undefined,
        originalError: error instanceof MpesaError ? error.originalError : undefined
      };
      results.timing.full_servicefactory_method = Date.now() - step6Start;
      console.log(`❌ Step 6 failed in ${results.timing.full_servicefactory_method}ms:`, error);
      console.log('💥 THIS IS THE FAILURE POINT - Full ServiceFactory method fails while individual steps work!');
      
      return NextResponse.json({
        success: false,
        step,
        error: 'Full ServiceFactory method failed (this is the bug!)',
        details: results,
        analysis: {
          individualStepsWork: true,
          fullMethodFails: true,
          likelyIssue: 'Error handling or async/await issue in ServiceFactory integration'
        }
      }, { status: 500 });
    }

    // All steps completed successfully
    results.success = true;
    results.totalTime = Date.now() - startTime;
    
    console.log(`🎉 All steps completed successfully in ${results.totalTime}ms`);
    console.log('📊 Step Timing:', results.timing);
    
    return NextResponse.json({
      success: true,
      message: 'All ServiceFactory steps work correctly',
      details: results,
      analysis: {
        allStepsWork: true,
        totalTime: results.totalTime,
        conclusion: 'ServiceFactory integration is working - issue might be elsewhere'
      }
    });

  } catch (error) {
    console.error(`💥 Unexpected error at step ${step}:`, error);
    
    return NextResponse.json({
      success: false,
      step,
      error: 'Unexpected error during ServiceFactory debug',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        totalTime: Date.now() - startTime
      }
    }, { status: 500 });
  }
}