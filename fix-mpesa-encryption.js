// Fix M-Pesa credentials encryption
// Run this script to re-encrypt credentials with current MPESA_KMS_KEY

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const mpesaKey = process.env.MPESA_KMS_KEY;

if (!supabaseUrl || !supabaseKey || !mpesaKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption functions (matching your server code)
function encryptCredential(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(mpesaKey, 'utf8'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

// Test credentials (Safaricom sandbox defaults)
const testCredentials = {
  consumerKey: 'YOUR_SANDBOX_CONSUMER_KEY', // Get from developer.safaricom.co.ke
  consumerSecret: 'YOUR_SANDBOX_CONSUMER_SECRET', // Get from developer.safaricom.co.ke
  passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9769de9c9769de9c9' // Default sandbox passkey
};

async function fixCredentials() {
  console.log('🔧 Fixing M-Pesa credentials encryption...');
  
  try {
    // Get all bars to find which one needs M-Pesa setup
    const { data: bars } = await supabase
      .from('bars')
      .select('id, name')
      .limit(5);
    
    console.log('📋 Found bars:', bars);
    
    // For each bar, update or insert M-Pesa credentials
    for (const bar of bars) {
      console.log(`🔐 Processing bar: ${bar.name} (${bar.id})`);
      
      // Encrypt credentials
      const encryptedConsumerKey = encryptCredential(testCredentials.consumerKey);
      const encryptedConsumerSecret = encryptCredential(testCredentials.consumerSecret);
      const encryptedPasskey = encryptCredential(testCredentials.passkey);
      
      // Update or insert credentials
      const { error } = await supabase
        .from('mpesa_credentials')
        .upsert({
          tenant_id: bar.id,
          environment: 'sandbox',
          business_shortcode: '174379', // Safaricom test shortcode
          consumer_key_enc: encryptedConsumerKey,
          consumer_secret_enc: encryptedConsumerSecret,
          passkey_enc: encryptedPasskey,
          is_active: true
        });
      
      if (error) {
        console.error(`❌ Failed to update ${bar.name}:`, error);
      } else {
        console.log(`✅ Updated ${bar.name} successfully`);
      }
    }
    
    console.log('🎉 M-Pesa credentials encryption fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixCredentials();
