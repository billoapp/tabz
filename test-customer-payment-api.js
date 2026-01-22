// Test the customer payment settings API
const fetch = require('node-fetch');

async function testPaymentAPI() {
  console.log('Testing customer payment settings API...');
  
  // First, let's find a bar ID to test with
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
  const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG'; // Service role key
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get a bar with M-Pesa enabled
    const { data: bars, error } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled')
      .eq('mpesa_enabled', true)
      .limit(1);
    
    if (error) {
      console.error('Error fetching bars:', error);
      return;
    }
    
    if (!bars || bars.length === 0) {
      console.log('No bars with M-Pesa enabled found');
      return;
    }
    
    const testBar = bars[0];
    console.log('Testing with bar:', testBar);
    
    // Test the API endpoint
    const apiUrl = `http://localhost:3002/api/payment-settings?barId=${testBar.id}`;
    console.log('Testing API URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.paymentMethods?.mpesa?.available) {
      console.log('✅ SUCCESS: M-Pesa is available for this bar!');
    } else {
      console.log('❌ ISSUE: M-Pesa not available or API error');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testPaymentAPI();