// Test if customer app can access bars table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2'; // Publishable key from customer app

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBarsAccess() {
  console.log('Testing bars table access with publishable key...');
  
  try {
    // Test basic bars access
    const { data, error } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled')
      .limit(5);
    
    if (error) {
      console.error('Error accessing bars table:', error);
      return;
    }
    
    console.log('Success! Found bars:', data);
    
    // Test specific bar access (Popos bar ID from context)
    const { data: specificBar, error: specificError } = await supabase
      .from('bars')
      .select('id, name, mpesa_enabled')
      .eq('name', 'Popos')
      .single();
    
    if (specificError) {
      console.error('Error accessing specific bar:', specificError);
      return;
    }
    
    console.log('Popos bar data:', specificBar);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testBarsAccess();