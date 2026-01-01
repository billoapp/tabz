-- =====================================================
-- COMPREHENSIVE FIX: Remove all correction payments and restore legitimate one
-- =====================================================

-- Step 1: Show ALL payments for Tab #2 to see what's there
SELECT 
    'CURRENT ALL PAYMENTS' as step,
    p.id,
    p.amount,
    p.method,
    p.reference,
    p.created_at
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE t.tab_number = 2
ORDER BY p.created_at;

-- Step 2: Remove ALL correction payments (both positive and negative)
DELETE FROM tab_payments 
WHERE reference = 'CANCELLED_ORDER_CORRECTION';

-- Step 3: Check if legitimate payment exists
SELECT 
    'LEGITIMATE PAYMENT CHECK' as step,
    COUNT(*) as legitimate_payments,
    COALESCE(SUM(amount), 0) as total_legitimate
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE t.tab_number = 2
  AND reference != 'CANCELLED_ORDER_CORRECTION';

-- Step 4: Add back legitimate payment if it doesn't exist
INSERT INTO tab_payments (tab_id, amount, method, status, reference, metadata, created_at, updated_at)
SELECT 
    t.id,
    1400.00,
    'cash',
    'success',
    'RESTORED_LEGITIMATE_PAYMENT',
    jsonb_build_object('reason', 'Restored legitimate payment', 'restored_date', NOW()),
    NOW(),
    NOW()
FROM tabs t
WHERE t.tab_number = 2
  AND NOT EXISTS (
    SELECT 1 FROM tab_payments p2 
    WHERE p2.tab_id = t.id 
      AND p2.reference != 'CANCELLED_ORDER_CORRECTION'
      AND p2.amount = 1400
  );

-- Step 5: Final verification
SELECT 
    'FINAL CORRECTED BALANCE' as step,
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
