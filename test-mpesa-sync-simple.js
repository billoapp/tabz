/**
 * Simple M-Pesa Sync Test
 * Check if M-Pesa settings are synchronized between staff and customer apps
 */

const { createClient } = require('@supabase/supabase-js');

// Use environment variables from the staff app
const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMpesaSync() {
  console.log('🔍 Testing M-Pesa Sync Status');
  console.log('============================');
  
  // Use a test bar ID - you can replace this with your actual bar ID
  const testBarId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    // Check bars table (what customer app sees)
    console.log('📱 CUSTOMER APP VIEW (bars table):');
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, payment_mpesa_enabled')
      .eq('id', testBarId)
      .single();
    
    if (barError) {
      console.log('❌ Error:', barError.message);
    } else {
      console.log(`   Bar: ${barData.name}`);
      console.log(`   mpesa_enabled: ${barData.mpesa_enabled}`);
      console.log(`   payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);
    }
    
    // Check mpesa_credentials table (what staff app uses)
    console.log('\n🏢 STAFF APP VIEW (mpesa_credentials table):');
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment, business_shortcode')
      .eq('tenant_id', testBarId)
      .maybeSingle();
    
    if (credError) {
      console.log('❌ Error:', credError.message);
    } else if (!credData) {
      console.log('   ⚠️ No M-Pesa credentials found');
    } else {
      console.log(`   is_active: ${credData.is_active}`);
      console.log(`   environment: ${credData.environment}`);
      console.log(`   business_shortcode: ${credData.business_shortcode}`);
    }
    
    // Analysis
    console.log('\n🔍 SYNC ANALYSIS:');
    if (barData && credData) {
      const customerSees = barData.mpesa_enabled || barData.payment_mpesa_enabled;
      const staffSees = credData.is_active;
      
      console.log(`   Customer app should see M-Pesa as: ${customerSees ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
      console.log(`   Staff app shows M-Pesa as: ${staffSees ? 'ACTIVE' : 'INACTIVE'}`);
      
      if (customerSees === staffSees) {
        console.log('   ✅ Status: SYNCHRONIZED');
      } else {
        console.log('   ❌ Status: OUT OF SYNC!');
        console.log('   🔧 Action needed: Sync the values');
      }
    } else if (!credData) {
      console.log('   ⚠️ M-Pesa credentials not configured - customer app should not show M-Pesa');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMpesaSync().catch(console.error);