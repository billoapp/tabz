-- Debug specific tab that should be overdue but isn't
-- Replace the bar_id and tab_id with the actual values

-- 1. Find the problematic tab
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.bar_id,
    b.name as bar_name,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.status = 'open'
  AND get_tab_balance(t.id) > 0
  AND t.opened_at < CURRENT_DATE - INTERVAL '2 days'
ORDER BY t.opened_at;

-- 2. Check business hours for that specific bar
-- Replace BAR_ID_HERE with the actual bar ID
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_hours_advanced,
    business_24_hours
FROM bars 
WHERE id = 'BAR_ID_HERE';

-- 3. Test the business day end calculation for the day tab was opened
-- Replace TAB_ID_HERE and BAR_ID_HERE with actual values
SELECT 
    t.id,
    t.opened_at,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    NOW() as current_time,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'SHOULD BE OVERDUE'
        ELSE 'SHOULD NOT BE OVERDUE'
    END as overdue_status,
    get_tab_balance(t.id) as balance
FROM tabs t
WHERE t.id = 'TAB_ID_HERE';

-- 4. Test the unified overdue function directly
SELECT 
    'TAB_ID_HERE' as tab_id,
    should_tab_be_overdue_unified('TAB_ID_HERE') as should_be_overdue;

-- 5. Check if the functions exist and are working
SELECT 
    'is_within_business_hours_at_time' as function_name,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_within_business_hours_at_time') as exists
UNION ALL
SELECT 
    'calculate_business_day_end' as function_name,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'calculate_business_day_end') as exists
UNION ALL
SELECT 
    'should_tab_be_overdue_unified' as function_name,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'should_tab_be_overdue_unified') as exists
UNION ALL
SELECT 
    'get_tab_balance' as function_name,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_tab_balance') as exists;
