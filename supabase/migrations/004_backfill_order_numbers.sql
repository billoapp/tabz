-- Backfill order numbers for existing orders
-- Run this once to assign order numbers to historical orders
-- Migration: 004_backfill_order_numbers.sql

-- Update existing orders with sequential numbers per tab
UPDATE tab_orders o1
SET order_number = (
    SELECT COUNT(*) + 1
    FROM tab_orders o2
    WHERE o2.tab_id = o1.tab_id
    AND o2.created_at < o1.created_at
)
WHERE order_number IS NULL;

-- Verify the results
SELECT 
    tab_id,
    order_number,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY tab_id ORDER BY created_at) as calculated_order
FROM tab_orders
WHERE tab_id IN (SELECT DISTINCT tab_id FROM tab_orders WHERE order_number IS NOT NULL)
ORDER BY tab_id, created_at;
