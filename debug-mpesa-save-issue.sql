-- Debug M-Pesa save issue
-- Run this to see what's actually in the database

-- Check if M-Pesa settings are being saved
SELECT 
    id,
    name,
    mpesa_enabled,
    mpesa_environment,
    mpesa_business_shortcode,
    CASE 
        WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 'HAS ENCRYPTED KEY'
        ELSE 'NO KEY'
    END as consumer_key_status,
    CASE 
        WHEN mpesa_consumer_secret_encrypted IS NOT NULL THEN 'HAS ENCRYPTED SECRET'
        ELSE 'NO SECRET'
    END as consumer_secret_status,
    CASE 
        WHEN mpesa_passkey_encrypted IS NOT NULL THEN 'HAS ENCRYPTED PASSKEY'
        ELSE 'NO PASSKEY'
    END as passkey_status,
    mpesa_setup_completed,
    mpesa_test_status,
    mpesa_last_test_at
FROM bars 
ORDER BY name;

-- Check for any recent updates
SELECT 
    COUNT(*) as total_bars,
    COUNT(CASE WHEN mpesa_enabled = true THEN 1 END) as enabled_count,
    COUNT(CASE WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 1 END) as has_credentials_count,
    COUNT(CASE WHEN mpesa_setup_completed = true THEN 1 END) as setup_completed_count
FROM bars;

-- Show the exact structure to verify columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%'
ORDER BY column_name;