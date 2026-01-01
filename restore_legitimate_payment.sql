-- =====================================================
-- RESTORE: Add back the legitimate 1400 payment
-- =====================================================

-- Add back the legitimate 1400 payment (replace with actual payment details)
INSERT INTO tab_payments (tab_id, amount, method, status, reference, metadata, created_at, updated_at)
SELECT 
    t.id as tab_id,
    1400.00 as amount,
    'cash' as method,
    'success' as status,
    'RESTORED_LEGITIMATE_PAYMENT' as reference,
    jsonb_build_object(
        'reason', 'Restored after removing incorrect corrections',
        'restored_date', NOW()
    ) as metadata,
    NOW() as created_at,
    NOW() as updated_at
FROM tabs t
WHERE t.tab_number = 2;

-- Verify the final correct balance (should be 1800 - 1400 = 400)
SELECT 
    'FINAL VERIFIED BALANCE' as status,
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
