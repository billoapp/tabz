-- Correct M-Pesa Fix (Updated for consolidated schema)
-- Uses only mpesa_enabled column (payment_mpesa_enabled was removed)

-- Step 1: Check current state
SELECT 
  'CURRENT STATE' as step,
  b.name as bar_name,
  b.mpesa_enabled as bar_mpesa_enabled,
  mc.is_active as credentials_active,
  mc.environment as credentials_env,
  CASE 
    WHEN b.mpesa_enabled = true 
    THEN 'CUSTOMER WILL SEE MPESA ✅'
    ELSE 'CUSTOMER WILL NOT SEE MPESA ❌'
  END as customer_app_behavior,
  CASE 
    WHEN mc.is_active = true 
    THEN 'STAFF SHOWS ACTIVE ✅'
    WHEN mc.is_active = false 
    THEN 'STAFF SHOWS INACTIVE ⚠️'
    ELSE 'NO CREDENTIALS ❌'
  END as staff_app_behavior
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 2: Fix the sync - Update bars.mpesa_enabled to match credentials.is_active
UPDATE bars 
SET mpesa_enabled = COALESCE(
  (SELECT is_active FROM mpesa_credentials WHERE tenant_id = bars.id), 
  false
)
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 3: Verify the fix
SELECT 
  'AFTER FIX' as step,
  b.name as bar_name,
  b.mpesa_enabled as bar_mpesa_enabled,
  mc.is_active as credentials_active,
  CASE 
    WHEN b.mpesa_enabled = COALESCE(mc.is_active, false)
    THEN 'SYNCHRONIZED ✅' 
    ELSE 'STILL OUT OF SYNC ❌' 
  END as sync_status,
  CASE 
    WHEN b.mpesa_enabled = true 
    THEN 'CUSTOMER WILL SEE MPESA ✅'
    ELSE 'CUSTOMER WILL NOT SEE MPESA ❌'
  END as customer_app_result
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 4: If you want to force enable M-Pesa for testing (uncomment if needed)
-- UPDATE bars 
-- SET mpesa_enabled = true
-- WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Step 5: Final check - what the customer app API will return
SELECT 
  'API RESPONSE SIMULATION' as step,
  b.name as bar_name,
  CASE 
    WHEN b.mpesa_enabled = true 
    THEN 'true'
    ELSE 'false'
  END as "paymentMethods.mpesa.available",
  'sandbox' as "paymentMethods.mpesa.environment"
FROM bars b
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';