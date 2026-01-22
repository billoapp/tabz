// Diagnose M-Pesa Save Issue
// This will help identify why credentials aren't being saved

async function diagnoseSaveIssue() {
  console.log('🔍 Diagnosing M-Pesa save issue...');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  // Test 1: Try saving with minimal data first
  console.log('📝 Test 1: Saving minimal data (just enabled flag)...');
  
  const minimalData = {
    barId: barId,
    mpesa_enabled: true,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '174379'
    // No credentials - just basic fields
  };
  
  try {
    const response1 = await fetch('/api/mpesa-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalData)
    });
    
    const result1 = await response1.json();
    console.log('📊 Minimal save result:', response1.status, result1);
    
    // Check if minimal data was saved
    const check1 = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const checkResult1 = await check1.json();
    console.log('📊 After minimal save:', {
      mpesa_enabled: checkResult1.settings?.mpesa_enabled,
      business_shortcode: checkResult1.settings?.mpesa_business_shortcode
    });
    
    // Test 2: Try saving with credentials
    console.log('📝 Test 2: Saving with credentials...');
    
    const fullData = {
      barId: barId,
      mpesa_enabled: true,
      mpesa_environment: 'sandbox',
      mpesa_business_shortcode: '174379',
      mpesa_consumer_key: 'test_key_1234567890',
      mpesa_consumer_secret: 'test_secret_1234567890',
      mpesa_passkey: 'test_passkey_1234567890'
    };
    
    const response2 = await fetch('/api/mpesa-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullData)
    });
    
    const result2 = await response2.json();
    console.log('📊 Full save result:', response2.status, result2);
    
    // Check if credentials were saved
    const check2 = await fetch(`/api/mpesa-settings?barId=${barId}`);
    const checkResult2 = await check2.json();
    console.log('📊 After full save:', {
      mpesa_enabled: checkResult2.settings?.mpesa_enabled,
      has_credentials: checkResult2.settings?.has_credentials,
      business_shortcode: checkResult2.settings?.mpesa_business_shortcode
    });
    
    // Test 3: Check server logs by making a request that should log
    console.log('📝 Test 3: Checking server-side logging...');
    
    // Make another request to trigger server logs
    const response3 = await fetch('/api/mpesa-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barId: barId,
        mpesa_enabled: true,
        mpesa_environment: 'sandbox',
        mpesa_business_shortcode: '174379',
        mpesa_consumer_key: 'debug_key_12345678901234567890',
        mpesa_consumer_secret: 'debug_secret_12345678901234567890',
        mpesa_passkey: 'debug_passkey_12345678901234567890'
      })
    });
    
    const result3 = await response3.json();
    console.log('📊 Debug save result:', response3.status, result3);
    
    console.log('🔍 Analysis:');
    
    if (result1.success && !checkResult1.settings?.mpesa_enabled) {
      console.log('❌ Issue: API returns success but database not updated');
      console.log('🔧 Likely causes:');
      console.log('  1. RLS (Row Level Security) policy blocking update');
      console.log('  2. Database permissions issue');
      console.log('  3. Silent database error');
    }
    
    if (result2.success && !checkResult2.settings?.has_credentials) {
      console.log('❌ Issue: Credentials not saved despite success');
      console.log('🔧 Likely causes:');
      console.log('  1. Encryption error (silent failure)');
      console.log('  2. Database column constraints');
      console.log('  3. Transaction rollback');
    }
    
    console.log('📋 Next steps:');
    console.log('1. Check your development server console for error logs');
    console.log('2. Check Supabase dashboard for failed queries');
    console.log('3. Verify RLS policies on bars table');
    console.log('4. Check MPESA_ENCRYPTION_KEY environment variable');
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

// Run diagnosis
console.log('🚀 M-Pesa Save Issue Diagnosis Ready!');
console.log('This will test different save scenarios to identify the problem.');
console.log('Run: diagnoseSaveIssue()');

diagnoseSaveIssue();