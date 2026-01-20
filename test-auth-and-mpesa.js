// Test authentication and M-Pesa setup
// Run this in browser console

async function testAuthAndMpesa() {
    console.log('🔐 Testing Authentication and M-Pesa Setup');
    
    const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
    
    try {
        // Step 1: Test M-Pesa GET (should work with service role)
        console.log('📋 Step 1: Testing M-Pesa GET...');
        const getResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
        const getResult = await getResponse.json();
        
        if (getResponse.ok) {
            console.log('✅ M-Pesa GET works:', getResult);
        } else {
            console.log('❌ M-Pesa GET failed:', getResult);
        }
        
        // Step 2: Test M-Pesa POST (requires authentication)
        console.log('💾 Step 2: Testing M-Pesa POST...');
        const saveData = {
            barId: barId,
            mpesa_enabled: true,
            mpesa_environment: 'sandbox',
            mpesa_business_shortcode: '174379',
            mpesa_consumer_key: 'test_key_12345',
            mpesa_consumer_secret: 'test_secret_12345',
            mpesa_passkey: 'test_passkey_12345'
        };
        
        const saveResponse = await fetch('/api/mpesa-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
        });
        
        const saveResult = await saveResponse.json();
        
        if (saveResponse.ok) {
            console.log('✅ M-Pesa POST works:', saveResult);
        } else {
            console.log('❌ M-Pesa POST failed:', saveResult);
            
            if (saveResponse.status === 401) {
                console.log('🔑 Authentication issue detected');
                console.log('💡 Suggestion: Make sure you are logged in to the staff app');
            } else if (saveResponse.status === 403) {
                console.log('🚫 Access denied - user may not have access to this bar');
            }
        }
        
        // Step 3: Check current authentication state
        console.log('👤 Step 3: Checking authentication state...');
        
        // Try to access Supabase auth directly (if available)
        if (typeof window !== 'undefined' && window.supabase) {
            const { data: { user } } = await window.supabase.auth.getUser();
            console.log('🔍 Current user from client:', user);
        } else {
            console.log('ℹ️ Supabase client not available in window');
        }
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

// Auto-run
console.log('🚀 Auth and M-Pesa Test Ready!');
testAuthAndMpesa();