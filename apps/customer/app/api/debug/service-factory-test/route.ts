import { NextRequest, NextResponse } from 'next/server';
import { 
  createTabResolutionService,
  createCredentialRetrievalService,
  createTenantMpesaConfigFactory,
  ServiceFactory,
  MpesaError
} from '@tabeza/shared';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Service Factory Test - Starting');
    
    const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
    const customerIdentifier = 'device_1767598208929_w541on3yr_438c80c1-fe11-4ac5-8a48-2fc45104ba31';
    
    const result: any = {
      success: false,
      steps: {},
      error: null
    };
    
    try {
      // Step 1: Create services
      console.log('🔍 Step 1: Creating services');
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
      
      result.steps.step1 = { success: true, message: 'Services created' };
      console.log('✅ Step 1: Services created successfully');
      
      // Step 2: Resolve customer tab to tenant
      console.log('🔍 Step 2: Resolving customer tab to tenant');
      const tenantInfo = await tabResolutionService.resolveCustomerTabToTenant(barId, customerIdentifier);
      
      result.steps.step2 = { 
        success: true, 
        message: 'Tab resolved to tenant',
        data: {
          tenantId: tenantInfo.tenantId,
          barId: tenantInfo.barId,
          barName: tenantInfo.barName,
          isActive: tenantInfo.isActive
        }
      };
      console.log('✅ Step 2: Tab resolved successfully', tenantInfo);
      
      // Step 3: Retrieve tenant credentials
      console.log('🔍 Step 3: Retrieving tenant credentials');
      const environment = 'sandbox';
      const credentials = await credentialRetrievalService.getTenantCredentials(tenantInfo.tenantId, environment);
      
      result.steps.step3 = { 
        success: true, 
        message: 'Credentials retrieved',
        data: {
          environment: credentials.environment,
          businessShortCode: credentials.businessShortCode,
          callbackUrl: credentials.callbackUrl,
          hasConsumerKey: !!credentials.consumerKey,
          hasConsumerSecret: !!credentials.consumerSecret,
          hasPasskey: !!credentials.passkey
        }
      };
      console.log('✅ Step 3: Credentials retrieved successfully');
      
      // Step 4: Create tenant configuration
      console.log('🔍 Step 4: Creating tenant configuration');
      const tenantConfig = tenantConfigFactory.createTenantConfig(tenantInfo, credentials, { environment });
      
      result.steps.step4 = { 
        success: true, 
        message: 'Tenant config created',
        data: {
          tenantId: tenantConfig.tenantId,
          environment: tenantConfig.environment,
          hasCredentials: !!tenantConfig.credentials
        }
      };
      console.log('✅ Step 4: Tenant config created successfully');
      
      // Step 5: Create service configuration
      console.log('🔍 Step 5: Creating service configuration');
      const serviceConfig = ServiceFactory.createTenantServiceConfig(tenantConfig, { environment });
      
      result.steps.step5 = { 
        success: true, 
        message: 'Service config created',
        data: {
          environment: serviceConfig.environment,
          timeoutMs: serviceConfig.timeoutMs,
          retryAttempts: serviceConfig.retryAttempts,
          hasConsumerKey: !!serviceConfig.consumerKey,
          hasConsumerSecret: !!serviceConfig.consumerSecret,
          hasPasskey: !!serviceConfig.passkey,
          businessShortCode: serviceConfig.businessShortCode
        }
      };
      console.log('✅ Step 5: Service config created successfully');
      
      // Step 6: Test the FULL ServiceFactory method (this is what fails in main API)
      console.log('🔍 Step 6: Testing FULL ServiceFactory.createServiceConfigFromCustomerContext()');
      try {
        const fullServiceConfig = await ServiceFactory.createServiceConfigFromCustomerContext(
          barId,
          customerIdentifier,
          tabResolutionService,
          credentialRetrievalService,
          tenantConfigFactory,
          { environment }
        );
        
        result.steps.step6 = { 
          success: true, 
          message: 'Full ServiceFactory method works',
          data: {
            environment: fullServiceConfig.environment,
            timeoutMs: fullServiceConfig.timeoutMs,
            retryAttempts: fullServiceConfig.retryAttempts,
            hasConsumerKey: !!fullServiceConfig.consumerKey,
            hasConsumerSecret: !!fullServiceConfig.consumerSecret,
            hasPasskey: !!fullServiceConfig.passkey,
            businessShortCode: fullServiceConfig.businessShortCode
          }
        };
        console.log('✅ Step 6: Full ServiceFactory method works perfectly!');
        
      } catch (fullMethodError) {
        console.error('❌ Step 6: Full ServiceFactory method failed:', fullMethodError);
        
        result.steps.step6 = { 
          success: false, 
          message: 'Full ServiceFactory method failed - THIS IS THE BUG!',
          error: {
            message: fullMethodError instanceof Error ? fullMethodError.message : 'Unknown error',
            code: fullMethodError instanceof MpesaError ? fullMethodError.code : 'UNKNOWN_ERROR',
            stack: fullMethodError instanceof Error ? fullMethodError.stack : undefined,
            originalError: fullMethodError instanceof MpesaError ? fullMethodError.originalError : undefined
          }
        };
        
        // This is the critical finding - individual steps work but full method fails
        result.criticalFinding = {
          individualStepsWork: true,
          fullMethodFails: true,
          conclusion: 'ServiceFactory integration has a bug in the full method implementation'
        };
      }
      
      result.success = true;
      result.message = 'All steps completed successfully';
      
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
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Service Factory Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}