-- Check and Fix M-Pesa State
-- This script will show the current state and fix the sync issue

-- Step 1: Check current state
SELECT 
  'CURRENT STATE' as step,
  b.id,
  b.name,
  b.mpesa_enabled as bar_mpesa_enabled,
  b.payment_mpesa_enabled as bar_payment_enabled,
  mc.is_active as credentials_active,
  mc.environment as credentials_env,
  mc.business_shortcode as credentials_shortcode
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 2: Fix the sync by updating bars table to match credentials
-- If credentials exist and are active, enable M-Pesa in bars table
-- If no credentials or inactive, disable M-Pesa in bars table
UPDATE bars 
SET 
  mpesa_enabled = COALESCE(
    (SELECT is_active FROM mpesa_credentials WHERE tenant_id = bars.id), 
    false
  ),
  payment_mpesa_enabled = COALESCE(
    (SELECT is_active FROM mpesa_credentials WHERE tenant_id = bars.id), 
    false
  )
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 3: Verify the fix
SELECT 
  'AFTER FIX' as step,
  b.id,
  b.name,
  b.mpesa_enabled as bar_mpesa_enabled,
  b.payment_mpesa_enabled as bar_payment_enabled,
  mc.is_active as credentials_active,
  mc.environment as credentials_env,
  CASE 
    WHEN b.mpesa_enabled = COALESCE(mc.is_active, false) 
         AND b.payment_mpesa_enabled = COALESCE(mc.is_active, false)
    THEN 'SYNCHRONIZED ✅' 
    ELSE 'OUT OF SYNC ❌' 
  END as sync_status,
  CASE 
    WHEN COALESCE(mc.is_active, false) = true OR b.mpesa_enabled = true OR b.payment_mpesa_enabled = true
    THEN 'WILL SHOW M-PESA ✅'
    ELSE 'WILL NOT SHOW M-PESA ❌'
  END as customer_app_behavior
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 4: If you want to force enable M-Pesa for testing (uncomment if needed)
-- UPDATE bars 
-- SET 
--   mpesa_enabled = true,
--   payment_mpesa_enabled = true
-- WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 5: Final verification
SELECT 
  'FINAL CHECK' as step,
  b.name,
  'M-Pesa Available: ' || 
  CASE 
    WHEN COALESCE(mc.is_active, false) = true OR b.mpesa_enabled = true OR b.payment_mpesa_enabled = true
    THEN 'YES ✅'
    ELSE 'NO ❌'
  END as api_result
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';