-- Verify M-Pesa secure schema is properly set up

-- Check if mpesa_credentials table exists with correct structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'mpesa_credentials'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'mpesa_credentials';

-- Check RLS policies
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'mpesa_credentials';

-- Check if audit table exists
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'mpesa_credential_events'
ORDER BY ordinal_position;

-- Check current data (should be empty initially)
SELECT 
    tenant_id,
    environment,
    business_shortcode,
    is_active,
    created_at,
    -- Don't select encrypted fields for security
    (consumer_key_enc IS NOT NULL) as has_consumer_key,
    (consumer_secret_enc IS NOT NULL) as has_consumer_secret,
    (passkey_enc IS NOT NULL) as has_passkey
FROM mpesa_credentials;