/**
 * Fix M-Pesa Sync - Final Solution
 * This will ensure customer app shows M-Pesa when staff app has it configured
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMpesaSyncFinal() {
  console.log('🔧 Fix M-Pesa Sync - Final Solution');
  console.log('===================================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    // Step 1: Check current state
    console.log('📊 Current State Check:');
    
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (barError) {
      console.error('❌ Error fetching bar:', barError.message);
      return;
    }
    
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment')
      .eq('tenant_id', barId)
      .maybeSingle();
    
    if (credError) {
      console.error('❌ Error fetching credentials:', credError.message);
      return;
    }
    
    console.log(`Bar: ${barData.name}`);
    console.log(`bars.mpesa_enabled: ${barData.mpesa_enabled}`);
    console.log(`bars.payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);
    console.log(`mpesa_credentials.is_active: ${credData ? credData.is_active : 'NOT FOUND'}`);
    
    // Step 2: Determine what the correct state should be
    const shouldBeEnabled = credData ? credData.is_active : false;
    console.log(`\n🎯 Target State: M-Pesa should be ${shouldBeEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    // Step 3: Update bars table to match credentials
    if (credData) {
      console.log('🔄 Syncing bars table with credentials...');
      
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          mpesa_enabled: credData.is_active,
          payment_mpesa_enabled: credData.is_active
        })
        .eq('id', barId);
      
      if (updateError) {
        console.error('❌ Failed to update bars table:', updateError.message);
        return;
      }
      
      console.log('✅ Bars table updated to match credentials');
    } else {
      console.log('🔄 No credentials found, disabling M-Pesa in bars table...');
      
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          mpesa_enabled: false,
          payment_mpesa_enabled: false
        })
        .eq('id', barId);
      
      if (updateError) {
        console.error('❌ Failed to update bars table:', updateError.message);
        return;
      }
      
      console.log('✅ Bars table updated - M-Pesa disabled (no credentials)');
    }
    
    // Step 4: Verify the fix
    console.log('\n🔍 Verification:');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('bars')
      .select('mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      return;
    }
    
    console.log(`bars.mpesa_enabled: ${verifyData.mpesa_enabled}`);
    console.log(`bars.payment_mpesa_enabled: ${verifyData.payment_mpesa_enabled}`);
    console.log(`mpesa_credentials.is_active: ${credData ? credData.is_active : 'N/A'}`);
    
    // Step 5: Test customer app logic
    console.log('\n🧪 Customer App Logic Test:');
    const customerWillShow = verifyData.mpesa_enabled === true || verifyData.payment_mpesa_enabled === true;
    console.log(`Customer app will show M-Pesa: ${customerWillShow}`);
    
    if (customerWillShow) {
      console.log('\n🎉 SUCCESS! Customer app should now show M-Pesa payment option');
      console.log('📱 Next steps:');
      console.log('   1. Refresh your customer app');
      console.log('   2. Clear browser cache if needed');
      console.log('   3. Navigate to payment page');
      console.log('   4. M-Pesa should be visible and enabled');
    } else {
      console.log('\n⚠️ Customer app will still not show M-Pesa');
      console.log('🔧 This means:');
      if (!credData) {
        console.log('   - No M-Pesa credentials are configured in staff app');
        console.log('   - Configure M-Pesa in staff app first');
      } else if (!credData.is_active) {
        console.log('   - M-Pesa credentials exist but are inactive');
        console.log('   - Enable M-Pesa in staff app settings');
      }
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

// Run the fix
fixMpesaSyncFinal().then(() => {
  console.log('\n✨ Fix completed');
}).catch(console.error);