/**
 * Test API Error
 * Test what's causing the 500 error in payment-settings API
 */

const { createClient } = require('@supabase/supabase-js');

// Test with publishable key (what customer app uses)
const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const publishableKey = 'sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2';

const supabase = createClient(supabaseUrl, publishableKey);

async function testAPIError() {
  console.log('🧪 Testing Payment Settings API Error');
  console.log('====================================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    console.log('📡 Testing bars table access with publishable key...');
    
    // This is what the API is trying to do
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled')
      .eq('id', barId)
      .single();
    
    if (barError) {
      console.error('❌ Error accessing bars table:', barError);
      console.log('🔍 Error details:', {
        code: barError.code,
        message: barError.message,
        details: barError.details,
        hint: barError.hint
      });
      
      console.log('\n💡 This is likely the cause of the 500 error!');
      console.log('🔧 Solution: The bars table needs to be accessible to anonymous users');
      console.log('   or we need to modify the API approach.');
      
      return;
    }
    
    console.log('✅ Successfully accessed bars table:', barData);
    
    // Test the full API logic
    const mpesaAvailable = barData.mpesa_enabled === true;
    
    console.log('\n📋 API Response would be:');
    console.log({
      success: true,
      barId: barData.id,
      barName: barData.name,
      paymentMethods: {
        mpesa: {
          available: mpesaAvailable,
          environment: 'sandbox'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIError().catch(console.error);