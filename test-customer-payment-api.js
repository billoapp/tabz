// Test the customer app payment settings API
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYWlneXJyenNxYmZzY3l6bnp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzc5NzI5NCwiZXhwIjoyMDQzMzczMjk0fQ.wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPaymentAPI() {
  console.log('Testing payment settings API logic...');
  
  try {
    // First, let's find the Popos bar ID
    console.log('\n1. Finding Popos bar...');
    const { data: bars, error: barsError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled')
      .ilike('name', '%popos%');
    
    if (barsError) {
      console.error('Error finding bars:', barsError);
      return;
    }
    
    console.log('Found bars:', bars);
    
    if (!bars || bars.length === 0) {
      console.log('No Popos bar found. Let me check all bars...');
      
      const { data: allBars, error: allBarsError } = await supabase
        .from('bars')
        .select('id, name, mpesa_enabled')
        .limit(10);
      
      if (allBarsError) {
        console.error('Error getting all bars:', allBarsError);
        return;
      }
      
      console.log('All bars:', allBars);
      return;
    }
    
    const poposBar = bars[0];
    console.log('\n2. Popos bar details:', poposBar);
    
    // Test the exact API logic
    console.log('\n3. Testing API logic...');
    const mpesaAvailable = poposBar.mpesa_enabled === true;
    
    const apiResponse = {
      success: true,
      barId: poposBar.id,
      barName: poposBar.name,
      paymentMethods: {
        mpesa: {
          available: mpesaAvailable,
          environment: 'sandbox'
        },
        card: {
          available: false,
          reason: 'Coming soon'
        },
        airtel: {
          available: false,
          reason: 'Coming soon'
        }
      }
    };
    
    console.log('API would return:', JSON.stringify(apiResponse, null, 2));
    
    // Also check M-Pesa credentials for this bar
    console.log('\n4. Checking M-Pesa credentials...');
    const { data: credentials, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('*')
      .eq('bar_id', poposBar.id);
    
    if (credError) {
      console.error('Error checking credentials:', credError);
    } else {
      console.log('M-Pesa credentials:', credentials);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testPaymentAPI();