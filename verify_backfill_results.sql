-- =====================================================
-- VERIFY: Check backfill results
-- =====================================================
-- Run this to verify the backfill corrections worked

-- Check tabs that had cancelled orders and their current status
SELECT 
    t.tab_number,
    COUNT(o.id) as total_orders,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
    COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) as cancelled_total,
    COALESCE(SUM(p.amount), 0) as total_payments,
    (COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) - COALESCE(SUM(p.amount), 0)) as current_balance
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
GROUP BY t.id, t.tab_number
ORDER BY t.tab_number;

-- Show correction payments that were created
SELECT 
    'CORRECTION PAYMENTS' as type,
    t.tab_number,
    p.amount as correction_amount,
    p.reference,
    p.created_at,
    p.metadata
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE p.reference = 'CANCELLED_ORDER_CORRECTION'
ORDER BY p.created_at DESC;
