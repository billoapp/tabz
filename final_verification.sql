-- =====================================================
-- FINAL VERIFICATION: Check the true state
-- =====================================================

-- Show all payments for Tab #2
SELECT 
    'ALL PAYMENTS FOR TAB #2' as info,
    p.id,
    p.amount,
    p.method,
    p.reference,
    p.status,
    p.created_at,
    p.metadata
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE t.tab_number = 2
ORDER BY p.created_at;

-- Show what the balance should be (confirmed orders only)
SELECT 
    'TRUE BALANCE CALCULATION' as info,
    t.tab_number,
    COUNT(o.id) as total_orders,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
    COALESCE(SUM(p.amount), 0) as total_payments,
    (COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) - COALESCE(SUM(p.amount), 0)) as current_balance
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
WHERE t.tab_number = 2
GROUP BY t.id, t.tab_number;

-- Expected result: confirmed_total = 1800, total_payments = 0, balance = 1800
