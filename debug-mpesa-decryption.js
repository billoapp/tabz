/**
 * Debug M-PESA Decryption Issues
 * This script helps diagnose M-PESA credential decryption problems
 */

const { createClient } = require('@supabase/supabase-js');

// Environment check
function checkEnvironment() {
  console.log('🔍 Environment Check:');
  console.log('- MPESA_KMS_KEY:', process.env.MPESA_KMS_KEY ? `Set (${process.env.MPESA_KMS_KEY.length} chars)` : 'NOT SET');
  console.log('- SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'NOT SET');
  console.log('- SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? 'Set' : 'NOT SET');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('');
}

// Database check
async function checkDatabase() {
  console.log('🗄️ Database Check:');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // Check if mpesa_credentials table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'mpesa_credentials');

    if (tablesError) {
      console.log('❌ Error checking tables:', tablesError.message);
      return;
    }

    if (!tables || tables.length === 0) {
      console.log('❌ mpesa_credentials table does not exist');
      return;
    }

    console.log('✅ mpesa_credentials table exists');

    // Check for any credentials
    const { data: creds, error: credsError } = await supabase
      .from('mpesa_credentials')
      .select('id, tenant_id, environment, business_shortcode, is_active, created_at')
      .limit(5);

    if (credsError) {
      console.log('❌ Error querying credentials:', credsError.message);
      return;
    }

    console.log(`📊 Found ${creds?.length || 0} credential records`);
    
    if (creds && creds.length > 0) {
      console.log('Sample records:');
      creds.forEach((cred, i) => {
        console.log(`  ${i + 1}. ID: ${cred.id}, Tenant: ${cred.tenant_id}, Env: ${cred.environment}, Active: ${cred.is_active}`);
      });
    }

    // Check for encrypted data
    const { data: encData, error: encError } = await supabase
      .from('mpesa_credentials')
      .select('id, consumer_key_enc, consumer_secret_enc, passkey_enc')
      .limit(1);

    if (encError) {
      console.log('❌ Error checking encrypted data:', encError.message);
      return;
    }

    if (encData && encData.length > 0) {
      const record = encData[0];
      console.log('🔐 Encrypted data check:');
      console.log('- consumer_key_enc:', record.consumer_key_enc ? `Present (${Buffer.isBuffer(record.consumer_key_enc) ? 'Buffer' : typeof record.consumer_key_enc})` : 'Missing');
      console.log('- consumer_secret_enc:', record.consumer_secret_enc ? `Present (${Buffer.isBuffer(record.consumer_secret_enc) ? 'Buffer' : typeof record.consumer_secret_enc})` : 'Missing');
      console.log('- passkey_enc:', record.passkey_enc ? `Present (${Buffer.isBuffer(record.passkey_enc) ? 'Buffer' : typeof record.passkey_enc})` : 'Missing');
    }

  } catch (error) {
    console.log('❌ Database check failed:', error.message);
  }
  
  console.log('');
}

// Encryption test
function testEncryption() {
  console.log('🔐 Encryption Test:');
  
  const masterKey = process.env.MPESA_KMS_KEY;
  
  if (!masterKey) {
    console.log('❌ MPESA_KMS_KEY not available - cannot test encryption');
    return;
  }

  if (masterKey.length !== 32) {
    console.log(`❌ MPESA_KMS_KEY wrong length: ${masterKey.length} (expected 32)`);
    return;
  }

  try {
    const crypto = require('crypto');
    
    // Test encryption/decryption
    const testData = 'test-credential-data';
    
    // Encrypt
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'utf8'), iv);
    let encrypted = cipher.update(testData, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedBuffer = Buffer.concat([iv, authTag, encrypted]);
    
    console.log('✅ Encryption test passed');
    
    // Decrypt
    const ivDecrypt = encryptedBuffer.subarray(0, 12);
    const authTagDecrypt = encryptedBuffer.subarray(12, 28);
    const encryptedDecrypt = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(masterKey, 'utf8'), ivDecrypt);
    decipher.setAuthTag(authTagDecrypt);
    
    let decrypted = decipher.update(encryptedDecrypt, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    if (decrypted === testData) {
      console.log('✅ Decryption test passed');
    } else {
      console.log('❌ Decryption test failed - data mismatch');
    }
    
  } catch (error) {
    console.log('❌ Encryption test failed:', error.message);
  }
  
  console.log('');
}

// Main diagnostic function
async function diagnose() {
  console.log('🔍 M-PESA Decryption Diagnostic Tool\n');
  
  checkEnvironment();
  await checkDatabase();
  testEncryption();
  
  console.log('🎯 Recommendations:');
  
  if (!process.env.MPESA_KMS_KEY) {
    console.log('1. ❌ Set MPESA_KMS_KEY environment variable');
    console.log('   - For Vercel: Add to Environment Variables in dashboard');
    console.log('   - For local: Add to .env.local file');
    console.log('   - Must be exactly 32 characters for AES-256');
  } else {
    console.log('1. ✅ MPESA_KMS_KEY is set');
  }
  
  console.log('2. 🔄 Ensure credentials are properly encrypted in database');
  console.log('3. 🔍 Check Vercel deployment logs for detailed error messages');
  console.log('4. 🧪 Test with a fresh credential set if issues persist');
}

// Run diagnostic
diagnose().catch(console.error);