-- =====================================================
-- BACKFILL: Correct historical balances for cancelled orders
-- =====================================================
-- Run this script in Supabase SQL editor to fix existing tabs
-- with incorrect balances due to cancelled orders

-- =====================================================
-- STEP 1: PREVIEW - See which tabs need correction
-- =====================================================
-- Run this first to see what will be corrected
WITH cancelled_order_impacts AS (
    SELECT 
        t.id as tab_id,
        t.tab_number,
        COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) as cancelled_total,
        COALESCE(SUM(o.total), 0) as total_all_orders,
        COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
        COALESCE(SUM(p.amount), 0) as total_payments
    FROM tabs t
    LEFT JOIN tab_orders o ON t.id = o.tab_id
    LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
    GROUP BY t.id, t.tab_number
    HAVING COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) > 0
),
tabs_needing_correction AS (
    SELECT 
        tab_id,
        tab_number,
        cancelled_total,
        confirmed_total,
        total_payments,
        (confirmed_total - total_payments) as correct_balance,
        (total_all_orders - total_payments) as current_balance,
        (cancelled_total) as correction_amount
    FROM cancelled_order_impacts
    WHERE cancelled_total > 0
)
SELECT 
    'TABS NEEDING CORRECTION' as status,
    tc.tab_number,
    tc.cancelled_total as cancelled_orders,
    tc.confirmed_total as confirmed_orders,
    tc.total_payments as payments,
    tc.current_balance as current_balance,
    tc.correct_balance as correct_balance,
    tc.correction_amount as amount_to_correct
FROM tabs_needing_correction tc
ORDER BY tc.tab_number;

-- =====================================================
-- STEP 2: EXECUTE - Apply the corrections
-- =====================================================
-- After reviewing the preview above, run this section
-- to actually apply the corrections

-- Create corrective payment records
WITH cancelled_order_impacts AS (
    SELECT 
        t.id as tab_id,
        t.tab_number,
        COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) as cancelled_total,
        COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
        COALESCE(SUM(p.amount), 0) as total_payments,
        (COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) - COALESCE(SUM(p.amount), 0)) as correct_balance,
        (COALESCE(SUM(o.total), 0) - COALESCE(SUM(p.amount), 0)) as current_balance,
        COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) as correction_amount
    FROM tabs t
    LEFT JOIN tab_orders o ON t.id = o.tab_id
    LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
    GROUP BY t.id, t.tab_number
    HAVING COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) > 0
)
INSERT INTO tab_payments (tab_id, amount, method, status, reference, metadata, created_at, updated_at)
SELECT 
    tab_id,
    correction_amount,
    'cash',
    'success',
    'CANCELLED_ORDER_CORRECTION',
    jsonb_build_object(
        'reason', 'Backfill correction for cancelled orders',
        'cancelled_total', cancelled_total,
        'correct_balance', correct_balance,
        'previous_balance', current_balance,
        'backfill_date', NOW()
    ),
    NOW(),
    NOW()
FROM cancelled_order_impacts
WHERE correction_amount > 0;

-- =====================================================
-- STEP 3: VERIFY - Check the results
-- =====================================================
-- Run this to confirm the corrections worked
WITH cancelled_order_impacts AS (
    SELECT 
        t.id as tab_id,
        t.tab_number,
        COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) as cancelled_total,
        COALESCE(SUM(o.total), 0) as total_all_orders,
        COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
        COALESCE(SUM(p.amount), 0) as total_payments
    FROM tabs t
    LEFT JOIN tab_orders o ON t.id = o.tab_id
    LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
    GROUP BY t.id, t.tab_number
    HAVING COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN o.total ELSE 0 END), 0) > 0
)
SELECT 
    'CORRECTION RESULTS' as status,
    t.tab_number,
    COUNT(o.id) as total_orders,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as confirmed_total,
    COALESCE(SUM(p.amount), 0) as total_payments,
    (COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) - COALESCE(SUM(p.amount), 0)) as final_balance
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
LEFT JOIN tab_payments p ON t.id = p.tab_id AND p.status = 'success'
WHERE EXISTS (
    SELECT 1 FROM tab_orders o2 WHERE o2.tab_id = t.id AND o2.status = 'cancelled'
)
GROUP BY t.id, t.tab_number
ORDER BY t.tab_number;

-- =====================================================
-- STEP 4: AUDIT - Show correction payments created
-- =====================================================
SELECT 
    'CORRECTION PAYMENTS CREATED' as status,
    t.tab_number,
    p.amount as correction_amount,
    p.reference,
    p.metadata,
    p.created_at
FROM tab_payments p
JOIN tabs t ON p.tab_id = t.id
WHERE p.reference = 'CANCELLED_ORDER_CORRECTION'
ORDER BY p.created_at DESC;
