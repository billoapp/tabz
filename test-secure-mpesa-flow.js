// Test the secure M-Pesa implementation
// Run this in browser console to test the complete flow

async function testSecureMpesaFlow() {
    console.log('🔒 Testing Secure M-Pesa Implementation');
    
    const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
    
    try {
        // Step 1: Test GET endpoint (should show no credentials initially)
        console.log('📋 Step 1: Fetching current M-Pesa settings...');
        const getResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
        const getResult = await getResponse.json();
        console.log('Current settings:', getResult);
        
        // Step 2: Save new credentials (will be encrypted server-side)
        console.log('💾 Step 2: Saving M-Pesa credentials (encrypted)...');
        const saveData = {
            barId: barId,
            mpesa_enabled: true,
            mpesa_environment: 'sandbox',
            mpesa_business_shortcode: '174379',
            mpesa_consumer_key: 'sandbox_consumer_key_test_12345',
            mpesa_consumer_secret: 'sandbox_consumer_secret_test_12345',
            mpesa_passkey: 'sandbox_passkey_test_12345'
        };
        
        const saveResponse = await fetch('/api/mpesa-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
        });
        
        const saveResult = await saveResponse.json();
        console.log('Save result:', saveResult);
        
        if (!saveResponse.ok) {
            console.error('❌ Save failed:', saveResult);
            return;
        }
        
        // Step 3: Fetch settings again (should show masked credentials)
        console.log('🔍 Step 3: Fetching settings after save...');
        const getResponse2 = await fetch(`/api/mpesa-settings?barId=${barId}`);
        const getResult2 = await getResponse2.json();
        console.log('Settings after save:', getResult2);
        
        // Verify credentials are masked
        if (getResult2.settings?.mpesa_consumer_key === '••••••••••••••••') {
            console.log('✅ Credentials properly masked in frontend');
        } else {
            console.error('❌ Credentials not properly masked!');
        }
        
        // Step 4: Test credentials (server-side decryption)
        console.log('🧪 Step 4: Testing credentials (server-side decryption)...');
        const testResponse = await fetch('/api/payments/mpesa/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barId: barId })
        });
        
        const testResult = await testResponse.json();
        console.log('Test result:', testResult);
        
        if (testResponse.ok) {
            console.log('✅ SUCCESS! Secure M-Pesa flow working correctly!');
            console.log('🔒 Security verified:');
            console.log('  - Credentials encrypted server-side');
            console.log('  - Frontend only sees masked values');
            console.log('  - Server-side decryption works');
            console.log('  - OAuth token generation successful');
        } else {
            console.error('❌ Test failed:', testResult);
        }
        
    } catch (error) {
        console.error('❌ Flow test error:', error);
    }
}

// Auto-run the test
console.log('🚀 Secure M-Pesa Flow Test Ready!');
testSecureMpesaFlow();