// Quick M-Pesa Fix - Run in browser console
// This will reset and properly set up M-Pesa credentials

async function quickMpesaFix() {
  console.log('🔧 Quick M-Pesa Fix Starting...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  // Step 1: Reset M-Pesa settings to clear any bad data
  console.log('🧹 Step 1: Resetting M-Pesa settings...');
  
  const resetData = {
    barId: barId,
    mpesa_enabled: false,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '',
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_passkey: ''
  };
  
  const resetResponse = await fetch('/api/mpesa-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resetData)
  });
  
  const resetResult = await resetResponse.json();
  console.log('🧹 Reset result:', resetResult);
  
  // Step 2: Set up fresh credentials
  console.log('💾 Step 2: Setting up fresh credentials...');
  
  const freshCredentials = {
    barId: barId,
    mpesa_enabled: true,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '174379',
    mpesa_consumer_key: 'sandbox_consumer_key_12345',
    mpesa_consumer_secret: 'sandbox_consumer_secret_12345',
    mpesa_passkey: 'sandbox_passkey_12345'
  };
  
  const setupResponse = await fetch('/api/mpesa-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(freshCredentials)
  });
  
  const setupResult = await setupResponse.json();
  console.log('💾 Setup result:', setupResult);
  
  if (!setupResponse.ok) {
    console.error('❌ Setup failed:', setupResult.error);
    return;
  }
  
  // Step 3: Test the credentials
  console.log('🧪 Step 3: Testing credentials...');
  
  const testResponse = await fetch('/api/payments/mpesa/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barId: barId })
  });
  
  const testResult = await testResponse.json();
  console.log('🧪 Test result:', testResult);
  
  if (testResponse.ok) {
    console.log('✅ SUCCESS! M-Pesa is now working correctly!');
  } else {
    console.error('❌ Test failed:', testResult.error);
    
    if (testResult.error?.includes('decrypt')) {
      console.log('🚨 Still getting decryption error. This could be:');
      console.log('1. Environment variable MPESA_ENCRYPTION_KEY is not set properly');
      console.log('2. Server needs to be restarted');
      console.log('3. Database still has old data');
      
      console.log('🔧 Try running this SQL in Supabase:');
      console.log(`
UPDATE bars 
SET 
  mpesa_consumer_key_encrypted = null,
  mpesa_consumer_secret_encrypted = null,
  mpesa_passkey_encrypted = null,
  mpesa_setup_completed = false
WHERE id = '${barId}';
      `);
    }
  }
}

// Run the fix
console.log('🚀 Quick M-Pesa Fix Ready! Run: quickMpesaFix()');

// Auto-run
quickMpesaFix();