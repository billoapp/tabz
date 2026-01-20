-- Quick diagnostic to check current M-Pesa schema state
-- Run this in Supabase SQL Editor to see what columns exist

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    CASE 
        WHEN column_name LIKE 'mpesa_%' THEN '🔧 M-Pesa column'
        WHEN column_name LIKE 'payment_%' THEN '⚠️ Payment column'
        ELSE '❌ Other'
    END as status
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND (column_name LIKE 'mpesa_%' OR column_name LIKE 'payment_%')
ORDER BY column_name;

-- Check if any bars have M-Pesa settings
SELECT 
    COUNT(*) as total_bars,
    COUNT(CASE WHEN payment_mpesa_enabled = true THEN 1 END) as old_mpesa_enabled,
    COUNT(CASE WHEN mpesa_enabled = true THEN 1 END) as new_mpesa_enabled,
    COUNT(CASE WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 1 END) as has_encrypted_credentials
FROM bars;

-- Show the exact error we're dealing with
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bars' AND column_name = 'mpesa_consumer_key_encrypted') 
        THEN '✅ New M-Pesa columns exist'
        ELSE '❌ Missing new M-Pesa columns - need to run fix-mpesa-duplicates.sql'
    END as schema_status;