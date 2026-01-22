/**
 * Fix M-Pesa Sync Issue
 * Use the MpesaSyncManager to repair the sync between staff and customer apps
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMpesaSync() {
  console.log('🔧 Fixing M-Pesa Sync Issue');
  console.log('===========================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    // First, check current state
    console.log('📊 Current State:');
    
    // Check bars table
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (barError) {
      console.error('❌ Error fetching bar data:', barError.message);
      return;
    }
    
    console.log(`   Bar: ${barData.name}`);
    console.log(`   bars.mpesa_enabled: ${barData.mpesa_enabled}`);
    console.log(`   bars.payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);
    
    // Check mpesa_credentials table
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment')
      .eq('tenant_id', barId)
      .maybeSingle();
    
    if (credError) {
      console.error('❌ Error fetching credentials:', credError.message);
      return;
    }
    
    if (!credData) {
      console.log('   ⚠️ No M-Pesa credentials found');
      console.log('\n🔧 Action: Setting bars.mpesa_enabled to false (no credentials)');
      
      const { error: updateError } = await supabase
        .from('bars')
        .update({ 
          mpesa_enabled: false,
          payment_mpesa_enabled: false 
        })
        .eq('id', barId);
      
      if (updateError) {
        console.error('❌ Failed to update bar:', updateError.message);
      } else {
        console.log('✅ Updated bars table - M-Pesa disabled (no credentials)');
      }
      return;
    }
    
    console.log(`   mpesa_credentials.is_active: ${credData.is_active}`);
    console.log(`   mpesa_credentials.environment: ${credData.environment}`);
    
    // Determine if sync is needed
    const authoritativeStatus = credData.is_active;
    const currentBarStatus = barData.mpesa_enabled;
    const currentPaymentStatus = barData.payment_mpesa_enabled;
    
    console.log('\n🔍 Analysis:');
    console.log(`   Authoritative source (credentials): ${authoritativeStatus}`);
    console.log(`   Current bar status: ${currentBarStatus}`);
    console.log(`   Current payment status: ${currentPaymentStatus}`);
    
    if (currentBarStatus === authoritativeStatus && currentPaymentStatus === authoritativeStatus) {
      console.log('   ✅ Already synchronized!');
      return;
    }
    
    console.log('   ❌ Out of sync - fixing now...');
    
    // Update bars table to match credentials
    const { error: syncError } = await supabase
      .from('bars')
      .update({ 
        mpesa_enabled: authoritativeStatus,
        payment_mpesa_enabled: authoritativeStatus 
      })
      .eq('id', barId);
    
    if (syncError) {
      console.error('❌ Failed to sync:', syncError.message);
      return;
    }
    
    console.log('✅ Sync completed successfully!');
    
    // Verify the fix
    console.log('\n🔍 Verification:');
    const { data: verifyData, error: verifyError } = await supabase
      .from('bars')
      .select('mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else {
      console.log(`   bars.mpesa_enabled: ${verifyData.mpesa_enabled}`);
      console.log(`   bars.payment_mpesa_enabled: ${verifyData.payment_mpesa_enabled}`);
      console.log(`   mpesa_credentials.is_active: ${credData.is_active}`);
      
      if (verifyData.mpesa_enabled === credData.is_active && verifyData.payment_mpesa_enabled === credData.is_active) {
        console.log('   ✅ Verification passed - sync is working!');
      } else {
        console.log('   ❌ Verification failed - still out of sync');
      }
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

fixMpesaSync().catch(console.error);