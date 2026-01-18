-- Debug the specific tab that was incorrectly marked as overdue
-- Tab ID: 4c8a5f2f-2580-45f2-a4d8-a64261955e91

SELECT 
    'TAB_DETAILS' as debug_step,
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::DATE as created_date,
    CURRENT_DATE as current_date,
    t.opened_at::DATE = CURRENT_DATE as is_created_today,
    NOW() - t.opened_at as age,
    get_tab_balance(t.id) as balance,
    b.name as bar_name,
    b.business_hours_mode,
    b.business_hours_simple,
    b.business_24_hours
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.id = '4c8a5f2f-2580-45f2-a4d8-a64261955e91';

SELECT 
    'BUSINESS_HOURS_CHECK' as debug_step,
    t.bar_id,
    is_within_business_hours_at_time(t.bar_id, NOW()) as currently_within_hours,
    is_within_business_hours_at_time(t.bar_id, t.opened_at) as was_within_hours_when_opened,
    should_tab_be_overdue_unified(t.id) as should_be_overdue_now
FROM tabs t
WHERE t.id = '4c8a5f2f-2580-45f2-a4d8-a64261955e91';

SELECT 
    'TIME_DEBUG' as debug_step,
    NOW() as current_time,
    NOW() AT TIME ZONE 'Africa/Nairobi' as nairobi_time,
    EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_hour,
    EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_minute;

-- Test the should_tab_be_overdue_unified function step by step
SELECT 
    'OVERDUE_LOGIC_TEST' as debug_step,
    t.id,
    get_tab_balance(t.id) > 0 as has_balance,
    NOT is_within_business_hours_at_time(t.bar_id, NOW()) as is_past_closing,
    t.opened_at::DATE = CURRENT_DATE as created_today,
    should_tab_be_overdue_unified(t.id) as final_result
FROM tabs t
WHERE t.id = '4c8a5f2f-2580-45f2-a4d8-a64261955e91';