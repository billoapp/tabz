/**
 * Inspect M-Pesa Database Records
 * Examines the raw database structure and data types
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function inspectDatabase() {
  console.log('🔍 Inspecting M-Pesa Database Records');
  console.log('====================================');
  
  try {
    // First, check the bars table for M-Pesa data
    console.log('📋 Checking BARS table for M-Pesa credentials...\n');
    
    const { data: bars, error: barsError } = await supabase
      .from('bars')
      .select(`
        id,
        name,
        payment_mpesa_enabled,
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted,
        mpesa_setup_completed,
        mpesa_last_test_at,
        mpesa_test_status
      `);
    
    if (barsError) {
      throw new Error(`Failed to fetch bars: ${barsError.message}`);
    }
    
    if (bars && bars.length > 0) {
      console.log(`🏢 Found ${bars.length} bar(s) with M-Pesa data:\n`);
      
      for (const bar of bars) {
        console.log(`🏪 Bar: ${bar.name} (${bar.id})`);
        console.log(`   payment_mpesa_enabled: ${bar.payment_mpesa_enabled}`);
        console.log(`   mpesa_enabled: ${bar.mpesa_enabled}`);
        console.log(`   mpesa_environment: ${bar.mpesa_environment}`);
        console.log(`   mpesa_business_shortcode: ${bar.mpesa_business_shortcode}`);
        console.log(`   mpesa_setup_completed: ${bar.mpesa_setup_completed}`);
        console.log(`   mpesa_test_status: ${bar.mpesa_test_status}`);
        
        // Check encrypted credentials
        const fields = [
          'mpesa_consumer_key_encrypted',
          'mpesa_consumer_secret_encrypted', 
          'mpesa_passkey_encrypted'
        ];
        
        console.log('   🔐 Encrypted Credentials:');
        for (const field of fields) {
          const value = bar[field];
          console.log(`     ${field}:`);
          console.log(`       Present: ${!!value}`);
          console.log(`       Type: ${typeof value}`);
          if (value) {
            console.log(`       Length: ${value.length}`);
            console.log(`       Preview: ${value.substring(0, 20)}...`);
          }
        }
        console.log('');
      }
    }
    
    // Now check the mpesa_credentials table
    console.log('\n📋 Checking MPESA_CREDENTIALS table...\n');
    
    const { data: credentials, error } = await supabase
      .from('mpesa_credentials')
      .select('*');
    
    if (error) {
      console.log(`⚠️ Error accessing mpesa_credentials table: ${error.message}`);
    } else if (!credentials || credentials.length === 0) {
      console.log('ℹ️ No records found in mpesa_credentials table');
    } else {
      console.log(`📋 Found ${credentials.length} record(s) in mpesa_credentials table`);
      
      for (const [index, cred] of credentials.entries()) {
        console.log(`🏢 Record ${index + 1}: ${cred.tenant_id}`);
        console.log(`   Environment: ${cred.environment}`);
        console.log(`   Business Shortcode: ${cred.business_shortcode}`);
        console.log(`   Active: ${cred.is_active}`);
      }
    }
    
    // Focus on the Popos bar (the one we're testing)
    const poposBar = bars?.find(b => b.id === '438c80c1-fe11-4ac5-8a48-2fc45104ba31');
    if (poposBar) {
      console.log('\n🎯 POPOS BAR DETAILED INSPECTION:');
      console.log('================================');
      console.log('Raw record:', JSON.stringify(poposBar, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Inspection failed:', error.message);
    process.exit(1);
  }
}

// Run the inspection
inspectDatabase().catch(console.error);