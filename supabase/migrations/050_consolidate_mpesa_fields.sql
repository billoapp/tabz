-- ============================================
-- Consolidate M-Pesa Fields Migration
-- Remove payment_mpesa_enabled and use only mpesa_enabled
-- ============================================

-- Step 1: Ensure mpesa_enabled has the correct data
-- Copy any data from payment_mpesa_enabled to mpesa_enabled if needed
UPDATE bars 
SET mpesa_enabled = COALESCE(payment_mpesa_enabled, mpesa_enabled, false)
WHERE payment_mpesa_enabled IS NOT NULL;

-- Step 2: Verify data consistency before dropping column
DO $$
DECLARE
    inconsistent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inconsistent_count
    FROM bars 
    WHERE payment_mpesa_enabled IS DISTINCT FROM mpesa_enabled;
    
    IF inconsistent_count > 0 THEN
        RAISE NOTICE 'Found % bars with inconsistent M-Pesa settings. Fixing...', inconsistent_count;
        
        -- Log inconsistent records for audit
        INSERT INTO audit_logs (bar_id, action, details)
        SELECT 
            id,
            'mpesa_field_consolidation',
            jsonb_build_object(
                'old_payment_mpesa_enabled', payment_mpesa_enabled,
                'old_mpesa_enabled', mpesa_enabled,
                'new_mpesa_enabled', COALESCE(payment_mpesa_enabled, mpesa_enabled, false)
            )
        FROM bars 
        WHERE payment_mpesa_enabled IS DISTINCT FROM mpesa_enabled;
        
        -- Fix inconsistencies by prioritizing payment_mpesa_enabled if it exists
        UPDATE bars 
        SET mpesa_enabled = COALESCE(payment_mpesa_enabled, mpesa_enabled, false)
        WHERE payment_mpesa_enabled IS DISTINCT FROM mpesa_enabled;
    ELSE
        RAISE NOTICE 'All M-Pesa settings are consistent. Proceeding with cleanup.';
    END IF;
END $$;

-- Step 3: Drop the duplicate column
ALTER TABLE bars DROP COLUMN IF EXISTS payment_mpesa_enabled;

-- Step 4: Update column comment to reflect its consolidated purpose
COMMENT ON COLUMN bars.mpesa_enabled IS 'Whether M-Pesa payments are enabled for this bar (consolidated from payment_mpesa_enabled)';

-- Step 5: Verification - Show current M-Pesa settings
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_bars,
    COUNT(*) FILTER (WHERE mpesa_enabled = true) as mpesa_enabled_bars,
    COUNT(*) FILTER (WHERE mpesa_enabled = false) as mpesa_disabled_bars
FROM bars;

-- Step 6: Verify no references to old column remain in database
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bars' 
        AND column_name = 'payment_mpesa_enabled'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE EXCEPTION 'payment_mpesa_enabled column still exists after migration!';
    ELSE
        RAISE NOTICE 'Confirmed: payment_mpesa_enabled column has been successfully removed.';
    END IF;
END $$;