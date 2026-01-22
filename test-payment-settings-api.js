/**
 * Test Payment Settings API
 * Test the new payment settings endpoint we created
 */

const fetch = require('node-fetch');

async function testPaymentSettingsAPI() {
  console.log('🧪 Testing Payment Settings API');
  console.log('===============================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  const baseUrl = 'http://localhost:3000'; // Adjust if needed
  
  try {
    console.log(`📡 Calling: ${baseUrl}/api/payment-settings?barId=${barId}`);
    
    const response = await fetch(`${baseUrl}/api/payment-settings?barId=${barId}`);
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n📋 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Analyze the response
    console.log('\n🔍 Analysis:');
    if (data.success) {
      console.log(`✅ API call successful`);
      console.log(`🏢 Bar: ${data.barName} (${data.barId})`);
      
      const mpesa = data.paymentMethods?.mpesa;
      if (mpesa) {
        console.log(`💳 M-Pesa: ${mpesa.available ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
        if (mpesa.available) {
          console.log(`🌍 Environment: ${mpesa.environment}`);
        }
      }
      
      const card = data.paymentMethods?.card;
      if (card) {
        console.log(`💳 Card: ${card.available ? 'AVAILABLE' : 'NOT AVAILABLE'} ${card.reason ? `(${card.reason})` : ''}`);
      }
      
      const airtel = data.paymentMethods?.airtel;
      if (airtel) {
        console.log(`📱 Airtel: ${airtel.available ? 'AVAILABLE' : 'NOT AVAILABLE'} ${airtel.reason ? `(${airtel.reason})` : ''}`);
      }
    } else {
      console.log('❌ API call failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPaymentSettingsAPI().then(() => {
  console.log('\n✨ Payment settings API test completed');
}).catch(console.error);