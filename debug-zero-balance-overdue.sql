-- Debug why zero balance tabs are marked overdue

-- Check all zero balance tabs and their status
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.moved_to_overdue_at,
    t.overdue_reason,
    get_tab_balance(t.id) as balance,
    CASE 
        WHEN get_tab_balance(t.id) <= 0 THEN 'SHOULD NOT BE OVERDUE'
        ELSE 'SHOULD BE OVERDUE'
    END as expected_status,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'PAST BUSINESS HOURS'
        ELSE 'WITHIN BUSINESS HOURS'
    END as time_status
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND get_tab_balance(t.id) <= 0
ORDER BY t.opened_at DESC;

-- Check what moved these tabs to overdue
SELECT 
    'Overdue history check' as info_type,
    t.id,
    t.tab_number,
    t.status,
    t.moved_to_overdue_at,
    t.overdue_reason,
    get_tab_balance(t.id) as current_balance,
    -- Check if there were any orders at the time it was moved to overdue
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND created_at <= t.moved_to_overdue_at) as orders_at_overdue_time,
    -- Check if there were any payments at the time it was moved to overdue
    (SELECT COUNT(*) FROM tab_payments WHERE tab_id = t.id AND created_at <= t.moved_to_overdue_at) as payments_at_overdue_time
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status = 'overdue'
  AND get_tab_balance(t.id) <= 0
ORDER BY t.moved_to_overdue_at DESC NULLS FIRST;

-- Check the update_overdue_tabs_unified function logic
SELECT 
    'Function logic check' as info_type,
    t.id,
    t.tab_number,
    t.status,
    get_tab_balance(t.id) as balance,
    should_tab_be_overdue_unified(t.id) as should_be_overdue
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status = 'overdue'
  AND get_tab_balance(t.id) <= 0
ORDER BY t.opened_at DESC;
