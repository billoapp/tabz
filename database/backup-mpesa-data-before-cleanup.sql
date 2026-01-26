-- =====================================================
-- M-Pesa Data Backup Script
-- =====================================================
-- Run this script BEFORE cleanup to backup M-Pesa data
-- This creates backup tables with all the data from over-engineered tables
-- 
-- IMPORTANT: This is optional - only run if you want to preserve historical data
-- =====================================================

-- Create backup tables with timestamp suffix
DO $$
DECLARE
    backup_suffix TEXT := '_backup_' || to_char(now(), 'YYYY_MM_DD_HH24_MI_SS');
BEGIN
    -- Backup mpesa_credentials table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_credentials') THEN
        EXECUTE 'CREATE TABLE mpesa_credentials' || backup_suffix || ' AS SELECT * FROM mpesa_credentials';
        RAISE NOTICE 'Created backup: mpesa_credentials%', backup_suffix;
    END IF;
    
    -- Backup mpesa_transactions table  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_transactions') THEN
        EXECUTE 'CREATE TABLE mpesa_transactions' || backup_suffix || ' AS SELECT * FROM mpesa_transactions';
        RAISE NOTICE 'Created backup: mpesa_transactions%', backup_suffix;
    END IF;
    
    -- Backup mpesa_credential_events table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_credential_events') THEN
        EXECUTE 'CREATE TABLE mpesa_credential_events' || backup_suffix || ' AS SELECT * FROM mpesa_credential_events';
        RAISE NOTICE 'Created backup: mpesa_credential_events%', backup_suffix;
    END IF;
    
    -- Backup mpesa_rate_limit_logs table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_rate_limit_logs') THEN
        EXECUTE 'CREATE TABLE mpesa_rate_limit_logs' || backup_suffix || ' AS SELECT * FROM mpesa_rate_limit_logs';
        RAISE NOTICE 'Created backup: mpesa_rate_limit_logs%', backup_suffix;
    END IF;
    
    RAISE NOTICE 'Backup completed with suffix: %', backup_suffix;
    RAISE NOTICE 'You can now safely run the cleanup script';
END $$;

-- Show what was backed up
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE '%mpesa%backup%'
ORDER BY table_name;