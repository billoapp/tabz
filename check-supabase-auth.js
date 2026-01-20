// Check Supabase Authentication Method
// Run this in browser console to see what auth your API is using

async function checkSupabaseAuth() {
  console.log('🔍 Checking Supabase Authentication Method...');
  
  // Test 1: Check what auth headers are being sent
  console.log('📡 Test 1: Intercepting API request to see auth headers...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  // Intercept fetch to see headers
  const originalFetch = window.fetch;
  let capturedHeaders = null;
  
  window.fetch = function(...args) {
    if (args[0].includes('/api/mpesa-settings')) {
      console.log('🔍 Intercepted M-Pesa API call');
      console.log('URL:', args[0]);
      console.log('Options:', args[1]);
      capturedHeaders = args[1]?.headers;
    }
    return originalFetch.apply(this, args);
  };
  
  // Make a test API call
  try {
    const response = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const result = await response.json();
    
    console.log('📊 API Response:', response.status, result.success);
    console.log('🔑 Captured Headers:', capturedHeaders);
    
    // Restore original fetch
    window.fetch = originalFetch;
    
    // Test 2: Check environment variables (if accessible)
    console.log('🔍 Test 2: Checking environment setup...');
    
    // Try to make a request that would show auth issues
    const testResponse = await fetch('/api/mpesa-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barId: barId,
        mpesa_enabled: true,
        mpesa_environment: 'sandbox',
        mpesa_business_shortcode: '174379',
        mpesa_consumer_key: 'test_key_for_auth_check',
        mpesa_consumer_secret: 'test_secret_for_auth_check',
        mpesa_passkey: 'test_passkey_for_auth_check'
      })
    });
    
    const testResult = await testResponse.json();
    console.log('🧪 Auth Test Result:', testResponse.status, testResult);
    
    // Test 3: Check if we can see the actual Supabase client config
    console.log('🔍 Test 3: Checking Supabase client configuration...');
    
    // This will help identify if it's using legacy keys
    if (testResponse.ok && testResult.success) {
      console.log('✅ API authentication is working');
      console.log('🔧 The issue is likely in the database save logic, not auth');
    } else {
      console.log('❌ API authentication might be failing');
      console.log('🔧 Check your Supabase keys in environment variables');
    }
    
    // Test 4: Check what happens with a direct database query
    console.log('🔍 Test 4: Checking if the save actually happened...');
    
    const checkResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const checkResult = await checkResponse.json();
    
    console.log('📊 Final database state:', {
      mpesa_enabled: checkResult.settings?.mpesa_enabled,
      has_credentials: checkResult.settings?.has_credentials,
      business_shortcode: checkResult.settings?.mpesa_business_shortcode
    });
    
    // Analysis
    console.log('🎯 Analysis:');
    
    if (testResult.success && !checkResult.settings?.has_credentials) {
      console.log('🚨 AUTHENTICATION ISSUE DETECTED!');
      console.log('The API returns success but database is not updated.');
      console.log('This typically means:');
      console.log('1. Using legacy service_role key with new secret-based auth');
      console.log('2. Wrong Supabase URL or key in environment variables');
      console.log('3. RLS policies blocking the service_role');
      
      console.log('🔧 Fix steps:');
      console.log('1. Check your .env.local file');
      console.log('2. Ensure SUPABASE_SERVICE_ROLE_KEY is the new secret key');
      console.log('3. Ensure SUPABASE_URL matches your project');
      console.log('4. Restart your development server');
    }
    
  } catch (error) {
    console.error('❌ Auth check error:', error);
    window.fetch = originalFetch; // Restore fetch even on error
  }
}

// Instructions
console.log(`
🔑 Supabase Authentication Checker

This will help identify if you're using:
- Legacy service_role keys (old system)
- New secret-based authentication (current system)

Run: checkSupabaseAuth()
`);

// Auto-run
checkSupabaseAuth();