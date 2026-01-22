-- Check if M-Pesa columns exist in bars table
-- Run this in Supabase SQL editor to verify the schema

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    CASE 
        WHEN column_name LIKE 'mpesa_%' THEN '✅ M-Pesa column'
        ELSE '❌ Not M-Pesa column'
    END as status
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%'
ORDER BY column_name;

-- Also check if mpesa_transactions table exists
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'mpesa_transactions' THEN '✅ Table exists'
        ELSE '❌ Table missing'
    END as status
FROM information_schema.tables 
WHERE table_name = 'mpesa_transactions';

-- Count total M-Pesa related columns (should be 10)
SELECT 
    COUNT(*) as mpesa_columns_count,
    CASE 
        WHEN COUNT(*) >= 10 THEN '✅ All M-Pesa columns present'
        ELSE '❌ Missing M-Pesa columns - run fix-mpesa-columns.sql'
    END as migration_status
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%';