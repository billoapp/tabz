// Restore Popos bar with your actual credentials, give others unique placeholders
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

// YOUR Popos credentials (keep these)
const poposCredentials = {
  consumerKey: 'QYM7B1LW9A4MSYGRxkoTEZahjAiGT5AyzGLqGsOcmHl0R6Qx',
  consumerSecret: 'Ku0hb9C966GMeAcNgJ3AyWpJQOh8PtFg0T6kKxOKqAwCslHJSilnFDxLL8zUaqIg', 
  passkey: 'jAW0yoi/vqqH7Q9//qqEiJQ9sLbU/AuHzudBexbXp4YWflQ/nzSnFFGkDCkys+A0fbrj2HxTnBTTsPza3eISO2n8kpFMNnUV9f79HjeJK5gQ0/1OrUf71/xhZxdE4AnD8X7Cm3Q3J/fCff1EfLnM22IJRAUl+aMNbsNm+9LcXZrvZrSAtSzsKx+Ob2Hc8iUPyVhjSiO1eWNFBzcM0HZ6MVXMH8CTGUvtDgaNm3WjyjwbDKNoQOj0PfwrDvZwMUxuspGC1mXLv15nnlqHD3DelV6gQedkQgKlZ+Ow6sCoGnFjc2caKgifIn7N1FaelhziANIQepCx+7zc6kvqhcK2TQ=='
};

// Unique placeholder credentials for other bars
const otherBarCredentials = {
  '8d1d8f04-2f29-46c4-a342-786f407b27c1': { // Oasis
    consumerKey: 'OASIS_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'OASIS_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9' // Default sandbox passkey
  },
  '095a866a-573f-4412-8e26-08d5a8643385': { // Garage bar
    consumerKey: 'GARAGE_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'GARAGE_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  '8f39bc25-99f8-4e99-a1a4-0adf31989084': { // Iconic
    consumerKey: 'ICONIC_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'ICONIC_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  '674749b2-99fe-450b-88fe-d70c90f10bcb': { // Comrades Rooftop
    consumerKey: 'COMRADES_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'COMRADES_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  '96f1a3aa-523b-49f3-8138-cefef2d2ba65': { // Vovo Cafe
    consumerKey: 'VOVO_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'VOVO_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  '6ec79abd-0d12-4ce1-bab4-3e20799ef86e': { // Tamasha
    consumerKey: 'TAMASHA_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'TAMASHA_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  'f51117b6-b3a2-4465-9404-d1708581e5a0': { // Golf Club
    consumerKey: 'GOLF_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'GOLF_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  'bb6fe0b0-9c78-4d87-a44f-a9d961222955': { // Legend
    consumerKey: 'LEGEND_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'LEGEND_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  '873c5264-3ef8-4867-a400-a0c407e776d7': { // Balis best bar
    consumerKey: 'BALIS_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'BALIS_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  },
  '5de99d10-0d24-4145-a062-ef8cc203672f': { // Legend Group
    consumerKey: 'LEGEND_GROUP_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'LEGEND_GROUP_SANDBOX_CONSUMER_SECRET',
    passkey: 'bfb279c9769de9c9769de9c9769de9c9769de9c9769de9c9'
  }
};

async function restorePoposCredentials() {
  console.log('🔄 Restoring Popos credentials and fixing other bars...');
  
  try {
    // Get all bars
    const { data: bars, error: barsError } = await supabase
      .from('bars')
      .select('id, name');
    
    if (barsError) {
      console.error('❌ Error fetching bars:', barsError);
      return;
    }
    
    // Delete existing credentials
    console.log('🗑️ Deleting existing credentials...');
    const { error: deleteError } = await supabase
      .from('mpesa_credentials')
      .delete()
      .gt('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('❌ Failed to delete existing credentials:', deleteError);
      return;
    }
    
    // Create credentials for each bar
    for (const bar of bars) {
      let credentials;
      
      if (bar.id === '438c80c1-fe11-4ac5-8a48-2fc45104ba31') {
        // Use your actual Popos credentials
        credentials = poposCredentials;
        console.log(`🔐 Restoring Popos credentials for: ${bar.name}`);
      } else {
        // Use unique placeholders for other bars
        credentials = otherBarCredentials[bar.id];
        if (!credentials) {
          console.log(`⚠️ No credentials defined for ${bar.name}, skipping...`);
          continue;
        }
        console.log(`🔐 Creating placeholder credentials for: ${bar.name}`);
      }
      
      // Encrypt credentials
      const encryptedConsumerKey = encryptCredential(credentials.consumerKey);
      const encryptedConsumerSecret = encryptCredential(credentials.consumerSecret);
      const encryptedPasskey = encryptCredential(credentials.passkey);
      
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
        if (bar.id === '438c80c1-fe11-4ac5-8a48-2fc45104ba31') {
          console.log(`   ✅ Using YOUR actual Popos credentials`);
        } else {
          console.log(`   Consumer Key: ${credentials.consumerKey}`);
          console.log(`   Consumer Secret: ${credentials.consumerSecret}`);
        }
      }
    }
    
    console.log('\n🎉 Credentials restoration complete!');
    console.log('\n📝 Summary:');
    console.log('✅ Popos: Your actual credentials restored');
    console.log('✅ Other bars: Unique placeholder credentials');
    console.log('\n📝 Next steps:');
    console.log('1. Update other bars with their actual M-Pesa credentials in settings');
    console.log('2. Popos should work immediately with your credentials');
    console.log('3. Test each bar individually');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
  }
}

restorePoposCredentials();
