-- Check RLS Policies for bars table
-- Run this in Supabase SQL Editor

-- 1. Check all RLS policies on bars table
SELECT 
  policyname,
  cmd as command,
  permissive,
  roles,
  qual as condition,
  with_check
FROM pg_policies 
WHERE tablename = 'bars'
ORDER BY cmd, policyname;

-- 2. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'bars';

-- 3. Test direct UPDATE as service_role would do
-- This simulates what the API does
UPDATE bars 
SET 
  mpesa_enabled = true,
  mpesa_environment = 'sandbox',
  mpesa_business_shortcode = '174379'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 4. Check if the update worked
SELECT 
  id,
  name,
  mpesa_enabled,
  mpesa_environment,
  mpesa_business_shortcode,
  updated_at
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 5. Test encrypted field update
UPDATE bars 
SET 
  mpesa_consumer_key_encrypted = 'test_encrypted_value_123',
  mpesa_consumer_secret_encrypted = 'test_encrypted_secret_123',
  mpesa_passkey_encrypted = 'test_encrypted_passkey_123'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 6. Check if encrypted fields were updated
SELECT 
  id,
  name,
  mpesa_consumer_key_encrypted IS NOT NULL as has_key,
  mpesa_consumer_secret_encrypted IS NOT NULL as has_secret,
  mpesa_passkey_encrypted IS NOT NULL as has_passkey,
  LENGTH(mpesa_consumer_key_encrypted) as key_length,
  updated_at
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';