-- =====================================================
-- FIX: Cancelled orders appearing in customer bills
-- =====================================================
-- Run this script directly in your Supabase SQL editor
-- to fix the billing issue with cancelled orders

-- Step 1: Drop the existing tab_balances view
DROP VIEW IF EXISTS tab_balances;

-- Step 2: Recreate the view with proper status filtering
CREATE OR REPLACE VIEW tab_balances AS
SELECT 
    t.id AS tab_id,
    t.bar_id,
    t.tab_number,
    t.status,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) AS total_orders,
    COALESCE(SUM(p.amount), 0) AS total_payments,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) - COALESCE(SUM(p.amount), 0) AS balance
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
GROUP BY t.id, t.bar_id, t.tab_number, t.status;

-- Step 3: Verify the fix by checking current balances
-- (You can run this query to see the corrected balances)
SELECT 
    t.tab_number,
    COUNT(o.id) as total_orders,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    tb.total_orders,
    tb.balance
FROM tabs t
JOIN tab_balances tb ON t.id = tb.tab_id
LEFT JOIN tab_orders o ON t.id = o.tab_id
GROUP BY t.id, t.tab_number, tb.total_orders, tb.balance
ORDER BY t.tab_number;

-- =====================================================
-- EXPLANATION:
-- 
-- BEFORE: The view included ALL orders regardless of status
-- AFTER:  The view only includes 'confirmed' orders in billing
-- 
-- This ensures that when customers reject orders (status = 'cancelled'),
-- those orders no longer appear in their bill calculations.
-- =====================================================
