-- Manual test to close tabs that should be auto-closed
-- Run this to simulate what should happen after business hours

-- First, let's see what tabs would be affected
SELECT 
    t.id,
    t.tab_number,
    t.status,
    -- Confirmed balance
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Pending orders count
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_orders_count,
    'WILL BE CLOSED' as action
FROM tabs t
WHERE t.status = 'open'
  AND (
    -- Zero confirmed balance AND no pending orders
    (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
     COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) <= 0
    AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') = 0
  )
ORDER BY t.tab_number;

-- UNCOMMENT THE LINES BELOW TO ACTUALLY CLOSE THE TABS
-- WARNING: This will actually close tabs in the database!

/*
-- Close tabs with zero confirmed balance and no pending orders
UPDATE tabs 
SET 
    status = 'closed',
    closed_at = NOW(),
    closed_by = 'staff',
    closure_reason = 'Manual auto-close: Zero confirmed balance after business hours'
WHERE status = 'open'
  AND (
    -- Zero confirmed balance AND no pending orders
    (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = tabs.id AND status = 'confirmed'), 0) - 
     COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = tabs.id AND status = 'success'), 0)) <= 0
    AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = tabs.id AND status = 'pending') = 0
  );

-- Show what was closed
SELECT 
    id,
    tab_number,
    status,
    closed_at,
    closure_reason
FROM tabs 
WHERE closure_reason = 'Manual auto-close: Zero confirmed balance after business hours'
ORDER BY tab_number;
*/