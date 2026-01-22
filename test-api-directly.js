/**
 * Test API Directly
 * Test the payment settings API without needing the customer app to be running
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAPIDirectly() {
  console.log('🧪 Testing Payment Settings API Logic Directly');
  console.log('==============================================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  
  try {
    console.log(`🔍 Testing for bar ID: ${barId}`);
    
    // Step 1: Get bar payment settings (same as API)
    console.log('\n📊 Step 1: Fetching bar data...');
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled, payment_mpesa_enabled')
      .eq('id', barId)
      .single();

    if (barError) {
      console.error('❌ Error fetching bar data:', barError);
      return;
    }

    if (!barData) {
      console.error('❌ Bar not found');
      return;
    }

    console.log(`✅ Bar found: ${barData.name}`);
    console.log(`   mpesa_enabled: ${barData.mpesa_enabled}`);
    console.log(`   payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);

    // Step 2: Check M-Pesa credentials (same as API)
    console.log('\n📊 Step 2: Fetching M-Pesa credentials...');
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('is_active, environment, business_shortcode')
      .eq('tenant_id', barId)
      .maybeSingle();

    if (credError) {
      console.error('❌ Error fetching credentials:', credError);
      return;
    }

    if (credData) {
      console.log(`✅ Credentials found:`);
      console.log(`   is_active: ${credData.is_active}`);
      console.log(`   environment: ${credData.environment}`);
      console.log(`   business_shortcode: ${credData.business_shortcode}`);
    } else {
      console.log('⚠️ No M-Pesa credentials found');
    }

    // Step 3: Apply API logic
    console.log('\n🧮 Step 3: Applying API logic...');
    const mpesaAvailable = (credData?.is_active === true) || 
                          (barData.mpesa_enabled === true) || 
                          (barData.payment_mpesa_enabled === true);

    console.log(`   credData?.is_active === true: ${credData?.is_active === true}`);
    console.log(`   barData.mpesa_enabled === true: ${barData.mpesa_enabled === true}`);
    console.log(`   barData.payment_mpesa_enabled === true: ${barData.payment_mpesa_enabled === true}`);
    console.log(`   Final result: mpesaAvailable = ${mpesaAvailable}`);

    // Step 4: Show API response
    console.log('\n📋 Step 4: API Response:');
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

    // Step 5: Customer app behavior
    console.log('\n🎯 Step 5: Customer App Behavior:');
    if (mpesaAvailable) {
      console.log('✅ Customer app WILL show M-Pesa payment option');
      console.log(`   Environment: ${credData?.environment || 'sandbox'}`);
    } else {
      console.log('❌ Customer app will NOT show M-Pesa payment option');
      console.log('🔧 To fix this:');
      if (!credData) {
        console.log('   1. Configure M-Pesa in staff app');
      } else if (!credData.is_active) {
        console.log('   1. Enable M-Pesa in staff app');
      }
      console.log('   2. Or run the sync fix script');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAPIDirectly().then(() => {
  console.log('\n✨ Direct API test completed');
}).catch(console.error);