-- Test the updated balance calculation logic
-- This script helps verify that balance calculations only count confirmed orders

-- 1. Check current tab statuses and their order breakdown
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    -- Count orders by status
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') as confirmed_orders,
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_orders,
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'cancelled') as cancelled_orders,
    -- Calculate confirmed balance (only confirmed orders)
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) as confirmed_orders_total,
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as payments_total,
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance
FROM tabs t
WHERE t.status = 'open'
ORDER BY t.tab_number DESC;

-- 2. Check for tabs that should be auto-closed (confirmed balance = 0, no pending orders)
SELECT 
    t.id,
    t.tab_number,
    t.status,
    -- Confirmed balance
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Pending orders count
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_orders_count,
    -- Should be auto-closed?
    CASE 
        WHEN (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
              COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) <= 0
             AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') = 0
        THEN 'YES - Should auto-close'
        ELSE 'NO - Keep open'
    END as should_auto_close
FROM tabs t
WHERE t.status = 'open'
ORDER BY t.tab_number DESC;

-- 3. Check for tabs that should be marked overdue (confirmed balance > 0 after hours)
-- Note: This would need business hours logic, but shows the balance calculation
SELECT 
    t.id,
    t.tab_number,
    t.status,
    -- Confirmed balance
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Should be overdue if after hours?
    CASE 
        WHEN (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
              COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) > 0
        THEN 'YES - Would be overdue after hours'
        ELSE 'NO - Zero confirmed balance'
    END as would_be_overdue
FROM tabs t
WHERE t.status = 'open'
ORDER BY confirmed_balance DESC;