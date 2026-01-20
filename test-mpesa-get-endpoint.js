// Test M-Pesa GET endpoint to see if UI can load saved credentials
// Run this in browser console

async function testMpesaGET() {
  console.log('🔍 Testing M-Pesa GET endpoint...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    console.log('📡 Calling GET /api/mpesa-settings...');
    const response = await fetch(`/api/mpesa-settings?barId=${barId}`);
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);
    
    if (response.ok) {
      const result = await response.json();
      console.log('📊 GET Response data:', result);
      
      if (result.success) {
        console.log('✅ GET endpoint working');
        console.log('🔍 Settings returned:');
        console.log('  - mpesa_enabled:', result.settings.mpesa_enabled);
        console.log('  - mpesa_business_shortcode:', result.settings.mpesa_business_shortcode);
        console.log('  - mpesa_consumer_key:', result.settings.mpesa_consumer_key);
        console.log('  - mpesa_consumer_secret:', result.settings.mpesa_consumer_secret);
        console.log('  - mpesa_passkey:', result.settings.mpesa_passkey);
        console.log('  - has_credentials:', result.settings.has_credentials);
        
        if (result.settings.has_credentials) {
          console.log('✅ Credentials should show as masked in UI');
        } else {
          console.log('❌ No credentials detected');
        }
      } else {
        console.log('❌ GET endpoint failed:', result.error);
      }
    } else {
      const errorResult = await response.json();
      console.log('❌ GET request failed:', errorResult);
    }
    
  } catch (error) {
    console.error('❌ GET test error:', error);
  }
}

// Run the test
console.log('🚀 Testing M-Pesa GET endpoint...');
testMpesaGET();