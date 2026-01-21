-- Final test of complete tab status system

-- Test all overdue tabs with fixed balance function
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    get_tab_balance(t.id) as balance,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    CASE 
        WHEN should_tab_be_overdue_unified(t.id) THEN 'SHOULD BE OVERDUE'
        ELSE 'SHOULD NOT BE OVERDUE'
    END as expected_status,
    CASE 
        WHEN t.status = 'overdue' AND should_tab_be_overdue_unified(t.id) THEN 'CORRECTLY OVERDUE'
        WHEN t.status = 'overdue' AND NOT should_tab_be_overdue_unified(t.id) THEN 'INCORRECTLY OVERDUE'
        WHEN t.status = 'closed' AND should_tab_be_overdue_unified(t.id) THEN 'SHOULD BE OVERDUE BUT IS CLOSED'
        ELSE 'CORRECTLY NOT OVERDUE'
    END as status_check
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
ORDER BY t.opened_at DESC;

-- Test order blocking on overdue tabs
SELECT 
    'Order blocking test' as test_type,
    t.id,
    t.tab_number,
    t.status,
    get_tab_balance(t.id) as balance,
    can_tab_accept_orders(t.id) as can_accept_orders
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status = 'overdue'
ORDER BY t.opened_at DESC;
