-- Fix tab_balances view to exclude cancelled orders
-- This prevents cancelled orders from appearing in customer bills

-- Drop the existing view
DROP VIEW IF EXISTS tab_balances;

-- Recreate the view with proper status filtering
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

-- Add comment explaining the fix
COMMENT ON VIEW tab_balances IS 'Computed: total_orders (confirmed only) - total_payments. Fixed to exclude cancelled orders from billing.';
