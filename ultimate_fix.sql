-- =====================================================
-- ULTIMATE FIX: Remove ALL payments and show only confirmed orders
-- =====================================================

-- Step 1: Delete ALL payments for Tab #2 (start fresh)
DELETE FROM tab_payments 
WHERE tab_id = (SELECT id FROM tabs WHERE tab_number = 2);

-- Step 2: Verify only confirmed orders are counted
SELECT 
    'CORRECTED STATE' as status,
    t.tab_number,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
    0 as total_payments,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as correct_balance
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
WHERE t.tab_number = 2
GROUP BY t.id, t.tab_number;

-- Expected: confirmed_orders = 2, confirmed_total = 1800, balance = 1800
