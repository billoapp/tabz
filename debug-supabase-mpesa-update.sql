-- Debug Supabase M-Pesa update issues
-- Run this in Supabase SQL Editor to check permissions and policies

-- 1. Check if the bars table has the correct columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%'
ORDER BY column_name;

-- 2. Check RLS policies on bars table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'bars';

-- 3. Try a direct update to see if it works
-- Replace 'YOUR_BAR_ID' with the actual bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
UPDATE bars 
SET 
  mpesa_enabled = true,
  mpesa_environment = 'sandbox',
  mpesa_business_shortcode = '174379',
  mpesa_consumer_key_encrypted = 'test_encrypted_key',
  mpesa_consumer_secret_encrypted = 'test_encrypted_secret',
  mpesa_passkey_encrypted = 'test_encrypted_passkey'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 4. Check if the update worked
SELECT 
  id,
  name,
  mpesa_enabled,
  mpesa_environment,
  mpesa_business_shortcode,
  CASE 
    WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 'HAS KEY'
    ELSE 'NO KEY'
  END as key_status,
  CASE 
    WHEN mpesa_consumer_secret_encrypted IS NOT NULL THEN 'HAS SECRET'
    ELSE 'NO SECRET'
  END as secret_status,
  CASE 
    WHEN mpesa_passkey_encrypted IS NOT NULL THEN 'HAS PASSKEY'
    ELSE 'NO PASSKEY'
  END as passkey_status
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 5. Check if there are any triggers or constraints that might be interfering
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'bars';

-- 6. Check for any foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'bars';