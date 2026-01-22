/**
 * Debug M-Pesa Visibility Issue
 * Comprehensive check of why M-Pesa is not showing in customer app
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMpesaVisibility() {
  console.log('🔍 Debug M-Pesa Visibility Issue');
  console.log('=================================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    // Step 1: Check bars table (what customer app sees)
    console.log('📊 Step 1: Customer App Data Source (bars table)');
    console.log('------------------------------------------------');
    
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (barError) {
      console.error('❌ Error fetching bar data:', barError.message);
      return;
    }
    
    console.log(`Bar Name: ${barData.name}`);
    console.log(`bars.mpesa_enabled: ${barData.mpesa_enabled}`);
    console.log(`bars.payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);
    
    // Step 2: Check mpesa_credentials table (what staff app uses)
    console.log('\n📊 Step 2: Staff App Data Source (mpesa_credentials table)');
    console.log('----------------------------------------------------------');
    
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment, business_shortcode, consumer_key, created_at, updated_at')
      .eq('tenant_id', barId)
      .maybeSingle();
    
    if (credError) {
      console.error('❌ Error fetching credentials:', credError.message);
      return;
    }
    
    if (credData) {
      console.log(`✅ M-Pesa credentials found:`);
      console.log(`   is_active: ${credData.is_active}`);
      console.log(`   environment: ${credData.environment}`);
      console.log(`   business_shortcode: ${credData.business_shortcode}`);
      console.log(`   has_consumer_key: ${credData.consumer_key ? 'YES' : 'NO'}`);
      console.log(`   created_at: ${credData.created_at}`);
      console.log(`   updated_at: ${credData.updated_at}`);
    } else {
      console.log('❌ No M-Pesa credentials found');
    }
    
    // Step 3: Simulate customer app API logic
    console.log('\n🧮 Step 3: Customer App API Logic Simulation');
    console.log('---------------------------------------------');
    
    const mpesaAvailable = barData.mpesa_enabled === true || barData.payment_mpesa_enabled === true;
    
    console.log(`Logic: barData.mpesa_enabled === true || barData.payment_mpesa_enabled === true`);
    console.log(`       ${barData.mpesa_enabled} === true || ${barData.payment_mpesa_enabled} === true`);
    console.log(`       ${barData.mpesa_enabled === true} || ${barData.payment_mpesa_enabled === true}`);
    console.log(`Result: ${mpesaAvailable}`);
    
    // Step 4: Show what customer app will see
    console.log('\n📱 Step 4: Customer App Behavior');
    console.log('--------------------------------');
    
    if (mpesaAvailable) {
      console.log('✅ Customer app WILL show M-Pesa payment option');
      console.log('   - M-Pesa button will be enabled');
      console.log('   - Environment will show as "sandbox"');
      console.log('   - Pay button will say "Pay with M-PESA"');
    } else {
      console.log('❌ Customer app will NOT show M-Pesa payment option');
      console.log('   - M-Pesa button will be disabled/grayed out');
      console.log('   - Will show "M-Pesa not enabled for this bar"');
      console.log('   - Pay button will say "M-PESA Not Available"');
    }
    
    // Step 5: Show staff app behavior
    console.log('\n🏢 Step 5: Staff App Behavior');
    console.log('-----------------------------');
    
    if (credData) {
      if (credData.is_active) {
        console.log('✅ Staff app shows M-Pesa as ACTIVE');
        console.log('   - Toggle switch is ON');
        console.log('   - Can process payments');
      } else {
        console.log('⚠️ Staff app shows M-Pesa as INACTIVE');
        console.log('   - Toggle switch is OFF');
        console.log('   - Cannot process payments');
      }
    } else {
      console.log('❌ Staff app shows M-Pesa as NOT CONFIGURED');
      console.log('   - No credentials set up');
      console.log('   - Need to configure M-Pesa first');
    }
    
    // Step 6: Sync analysis
    console.log('\n🔄 Step 6: Sync Analysis');
    console.log('------------------------');
    
    if (credData) {
      const staffSays = credData.is_active;
      const customerSees = mpesaAvailable;
      
      if (staffSays === customerSees) {
        console.log('✅ SYNCHRONIZED: Staff and customer apps are in sync');
      } else {
        console.log('❌ OUT OF SYNC: Staff and customer apps show different states');
        console.log(`   Staff app: M-Pesa is ${staffSays ? 'ACTIVE' : 'INACTIVE'}`);
        console.log(`   Customer app: M-Pesa is ${customerSees ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
        console.log('\n🔧 SOLUTION: Run sync fix to update bars table');
      }
    } else {
      if (mpesaAvailable) {
        console.log('⚠️ INCONSISTENT: Customer shows M-Pesa available but no credentials exist');
        console.log('   This might be from old data or manual database changes');
      } else {
        console.log('✅ CONSISTENT: No credentials and customer app correctly hides M-Pesa');
      }
    }
    
    // Step 7: Recommendations
    console.log('\n💡 Step 7: Recommendations');
    console.log('--------------------------');
    
    if (!mpesaAvailable && credData?.is_active) {
      console.log('🔧 ISSUE: Staff app shows active but customer app won\'t show M-Pesa');
      console.log('   SOLUTION: Run this SQL to sync:');
      console.log('   UPDATE bars SET mpesa_enabled = true, payment_mpesa_enabled = true');
      console.log(`   WHERE id = '${barId}';`);
    } else if (mpesaAvailable && !credData?.is_active) {
      console.log('🔧 ISSUE: Customer app shows M-Pesa but staff app shows inactive');
      console.log('   SOLUTION: Either activate in staff app or disable in customer app');
    } else if (!credData) {
      console.log('🔧 ISSUE: No M-Pesa credentials configured');
      console.log('   SOLUTION: Configure M-Pesa in staff app first');
    } else if (mpesaAvailable && credData.is_active) {
      console.log('✅ EVERYTHING LOOKS GOOD: M-Pesa should be visible in customer app');
      console.log('   If still not visible, check:');
      console.log('   1. Customer app is using the updated code');
      console.log('   2. Browser cache is cleared');
      console.log('   3. API endpoint is working');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugMpesaVisibility().then(() => {
  console.log('\n✨ Debug completed');
}).catch(console.error);