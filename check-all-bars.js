const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllBars() {
  console.log('🔍 Checking all bars and M-Pesa credentials...');
  
  try {
    // Get all bars
    const { data: bars, error: barsError } = await supabase
      .from('bars')
      .select('id, name');
    
    if (barsError) {
      console.error('❌ Error fetching bars:', barsError);
      return;
    }
    
    console.log(`📊 Found ${bars.length} bars total`);
    
    // Get all M-Pesa credentials
    const { data: creds, error: credsError } = await supabase
      .from('mpesa_credentials')
      .select('id, tenant_id, is_active, environment, business_shortcode');
    
    if (credsError) {
      console.error('❌ Error fetching credentials:', credsError);
      return;
    }
    
    console.log(`🔐 Found ${creds.length} M-Pesa credential records\n`);
    
    // Check each bar
    for (const bar of bars) {
      const credential = creds.find(c => c.tenant_id === bar.id);
      
      console.log(`📍 ${bar.name} (${bar.id})`);
      console.log(`   M-Pesa: ${credential ? '✅ Configured' : '❌ Missing'}`);
      
      if (credential) {
        console.log(`   Active: ${credential.is_active ? '✅ Yes' : '❌ No'}`);
        console.log(`   Environment: ${credential.environment}`);
        console.log(`   Shortcode: ${credential.business_shortcode}`);
        
        if (!credential.is_active) {
          console.log(`   ⚠️ NEEDS ACTIVATION`);
        }
      } else {
        console.log(`   ⚠️ NEEDS M-PESA SETUP`);
      }
      console.log('');
    }
    
    // Activate any inactive credentials
    const inactiveCreds = creds.filter(c => !c.is_active);
    if (inactiveCreds.length > 0) {
      console.log(`🔧 Activating ${inactiveCreds.length} inactive credentials...`);
      
      for (const cred of inactiveCreds) {
        const { error: updateError } = await supabase
          .from('mpesa_credentials')
          .update({ is_active: true })
          .eq('id', cred.id);
        
        if (updateError) {
          console.error(`❌ Failed to activate ${cred.tenant_id}:`, updateError);
        } else {
          console.log(`✅ Activated ${cred.tenant_id}`);
        }
      }
    }
    
    // Create missing credentials for bars that don't have them
    const barsWithoutCreds = bars.filter(bar => !creds.find(c => c.tenant_id === bar.id));
    if (barsWithoutCreds.length > 0) {
      console.log(`🔧 Creating M-Pesa credentials for ${barsWithoutCreds.length} bars...`);
      
      const crypto = require('crypto');
      const mpesaKey = process.env.MPESA_KMS_KEY;
      
      function encryptCredential(plaintext) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(mpesaKey, 'utf8'), iv);
        let encrypted = cipher.update(plaintext, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
      }
      
      const sandboxCredentials = {
        consumerKey: 'YOUR_SANDBOX_CONSUMER_KEY',
        consumerSecret: 'YOUR_SANDBOX_CONSUMER_SECRET', 
        passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
      };
      
      for (const bar of barsWithoutCreds) {
        console.log(`🔐 Creating credentials for: ${bar.name}`);
        
        const encryptedConsumerKey = encryptCredential(sandboxCredentials.consumerKey);
        const encryptedConsumerSecret = encryptCredential(sandboxCredentials.consumerSecret);
        const encryptedPasskey = encryptCredential(sandboxCredentials.passkey);
        
        const { error: insertError } = await supabase
          .from('mpesa_credentials')
          .insert({
            tenant_id: bar.id,
            environment: 'sandbox',
            business_shortcode: '174379',
            consumer_key_enc: encryptedConsumerKey,
            consumer_secret_enc: encryptedConsumerSecret,
            passkey_enc: encryptedPasskey,
            is_active: true
          });
        
        if (insertError) {
          console.error(`❌ Failed to create credentials for ${bar.name}:`, insertError);
        } else {
          console.log(`✅ Created credentials for ${bar.name}`);
        }
      }
    }
    
    console.log('\n🎉 All bars M-Pesa setup complete!');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkAllBars();
