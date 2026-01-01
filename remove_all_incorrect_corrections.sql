-- =====================================================
-- REMOVE: All incorrect correction payments
-- =====================================================

-- Show all correction payments for this tab
SELECT 
    'ALL CORRECTION PAYMENTS' as action,
    p.id as payment_id,
    t.tab_number,
    p.amount,
    p.reference,
    p.created_at,
    p.metadata
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE t.tab_number = 2
  AND p.reference = 'CANCELLED_ORDER_CORRECTION'
ORDER BY p.created_at;

-- Delete ALL correction payments for this tab
DELETE FROM tab_payments 
WHERE id IN (
    SELECT p.id 
    FROM tab_payments p
    JOIN tabs t ON p.tab_id = t.id
    WHERE t.tab_number = 2
      AND p.reference = 'CANCELLED_ORDER_CORRECTION'
);

-- Verify the corrected balance (should be 1800 - 1400 = 400)
SELECT 
    'FINAL CORRECTED BALANCE' as status,
    t.tab_number,
    COUNT(o.id) as total_orders,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
    COALESCE(SUM(p.amount), 0) as total_payments,
    (COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) - COALESCE(SUM(p.amount), 0)) as correct_balance
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
WHERE t.tab_number = 2
GROUP BY t.id, t.tab_number;
