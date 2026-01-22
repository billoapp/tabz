-- Fix M-Pesa database state issues
-- Run this in Supabase SQL Editor

-- Clear the test data and reset M-Pesa state for proper testing
UPDATE bars 
SET 
  mpesa_enabled = false,
  payment_mpesa_enabled = false,
  mpesa_business_shortcode = null,
  mpesa_consumer_key_encrypted = null,
  mpesa_consumer_secret_encrypted = null,
  mpesa_passkey_encrypted = null,
  mpesa_setup_completed = false,
  mpesa_test_status = 'pending',
  mpesa_last_test_at = null
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- Verify the reset
SELECT 
  name,
  mpesa_enabled,
  payment_mpesa_enabled,
  mpesa_business_shortcode,
  CASE 
    WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 'HAS KEY'
    ELSE 'NO KEY'
  END as key_status,
  mpesa_setup_completed,
  mpesa_test_status
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';