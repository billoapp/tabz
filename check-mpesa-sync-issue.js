/**
 * Check M-Pesa Sync Issue
 * Compares the two different M-Pesa enable statuses
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

async function checkMpesaSyncIssue() {
  console.log('🔍 Checking M-Pesa Sync Issue');
  console.log('=============================');
  
  const poposBarId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  
  try {
    // Check the bars table (old system - used by customer app)
    console.log('📊 OLD SYSTEM (bars table - used by customer app):');
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select('id, name, payment_mpesa_enabled, mpesa_enabled')
      .eq('id', poposBarId)
      .single();
    
    if (barError) {
      console.log('❌ Error fetching from bars:', barError.message);
    } else {
      console.log(`   Bar: ${barData.name}`);
      console.log(`   payment_mpesa_enabled: ${barData.payment_mpesa_enabled}`);
      console.log(`   mpesa_enabled: ${barData.mpesa_enabled}`);
    }
    
    console.log('\n📊 NEW SYSTEM (mpesa_credentials table - used by staff app):');
    const { data: credData, error: credError } = await supabase
      .from('mpesa_credentials')
      .select('tenant_id, is_active, environment, business_shortcode')
      .eq('tenant_id', poposBarId)
      .single();
    
    if (credError) {
      console.log('❌ Error fetching from mpesa_credentials:', credError.message);
    } else {
      console.log(`   tenant_id: ${credData.tenant_id}`);
      console.log(`   is_active: ${credData.is_active}`);
      console.log(`   environment: ${credData.environment}`);
      console.log(`   business_shortcode: ${credData.business_shortcode}`);
    }
    
    console.log('\n🔍 SYNC ANALYSIS:');
    if (barData && credData) {
      const customerAppSees = barData.payment_mpesa_enabled;
      const staffAppSees = credData.is_active;
      
      console.log(`   Customer app sees M-Pesa as: ${customerAppSees ? 'ENABLED' : 'DISABLED'}`);
      console.log(`   Staff app sees M-Pesa as: ${staffAppSees ? 'ENABLED' : 'DISABLED'}`);
      
      if (customerAppSees === staffAppSees) {
        console.log('   ✅ SYNC STATUS: Both systems are in sync');
      } else {
        console.log('   ❌ SYNC STATUS: Systems are OUT OF SYNC!');
        console.log('   🔧 SOLUTION NEEDED: Update bars.payment_mpesa_enabled to match mpesa_credentials.is_active');
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Update M-Pesa settings API to sync both fields');
    console.log('2. Create a migration script to sync existing data');
    console.log('3. Consider removing the old field and updating customer app to use new system');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkMpesaSyncIssue().catch(console.error);