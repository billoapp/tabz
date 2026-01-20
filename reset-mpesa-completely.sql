-- Complete M-Pesa Reset Script
-- Run this in Supabase SQL Editor to completely reset M-Pesa state

-- 1. Reset the specific bar's M-Pesa settings
UPDATE bars 
SET 
  mpesa_enabled = false,
  payment_mpesa_enabled = false,
  mpesa_environment = 'sandbox',
  mpesa_business_shortcode = null,
  mpesa_consumer_key_encrypted = null,
  mpesa_consumer_secret_encrypted = null,
  mpesa_passkey_encrypted = null,
  mpesa_setup_completed = false,
  mpesa_test_status = 'pending',
  mpesa_last_test_at = null
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 2. Delete any existing M-Pesa transactions for this bar
DELETE FROM mpesa_transactions 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 3. Verify the reset worked
SELECT 
  id,
  name,
  mpesa_enabled,
  mpesa_environment,
  mpesa_business_shortcode,
  mpesa_consumer_key_encrypted,
  mpesa_consumer_secret_encrypted,
  mpesa_passkey_encrypted,
  mpesa_setup_completed,
  mpesa_test_status
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Expected result: All mpesa_*_encrypted fields should be NULL