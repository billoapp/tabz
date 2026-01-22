/**
 * Test Proper M-Pesa Credential Decryption
 * Handles the correct format from Supabase bytea columns
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
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

const currentMpesaKey = process.env.MPESA_KMS_KEY;
const oldMpesaKey = 'f37bac6fd61edf41bd1cb49a2fb79d33'; // Old exposed key

/**
 * Convert Supabase bytea format to Buffer
 */
function parseSupabaseBytea(byteaString) {
  try {
    // Remove the \x prefix if present
    const hexString = byteaString.startsWith('\\x') ? byteaString.slice(2) : byteaString;
    
    // Convert hex to buffer
    const buffer = Buffer.from(hexString, 'hex');
    
    // Check if it's a JSON representation of a Buffer
    const jsonString = buffer.toString('utf8');
    if (jsonString.startsWith('{"type":"Buffer","data":[')) {
      const bufferObj = JSON.parse(jsonString);
      return Buffer.from(bufferObj.data);
    }
    
    // Otherwise return the buffer as-is
    return buffer;
  } catch (error) {
    console.error('Error parsing bytea:', error.message);
    throw error;
  }
}

/**
 * Decrypt credential with a specific key
 */
function decryptCredential(encryptedBuffer, encryptionKey) {
  try {
    if (encryptedBuffer.length < 28) {
      throw new Error('Invalid encrypted data: too short');
    }
    
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

async function testProperDecryption() {
  console.log('🧪 Testing Proper M-Pesa Credential Decryption');
  console.log('===============================================');
  
  const poposBarId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  console.log('🔑 Encryption Keys:');
  console.log(`   Current Key: ${currentMpesaKey}`);
  console.log(`   Old Key: ${oldMpesaKey}`);
  console.log('');
  
  try {
    // Get the encrypted credentials
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('consumer_key_enc, consumer_secret_enc, passkey_enc')
      .eq('tenant_id', poposBarId)
      .single();
    
    if (credError || !credData) {
      throw new Error('Failed to fetch credentials: ' + (credError?.message || 'No data'));
    }
    
    console.log('📦 Raw encrypted data from database:');
    console.log(`   Consumer Key: ${credData.consumer_key_enc.substring(0, 50)}...`);
    console.log(`   Consumer Secret: ${credData.consumer_secret_enc.substring(0, 50)}...`);
    console.log(`   Passkey: ${credData.passkey_enc.substring(0, 50)}...`);
    console.log('');
    
    // Test decryption with both keys
    const credentials = [
      { name: 'Consumer Key', data: credData.consumer_key_enc },
      { name: 'Consumer Secret', data: credData.consumer_secret_enc },
      { name: 'Passkey', data: credData.passkey_enc }
    ];
    
    for (const cred of credentials) {
      console.log(`🔓 Testing ${cred.name}:`);
      
      try {
        // Parse the bytea format
        const encryptedBuffer = parseSupabaseBytea(cred.data);
        console.log(`   ✅ Parsed bytea format (${encryptedBuffer.length} bytes)`);
        
        // Try with current key first
        try {
          const decrypted = decryptCredential(encryptedBuffer, currentMpesaKey);
          console.log(`   ✅ Decrypted with CURRENT key: ${decrypted.substring(0, 10)}...${decrypted.substring(decrypted.length - 4)}`);
        } catch (currentKeyError) {
          console.log(`   ❌ Failed with current key: ${currentKeyError.message}`);
          
          // Try with old key
          try {
            const decrypted = decryptCredential(encryptedBuffer, oldMpesaKey);
            console.log(`   ✅ Decrypted with OLD key: ${decrypted.substring(0, 10)}...${decrypted.substring(decrypted.length - 4)}`);
            console.log(`   🔄 This credential needs to be re-encrypted with the new key`);
          } catch (oldKeyError) {
            console.log(`   ❌ Failed with old key: ${oldKeyError.message}`);
          }
        }
        
      } catch (parseError) {
        console.log(`   ❌ Failed to parse bytea: ${parseError.message}`);
      }
      
      console.log('');
    }
    
    console.log('📊 SUMMARY:');
    console.log('===========');
    console.log('✅ Successfully parsed Supabase bytea format');
    console.log('🔍 Tested decryption with both current and old encryption keys');
    console.log('');
    
    console.log('💡 NEXT STEPS:');
    console.log('1. If credentials decrypt with OLD key: Run credential rotation script');
    console.log('2. If credentials decrypt with CURRENT key: Update API to handle bytea format correctly');
    console.log('3. If neither works: Credentials may be corrupted and need to be re-entered');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProperDecryption().catch(console.error);