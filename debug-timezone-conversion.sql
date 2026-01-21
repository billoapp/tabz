-- Debug the timezone conversion step by step

-- Check what timezone PostgreSQL thinks we're in
SELECT 
    'Timezone check' as test_type,
    NOW() as current_utc,
    NOW() AT TIME ZONE 'Africa/Nairobi' as current_local,
    EXTRACT(TIMEZONE FROM NOW()) as db_timezone,
    EXTRACT(TIMEZONE FROM NOW() AT TIME ZONE 'Africa/Nairobi') as local_timezone;

-- Test the exact conversion we need
SELECT 
    'Direct conversion test' as test_type,
    '2026-01-21 23:00:00'::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as test_conversion,
    ('2026-01-21 23:00:00'::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'UTC' as test_to_utc;

-- Test different approaches
SELECT 
    'Approach 1: String concat' as test_type,
    ('2026-01-21'::DATE || ' 23:00:00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as approach1;

SELECT 
    'Approach 2: Make timestamp' as test_type,
    MAKE_TIMESTAMP(2026, 1, 21, 23, 0, 0) AT TIME ZONE 'Africa/Nairobi' as approach2;

SELECT 
    'Approach 3: Make timestamptz' as test_type,
    MAKE_TIMESTAMPTZ(2026, 1, 21, 23, 0, 0, 'Africa/Nairobi') as approach3;

-- Test what happens with current date
SELECT 
    'Current date test' as test_type,
    (NOW() AT TIME ZONE 'Africa/Nairobi')::DATE as today_local,
    MAKE_TIMESTAMPTZ(
        EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))::INTEGER,
        EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))::INTEGER,
        EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))::INTEGER,
        23, 0, 0, 'Africa/Nairobi'
    ) as today_23_local;

-- The correct calculation should be:
-- 23:00 Africa/Nairobi = 20:00 UTC (since Africa/Nairobi is UTC+3)
SELECT 
    'Expected result' as test_type,
    '23:00 Africa/Nairobi should equal 20:00 UTC' as expectation;
