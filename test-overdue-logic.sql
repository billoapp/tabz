-- Test the overdue logic with current data
-- This will show us what's happening

-- Show all recent tabs and their overdue status
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    NOW() - t.opened_at as age_minutes,
    get_tab_balance(t.id) as balance,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    is_within_business_hours_at_time(t.bar_id, NOW()) as bar_currently_open,
    b.name as bar_name
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.opened_at > NOW() - INTERVAL '2 hours'
ORDER BY t.opened_at DESC;

-- Check if any tabs were incorrectly marked as overdue
SELECT 
    'INCORRECTLY_MARKED_OVERDUE' as issue_type,
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.moved_to_overdue_at,
    get_tab_balance(t.id) as balance,
    should_tab_be_overdue_unified(t.id) as should_be_overdue_now,
    is_within_business_hours_at_time(t.bar_id, NOW()) as bar_currently_open
FROM tabs t
WHERE t.status = 'overdue'
  AND t.opened_at > NOW() - INTERVAL '2 hours'  -- Recently opened
  AND should_tab_be_overdue_unified(t.id) = FALSE  -- But shouldn't be overdue
ORDER BY t.opened_at DESC;