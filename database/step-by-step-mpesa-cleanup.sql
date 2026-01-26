-- =====================================================
-- Step-by-Step M-Pesa Cleanup Script
-- =====================================================
-- This script provides individual steps to safely remove over-engineered M-Pesa components
-- Run each step separately and verify results before proceeding to the next step
--
-- IMPORTANT: 
-- 1. BACKUP your database before running any of these steps!
-- 2. Verify the simplified M-Pesa system works correctly before cleanup
-- 3. Run each step individually, not all at once
-- =====================================================

-- STEP 1: Check what M-Pesa tables currently exist
-- Run this first to see what needs to be cleaned up
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%mpesa%'
ORDER BY table_name;

-- STEP 2: Check for any data in M-Pesa tables (OPTIONAL - for backup purposes)
-- Uncomment and run these if you want to see what data exists before deletion

-- SELECT COUNT(*) as mpesa_credentials_count FROM mpesa_credentials;
-- SELECT COUNT(*) as mpesa_transactions_count FROM mpesa_transactions;  
-- SELECT COUNT(*) as mpesa_credential_events_count FROM mpesa_credential_events;

-- STEP 3: Drop mpesa_credential_events table (has foreign keys to other tables)
-- This table tracks audit events for credential changes
DROP TABLE IF EXISTS mpesa_credential_events CASCADE;

-- Verify step 3
SELECT 'mpesa_credential_events dropped' as status 
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'mpesa_credential_events'
);

-- STEP 4: Drop mpesa_transactions table 
-- This table duplicates payment data that's now in tab_payments
DROP TABLE IF EXISTS mpesa_transactions CASCADE;

-- Verify step 4
SELECT 'mpesa_transactions dropped' as status 
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'mpesa_transactions'
);

-- STEP 5: Drop mpesa_credentials table
-- This table stored encrypted credentials that are now environment variables
DROP TABLE IF EXISTS mpesa_credentials CASCADE;

-- Verify step 5
SELECT 'mpesa_credentials dropped' as status 
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'mpesa_credentials'
);

-- STEP 6: Drop rate limiting table if it exists
-- This was part of the over-engineered rate limiting system
DROP TABLE IF EXISTS mpesa_rate_limit_logs CASCADE;

-- Verify step 6
SELECT 'mpesa_rate_limit_logs dropped (or never existed)' as status 
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'mpesa_rate_limit_logs'
);

-- STEP 7: Clean up any orphaned functions
-- These functions were specific to the over-engineered system
DROP FUNCTION IF EXISTS update_mpesa_credentials_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_mpesa_transactions_updated_at() CASCADE;
DROP FUNCTION IF EXISTS validate_transaction_state_transition() CASCADE;

-- STEP 8: Final verification - check that all M-Pesa tables are gone
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: All over-engineered M-Pesa tables removed'
        ELSE 'WARNING: ' || COUNT(*) || ' M-Pesa tables still exist'
    END as cleanup_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%mpesa%';

-- STEP 9: Verify the simplified system tables still exist
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'tab_payments' THEN 'Used by simplified M-Pesa system'
        WHEN table_name = 'bars' THEN 'Contains M-Pesa configuration columns'
        ELSE 'Other table'
    END as purpose
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('tab_payments', 'bars')
ORDER BY table_name;

-- STEP 10: Show remaining M-Pesa configuration in bars table
-- This confirms the simplified system configuration is still intact
SELECT 
    'M-Pesa configuration columns in bars table:' as info,
    COUNT(*) as bars_with_mpesa_config
FROM bars 
WHERE mpesa_enabled IS NOT NULL;