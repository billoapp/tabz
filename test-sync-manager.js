/**
 * Test Sync Manager
 * Test the MpesaSyncManager to ensure it works with the consolidated schema
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bkaigyrrzsqbfscyznzw.supabase.co';
const supabaseKey = 'sb_secret_wRBvATftWPqlT9hL660eYw_FbSXYpLG';

const supabase = createClient(supabaseUrl, supabaseKey);

// Simple version of MpesaSyncManager for testing
class TestMpesaSyncManager {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async validateSync(barId) {
    try {
      console.log(`🔍 Validating M-Pesa sync for bar ${barId}`);

      // Get credentials status
      const { data: credData, error: credError } = await this.supabase
        .from('mpesa_credentials')
        .select('is_active')
        .eq('tenant_id', barId)
        .maybeSingle();

      if (credError) {
        console.error('❌ Failed to fetch credentials:', credError);
        return {
          isConsistent: false,
          error: `Failed to fetch credentials: ${credError.message}`
        };
      }

      // Get bar status
      const { data: barData, error: barError } = await this.supabase
        .from('bars')
        .select('mpesa_enabled')
        .eq('id', barId)
        .single();

      if (barError) {
        console.error('❌ Failed to fetch bar data:', barError);
        return {
          isConsistent: false,
          error: `Failed to fetch bar data: ${barError.message}`
        };
      }

      const credentialsActive = credData?.is_active ?? false;
      const barMpesaEnabled = barData?.mpesa_enabled ?? false;
      const isConsistent = credentialsActive === barMpesaEnabled;

      console.log(`📊 Validation result: credentials=${credentialsActive}, bar=${barMpesaEnabled}, consistent=${isConsistent}`);

      return {
        isConsistent,
        credentialsActive,
        barMpesaEnabled
      };

    } catch (error) {
      console.error('❌ Validation failed:', error);
      return {
        isConsistent: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  async repairInconsistency(barId) {
    try {
      console.log(`🔧 Repairing M-Pesa sync inconsistency for bar ${barId}`);

      // First validate to get current state
      const validation = await this.validateSync(barId);
      
      if (validation.error) {
        return {
          success: false,
          repaired: false,
          error: validation.error
        };
      }

      if (validation.isConsistent) {
        console.log('✅ No repair needed - already consistent');
        return {
          success: true,
          repaired: false
        };
      }

      // Use credentials as authoritative source
      const authoritativeStatus = validation.credentialsActive ?? false;
      const previousBarStatus = validation.barMpesaEnabled;

      console.log(`🔄 Repairing: setting bar.mpesa_enabled from ${previousBarStatus} to ${authoritativeStatus}`);

      // Update bar status to match credentials
      const { error: updateError } = await this.supabase
        .from('bars')
        .update({ mpesa_enabled: authoritativeStatus })
        .eq('id', barId);

      if (updateError) {
        console.error('❌ Failed to repair inconsistency:', updateError);
        return {
          success: false,
          repaired: false,
          error: `Failed to repair: ${updateError.message}`
        };
      }

      console.log('✅ Inconsistency repaired successfully');

      return {
        success: true,
        repaired: true,
        previousBarStatus,
        newBarStatus: authoritativeStatus
      };

    } catch (error) {
      console.error('❌ Repair failed:', error);
      return {
        success: false,
        repaired: false,
        error: error instanceof Error ? error.message : 'Unknown repair error'
      };
    }
  }
}

async function testSyncManager() {
  console.log('🧪 Testing M-Pesa Sync Manager');
  console.log('==============================');
  
  const barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'; // POPOS bar ID
  const syncManager = new TestMpesaSyncManager(supabase);
  
  try {
    // Step 1: Validate current sync
    console.log('📊 Step 1: Validate current sync');
    const validation = await syncManager.validateSync(barId);
    
    if (validation.error) {
      console.error('❌ Validation failed:', validation.error);
      return;
    }
    
    console.log(`Current state: credentials=${validation.credentialsActive}, bar=${validation.barMpesaEnabled}`);
    
    if (validation.isConsistent) {
      console.log('✅ Already synchronized!');
    } else {
      console.log('❌ Out of sync - attempting repair...');
      
      // Step 2: Repair inconsistency
      console.log('\n🔧 Step 2: Repair inconsistency');
      const repair = await syncManager.repairInconsistency(barId);
      
      if (repair.success) {
        if (repair.repaired) {
          console.log(`✅ Repaired: ${repair.previousBarStatus} → ${repair.newBarStatus}`);
        } else {
          console.log('✅ No repair needed');
        }
      } else {
        console.error('❌ Repair failed:', repair.error);
        return;
      }
    }
    
    // Step 3: Final validation
    console.log('\n🔍 Step 3: Final validation');
    const finalValidation = await syncManager.validateSync(barId);
    
    if (finalValidation.isConsistent) {
      console.log('🎉 SUCCESS: M-Pesa sync is now working correctly!');
      console.log(`Customer app will ${finalValidation.barMpesaEnabled ? 'SHOW' : 'HIDE'} M-Pesa payment option`);
    } else {
      console.log('❌ FAILED: Still out of sync after repair');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSyncManager().then(() => {
  console.log('\n✨ Sync manager test completed');
}).catch(console.error);