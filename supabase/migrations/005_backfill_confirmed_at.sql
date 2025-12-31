-- Backfill confirmed_at timestamps for historical orders
-- This migration estimates confirmation times based on business patterns
-- Migration: 005_backfill_confirmed_at.sql

-- Strategy: 
-- 1. For confirmed orders without confirmed_at, estimate based on:
--    - Staff-initiated orders: Assume 2-4 minutes confirmation time
--    - Customer-initiated orders: Assume 5-10 minutes confirmation time
-- 2. Use random time within reasonable ranges to simulate natural variation

-- First, let's see what we're working with
SELECT 
    COUNT(*) as total_confirmed,
    COUNT(CASE WHEN confirmed_at IS NULL THEN 1 END) as missing_confirmed_at,
    COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END) as has_confirmed_at,
    initiated_by
FROM tab_orders 
WHERE status = 'confirmed'
GROUP BY initiated_by;

-- Update staff-initiated orders (faster confirmation, staff knows what they're doing)
UPDATE tab_orders 
SET confirmed_at = created_at + 
    -- Random 2-4 minutes after creation (using different approach for randomness)
    INTERVAL '1 minute' * (2 + (RANDOM() * 2)::integer)
WHERE 
    status = 'confirmed' 
    AND confirmed_at IS NULL
    AND initiated_by = 'staff';

-- Update customer-initiated orders (slower confirmation, needs staff approval)
UPDATE tab_orders 
SET confirmed_at = created_at + 
    -- Random 5-10 minutes after creation
    INTERVAL '1 minute' * (5 + (RANDOM() * 5)::integer)
WHERE 
    status = 'confirmed' 
    AND confirmed_at IS NULL
    AND initiated_by = 'customer';

-- Check results after first attempt
SELECT 
    COUNT(*) as total_confirmed,
    COUNT(CASE WHEN confirmed_at IS NULL THEN 1 END) as still_missing,
    COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END) as now_filled,
    initiated_by
FROM tab_orders 
WHERE status = 'confirmed'
GROUP BY initiated_by;

-- If any still missing, use simpler approach
UPDATE tab_orders 
SET confirmed_at = created_at + INTERVAL '3 minutes'
WHERE 
    status = 'confirmed' 
    AND confirmed_at IS NULL;

-- Final verification
SELECT 
    id,
    order_number,
    status,
    initiated_by,
    created_at,
    confirmed_at,
    EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 60 as service_time_minutes,
    CASE 
        WHEN initiated_by = 'staff' THEN 'Staff Order'
        ELSE 'Customer Order'
    END as order_type
FROM tab_orders 
WHERE status = 'confirmed' 
ORDER BY created_at DESC
LIMIT 10;

-- Summary statistics
SELECT 
    COUNT(*) as total_confirmed_orders,
    COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END) as orders_with_timestamps,
    COUNT(CASE WHEN confirmed_at IS NULL THEN 1 END) as orders_still_missing_timestamps,
    ROUND(AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 60), 2) as avg_service_time_minutes,
    MIN(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 60) as min_service_time_minutes,
    MAX(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 60) as max_service_time_minutes
FROM tab_orders 
WHERE status = 'confirmed';
