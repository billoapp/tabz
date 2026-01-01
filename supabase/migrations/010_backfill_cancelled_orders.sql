-- =====================================================
-- BACKFILL: Correct historical balances for cancelled orders
-- =====================================================
-- This script identifies tabs with cancelled orders and creates
-- corrective payment entries to fix their balances

-- Step 1: Identify tabs with cancelled orders and calculate corrections
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

-- Step 2: Create corrective payment records for each affected tab
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
FROM tabs_needing_correction;

-- Step 3: Log the corrections for audit purposes
INSERT INTO audit_logs (bar_id, tab_id, action, details, created_at)
SELECT 
    t.bar_id,
    tc.tab_id,
    'backfill_cancelled_orders',
    jsonb_build_object(
        'correction_amount', tc.correction_amount,
        'cancelled_total', tc.cancelled_total,
        'correct_balance', tc.correct_balance,
        'previous_balance', tc.current_balance,
        'tab_number', tc.tab_number
    ),
    NOW()
FROM tabs_needing_correction tc
JOIN tabs t ON tc.tab_id = t.id;

-- Step 4: Display summary of corrections made
SELECT 
    'BACKFILL SUMMARY' as report_type,
    COUNT(*) as tabs_corrected,
    SUM(correction_amount) as total_correction_amount,
    AVG(correction_amount) as average_correction
FROM tabs_needing_correction;

-- Step 5: Show detailed correction results
SELECT 
    'DETAILED CORRECTIONS' as report_type,
    tc.tab_number,
    tc.cancelled_total as cancelled_orders_total,
    tc.confirmed_total as confirmed_orders_total,
    tc.total_payments as payments_made,
    tc.current_balance as previous_balance,
    tc.correct_balance as new_balance,
    tc.correction_amount as correction_applied,
    CASE 
        WHEN tc.correct_balance = 0 THEN 'FULLY CORRECTED'
        WHEN tc.correct_balance < 0 THEN 'OVERPAID (CREDIT)'
        ELSE 'PARTIALLY PAID'
    END as status
FROM tabs_needing_correction tc
ORDER BY tc.tab_number;

-- =====================================================
-- EXPLANATION:
-- 
-- This backfill script:
-- 1. Identifies all tabs with cancelled orders
-- 2. Calculates the correct balance (excluding cancelled orders)
-- 3. Creates corrective payment entries to fix the balance
-- 4. Logs all changes for audit trail
-- 5. Provides detailed reporting of corrections made
-- 
-- After running this script:
-- - All tabs will have correct balances excluding cancelled orders
-- - Audit trail will show the backfill corrections
-- - Customer bills will be accurate
-- =====================================================
