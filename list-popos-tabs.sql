-- Get all tabs for Popos bar with detailed information

SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 as hours_open,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance,
    t.moved_to_overdue_at,
    t.overdue_reason,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'PAST BUSINESS HOURS'
        ELSE 'WITHIN BUSINESS HOURS'
    END as business_status,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    CASE 
        WHEN should_tab_be_overdue_unified(t.id) THEN 'OVERDUE'
        ELSE 'NOT OVERDUE'
    END as overdue_check,
    -- Order and payment counts
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') as confirmed_orders,
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_orders,
    (SELECT COUNT(*) FROM tab_payments WHERE tab_id = t.id AND status = 'success') as successful_payments
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE b.name = 'Popos'
ORDER BY t.opened_at DESC;
