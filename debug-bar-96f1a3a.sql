-- Debug specific bar 96f1a3aa-523b-49f3-8138-cefef2d2ba65
-- This bar seems to have issues with tab status logic

-- 1. Get bar details
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_hours_advanced,
    business_24_hours
FROM bars 
WHERE id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65';

-- 2. Get all tabs for this bar with status
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance,
    t.moved_to_overdue_at,
    t.overdue_reason,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'PAST BUSINESS HOURS'
        ELSE 'WITHIN BUSINESS HOURS'
    END as time_status,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    CASE 
        WHEN should_tab_be_overdue_unified(t.id) THEN 'OVERDUE'
        ELSE 'NOT OVERDUE'
    END as overdue_check
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
ORDER BY t.opened_at DESC;

-- 3. Test business day end calculation specifically
SELECT 
    'Business day end test' as test_type,
    calculate_business_day_end('96f1a3aa-523b-49f3-8138-cefef2d2ba65', NOW()) as today_end,
    calculate_business_day_end('96f1a3aa-523b-49f3-8138-cefef2d2ba65', '2026-01-20 12:00:00+00'::TIMESTAMPTZ) as yesterday_end,
    calculate_business_day_end('96f1a3aa-523b-49f3-8138-cefef2d2ba65', '2026-01-19 20:32:00+00'::TIMESTAMPTZ) as day_before;

-- 4. Check what business hours are configured
SELECT 
    'Bar business hours config' as info_type,
    b.business_hours_simple,
    CASE 
        WHEN b.business_hours_simple IS NOT NULL THEN 'HAS CONFIG'
        ELSE 'NULL CONFIG'
    END as config_status
FROM bars b 
WHERE id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65';

-- 5. Test if functions exist for this bar
SELECT 
    'Function test' as test_type,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'calculate_business_day_end') as has_calc_function,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'should_tab_be_overdue_unified') as has_overdue_function,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_tab_balance') as has_balance_function;
