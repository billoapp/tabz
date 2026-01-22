-- Fix M-Pesa duplicate columns in bars table
-- The migration was applied but created duplicates

-- Step 1: Consolidate mpesa_enabled columns
-- Copy data from payment_mpesa_enabled to mpesa_enabled if needed
UPDATE bars 
SET mpesa_enabled = payment_mpesa_enabled 
WHERE mpesa_enabled IS NULL OR mpesa_enabled = false;

-- Step 2: Remove old unencrypted mpesa_passkey column (security risk)
-- First, check if there's any data that needs to be migrated
DO $$ 
BEGIN
    -- Only proceed if the old column exists and has data
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bars' AND column_name = 'mpesa_passkey'
    ) THEN
        -- Log any bars that have unencrypted passkeys
        RAISE NOTICE 'Found % bars with unencrypted passkeys that need manual migration', 
            (SELECT COUNT(*) FROM bars WHERE mpesa_passkey IS NOT NULL AND mpesa_passkey != '');
        
        -- Drop the old unencrypted column (security best practice)
        ALTER TABLE bars DROP COLUMN IF EXISTS mpesa_passkey;
        RAISE NOTICE 'Dropped insecure mpesa_passkey column';
    END IF;
END $$;

-- Step 3: Remove old M-Pesa columns that are no longer needed
ALTER TABLE bars DROP COLUMN IF EXISTS mpesa_till_number;
ALTER TABLE bars DROP COLUMN IF EXISTS mpesa_paybill_number;

-- Step 4: Verify the final schema
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    CASE 
        WHEN column_name LIKE 'mpesa_%' THEN '✅ M-Pesa column'
        WHEN column_name = 'payment_mpesa_enabled' THEN '⚠️ Old payment column (keep for compatibility)'
        ELSE '❌ Not M-Pesa related'
    END as status
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND (column_name LIKE 'mpesa_%' OR column_name LIKE 'payment_%')
ORDER BY column_name;

-- Step 5: Update the settings page to use the correct column
-- The settings page should use mpesa_enabled, not payment_mpesa_enabled

COMMENT ON COLUMN bars.mpesa_enabled IS 'Whether M-Pesa payments are enabled (primary column)';
COMMENT ON COLUMN bars.payment_mpesa_enabled IS 'Legacy column - use mpesa_enabled instead';

-- Final verification
SELECT 
    COUNT(*) as total_bars,
    COUNT(CASE WHEN mpesa_enabled = true THEN 1 END) as mpesa_enabled_count,
    COUNT(CASE WHEN mpesa_setup_completed = true THEN 1 END) as setup_completed_count
FROM bars;