import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const steps: any = {};
  
  try {
    console.log('🔍 Minimal Payment Debug - Starting');
    
    // Step 1: Test request parsing
    console.log('🔍 Step 1: Testing request parsing');
    let requestBody;
    try {
      requestBody = await request.json();
      steps.step1 = { success: true, message: 'Request parsed successfully' };
      console.log('✅ Step 1: Request parsing works');
    } catch (error) {
      steps.step1 = { success: false, error: 'Request parsing failed' };
      return NextResponse.json({ success: false, steps, error: 'Request parsing failed' });
    }
    
    // Step 2: Test basic validation
    console.log('🔍 Step 2: Testing basic validation');
    const { barId, customerIdentifier, phoneNumber, amount } = requestBody;
    if (!barId || !customerIdentifier || !phoneNumber || !amount) {
      steps.step2 = { success: false, error: 'Missing required fields' };
      return NextResponse.json({ success: false, steps, error: 'Missing fields' });
    }
    steps.step2 = { success: true, message: 'Basic validation passed' };
    console.log('✅ Step 2: Basic validation works');
    
    // Step 3: Test Supabase client creation
    console.log('🔍 Step 3: Testing Supabase client creation');
    try {
      const { createServiceRoleClient } = await import('@/lib/supabase');
      const supabase = createServiceRoleClient();
      steps.step3 = { success: true, message: 'Supabase client created' };
      console.log('✅ Step 3: Supabase client creation works');
    } catch (error) {
      steps.step3 = { success: false, error: 'Supabase client creation failed' };
      return NextResponse.json({ success: false, steps, error: 'Supabase client failed' });
    }
    
    // Step 4: Test phone validation import
    console.log('🔍 Step 4: Testing phone validation import');
    try {
      const { validateMpesaPhoneNumber, sanitizePhoneNumber } = await import('@tabeza/shared/lib/phoneValidation');
      const sanitized = sanitizePhoneNumber(phoneNumber);
      const validation = validateMpesaPhoneNumber(sanitized);
      steps.step4 = { success: true, message: 'Phone validation imported and works', valid: validation.isValid };
      console.log('✅ Step 4: Phone validation works');
    } catch (error) {
      steps.step4 = { success: false, error: 'Phone validation import failed' };
      return NextResponse.json({ success: false, steps, error: 'Phone validation failed' });
    }
    
    // Step 5: Test M-Pesa imports
    console.log('🔍 Step 5: Testing M-Pesa imports');
    try {
      const { 
        MpesaRateLimiter, 
        extractIpAddress, 
        TransactionService,
        createTabResolutionService
      } = await import('@tabeza/shared');
      
      steps.step5 = { success: true, message: 'M-Pesa imports successful' };
      console.log('✅ Step 5: M-Pesa imports work');
    } catch (error) {
      steps.step5 = { success: false, error: 'M-Pesa imports failed' };
      return NextResponse.json({ success: false, steps, error: 'M-Pesa imports failed' });
    }
    
    // Step 6: Test IP extraction
    console.log('🔍 Step 6: Testing IP extraction');
    try {
      const { extractIpAddress } = await import('@tabeza/shared');
      const ipAddress = extractIpAddress(request);
      steps.step6 = { success: true, message: 'IP extraction works', ip: ipAddress };
      console.log('✅ Step 6: IP extraction works');
    } catch (error) {
      steps.step6 = { success: false, error: 'IP extraction failed' };
      return NextResponse.json({ success: false, steps, error: 'IP extraction failed' });
    }
    
    // Step 7: Test environment variables
    console.log('🔍 Step 7: Testing environment variables');
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SECRET_KEY;
    const hasMpesaEnv = !!process.env.MPESA_ENVIRONMENT;
    
    if (!hasSupabaseUrl || !hasSupabaseKey) {
      steps.step7 = { success: false, error: 'Missing environment variables' };
      return NextResponse.json({ success: false, steps, error: 'Missing env vars' });
    }
    
    steps.step7 = { 
      success: true, 
      message: 'Environment variables present',
      env: { hasSupabaseUrl, hasSupabaseKey, hasMpesaEnv }
    };
    console.log('✅ Step 7: Environment variables work');
    
    // If we get here, all basic steps work
    return NextResponse.json({
      success: true,
      message: 'All basic payment API components work',
      steps,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Minimal payment debug failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      steps,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}