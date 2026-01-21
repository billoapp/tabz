-- Debug the business hours calculation for Popos bar

-- 1. Get Popos bar details
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_hours_advanced,
    business_24_hours
FROM bars 
WHERE name ILIKE '%popos%';

-- 2. Test the is_within_business_hours_at_time function directly
SELECT 
    'Current time test' as test_type,
    is_within_business_hours_at_time(b.id, NOW()) as is_currently_open,
    NOW() as current_time
FROM bars b 
WHERE name ILIKE '%popos%';

-- 3. Test calculate_business_day_end step by step
SELECT 
    b.id,
    b.name,
    b.business_hours_mode,
    b.business_hours_simple,
    'Testing business day end calculation' as test_type,
    (NOW() AT TIME ZONE 'Africa/Nairobi')::DATE as local_date,
    calculate_business_day_end(b.id, NOW()) as calculated_end_time,
    CASE 
        WHEN calculate_business_day_end(b.id, NOW()) IS NULL THEN 'NULL - 24hr or no config'
        WHEN NOW() > calculate_business_day_end(b.id, NOW()) THEN 'PAST business hours - should be overdue'
        ELSE 'WITHIN business hours - should stay open'
    END as overdue_status
FROM bars b 
WHERE name ILIKE '%popos%';

-- 4. Find the specific tab that should be overdue
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.bar_id,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance,
    b.name as bar_name,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    CASE 
        WHEN should_tab_be_overdue_unified(t.id) THEN 'OVERDUE'
        ELSE 'NOT OVERDUE'
    END as status_check
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE b.name ILIKE '%popos%'
  AND t.status = 'open'
  AND get_tab_balance(t.id) > 0
ORDER BY t.opened_at DESC;
