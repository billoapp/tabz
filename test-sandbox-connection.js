// Test if Safaricom sandbox credentials actually work
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const mpesaKey = process.env.MPESA_KMS_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Test with known working sandbox credentials
const workingSandboxCredentials = {
  consumerKey: 'YOUR_SANDBOX_CONSUMER_KEY',
  consumerSecret: 'YOUR_SANDBOX_CONSUMER_SECRET',
  passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9' // Default sandbox passkey
};

async function testSandboxConnection() {
  console.log('🧪 Testing Safaricom sandbox API connection...');
  
  try {
    // Test OAuth token generation
    const auth = Buffer.from(`${workingSandboxCredentials.consumerKey}:${workingSandboxCredentials.consumerSecret}`).toString('base64');
    
    console.log('🔑 Requesting OAuth token...');
    const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OAuth request failed:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }
    
    const data = await response.json();
    
    if (data.access_token) {
      console.log('✅ Sandbox OAuth test successful!');
      console.log('✅ Access token received:', data.access_token.substring(0, 20) + '...');
      console.log('✅ Sandbox credentials are working');
    } else {
      console.error('❌ No access token received');
      console.error('Response:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSandboxConnection();
