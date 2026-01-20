// Complete M-Pesa Debug and Fix Script
// Run this in browser console on staff settings page

async function debugAndFixMpesa() {
  console.log('🔍 Starting M-Pesa debug and fix process...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    // Step 1: Check current database state
    console.log('📊 Step 1: Checking current database state...');
    const currentStateResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const currentState = await currentStateResponse.json();
    console.log('Current state:', currentState);
    
    if (currentState.settings?.has_credentials) {
      console.log('⚠️ Found existing credentials - they may be in wrong format');
      console.log('🧹 You need to run the database cleanup script first');
      console.log(`
📋 Run this SQL in Supabase SQL Editor:

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
WHERE id = '${barId}';
      `);
      
      const proceed = confirm('Have you run the database cleanup SQL? Click OK to continue with fresh setup.');
      if (!proceed) {
        console.log('❌ Please run the cleanup SQL first, then try again');
        return;
      }
    }
    
    // Step 2: Save new credentials with proper encryption
    console.log('💾 Step 2: Saving M-Pesa credentials with proper encryption...');
    
    const credentials = {
      barId: barId,
      mpesa_enabled: true,
      mpesa_environment: 'sandbox',
      mpesa_business_shortcode: '174379',
      mpesa_consumer_key: 'test_consumer_key_123456789',  // Test key
      mpesa_consumer_secret: 'test_consumer_secret_123456789',  // Test secret
      mpesa_passkey: 'test_passkey_123456789'  // Test passkey
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
    
    // Step 3: Verify credentials were saved properly
    console.log('🔍 Step 3: Verifying credentials were saved...');
    const verifyResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const verifyResult = await verifyResponse.json();
    console.log('✅ Verification result:', verifyResult);
    
    if (!verifyResult.settings?.has_credentials) {
      console.error('❌ Credentials were not saved properly');
      return;
    }
    
    // Step 4: Test M-Pesa API with new credentials
    console.log('🧪 Step 4: Testing M-Pesa API...');
    const testResponse = await fetch('/api/payments/mpesa/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barId: barId })
    });
    
    const testResult = await testResponse.json();
    console.log('🧪 Test result:', testResult);
    
    if (testResponse.ok) {
      console.log('✅ SUCCESS! M-Pesa setup is working correctly!');
      console.log('🎉 You can now process M-Pesa payments');
      
      // Step 5: Final verification
      const finalCheck = await fetch(`/api/mpesa-settings?barId=${barId}`);
      const finalResult = await finalCheck.json();
      console.log('🏁 Final status:', {
        mpesa_enabled: finalResult.settings.mpesa_enabled,
        mpesa_setup_completed: finalResult.settings.mpesa_setup_completed,
        mpesa_test_status: finalResult.settings.mpesa_test_status,
        has_credentials: finalResult.settings.has_credentials
      });
      
    } else {
      console.error('❌ M-Pesa test failed:', testResult.error);
      console.log('🔧 Debug info:', testResult.details);
      
      // Check if it's still a decryption error
      if (testResult.error?.includes('decrypt')) {
        console.log('🚨 Still getting decryption error - this means:');
        console.log('1. The encryption key might be different between save and test');
        console.log('2. The database cleanup might not have worked');
        console.log('3. There might be caching issues');
        
        console.log('🔧 Try these steps:');
        console.log('1. Check MPESA_ENCRYPTION_KEY environment variable');
        console.log('2. Restart the development server');
        console.log('3. Clear browser cache and try again');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Instructions
console.log(`
🚀 M-Pesa Debug and Fix Script Ready!

This script will:
1. Check current database state
2. Guide you through database cleanup if needed
3. Save new credentials with proper encryption
4. Test the M-Pesa API
5. Verify everything is working

Run: debugAndFixMpesa()
`);

// Auto-run if you want
// debugAndFixMpesa();