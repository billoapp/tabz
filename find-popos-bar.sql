-- Find the Popos bar and check its business hours
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_hours_advanced,
    business_24_hours
FROM bars 
WHERE name ILIKE '%popos%';

-- Find tabs for Popos bar that should be overdue
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
    b.business_hours_mode,
    b.business_hours_simple,
    b.business_hours_advanced,
    b.business_24_hours
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE b.name ILIKE '%popos%'
  AND t.status = 'open'
  AND get_tab_balance(t.id) > 0
ORDER BY t.opened_at DESC;

-- Test what happens when business_hours_simple is NULL
SELECT 
    'Test NULL business hours' as test_type,
    calculate_business_day_end(b.id, NOW()) as business_day_end_result
FROM bars b 
WHERE name ILIKE '%popos%'
LIMIT 1;
