-- =====================================================
-- REMOVE: Incorrect -1400 correction payment
-- =====================================================

-- Find and remove the incorrect correction payment
SELECT 
    'INCORRECT PAYMENT TO REMOVE' as action,
    p.id as payment_id,
    t.tab_number,
    p.amount,
    p.reference,
    p.created_at
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE p.reference = 'CANCELLED_ORDER_CORRECTION' 
  AND p.amount = -1400;

-- Delete the incorrect -1400 correction payment
DELETE FROM tab_payments 
WHERE reference = 'CANCELLED_ORDER_CORRECTION' 
  AND amount = -1400;

-- Verify the corrected balance
SELECT 
    'CORRECTED BALANCE' as status,
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
