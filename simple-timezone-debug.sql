-- Simple timezone debug without special characters

-- Check current timezone
SELECT 
    'Timezone check' as test_type,
    NOW() as current_utc,
    NOW() AT TIME ZONE 'Africa/Nairobi' as current_local;

-- Test the conversion we need
SELECT 
    'Direct conversion test' as test_type,
    '2026-01-21 23:00:00'::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as test_conversion;

-- Test MAKE_TIMESTAMPTZ function
SELECT 
    'MAKE_TIMESTAMPTZ test' as test_type,
    MAKE_TIMESTAMPTZ(2026, 1, 21, 23, 0, 0, 'Africa/Nairobi') as make_timestamp;

-- Test with current date
SELECT 
    'Current date test' as test_type,
    (NOW() AT TIME ZONE 'Africa/Nairobi')::DATE as today_local,
    MAKE_TIMESTAMPTZ(
        EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))::INTEGER,
        EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))::INTEGER,
        EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))::INTEGER,
        23, 0, 0, 'Africa/Nairobi'
    ) as today_23_local;

-- Test manual calculation
SELECT 
    'Manual calculation' as test_type,
    NOW() as current_time,
    NOW() + INTERVAL '3 hours' as plus_3_hours,
    NOW() - INTERVAL '3 hours' as minus_3_hours;
