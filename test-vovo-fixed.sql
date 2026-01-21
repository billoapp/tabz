-- Test Vovo Cafe tabs with the fixed timezone function

SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    CASE 
        WHEN NOW() > calculate_business_day_end(t.bar_id, t.opened_at) THEN 'PAST BUSINESS HOURS'
        ELSE 'WITHIN BUSINESS HOURS'
    END as time_status,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    CASE 
        WHEN should_tab_be_overdue_unified(t.id) THEN 'OVERDUE'
        ELSE 'NOT OVERDUE'
    END as overdue_check
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
ORDER BY t.opened_at DESC;
