import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🔍 Minimal Payment Bypass - Starting...');
  
  try {
    // Step 1: Parse request (should be instant)
    console.log('🔍 Step 1: Parsing request...');
    const requestBody = await request.json();
    const { barId, phoneNumber, amount, customerIdentifier } = requestBody;
    console.log('✅ Step 1: Request parsed successfully');
    
    // Step 2: Basic validation (should be instant)
    console.log('🔍 Step 2: Basic validation...');
    if (!barId || !customerIdentifier || !phoneNumber || !amount) {
      console.log('❌ Step 2: Validation failed - missing fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    console.log('✅ Step 2: Validation passed');
    
    // Step 3: Test environment variables (should be instant)
    console.log('🔍 Step 3: Checking environment variables...');
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SECRET_KEY;
    console.log(`✅ Step 3: Supabase URL: ${hasSupabaseUrl}, Key: ${hasSupabaseKey}`);
    
    // Step 4: Test basic Supabase connection (might hang here)
    console.log('🔍 Step 4: Testing Supabase connection...');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );
      
      // Simple query with timeout
      const { data, error } = await Promise.race([
        supabase.from('bars').select('id').eq('id', barId).single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase query timeout')), 5000)
        )
      ]) as any;
      
      if (error) {
        console.log(`⚠️ Step 4: Supabase query error: ${error.message}`);
      } else {
        console.log('✅ Step 4: Supabase connection works');
      }
    } catch (supabaseError) {
      console.log(`❌ Step 4: Supabase connection failed: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}`);
      return NextResponse.json({ 
        error: 'Database connection failed',
        step: 'supabase_connection',
        details: supabaseError instanceof Error ? supabaseError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Step 5: Test shared package import (might hang here)
    console.log('🔍 Step 5: Testing shared package imports...');
    try {
      const { MpesaError } = await Promise.race([
        import('@tabeza/shared'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shared package import timeout')), 5000)
        )
      ]) as any;
      
      console.log('✅ Step 5: Shared package imports work');
    } catch (importError) {
      console.log(`❌ Step 5: Shared package import failed: ${importError instanceof Error ? importError.message : 'Unknown error'}`);
      return NextResponse.json({ 
        error: 'Shared package import failed',
        step: 'shared_package_import',
        details: importError instanceof Error ? importError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Step 6: Test Rate Limiter creation (might hang here)
    console.log('🔍 Step 6: Testing Rate Limiter creation...');
    try {
      const { MpesaRateLimiter } = await import('@tabeza/shared');
      
      // Create Rate Limiter with timeout
      const rateLimiter = await Promise.race([
        Promise.resolve(new MpesaRateLimiter(
          undefined, // Use default config
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SECRET_KEY!
        )),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Rate Limiter creation timeout')), 5000)
        )
      ]) as any;
      
      console.log('✅ Step 6: Rate Limiter created successfully');
      
      // Test Rate Limiter check with timeout
      console.log('🔍 Step 6b: Testing Rate Limiter check...');
      const rateLimitResult = await Promise.race([
        rateLimiter.checkCustomerRateLimit(customerIdentifier, phoneNumber, amount),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Rate Limiter check timeout')), 10000)
        )
      ]) as any;
      
      console.log(`✅ Step 6b: Rate Limiter check completed: ${rateLimitResult.allowed}`);
      
    } catch (rateLimiterError) {
      console.log(`❌ Step 6: Rate Limiter failed: ${rateLimiterError instanceof Error ? rateLimiterError.message : 'Unknown error'}`);
      return NextResponse.json({ 
        error: 'Rate Limiter failed',
        step: 'rate_limiter',
        details: rateLimiterError instanceof Error ? rateLimiterError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // If we get here, everything works
    console.log('🎉 All steps completed successfully!');
    return NextResponse.json({
      success: true,
      message: 'All components work correctly',
      steps: {
        request_parsing: 'success',
        validation: 'success',
        environment_variables: 'success',
        supabase_connection: 'success',
        shared_package_import: 'success',
        rate_limiter: 'success'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 Minimal payment bypass failed:', error);
    return NextResponse.json({
      error: 'Minimal payment bypass failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}