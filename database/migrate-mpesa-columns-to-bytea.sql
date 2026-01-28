-- M-Pesa Columns Migration: TEXT → BYTEA
-- Converts M-Pesa credential columns from TEXT to BYTEA for proper storage contract
-- 
-- IMPORTANT: This will clear existing M-Pesa credentials!
-- All bars will need to re-configure their M-Pesa settings after this migration.

-- Step 1: Check current column types
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name IN (
    'mpesa_consumer_key_encrypted',
    'mpesa_consumer_secret_encrypted', 
    'mpesa_passkey_encrypted'
)
ORDER BY column_name;

-- Step 2: Clear existing M-Pesa credentials (required for clean migration)
-- This ensures no data corruption during type conversion
UPDATE bars SET 
    mpesa_consumer_key_encrypted = NULL,
    mpesa_consumer_secret_encrypted = NULL,
    mpesa_passkey_encrypted = NULL,
    mpesa_setup_completed = false,
    mpesa_test_status = 'pending'
WHERE mpesa_consumer_key_encrypted IS NOT NULL 
   OR mpesa_consumer_secret_encrypted IS NOT NULL 
   OR mpesa_passkey_encrypted IS NOT NULL;

-- Step 3: Convert columns from TEXT to BYTEA
ALTER TABLE bars ALTER COLUMN mpesa_consumer_key_encrypted TYPE BYTEA USING NULL;
ALTER TABLE bars ALTER COLUMN mpesa_consumer_secret_encrypted TYPE BYTEA USING NULL;
ALTER TABLE bars ALTER COLUMN mpesa_passkey_encrypted TYPE BYTEA USING NULL;

-- Step 4: Verify the migration
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name IN (
    'mpesa_consumer_key_encrypted',
    'mpesa_consumer_secret_encrypted', 
    'mpesa_passkey_encrypted'
)
ORDER BY column_name;

-- Expected output after migration:
-- mpesa_consumer_key_encrypted    | bytea | YES
-- mpesa_consumer_secret_encrypted | bytea | YES  
-- mpesa_passkey_encrypted         | bytea | YES

-- Step 5: Check how many bars need to reconfigure M-Pesa
SELECT 
    COUNT(*) as total_bars,
    COUNT(CASE WHEN mpesa_enabled = true THEN 1 END) as mpesa_enabled_bars,
    COUNT(CASE WHEN mpesa_setup_completed = true THEN 1 END) as setup_completed_bars
FROM bars;

-- Migration complete!
-- All bars with M-Pesa enabled will need to re-save their credentials in the staff app.