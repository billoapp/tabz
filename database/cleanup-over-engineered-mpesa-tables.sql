-- =====================================================
-- M-Pesa Over-Engineered Components Cleanup Script
-- =====================================================
-- This script removes all over-engineered M-Pesa tables and components
-- that were replaced by the simplified M-Pesa payment system.
--
-- IMPORTANT: Run this script AFTER verifying the simplified M-Pesa system works correctly
-- BACKUP your database before running this script!
--
-- Tables to be removed:
-- - mpesa_credentials (replaced by environment variables)
-- - mpesa_transactions (replaced by tab_payments records)
-- - mpesa_credential_events (audit logging removed)
-- - mpesa_rate_limit_logs (rate limiting removed)
--
-- Functions and triggers to be removed:
-- - All M-Pesa specific functions and triggers
--
-- =====================================================

-- Step 1: Drop dependent triggers first
DROP TRIGGER IF EXISTS trigger_update_mpesa_credentials_updated_at ON mpesa_credentials;
DROP TRIGGER IF EXISTS trigger_update_mpesa_transactions_updated_at ON mpesa_transactions;
DROP TRIGGER IF EXISTS trigger_validate_transaction_state_transition ON mpesa_transactions;

-- Step 2: Drop dependent functions
DROP FUNCTION IF EXISTS update_mpesa_credentials_updated_at();
DROP FUNCTION IF EXISTS update_mpesa_transactions_updated_at();
DROP FUNCTION IF EXISTS validate_transaction_state_transition();

-- Step 3: Drop foreign key constraints and indexes
-- (These will be dropped automatically with the tables, but listing for clarity)

-- Step 4: Drop the over-engineered tables in dependency order

-- Drop mpesa_credential_events first (has foreign key to mpesa_credentials)
DROP TABLE IF EXISTS mpesa_credential_events CASCADE;

-- Drop mpesa_transactions (has foreign key to tab_payments)
DROP TABLE IF EXISTS mpesa_transactions CASCADE;

-- Drop mpesa_credentials table
DROP TABLE IF EXISTS mpesa_credentials CASCADE;

-- Drop rate limiting table if it exists
DROP TABLE IF EXISTS mpesa_rate_limit_logs CASCADE;

-- Step 5: Clean up any remaining M-Pesa specific functions
-- (Add any other M-Pesa specific functions that might exist)

-- Step 6: Remove M-Pesa specific columns from bars table that are no longer needed
-- Note: We keep the basic M-Pesa configuration columns in bars table for the simplified system:
-- - mpesa_enabled (still used)
-- - mpesa_environment (still used) 
-- - mpesa_business_shortcode (still used)
-- - mpesa_consumer_key_encrypted (still used)
-- - mpesa_consumer_secret_encrypted (still used)
-- - mpesa_passkey_encrypted (still used)
-- - mpesa_callback_url (still used)
-- - mpesa_setup_completed (still used)
-- - mpesa_last_test_at (still used)
-- - mpesa_test_status (still used)

-- The bars table columns are kept because the simplified system uses them
-- This provides a clean migration path from over-engineered to simplified

-- Step 7: Verify cleanup
DO $$
BEGIN
    -- Check if tables were successfully dropped
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_credentials') THEN
        RAISE NOTICE 'WARNING: mpesa_credentials table still exists';
    ELSE
        RAISE NOTICE 'SUCCESS: mpesa_credentials table removed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_transactions') THEN
        RAISE NOTICE 'WARNING: mpesa_transactions table still exists';
    ELSE
        RAISE NOTICE 'SUCCESS: mpesa_transactions table removed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_credential_events') THEN
        RAISE NOTICE 'WARNING: mpesa_credential_events table still exists';
    ELSE
        RAISE NOTICE 'SUCCESS: mpesa_credential_events table removed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_rate_limit_logs') THEN
        RAISE NOTICE 'WARNING: mpesa_rate_limit_logs table still exists';
    ELSE
        RAISE NOTICE 'SUCCESS: mpesa_rate_limit_logs table removed (or never existed)';
    END IF;
    
    RAISE NOTICE 'M-Pesa over-engineered components cleanup completed!';
    RAISE NOTICE 'The simplified M-Pesa system now uses only:';
    RAISE NOTICE '- tab_payments table for payment records';
    RAISE NOTICE '- bars table columns for M-Pesa configuration';
    RAISE NOTICE '- Environment variables for credentials (MPESA_*)';
END $$;