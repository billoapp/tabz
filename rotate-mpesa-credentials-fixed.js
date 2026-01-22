/**
 * M-Pesa Credential Rotation Script (Fixed)
 * Re-encrypts all M-Pesa credentials with new encryption key after security incident
 * Handles Supabase bytea format correctly
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
  console.log('✅ Loaded environment variables from apps/staff/.env.local');
}

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const oldMpesaKey = 'f37bac6fd61edf41bd1cb49a2fb79d33'; // Old exposed key
const newMpesaKey = process.env.MPESA_KMS_KEY; // New rotated key

console.log('🔄 M-Pesa Credential Rotation Script (Fixed)');
console.log('=============================================');

if (!supabaseUrl || !supabaseKey || !newMpesaKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SECRET_KEY:', !!supabaseKey);
  console.error('   MPESA_KMS_KEY:', !!newMpesaKey);
  process.exit(1);
}

if (newMpesaKey.length !== 32) {
  console.error('❌ MPESA_KMS_KEY must be exactly 32 characters');
  process.exit(1);
}

console.log('🔑 Encryption Keys:');
console.log(`   Old Key: ${oldMpesaKey}`);
console.log(`   New Key: ${newMpesaKey}`);
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse Supabase bytea format to Buffer
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
    throw new Error(`Failed to parse bytea format: ${error.message}`);
  }
}

/**
 * Decrypt credential with old key
 */
function decryptWithOldKey(encryptedBuffer) {
  try {
    if (encryptedBuffer.length < 28) {
      throw new Error('Invalid encrypted data: too short');
    }
    
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(oldMpesaKey, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt with old key: ${error.message}`);
  }
}

/**
 * Encrypt credential with new key
 */
function encryptWithNewKey(plaintext) {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(newMpesaKey, 'utf8'), iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return result;
  } catch (error) {
    throw new Error(`Failed to encrypt with new key: ${error.message}`);
  }
}

/**
 * Main rotation function
 */
async function rotateCredentials() {
  try {
    console.log('🔍 Fetching existing M-Pesa credentials...');
    
    // Get all M-Pesa credentials
    const { data: credentials, error } = await supabase
      .from('mpesa_credentials')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch credentials: ${error.message}`);
    }
    
    if (!credentials || credentials.length === 0) {
      console.log('ℹ️ No M-Pesa credentials found to rotate');
      return;
    }
    
    console.log(`📋 Found ${credentials.length} credential record(s) to rotate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const cred of credentials) {
      console.log(`\n🔄 Processing credential for tenant: ${cred.tenant_id}`);
      
      try {
        const updates = {};
        
        // Rotate consumer_key_enc if exists
        if (cred.consumer_key_enc) {
          console.log('  🔐 Rotating consumer key...');
          const encryptedBuffer = parseSupabaseBytea(cred.consumer_key_enc);
          const decrypted = decryptWithOldKey(encryptedBuffer);
          updates.consumer_key_enc = encryptWithNewKey(decrypted);
          console.log('  ✅ Consumer key rotated');
        }
        
        // Rotate consumer_secret_enc if exists
        if (cred.consumer_secret_enc) {
          console.log('  🔐 Rotating consumer secret...');
          const encryptedBuffer = parseSupabaseBytea(cred.consumer_secret_enc);
          const decrypted = decryptWithOldKey(encryptedBuffer);
          updates.consumer_secret_enc = encryptWithNewKey(decrypted);
          console.log('  ✅ Consumer secret rotated');
        }
        
        // Rotate passkey_enc if exists
        if (cred.passkey_enc) {
          console.log('  🔐 Rotating passkey...');
          const encryptedBuffer = parseSupabaseBytea(cred.passkey_enc);
          const decrypted = decryptWithOldKey(encryptedBuffer);
          updates.passkey_enc = encryptWithNewKey(decrypted);
          console.log('  ✅ Passkey rotated');
        }
        
        // Rotate security_credential_enc if exists
        if (cred.security_credential_enc) {
          console.log('  🔐 Rotating security credential...');
          const encryptedBuffer = parseSupabaseBytea(cred.security_credential_enc);
          const decrypted = decryptWithOldKey(encryptedBuffer);
          updates.security_credential_enc = encryptWithNewKey(decrypted);
          console.log('  ✅ Security credential rotated');
        }
        
        if (Object.keys(updates).length === 0) {
          console.log('  ℹ️ No encrypted credentials to rotate');
          continue;
        }
        
        // Update the record
        const { error: updateError } = await supabase
          .from('mpesa_credentials')
          .update(updates)
          .eq('id', cred.id);
        
        if (updateError) {
          throw new Error(`Failed to update credentials: ${updateError.message}`);
        }
        
        // Log audit event
        await supabase
          .from('mpesa_credential_events')
          .insert({
            credential_id: cred.id,
            tenant_id: cred.tenant_id,
            event_type: 'key_rotated',
            event_data: {
              rotated_fields: Object.keys(updates),
              rotation_reason: 'security_incident_key_exposure',
              old_key_hash: crypto.createHash('sha256').update(oldMpesaKey).digest('hex').substring(0, 8),
              new_key_hash: crypto.createHash('sha256').update(newMpesaKey).digest('hex').substring(0, 8)
            }
          });
        
        console.log(`  ✅ Credential rotation completed for tenant: ${cred.tenant_id}`);
        successCount++;
        
      } catch (credError) {
        console.error(`  ❌ Failed to rotate credential for tenant ${cred.tenant_id}:`, credError.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Rotation Summary:');
    console.log(`   ✅ Successfully rotated: ${successCount}`);
    console.log(`   ❌ Failed to rotate: ${errorCount}`);
    console.log(`   📋 Total processed: ${credentials.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 All M-Pesa credentials successfully rotated!');
      console.log('🔒 Old encryption key is now obsolete');
      console.log('✅ New encryption key is active');
      console.log('');
      console.log('💡 NEXT STEPS:');
      console.log('1. Test M-Pesa API endpoint to verify decryption works');
      console.log('2. Update production environment variables');
      console.log('3. Deploy updated API code to production');
    } else {
      console.log('\n⚠️ Some credentials failed to rotate. Check errors above.');
    }
    
  } catch (error) {
    console.error('❌ Credential rotation failed:', error.message);
    process.exit(1);
  }
}

// Run the rotation
rotateCredentials().catch(console.error);