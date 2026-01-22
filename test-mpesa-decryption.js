/**
 * Test M-Pesa Credential Decryption
 * Tests if we can decrypt existing credentials and diagnose the issue
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables from staff app .env.local
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
  console.log('✅ Loaded environment variables from apps/staff/.env.local');
} else {
  console.log('⚠️ No .env.local file found at:', envPath);
}

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const currentMpesaKey = process.env.MPESA_KMS_KEY;

console.log('🧪 M-Pesa Credential Decryption Test');
console.log('====================================');

if (!supabaseUrl || !supabaseKey || !currentMpesaKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SECRET_KEY:', !!supabaseKey);
  console.error('   MPESA_KMS_KEY:', !!currentMpesaKey);
  process.exit(1);
}

console.log('🔑 Current MPESA_KMS_KEY:', currentMpesaKey);
console.log('📏 Key length:', currentMpesaKey.length, 'characters');

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Decrypt credential with current key
 */
function decryptCredential(encryptedBuffer) {
  try {
    if (encryptedBuffer.length < 28) {
      throw new Error('Invalid encrypted data: too short');
    }
    
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(currentMpesaKey, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Test decryption of existing credentials
 */
async function testDecryption() {
  try {
    console.log('\n🔍 Fetching M-Pesa credentials from database...');
    
    // Get all M-Pesa credentials
    const { data: credentials, error } = await supabase
      .from('mpesa_credentials')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch credentials: ${error.message}`);
    }
    
    if (!credentials || credentials.length === 0) {
      console.log('ℹ️ No M-Pesa credentials found in database');
      return;
    }
    
    console.log(`📋 Found ${credentials.length} credential record(s)`);
    
    for (const cred of credentials) {
      console.log(`\n🏢 Testing credential for tenant: ${cred.tenant_id}`);
      console.log(`   Environment: ${cred.environment}`);
      console.log(`   Business Shortcode: ${cred.business_shortcode}`);
      console.log(`   Active: ${cred.is_active}`);
      console.log(`   Created: ${cred.created_at}`);
      console.log(`   Updated: ${cred.updated_at}`);
      
      // Test consumer key decryption
      if (cred.consumer_key_enc) {
        try {
          const decrypted = decryptCredential(cred.consumer_key_enc);
          console.log(`   ✅ Consumer Key: ${decrypted.substring(0, 8)}...${decrypted.substring(decrypted.length - 4)}`);
        } catch (error) {
          console.log(`   ❌ Consumer Key: ${error.message}`);
        }
      } else {
        console.log('   ⚪ Consumer Key: Not set');
      }
      
      // Test consumer secret decryption
      if (cred.consumer_secret_enc) {
        try {
          const decrypted = decryptCredential(cred.consumer_secret_enc);
          console.log(`   ✅ Consumer Secret: ${decrypted.substring(0, 8)}...${decrypted.substring(decrypted.length - 4)}`);
        } catch (error) {
          console.log(`   ❌ Consumer Secret: ${error.message}`);
        }
      } else {
        console.log('   ⚪ Consumer Secret: Not set');
      }
      
      // Test passkey decryption
      if (cred.passkey_enc) {
        try {
          const decrypted = decryptCredential(cred.passkey_enc);
          console.log(`   ✅ Passkey: ${decrypted.substring(0, 8)}...${decrypted.substring(decrypted.length - 4)}`);
        } catch (error) {
          console.log(`   ❌ Passkey: ${error.message}`);
        }
      } else {
        console.log('   ⚪ Passkey: Not set');
      }
      
      // Test security credential decryption
      if (cred.security_credential_enc) {
        try {
          const decrypted = decryptCredential(cred.security_credential_enc);
          console.log(`   ✅ Security Credential: ${decrypted.substring(0, 8)}...${decrypted.substring(decrypted.length - 4)}`);
        } catch (error) {
          console.log(`   ❌ Security Credential: ${error.message}`);
        }
      } else {
        console.log('   ⚪ Security Credential: Not set');
      }
    }
    
    console.log('\n📊 Decryption Test Complete');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testDecryption().catch(console.error);