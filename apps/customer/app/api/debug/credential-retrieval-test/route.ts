import { NextRequest, NextResponse } from 'next/server';
import { createCredentialRetrievalService } from '@tabeza/shared';

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 Credential Retrieval Test - Starting');
    
    const result: any = {
      success: false,
      environment: {},
      error: null
    };
    
    // Check environment variables
    result.environment = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      MPESA_KMS_KEY_SET: !!process.env.MPESA_KMS_KEY,
      MPESA_KMS_KEY_LENGTH: process.env.MPESA_KMS_KEY?.length || 0,
      MPESA_KMS_KEY_FIRST_10: process.env.MPESA_KMS_KEY?.substring(0, 10) || 'N/A',
      MPESA_KMS_KEY_LAST_10: process.env.MPESA_KMS_KEY?.substring(-10) || 'N/A',
      SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_KEY_SET: !!process.env.SUPABASE_SECRET_KEY
    };
    
    console.log('🔍 Environment check:', result.environment);
    
    try {
      // Test credential retrieval service
      const credentialRetrievalService = createCredentialRetrievalService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );
      
      const tenantId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
      const environment = 'sandbox';
      
      console.log('🔍 Testing credential retrieval for:', { tenantId, environment });
      
      const credentials = await credentialRetrievalService.getTenantCredentials(tenantId, environment);
      
      result.success = true;
      result.credentials = {
        environment: credentials.environment,
        businessShortCode: credentials.businessShortCode,
        callbackUrl: credentials.callbackUrl,
        hasConsumerKey: !!credentials.consumerKey,
        hasConsumerSecret: !!credentials.consumerSecret,
        hasPasskey: !!credentials.passkey,
        consumerKeyLength: credentials.consumerKey?.length || 0,
        consumerSecretLength: credentials.consumerSecret?.length || 0,
        passkeyLength: credentials.passkey?.length || 0
      };
      
      console.log('✅ Credential retrieval successful');
      
    } catch (credentialError) {
      console.error('❌ Credential retrieval failed:', credentialError);
      
      result.error = {
        message: credentialError instanceof Error ? credentialError.message : 'Unknown error',
        name: credentialError instanceof Error ? credentialError.name : 'Unknown',
        stack: credentialError instanceof Error ? credentialError.stack : undefined
      };
      
      // Check if it's a specific M-Pesa error
      if (credentialError && typeof credentialError === 'object' && 'code' in credentialError) {
        result.error.code = (credentialError as any).code;
        result.error.statusCode = (credentialError as any).statusCode;
      }
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Credential Retrieval Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}