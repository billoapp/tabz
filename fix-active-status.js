const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixActiveStatus() {
  console.log('🔧 Fixing M-Pesa credentials active status...');
  
  try {
    // Check current credentials
    const { data: creds, error } = await supabase
      .from('mpesa_credentials')
      .select('id, tenant_id, is_active')
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`📊 Found ${creds.length} credential records`);
    
    for (const cred of creds) {
      console.log(`🔐 Bar ${cred.tenant_id}: Active = ${cred.is_active}`);
      
      if (!cred.is_active) {
        // Update to active
        const { error: updateError } = await supabase
          .from('mpesa_credentials')
          .update({ is_active: true })
          .eq('id', cred.id);
        
        if (updateError) {
          console.error(`❌ Failed to activate ${cred.tenant_id}:`, updateError);
        } else {
          console.log(`✅ Activated credentials for ${cred.tenant_id}`);
        }
      }
    }
    
    console.log('🎉 Active status fix complete!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixActiveStatus();
