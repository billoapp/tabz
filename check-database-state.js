// Check Database State Script
// Run this to see what's actually in the database

async function checkDatabaseState() {
  console.log('🔍 Checking M-Pesa database state...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    const response = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const result = await response.json();
    
    console.log('📊 Database State:', {
      success: result.success,
      mpesa_enabled: result.settings?.mpesa_enabled,
      mpesa_environment: result.settings?.mpesa_environment,
      mpesa_business_shortcode: result.settings?.mpesa_business_shortcode,
      has_consumer_key: !!result.settings?.mpesa_consumer_key,
      has_consumer_secret: !!result.settings?.mpesa_consumer_secret,
      has_passkey: !!result.settings?.mpesa_passkey,
      has_credentials: result.settings?.has_credentials,
      mpesa_setup_completed: result.settings?.mpesa_setup_completed,
      mpesa_test_status: result.settings?.mpesa_test_status
    });
    
    if (!result.settings?.has_credentials) {
      console.log('❌ No credentials found in database');
      console.log('🔧 This means either:');
      console.log('1. Credentials were never saved');
      console.log('2. Database was reset/cleared');
      console.log('3. Wrong bar ID being used');
    } else {
      console.log('✅ Credentials found in database');
      console.log('🔧 If test is still failing, it\'s likely a decryption issue');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

// Run the check
console.log('🚀 Database State Checker Ready! Run: checkDatabaseState()');
checkDatabaseState();