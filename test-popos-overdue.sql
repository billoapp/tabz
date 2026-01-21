-- Test Popos overdue logic specifically

-- 1. Test the business day end calculation for Popos
SELECT 
    'Popos business day end test' as test_type,
    b.id,
    b.name,
    b.business_hours_simple,
    (NOW() AT TIME ZONE 'Africa/Nairobi')::DATE as today_local,
    calculate_business_day_end(b.id, NOW()) as business_day_end,
    NOW() as current_time,
    CASE 
        WHEN NOW() > calculate_business_day_end(b.id, NOW()) THEN 'CURRENT TIME PAST BUSINESS DAY END'
        ELSE 'CURRENT TIME WITHIN BUSINESS DAY'
    END as time_comparison
FROM bars b 
WHERE name = 'Popos';

-- 2. Find the specific 3-day-old tab for Popos
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end_when_opened,
    NOW() as current_time,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'PAST BUSINESS DAY END - SHOULD BE OVERDUE'
        ELSE 'WITHIN BUSINESS DAY - SHOULD STAY OPEN'
    END as overdue_check,
    should_tab_be_overdue_unified(t.id) as function_result
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE b.name = 'Popos'
  AND t.status = 'open'
  AND get_tab_balance(t.id) > 0
  AND t.opened_at < CURRENT_DATE - INTERVAL '2 days'
ORDER BY t.opened_at DESC;

-- 3. Manually test the overdue logic for that tab
-- Replace TAB_ID_HERE with the actual tab ID from above query
SELECT 
    'Manual overdue test' as test_type,
    should_tab_be_overdue_unified('TAB_ID_HERE') as should_be_overdue;
