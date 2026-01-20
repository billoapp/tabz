// Fixed M-Pesa Setup Script
// Run this in browser console on staff settings page

async function fixedMpesaSetup() {
  console.log('🔧 Fixed M-Pesa Setup Starting...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  // Step 1: Check current state
  console.log('🔍 Step 1: Checking current state...');
  const checkResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
  const checkResult = await checkResponse.json();
  console.log('Current state:', checkResult);
  
  // Step 2: Set up credentials properly (don't reset first)
  console.log('💾 Step 2: Setting up M-Pesa credentials...');
  
  const credentials = {
    barId: barId,
    mpesa_enabled: true,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '174379',
    mpesa_consumer_key: 'test_consumer_key_for_sandbox_12345',
    mpesa_consumer_secret: 'test_consumer_secret_for_sandbox_12345',
    mpesa_passkey: 'test_passkey_for_sandbox_12345'
  };
  
  console.log('📤 Saving credentials:', {
    ...credentials,
    mpesa_consumer_key: '[REDACTED]',
    mpesa_consumer_secret: '[REDACTED]',
    mpesa_passkey: '[REDACTED]'
  });
  
  const saveResponse = await fetch('/api/mpesa-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  
  const saveResult = await saveResponse.json();
  console.log('💾 Save result:', saveResult);
  
  if (!saveResponse.ok) {
    console.error('❌ Failed to save credentials:', saveResult.error);
    return;
  }
  
  // Step 3: Verify credentials were saved
  console.log('🔍 Step 3: Verifying credentials were saved...');
  const verifyResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
  const verifyResult = await verifyResponse.json();
  console.log('✅ Verification:', {
    mpesa_enabled: verifyResult.settings?.mpesa_enabled,
    has_credentials: verifyResult.settings?.has_credentials,
    business_shortcode: verifyResult.settings?.mpesa_business_shortcode
  });
  
  if (!verifyResult.settings?.has_credentials) {
    console.error('❌ Credentials were not saved properly!');
    console.log('🔧 This could be due to:');
    console.log('1. Database permissions issue');
    console.log('2. Encryption error');
    console.log('3. Missing environment variables');
    return;
  }
  
  // Step 4: Test the credentials
  console.log('🧪 Step 4: Testing M-Pesa credentials...');
  
  const testResponse = await fetch('/api/payments/mpesa/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barId: barId })
  });
  
  const testResult = await testResponse.json();
  console.log('🧪 Test result:', testResult);
  
  if (testResponse.ok) {
    console.log('✅ SUCCESS! M-Pesa setup is working correctly!');
    console.log('🎉 You can now process M-Pesa payments');
  } else {
    console.error('❌ Test failed:', testResult.error);
    
    if (testResult.error?.includes('decrypt')) {
      console.log('🚨 Decryption error detected. Possible causes:');
      console.log('1. MPESA_ENCRYPTION_KEY environment variable not set');
      console.log('2. Encryption key mismatch between save and test');
      console.log('3. Server needs restart');
      
      console.log('🔧 Debug steps:');
      console.log('1. Check server logs for encryption errors');
      console.log('2. Verify environment variables are loaded');
      console.log('3. Restart development server');
    } else if (testResult.error?.includes('not configured')) {
      console.log('🚨 Credentials not found. This means:');
      console.log('1. Database save failed silently');
      console.log('2. Wrong bar ID being used');
      console.log('3. Database permissions issue');
    } else {
      console.log('🚨 Other error:', testResult.error);
      console.log('Details:', testResult.details);
    }
  }
}

// Instructions
console.log(`
🚀 Fixed M-Pesa Setup Ready!

This script will:
1. Check current database state
2. Save M-Pesa credentials with proper encryption
3. Verify credentials were saved
4. Test the M-Pesa API

Run: fixedMpesaSetup()
`);

// Auto-run
fixedMpesaSetup();