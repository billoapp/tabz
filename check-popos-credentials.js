/**
 * Check Popos M-Pesa Credentials
 * Specifically inspect the Popos bar credentials that are failing
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, 'apps', 'staff', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  }
  console.log('✅ Loaded environment variables');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function checkPoposCredentials() {
  console.log('🎯 Checking Popos M-Pesa Credentials');
  console.log('===================================');
  
  const poposBarId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    // Check the mpesa_credentials table (new system)
    console.log('🔍 Checking mpesa_credentials table...');
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('*')
      .eq('tenant_id', poposBarId)
      .single();
    
    if (credError) {
      console.log('❌ Error fetching from mpesa_credentials:', credError.message);
    } else if (credData) {
      console.log('✅ Found record in mpesa_credentials table:');
      console.log('   ID:', credData.id);
      console.log('   Environment:', credData.environment);
      console.log('   Business Shortcode:', credData.business_shortcode);
      console.log('   Active:', credData.is_active);
      console.log('   Created:', credData.created_at);
      console.log('   Updated:', credData.updated_at);
      
      // Check encrypted fields
      const encryptedFields = ['consumer_key_enc', 'consumer_secret_enc', 'passkey_enc'];
      for (const field of encryptedFields) {
        const value = credData[field];
        console.log(`   ${field}:`);
        console.log(`     Present: ${!!value}`);
        console.log(`     Type: ${typeof value}`);
        console.log(`     Is null: ${value === null}`);
        
        if (value) {
          console.log(`     Length: ${value.length || 'N/A'}`);
          if (typeof value === 'string') {
            console.log(`     Value: ${value}`);
          } else if (Buffer.isBuffer(value)) {
            console.log(`     Buffer length: ${value.length}`);
            console.log(`     First 20 bytes: ${value.subarray(0, 20).toString('hex')}`);
          } else if (value instanceof Uint8Array) {
            console.log(`     Uint8Array length: ${value.length}`);
            console.log(`     First 20 bytes: ${Array.from(value.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          }
        }
      }
    } else {
      console.log('ℹ️ No record found in mpesa_credentials table');
    }
    
    console.log('\n' + '='.repeat(50));
    
    // Check the bars table (old system)
    console.log('🔍 Checking bars table...');
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select(`
        id,
        name,
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted,
        mpesa_setup_completed,
        mpesa_test_status
      `)
      .eq('id', poposBarId)
      .single();
    
    if (barError) {
      console.log('❌ Error fetching from bars:', barError.message);
    } else if (barData) {
      console.log('✅ Found record in bars table:');
      console.log('   Name:', barData.name);
      console.log('   M-Pesa Enabled:', barData.mpesa_enabled);
      console.log('   Environment:', barData.mpesa_environment);
      console.log('   Business Shortcode:', barData.mpesa_business_shortcode);
      console.log('   Setup Completed:', barData.mpesa_setup_completed);
      console.log('   Test Status:', barData.mpesa_test_status);
      
      // Check encrypted fields in bars table
      const barEncryptedFields = [
        'mpesa_consumer_key_encrypted',
        'mpesa_consumer_secret_encrypted', 
        'mpesa_passkey_encrypted'
      ];
      
      for (const field of barEncryptedFields) {
        const value = barData[field];
        console.log(`   ${field}:`);
        console.log(`     Present: ${!!value}`);
        console.log(`     Type: ${typeof value}`);
        console.log(`     Value: ${value}`);
      }
    }
    
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    
    if (credData && credData.consumer_key_enc) {
      console.log('✅ New system (mpesa_credentials table) has encrypted data');
      console.log('🔧 The API should be using this table');
    } else {
      console.log('❌ New system (mpesa_credentials table) has no encrypted data');
    }
    
    if (barData && barData.mpesa_consumer_key_encrypted && barData.mpesa_consumer_key_encrypted !== 'test_encrypted_value') {
      console.log('✅ Old system (bars table) has encrypted data');
      console.log('🔄 May need to migrate from old to new system');
    } else {
      console.log('❌ Old system (bars table) has no real encrypted data');
    }
    
    console.log('\n💡 RECOMMENDATION:');
    if (!credData || !credData.consumer_key_enc) {
      console.log('🎯 The mpesa_credentials table is empty or has no encrypted data');
      console.log('🔧 You need to save M-Pesa credentials through the UI to encrypt and store them');
      console.log('📝 The test values in the bars table are just placeholders');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkPoposCredentials().catch(console.error);