/**
 * Manual M-Pesa Sync Fix
 * Directly update the database to sync M-Pesa settings
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function manualSyncFix() {
  console.log('🔧 Manual M-Pesa Sync Fix');
  console.log('=========================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    // Step 1: Check current state
    console.log('📊 Current State:');
    
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
    
    if (credData) {
      console.log(`mpesa_credentials.is_active: ${credData.is_active}`);
      console.log(`mpesa_credentials.environment: ${credData.environment}`);
    } else {
      console.log('mpesa_credentials: NOT FOUND');
    }
    
    // Step 2: Determine correct state
    const shouldBeEnabled = credData ? credData.is_active : false;
    console.log(`\n🎯 Target State: M-Pesa should be ${shouldBeEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    // Step 3: Update bars table if needed
    if (barData.mpesa_enabled !== shouldBeEnabled || barData.payment_mpesa_enabled !== shouldBeEnabled) {
      console.log('🔄 Updating bars table...');
      
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          mpesa_enabled: shouldBeEnabled,
          payment_mpesa_enabled: shouldBeEnabled
        })
        .eq('id', barId);
      
      if (updateError) {
        console.error('❌ Update failed:', updateError.message);
        return;
      }
      
      console.log('✅ Bars table updated successfully');
    } else {
      console.log('✅ Bars table already in sync');
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
    
    const isNowSynced = verifyData.mpesa_enabled === shouldBeEnabled && 
                       verifyData.payment_mpesa_enabled === shouldBeEnabled;
    
    if (isNowSynced) {
      console.log('\n🎉 SUCCESS: M-Pesa sync is now fixed!');
      console.log(`Customer app will ${shouldBeEnabled ? 'SHOW' : 'HIDE'} M-Pesa payment option`);
      console.log(`Staff app shows M-Pesa as ${credData ? (credData.is_active ? 'ACTIVE' : 'INACTIVE') : 'NOT CONFIGURED'}`);
    } else {
      console.log('\n❌ FAILED: Sync is still broken');
    }
    
  } catch (error) {
    console.error('❌ Manual fix failed:', error.message);
  }
}

// Run the fix
manualSyncFix().then(() => {
  console.log('\n✨ Manual sync fix completed');
}).catch(console.error);