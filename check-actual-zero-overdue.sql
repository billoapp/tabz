-- Check actual overdue tabs with zero balance

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
  AND t.status = 'overdue'
  AND get_tab_balance(t.id) <= 0
ORDER BY t.moved_to_overdue_at DESC NULLS FIRST;

-- Check if there are any overdue tabs with zero balance
SELECT 
    'Summary' as info_type,
    COUNT(*) as overdue_zero_balance_tabs,
    COUNT(CASE WHEN get_tab_balance(t.id) <= 0 THEN 1 END) as zero_balance_count
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status = 'overdue';
