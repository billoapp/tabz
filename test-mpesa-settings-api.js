/**
 * Test M-Pesa Settings API
 * Tests the GET endpoint to verify setup completion status
 */

async function testMpesaSettingsAPI() {
  console.log('🧪 Testing M-Pesa Settings API');
  console.log('==============================');
  
  // The bar ID from the context (Popos bar)
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    console.log('📞 Calling M-Pesa settings GET endpoint...');
    console.log('🏢 Bar ID:', barId);
    
    const response = await fetch(`http://localhost:3003/api/mpesa-settings?barId=${barId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📊 Response Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('📄 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ API Response Analysis:');
      console.log('   M-Pesa Enabled:', data.settings.mpesa_enabled);
      console.log('   Environment:', data.settings.mpesa_environment);
      console.log('   Business Shortcode:', data.settings.mpesa_business_shortcode);
      console.log('   Has Credentials:', data.settings.has_credentials);
      console.log('   Setup Completed:', data.settings.mpesa_setup_completed);
      console.log('   Test Status:', data.settings.mpesa_test_status);
      
      if (data.settings.mpesa_setup_completed) {
        console.log('\n🎉 SUCCESS: Setup completion status is now correctly showing as TRUE!');
      } else {
        console.log('\n⚠️ ISSUE: Setup completion status is still showing as FALSE');
        console.log('   This might be because:');
        console.log('   - Credentials are not saved:', !data.settings.has_credentials);
        console.log('   - M-Pesa is not enabled:', !data.settings.mpesa_enabled);
      }
    } else {
      console.log('❌ API call failed');
      console.log('🔍 Error Details:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMpesaSettingsAPI().catch(console.error);