// Debug user bar access for M-Pesa setup
// Run this in browser console to check RLS permissions

async function debugUserBarAccess() {
    console.log('🔍 Debugging User Bar Access');
    
    const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
    
    try {
        // Check current user
        console.log('👤 Checking current user...');
        const userResponse = await fetch('/api/auth/user');
        if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('Current user:', userData);
        } else {
            console.log('❌ No user session found');
        }
        
        // Check user_bars access directly
        console.log('🏢 Checking user_bars access...');
        
        // This should work if RLS is properly configured
        const checkAccess = await fetch('/api/check-bar-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barId: barId })
        });
        
        if (checkAccess.ok) {
            const accessResult = await checkAccess.json();
            console.log('✅ Bar access check:', accessResult);
        } else {
            console.log('❌ Bar access check failed:', await checkAccess.text());
        }
        
        // Try the M-Pesa settings GET endpoint
        console.log('⚙️ Testing M-Pesa settings GET...');
        const settingsResponse = await fetch(`/api/mpesa-settings?barId=${barId}`);
        const settingsResult = await settingsResponse.json();
        
        if (settingsResponse.ok) {
            console.log('✅ M-Pesa settings accessible:', settingsResult);
        } else {
            console.log('❌ M-Pesa settings access denied:', settingsResult);
        }
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

// Auto-run
console.log('🚀 User Bar Access Debug Ready!');
debugUserBarAccess();