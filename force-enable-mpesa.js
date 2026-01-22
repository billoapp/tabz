/**
 * Force Enable M-Pesa
 * This script will force enable M-Pesa for testing purposes
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceEnableMpesa() {
  console.log('🔧 Force Enable M-Pesa for Testing');
  console.log('==================================');
  
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
    
    console.log(`Bar: ${barData.name}`);
    console.log(`bars.mpesa_enabled: ${barData.mpesa_enabled}`);
    console.log(`bars.payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);
    
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment')
      .eq('tenant_id', barId)
      .maybeSingle();
    
    if (credError) {
      console.error('❌ Error fetching credentials:', credError.message);
      return;
    }
    
    if (credData) {
      console.log(`mpesa_credentials.is_active: ${credData.is_active}`);
    } else {
      console.log('mpesa_credentials: NOT FOUND');
    }
    
    // Step 2: Force enable in bars table
    console.log('\n🔧 Force enabling M-Pesa in bars table...');
    
    const { error: updateBarError } = await supabase
      .from('bars')
      .update({
        mpesa_enabled: true,
        payment_mpesa_enabled: true
      })
      .eq('id', barId);
    
    if (updateBarError) {
      console.error('❌ Failed to update bars table:', updateBarError.message);
      return;
    }
    
    console.log('✅ Updated bars table');
    
    // Step 3: Force enable in credentials table if it exists
    if (credData) {
      console.log('🔧 Force enabling M-Pesa in credentials table...');
      
      const { error: updateCredError } = await supabase
        .from('mpesa_credentials')
        .update({
          is_active: true
        })
        .eq('tenant_id', barId);
      
      if (updateCredError) {
        console.error('❌ Failed to update credentials table:', updateCredError.message);
        return;
      }
      
      console.log('✅ Updated credentials table');
    } else {
      console.log('⚠️ No credentials to update');
    }
    
    // Step 4: Verify the changes
    console.log('\n🔍 Verification:');
    
    const { data: verifyBarData, error: verifyBarError } = await supabase
      .from('bars')
      .select('mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (verifyBarError) {
      console.error('❌ Verification failed:', verifyBarError.message);
      return;
    }
    
    const { data: verifyCredData, error: verifyCredError } = await supabase
      .from('mpesa_credentials')
      .select('is_active')
      .eq('tenant_id', barId)
      .maybeSingle();
    
    if (verifyCredError) {
      console.error('❌ Credentials verification failed:', verifyCredError.message);
      return;
    }
    
    console.log(`bars.mpesa_enabled: ${verifyBarData.mpesa_enabled}`);
    console.log(`bars.payment_mpesa_enabled: ${verifyBarData.payment_mpesa_enabled}`);
    console.log(`mpesa_credentials.is_active: ${verifyCredData ? verifyCredData.is_active : 'N/A'}`);
    
    // Step 5: Test API logic
    console.log('\n🧪 Testing API Logic:');
    const mpesaAvailable = (verifyCredData?.is_active === true) || 
                          (verifyBarData.mpesa_enabled === true) || 
                          (verifyBarData.payment_mpesa_enabled === true);
    
    console.log(`API will return mpesa.available: ${mpesaAvailable}`);
    
    if (mpesaAvailable) {
      console.log('\n🎉 SUCCESS! Customer app should now show M-Pesa payment option');
    } else {
      console.log('\n❌ FAILED! Something is still wrong');
    }
    
  } catch (error) {
    console.error('❌ Force enable failed:', error.message);
  }
}

// Run the fix
forceEnableMpesa().then(() => {
  console.log('\n✨ Force enable completed');
}).catch(console.error);