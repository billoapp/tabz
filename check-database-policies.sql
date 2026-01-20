-- Check Database Policies and Permissions for M-Pesa Issues
-- Run this in Supabase SQL Editor

-- 1. Check RLS policies on bars table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'bars'
ORDER BY policyname;

-- 2. Check if RLS is enabled on bars table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'bars';

-- 3. Check column permissions and constraints on bars table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%'
ORDER BY column_name;

-- 4. Check for any constraints that might block updates
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  tc.table_name,
  kcu.column_name,
  tc.is_deferrable,
  tc.initially_deferred
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'bars'
AND kcu.column_name LIKE 'mpesa_%';

-- 5. Check for triggers that might interfere with updates
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'bars'
ORDER BY trigger_name;

-- 6. Test direct update to see if it works (replace with actual bar ID)
-- This will help identify if it's a permissions issue
UPDATE bars 
SET 
  mpesa_enabled = true,
  mpesa_environment = 'sandbox',
  mpesa_business_shortcode = '174379'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 7. Check if the update worked
SELECT 
  id,
  name,
  mpesa_enabled,
  mpesa_environment,
  mpesa_business_shortcode,
  updated_at
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 8. Try updating encrypted fields directly
UPDATE bars 
SET 
  mpesa_consumer_key_encrypted = 'test_encrypted_value',
  mpesa_consumer_secret_encrypted = 'test_encrypted_value',
  mpesa_passkey_encrypted = 'test_encrypted_value'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 9. Check if encrypted fields were updated
SELECT 
  id,
  name,
  mpesa_consumer_key_encrypted IS NOT NULL as has_key,
  mpesa_consumer_secret_encrypted IS NOT NULL as has_secret,
  mpesa_passkey_encrypted IS NOT NULL as has_passkey,
  updated_at
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- 10. Check current user and role
SELECT current_user, current_role;

-- 11. Check grants on bars table
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'bars';

-- 12. If RLS is blocking, temporarily disable it for testing (BE CAREFUL!)
-- Uncomment only if you want to test without RLS
-- ALTER TABLE bars DISABLE ROW LEVEL SECURITY;

-- 13. Re-enable RLS after testing (if you disabled it)
-- ALTER TABLE bars ENABLE ROW LEVEL SECURITY;