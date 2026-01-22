// Simple M-Pesa Test - Minimal validation
// Run this in browser console

async function simpleMpesaTest() {
  console.log('🧪 Simple M-Pesa Test Starting...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  // Test 1: Check if we can save minimal credentials
  console.log('📝 Test 1: Saving minimal credentials...');
  
  const minimalCredentials = {
    barId: barId,
    mpesa_enabled: true,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '174379',  // Valid PayBill format
    mpesa_consumer_key: 'test_key_1234567890',  // 10+ chars
    mpesa_consumer_secret: 'test_secret_1234567890',  // 10+ chars
    mpesa_passkey: 'test_passkey_1234567890'  // 10+ chars
  };
  
  console.log('📤 Sending:', {
    ...minimalCredentials,
    mpesa_consumer_key: '[REDACTED]',
    mpesa_consumer_secret: '[REDACTED]',
    mpesa_passkey: '[REDACTED]'
  });
  
  try {
    const saveResponse = await fetch('/api/mpesa-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalCredentials)
    });
    
    const saveResult = await saveResponse.json();
    console.log('💾 Save response:', saveResponse.status, saveResult);
    
    if (!saveResponse.ok) {
      console.error('❌ Save failed:', saveResult.error);
      return;
    }
    
    // Test 2: Check if credentials were actually saved
    console.log('🔍 Test 2: Checking if credentials were saved...');
    
    const checkResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const checkResult = await checkResponse.json();
    
    console.log('📊 Check result:', {
      success: checkResult.success,
      has_credentials: checkResult.settings?.has_credentials,
      mpesa_enabled: checkResult.settings?.mpesa_enabled,
      business_shortcode: checkResult.settings?.mpesa_business_shortcode
    });
    
    if (!checkResult.settings?.has_credentials) {
      console.error('❌ Credentials not found after save!');
      console.log('🔧 This indicates a database save issue');
      return;
    }
    
    // Test 3: Try the M-Pesa test API
    console.log('🧪 Test 3: Testing M-Pesa API...');
    
    const testResponse = await fetch('/api/payments/mpesa/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barId: barId })
    });
    
    const testResult = await testResponse.json();
    console.log('🧪 Test API result:', testResponse.status, testResult);
    
    if (testResponse.ok) {
      console.log('✅ SUCCESS! Everything is working!');
    } else {
      console.error('❌ Test API failed:', testResult.error);
      
      // Detailed error analysis
      if (testResult.error?.includes('decrypt')) {
        console.log('🔍 Decryption error - checking encryption key...');
        console.log('This usually means MPESA_ENCRYPTION_KEY is not set or inconsistent');
      } else if (testResult.error?.includes('not configured')) {
        console.log('🔍 Credentials not found - database issue');
      } else {
        console.log('🔍 Other error:', testResult.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the test
console.log('🚀 Simple M-Pesa Test Ready! Run: simpleMpesaTest()');
simpleMpesaTest();