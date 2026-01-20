// Test M-Pesa API directly - Simplified Version
// Run this in browser console on staff settings page

async function testMpesaAPI() {
  console.log('🧪 Testing M-Pesa API directly...');
  
  // Use the bar ID we know from the database
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // Popos bar ID
  
  console.log('📋 Using Bar ID:', barId);
  
  // Test data
  const testData = {
    barId: barId,
    mpesa_enabled: true,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '174379',
    mpesa_consumer_key: 'test_consumer_key_123',
    mpesa_consumer_secret: 'test_consumer_secret_456',
    mpesa_passkey: 'test_passkey_789'
  };
  
  console.log('📤 Sending test data:', {
    ...testData,
    mpesa_consumer_key: '[REDACTED]',
    mpesa_consumer_secret: '[REDACTED]',
    mpesa_passkey: '[REDACTED]'
  });
  
  try {
    // Call the API
    console.log('📡 Calling POST /api/mpesa-settings...');
    const response = await fetch('/api/mpesa-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);
    
    const result = await response.json();
    console.log('📡 Response data:', result);
    
    if (response.ok) {
      console.log('✅ API call successful');
      
      // Now check if data was actually saved
      console.log('🔍 Checking if data was saved...');
      
      const checkResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
      console.log('� GET Response status:', checkResponse.status);
      
      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        console.log('📊 Current database state:', checkResult);
        
        if (checkResult.success && checkResult.settings.has_credentials) {
          console.log('✅ Data successfully saved to database!');
        } else {
          console.log('❌ Data NOT saved to database despite API success');
          console.log('🔍 Settings returned:', checkResult.settings);
        }
      } else {
        console.log('❌ Failed to check database state');
        const errorResult = await checkResponse.json();
        console.log('❌ GET Error:', errorResult);
      }
    } else {
      console.log('❌ API call failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ API test error:', error);
  }
}

// Run the test
console.log('🚀 Starting M-Pesa API test...');
testMpesaAPI();