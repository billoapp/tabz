// Debug M-Pesa credentials storage and retrieval
// Run this in browser console

async function debugMpesaCredentials() {
    console.log('🔍 Debugging M-Pesa Credentials Storage');
    
    const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
    
    try {
        // Step 1: Check what's in the database
        console.log('📋 Step 1: Checking M-Pesa GET endpoint...');
        const getResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
        const getResult = await getResponse.json();
        
        if (getResponse.ok) {
            console.log('✅ M-Pesa GET result:', getResult);
            console.log('Has credentials:', getResult.settings?.has_credentials);
            console.log('Environment:', getResult.settings?.mpesa_environment);
            console.log('Business shortcode:', getResult.settings?.mpesa_business_shortcode);
            console.log('Enabled:', getResult.settings?.mpesa_enabled);
        } else {
            console.log('❌ M-Pesa GET failed:', getResult);
        }
        
        // Step 2: Try to save credentials again
        console.log('💾 Step 2: Saving M-Pesa credentials...');
        const saveData = {
            barId: barId,
            mpesa_enabled: true,
            mpesa_environment: 'sandbox',
            mpesa_business_shortcode: '174379',
            mpesa_consumer_key: 'test_consumer_key_12345',
            mpesa_consumer_secret: 'test_consumer_secret_12345',
            mpesa_passkey: 'test_passkey_12345'
        };
        
        const saveResponse = await fetch('/api/mpesa-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
        });
        
        const saveResult = await saveResponse.json();
        
        if (saveResponse.ok) {
            console.log('✅ M-Pesa save successful:', saveResult);
        } else {
            console.log('❌ M-Pesa save failed:', saveResult);
            return;
        }
        
        // Step 3: Check GET again after save
        console.log('🔍 Step 3: Checking GET after save...');
        const getResponse2 = await fetch(`/api/mpesa-settings?barId=${barId}`);
        const getResult2 = await getResponse2.json();
        
        if (getResponse2.ok) {
            console.log('✅ M-Pesa GET after save:', getResult2);
            console.log('Has credentials now:', getResult2.settings?.has_credentials);
        } else {
            console.log('❌ M-Pesa GET after save failed:', getResult2);
        }
        
        // Step 4: Try test endpoint
        console.log('🧪 Step 4: Testing credentials...');
        const testResponse = await fetch('/api/payments/mpesa/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barId: barId })
        });
        
        const testResult = await testResponse.json();
        
        if (testResponse.ok) {
            console.log('✅ M-Pesa test successful:', testResult);
        } else {
            console.log('❌ M-Pesa test failed:', testResult);
            console.log('Status:', testResponse.status);
        }
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

// Auto-run
console.log('🚀 M-Pesa Credentials Debug Ready!');
debugMpesaCredentials();