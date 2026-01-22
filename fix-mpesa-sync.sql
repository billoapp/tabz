-- Fix M-Pesa Sync Issue
-- Update bars table to match mpesa_credentials table

-- First, let's see the current state
SELECT 
  b.id,
  b.name,
  b.mpesa_enabled as bar_mpesa_enabled,
  b.payment_mpesa_enabled as bar_payment_enabled,
  mc.is_active as credentials_active,
  mc.environment as credentials_env
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Update bars table to match mpesa_credentials
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

-- Verify the fix
SELECT 
  b.id,
  b.name,
  b.mpesa_enabled as bar_mpesa_enabled,
  b.payment_mpesa_enabled as bar_payment_enabled,
  mc.is_active as credentials_active,
  mc.environment as credentials_env,
  CASE 
    WHEN b.mpesa_enabled = COALESCE(mc.is_active, false) 
         AND b.payment_mpesa_enabled = COALESCE(mc.is_active, false)
    THEN 'SYNCHRONIZED' 
    ELSE 'OUT OF SYNC' 
  END as sync_status
FROM bars b
LEFT JOIN mpesa_credentials mc ON b.id = mc.tenant_id
WHERE b.id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';