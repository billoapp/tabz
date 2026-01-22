/**
 * Clean up M-Pesa Credentials
 * Deletes all existing M-Pesa credentials that were encrypted with the exposed key
 */

const { createClient } = require('@supabase/supabase-js');
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

console.log('🧹 M-Pesa Credential Cleanup Script');
console.log('===================================');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SECRET_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupCredentials() {
  try {
    console.log('🔍 Fetching existing M-Pesa credentials...');
    
    // Get all M-Pesa credentials
    const { data: credentials, error } = await supabase
      .from('mpesa_credentials')
      .select('id, tenant_id, environment, business_shortcode, created_at');
    
    if (error) {
      throw new Error(`Failed to fetch credentials: ${error.message}`);
    }
    
    if (!credentials || credentials.length === 0) {
      console.log('ℹ️ No M-Pesa credentials found to clean up');
      return;
    }
    
    console.log(`📋 Found ${credentials.length} credential record(s) to delete:`);
    
    for (const cred of credentials) {
      console.log(`   🏢 Tenant: ${cred.tenant_id}`);
      console.log(`      Environment: ${cred.environment}`);
      console.log(`      Business Code: ${cred.business_shortcode}`);
      console.log(`      Created: ${cred.created_at}`);
    }
    
    console.log('\n⚠️ WARNING: This will permanently delete all M-Pesa credentials!');
    console.log('🔒 These credentials were encrypted with the exposed key and need to be re-entered.');
    
    // Delete all credentials
    console.log('\n🗑️ Deleting all M-Pesa credentials...');
    
    const { error: deleteError } = await supabase
      .from('mpesa_credentials')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that matches all)
    
    if (deleteError) {
      throw new Error(`Failed to delete credentials: ${deleteError.message}`);
    }
    
    // Log audit event for each deleted credential
    for (const cred of credentials) {
      await supabase
        .from('mpesa_credential_events')
        .insert({
          credential_id: cred.id,
          tenant_id: cred.tenant_id,
          event_type: 'deleted',
          event_data: {
            reason: 'security_incident_key_exposure',
            cleanup_date: new Date().toISOString(),
            original_environment: cred.environment,
            original_business_shortcode: cred.business_shortcode
          }
        });
    }
    
    console.log('✅ All M-Pesa credentials have been deleted');
    console.log('🔄 Users will need to re-enter their M-Pesa credentials in the settings');
    console.log('🔒 New credentials will be encrypted with the new secure key');
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`   🗑️ Deleted credentials: ${credentials.length}`);
    console.log(`   📝 Audit events logged: ${credentials.length}`);
    console.log('   ✅ Cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupCredentials().catch(console.error);