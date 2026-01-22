-- Simple Database Check for M-Pesa Issues
-- Run each section separately in Supabase SQL Editor

-- STEP 1: Check RLS policies on bars table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'bars'
ORDER BY policyname;

-- STEP 2: Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'bars';

-- STEP 3: Check M-Pesa columns exist
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%'
ORDER BY column_name;

-- STEP 4: Test direct update (this is the key test)
UPDATE bars 
SET 
  mpesa_enabled = true,
  mpesa_environment = 'sandbox'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- STEP 5: Check if basic update worked
SELECT 
  id,
  name,
  mpesa_enabled,
  mpesa_environment,
  updated_at
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- STEP 6: Test encrypted field update
UPDATE bars 
SET 
  mpesa_consumer_key_encrypted = 'test_value_123'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';

-- STEP 7: Check if encrypted field update worked
SELECT 
  id,
  name,
  mpesa_consumer_key_encrypted,
  updated_at
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';