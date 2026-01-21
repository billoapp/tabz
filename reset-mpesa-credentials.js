// Reset M-Pesa credentials with current encryption key
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const mpesaKey = process.env.MPESA_KMS_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption function (matching server)
function encryptCredential(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(mpesaKey, 'utf8'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

// Use sandbox credentials (you can replace these)
const sandboxCredentials = {
  consumerKey: 'YOUR_SANDBOX_CONSUMER_KEY',
  consumerSecret: 'YOUR_SANDBOX_CONSUMER_SECRET', 
  passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9769de9c9' // Default sandbox passkey
};

async function resetCredentials() {
  console.log('🔄 Resetting M-Pesa credentials with current encryption key...');
  
  try {
    // First, delete all existing credentials to avoid conflicts
    console.log('🗑️ Deleting existing credentials...');
    const { error: deleteError } = await supabase
      .from('mpesa_credentials')
      .delete()
      .gt('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Failed to delete existing credentials:', deleteError);
      return;
    }
    
    console.log('✅ Existing credentials deleted');
    
    // Get bars to create new credentials for
    const { data: bars } = await supabase
      .from('bars')
      .select('id, name')
      .limit(3);
    
    console.log(`📊 Creating credentials for ${bars?.length || 0} bars...`);
    
    for (const bar of bars) {
      console.log(`🔐 Creating credentials for: ${bar.name}`);
      
      // Encrypt credentials with current key
      const encryptedConsumerKey = encryptCredential(sandboxCredentials.consumerKey);
      const encryptedConsumerSecret = encryptCredential(sandboxCredentials.consumerSecret);
      const encryptedPasskey = encryptCredential(sandboxCredentials.passkey);
      
      // Insert new credentials
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
    
    console.log('🎉 M-Pesa credentials reset complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Get your sandbox Consumer Key & Secret from https://developer.safaricom.co.ke/');
    console.log('2. Update credentials in your app settings');
    console.log('3. Test M-Pesa functionality');
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
  }
}

resetCredentials();
