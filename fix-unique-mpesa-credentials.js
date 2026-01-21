// Fix: Give each bar unique M-Pesa credentials
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

// Unique credentials for each bar
const barCredentials = {
  '8d1d8f04-2f29-46c4-a342-786f407b27c1': { // Oasis
    consumerKey: 'OASIS_CONSUMER_KEY_001',
    consumerSecret: 'OASIS_CONSUMER_SECRET_001',
    passkey: 'OASIS_PASSKEY_001'
  },
  '095a866a-573f-4412-8e26-08d5a8643385': { // Garage bar
    consumerKey: 'GARAGE_CONSUMER_KEY_002',
    consumerSecret: 'GARAGE_CONSUMER_SECRET_002',
    passkey: 'GARAGE_PASSKEY_002'
  },
  '8f39bc25-99f8-4e99-a1a4-0adf31989084': { // Iconic
    consumerKey: 'ICONIC_CONSUMER_KEY_003',
    consumerSecret: 'ICONIC_CONSUMER_SECRET_003',
    passkey: 'ICONIC_PASSKEY_003'
  },
  '674749b2-99fe-450b-88fe-d70c90f10bcb': { // Comrades Rooftop
    consumerKey: 'COMRADES_CONSUMER_KEY_004',
    consumerSecret: 'COMRADES_CONSUMER_SECRET_004',
    passkey: 'COMRADES_PASSKEY_004'
  },
  '438c80c1-fe11-4ac5-8a48-2fc45104ba31': { // Popos
    consumerKey: 'POPOS_CONSUMER_KEY_005',
    consumerSecret: 'POPOS_CONSUMER_SECRET_005',
    passkey: 'POPOS_PASSKEY_005'
  },
  '96f1a3aa-523b-49f3-8138-cefef2d2ba65': { // Vovo Cafe
    consumerKey: 'VOVO_CONSUMER_KEY_006',
    consumerSecret: 'VOVO_CONSUMER_SECRET_006',
    passkey: 'VOVO_PASSKEY_006'
  },
  '6ec79abd-0d12-4ce1-bab4-3e20799ef86e': { // Tamasha
    consumerKey: 'TAMASHA_CONSUMER_KEY_007',
    consumerSecret: 'TAMASHA_CONSUMER_SECRET_007',
    passkey: 'TAMASHA_PASSKEY_007'
  },
  'f51117b6-b3a2-4465-9404-d1708581e5a0': { // Golf Club
    consumerKey: 'GOLF_CONSUMER_KEY_008',
    consumerSecret: 'GOLF_CONSUMER_SECRET_008',
    passkey: 'GOLF_PASSKEY_008'
  },
  'bb6fe0b0-9c78-4d87-a44f-a9d961222955': { // Legend
    consumerKey: 'LEGEND_CONSUMER_KEY_009',
    consumerSecret: 'LEGEND_CONSUMER_SECRET_009',
    passkey: 'LEGEND_PASSKEY_009'
  },
  '873c5264-3ef8-4867-a400-a0c407e776d7': { // Balis best bar
    consumerKey: 'BALIS_CONSUMER_KEY_010',
    consumerSecret: 'BALIS_CONSUMER_SECRET_010',
    passkey: 'BALIS_PASSKEY_010'
  },
  '5de99d10-0d24-4145-a062-ef8cc203672f': { // Legend Group
    consumerKey: 'LEGEND_GROUP_CONSUMER_KEY_011',
    consumerSecret: 'LEGEND_GROUP_CONSUMER_SECRET_011',
    passkey: 'LEGEND_GROUP_PASSKEY_011'
  }
};

async function fixUniqueCredentials() {
  console.log('🔧 Giving each bar unique M-Pesa credentials...');
  
  try {
    // Get all bars
    const { data: bars, error: barsError } = await supabase
      .from('bars')
      .select('id, name');
    
    if (barsError) {
      console.error('❌ Error fetching bars:', barsError);
      return;
    }
    
    console.log(`📊 Found ${bars.length} bars`);
    
    // Delete existing credentials first
    console.log('🗑️ Deleting existing shared credentials...');
    const { error: deleteError } = await supabase
      .from('mpesa_credentials')
      .delete()
      .gt('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('❌ Failed to delete existing credentials:', deleteError);
      return;
    }
    
    // Create unique credentials for each bar
    for (const bar of bars) {
      const credentials = barCredentials[bar.id];
      
      if (!credentials) {
        console.log(`⚠️ No credentials defined for ${bar.name}, skipping...`);
        continue;
      }
      
      console.log(`🔐 Creating unique credentials for: ${bar.name}`);
      
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
        console.log(`✅ Created unique credentials for ${bar.name}`);
        console.log(`   Consumer Key: ${credentials.consumerKey}`);
        console.log(`   Consumer Secret: ${credentials.consumerSecret}`);
        console.log(`   Passkey: ${credentials.passkey}`);
      }
    }
    
    console.log('\n🎉 Unique M-Pesa credentials setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Each bar now has unique placeholder credentials');
    console.log('2. Update each bar in app settings with actual M-Pesa credentials');
    console.log('3. Test each bar individually');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixUniqueCredentials();
