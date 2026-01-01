-- =====================================================
-- FIX: Correct the incorrect backfill payments
-- =====================================================
-- This removes the incorrect -1400 correction and 
-- ensures cancelled orders don't affect balances

-- Step 1: Identify the incorrect correction payments
SELECT 
    'INCORRECT CORRECTIONS TO REMOVE' as action,
    p.id as payment_id,
    t.tab_number,
    p.amount as incorrect_amount,
    p.reference,
    p.created_at
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE p.reference = 'CANCELLED_ORDER_CORRECTION' 
  AND p.amount < 0;  -- Only negative corrections (which are wrong)

-- Step 2: Remove the incorrect correction payments
DELETE FROM tab_payments 
WHERE reference = 'CANCELLED_ORDER_CORRECTION' 
  AND amount < 0;

-- Step 3: Verify the corrected balances
SELECT 
    'CORRECTED BALANCES' as status,
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
GROUP BY t.id, t.tab_number
ORDER BY t.tab_number;

-- =====================================================
-- EXPLANATION:
-- 
-- The previous backfill incorrectly created NEGATIVE payments
-- to "correct" balances. This was wrong because:
-- 
-- 1. Cancelled orders should NEVER be in balance calculations
-- 2. We don't need to "undo" cancelled orders with payments
-- 3. The tab_balances view fix already excludes cancelled orders
-- 
-- This script removes the incorrect negative corrections
-- and lets the fixed tab_balances view handle the logic.
-- =====================================================
