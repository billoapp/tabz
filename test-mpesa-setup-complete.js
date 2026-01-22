// Complete M-Pesa setup test
// Run this in browser console on staff settings page

async function testCompleteMpesaSetup() {
  console.log('🧪 Testing Complete M-Pesa Setup...');
  
  // First, reset the database state
  console.log('🔄 Step 1: Resetting database state...');
  
  // You'll need to run this SQL in Supabase SQL Editor first:
  console.log(`
  📋 Run this SQL in Supabase SQL Editor first:
  
  UPDATE bars 
  SET 
    mpesa_enabled = false,
    payment_mpesa_enabled = false,
    mpesa_business_shortcode = null,
    mpesa_consumer_key_encrypted = null,
    mpesa_consumer_secret_encrypted = null,
    mpesa_passkey_encrypted = null,
    mpesa_setup_completed = false,
    mpesa_test_status = 'pending',
    mpesa_last_test_at = null
  WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  `);
  
  // Wait for user confirmation
  const proceed = confirm('Have you run the SQL reset script in Supabase? Click OK to continue.');
  if (!proceed) {
    console.log('❌ Test cancelled');
    return;
  }
  
  // Get bar ID from current user
  const response = await fetch('/api/mpesa-settings?barId=438c80c1-fe11-4ac5-8a48-2fc45104ba31');
  const currentState = await response.json();
  console.log('📊 Current state after reset:', currentState);
  
  // Step 2: Save M-Pesa credentials
  console.log('💾 Step 2: Saving M-Pesa credentials...');
  
  // Use the credentials you provided
  const credentials = {
    barId: '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
    mpesa_enabled: true,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '174379',
    mpesa_consumer_key: 'YOUR_CONSUMER_KEY_HERE',  // Replace with actual
    mpesa_consumer_secret: 'YOUR_CONSUMER_SECRET_HERE',  // Replace with actual
    mpesa_passkey: 'YOUR_PASSKEY_HERE'  // Replace with actual
  };
  
  console.log('📤 Saving credentials...');
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
  const verifyResponse = await fetch('/api/mpesa-settings?barId=438c80c1-fe11-4ac5-8a48-2fc45104ba31');
  const verifyResult = await verifyResponse.json();
  console.log('✅ Verification result:', verifyResult);
  
  // Step 4: Test M-Pesa API
  console.log('🧪 Step 4: Testing M-Pesa API...');
  const testResponse = await fetch('/api/payments/mpesa/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barId: '438c80c1-fe11-4ac5-8a48-2fc45104ba31' })
  });
  
  const testResult = await testResponse.json();
  console.log('🧪 Test result:', testResult);
  
  if (testResponse.ok) {
    console.log('✅ M-Pesa setup completed successfully!');
    console.log('🎉 You can now process M-Pesa payments');
  } else {
    console.error('❌ M-Pesa test failed:', testResult.error);
    console.log('🔧 Check your credentials and try again');
  }
}

// Instructions
console.log(`
🚀 M-Pesa Setup Test Instructions:

1. First run the database reset SQL in Supabase SQL Editor
2. Update the credentials in this script with your real M-Pesa credentials
3. Run: testCompleteMpesaSetup()

The test will:
- Reset database state
- Save your M-Pesa credentials (encrypted)
- Verify they were saved correctly
- Test the M-Pesa API connection
- Confirm setup is complete
`);