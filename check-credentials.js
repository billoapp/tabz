const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const mpesaKey = process.env.MPESA_KMS_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Decryption function (matching server)
function decryptCredential(encryptedBuffer) {
  try {
    if (encryptedBuffer.length < 28) {
      throw new Error('Invalid encrypted data: too short');
    }
    
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(mpesaKey, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw error;
  }
}

async function checkCredentials() {
  console.log('🔍 Checking M-Pesa credentials in database...');
  
  try {
    const { data: creds, error } = await supabase
      .from('mpesa_credentials')
      .select('*')
      .limit(3);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`📊 Found ${creds.length} credential records`);
    
    for (const cred of creds) {
      console.log(`\n🔐 Checking credentials for bar: ${cred.tenant_id}`);
      console.log(`- Environment: ${cred.environment}`);
      console.log(`- Business Shortcode: ${cred.business_shortcode}`);
      console.log(`- Active: ${cred.is_active}`);
      
      try {
        // Check data types and lengths
        console.log('\n📋 Data analysis:');
        console.log(`- consumer_key_enc type: ${typeof cred.consumer_key_enc}`);
        console.log(`- consumer_key_enc length: ${cred.consumer_key_enc?.length || 0}`);
        console.log(`- consumer_secret_enc type: ${typeof cred.consumer_secret_enc}`);
        console.log(`- consumer_secret_enc length: ${cred.consumer_secret_enc?.length || 0}`);
        console.log(`- passkey_enc type: ${typeof cred.passkey_enc}`);
        console.log(`- passkey_enc length: ${cred.passkey_enc?.length || 0}`);
        
        // Convert to Buffer from base64 string
        const consumerKeyBuffer = Buffer.from(cred.consumer_key_enc || '', 'base64');
        const consumerSecretBuffer = Buffer.from(cred.consumer_secret_enc || '', 'base64');
        const passkeyBuffer = Buffer.from(cred.passkey_enc || '', 'base64');
        
        console.log('\n🔓 Attempting decryption...');
        
        const consumerKey = decryptCredential(consumerKeyBuffer);
        console.log('✅ Consumer key decrypted successfully');
        
        const consumerSecret = decryptCredential(consumerSecretBuffer);
        console.log('✅ Consumer secret decrypted successfully');
        
        const passkey = decryptCredential(passkeyBuffer);
        console.log('✅ Passkey decrypted successfully');
        
        console.log('\n📝 Decrypted values (first 10 chars):');
        console.log(`- Consumer Key: ${consumerKey.substring(0, 10)}...`);
        console.log(`- Consumer Secret: ${consumerSecret.substring(0, 10)}...`);
        console.log(`- Passkey: ${passkey.substring(0, 10)}...`);
        
      } catch (decryptError) {
        console.error(`❌ Decryption failed: ${decryptError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkCredentials();
