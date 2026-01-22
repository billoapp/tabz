/**
 * Debug Payment Settings
 * Check the database state and test the API
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPaymentSettings() {
  console.log('🔍 Debug Payment Settings');
  console.log('=========================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    // Step 1: Check database state
    console.log('📊 Database State:');
    
    // Check bars table
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
    
    // Check mpesa_credentials table
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment, business_shortcode')
      .eq('tenant_id', barId)
      .maybeSingle();
    
    if (credError) {
      console.error('❌ Error fetching credentials:', credError.message);
      return;
    }
    
    if (credData) {
      console.log(`mpesa_credentials.is_active: ${credData.is_active}`);
      console.log(`mpesa_credentials.environment: ${credData.environment}`);
      console.log(`mpesa_credentials.business_shortcode: ${credData.business_shortcode}`);
    } else {
      console.log('mpesa_credentials: NOT FOUND');
    }
    
    // Step 2: Simulate API logic
    console.log('\n🧮 API Logic Simulation:');
    const mpesaAvailable = (credData?.is_active === true) || 
                          (barData.mpesa_enabled === true) || 
                          (barData.payment_mpesa_enabled === true);
    
    console.log(`credData?.is_active === true: ${credData?.is_active === true}`);
    console.log(`barData.mpesa_enabled === true: ${barData.mpesa_enabled === true}`);
    console.log(`barData.payment_mpesa_enabled === true: ${barData.payment_mpesa_enabled === true}`);
    console.log(`Final mpesaAvailable: ${mpesaAvailable}`);
    
    // Step 3: Show what the API would return
    console.log('\n📋 API Response Would Be:');
    const apiResponse = {
      success: true,
      barId: barData.id,
      barName: barData.name,
      paymentMethods: {
        mpesa: {
          available: mpesaAvailable,
          environment: credData?.environment || 'sandbox'
        },
        card: {
          available: false,
          reason: 'Coming soon'
        },
        airtel: {
          available: false,
          reason: 'Coming soon'
        }
      }
    };
    
    console.log(JSON.stringify(apiResponse, null, 2));
    
    // Step 4: Recommendations
    console.log('\n💡 Recommendations:');
    if (!mpesaAvailable) {
      console.log('❌ M-Pesa will NOT be shown in customer app');
      console.log('🔧 To fix:');
      if (!credData) {
        console.log('   1. Configure M-Pesa credentials in staff app');
      } else if (!credData.is_active) {
        console.log('   1. Enable M-Pesa in staff app (set is_active = true)');
      }
      console.log('   2. Or manually set bars.mpesa_enabled = true');
    } else {
      console.log('✅ M-Pesa WILL be shown in customer app');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugPaymentSettings().then(() => {
  console.log('\n✨ Debug completed');
}).catch(console.error);