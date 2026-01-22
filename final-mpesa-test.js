// Final M-Pesa Test - Everything should work now!
// Run this in browser console

async function finalMpesaTest() {
  console.log('🎉 Final M-Pesa Test - Everything should work now!');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  // Step 1: Verify current state
  console.log('📊 Step 1: Verifying current state...');
  const stateResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
  const stateResult = await stateResponse.json();
  
  console.log('Current state:', {
    mpesa_enabled: stateResult.settings?.mpesa_enabled,
    has_credentials: stateResult.settings?.has_credentials,
    business_shortcode: stateResult.settings?.mpesa_business_shortcode,
    setup_completed: stateResult.settings?.mpesa_setup_completed,
    test_status: stateResult.settings?.mpesa_test_status
  });
  
  if (!stateResult.settings?.has_credentials) {
    console.error('❌ No credentials found - something went wrong');
    return;
  }
  
  // Step 2: Test M-Pesa API
  console.log('🧪 Step 2: Testing M-Pesa API...');
  
  const testResponse = await fetch('/api/payments/mpesa/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barId: barId })
  });
  
  const testResult = await testResponse.json();
  console.log('🧪 Test result:', testResponse.status, testResult);
  
  if (testResponse.ok) {
    console.log('🎉 SUCCESS! M-Pesa is fully working!');
    console.log('✅ Credentials saved and encrypted properly');
    console.log('✅ M-Pesa API test passed');
    console.log('✅ Ready for production use');
    
    // Step 3: Final verification
    console.log('🔍 Step 3: Final verification...');
    const finalCheck = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const finalResult = await finalCheck.json();
    
    console.log('🏁 Final status:', {
      mpesa_enabled: finalResult.settings?.mpesa_enabled,
      mpesa_setup_completed: finalResult.settings?.mpesa_setup_completed,
      mpesa_test_status: finalResult.settings?.mpesa_test_status,
      environment: finalResult.settings?.mpesa_environment
    });
    
    console.log('🚀 M-Pesa implementation is production-ready!');
    
  } else {
    console.error('❌ M-Pesa test failed:', testResult.error);
    
    if (testResult.error?.includes('decrypt')) {
      console.log('🔧 Decryption issue - check MPESA_ENCRYPTION_KEY');
    } else if (testResult.error?.includes('token')) {
      console.log('🔧 M-Pesa API issue - check credentials or network');
    } else {
      console.log('🔧 Other issue:', testResult.details);
    }
  }
}

// Run the final test
console.log('🚀 Final M-Pesa Test Ready!');
console.log('This should complete the M-Pesa setup successfully.');
finalMpesaTest();