/**
 * Test M-Pesa API Endpoint
 * Tests the M-Pesa test endpoint to diagnose credential decryption issues
 */

async function testMpesaAPI() {
  console.log('🧪 Testing M-Pesa API Endpoint');
  console.log('==============================');
  
  // The bar ID from the context (Popos bar)
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    console.log('📞 Calling M-Pesa test endpoint...');
    console.log('🏢 Bar ID:', barId);
    
    const response = await fetch('http://localhost:3003/api/payments/mpesa/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barId })
    });
    
    console.log('📊 Response Status:', response.status, response.statusText);
    
    const data = await response.text();
    console.log('📄 Response Body:', data);
    
    if (response.ok) {
      try {
        const jsonData = JSON.parse(data);
        console.log('✅ Parsed JSON Response:', JSON.stringify(jsonData, null, 2));
      } catch (parseError) {
        console.log('⚠️ Response is not JSON, showing as text');
      }
    } else {
      console.log('❌ API call failed');
      try {
        const errorData = JSON.parse(data);
        console.log('🔍 Error Details:', JSON.stringify(errorData, null, 2));
      } catch (parseError) {
        console.log('🔍 Error Text:', data);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMpesaAPI().catch(console.error);