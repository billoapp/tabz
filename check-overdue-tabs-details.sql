-- Check details of all overdue tabs

SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.moved_to_overdue_at,
    t.overdue_reason,
    get_tab_balance(t.id) as balance,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'PAST BUSINESS HOURS'
        ELSE 'WITHIN BUSINESS HOURS'
    END as time_status,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    -- Order and payment summary
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') as confirmed_orders,
    (SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') as order_total,
    (SELECT COUNT(*) FROM tab_payments WHERE tab_id = t.id AND status = 'success') as successful_payments,
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND status = 'success') as payment_total
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status = 'overdue'
ORDER BY t.moved_to_overdue_at DESC NULLS FIRST;
