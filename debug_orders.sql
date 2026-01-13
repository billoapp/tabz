-- Debug: Check current orders and their status for real-time subscription debugging
-- Run this in Supabase SQL Editor to see what's happening with orders

SELECT 
    o.id,
    o.order_number,
    o.status,
    o.initiated_by,
    o.created_at,
    o.updated_at,
    o.tab_id,
    t.tab_number
FROM tab_orders o
JOIN tabs t ON o.tab_id = t.id
WHERE o.tab_id = 'YOUR_TAB_ID'  -- Replace with actual tab ID from customer app
ORDER BY o.created_at DESC;

-- Also check for any recent order updates
SELECT 
    id,
    order_number,
    status,
    initiated_by,
    created_at,
    updated_at
FROM tab_orders 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- Check what real-time subscriptions should be listening for
-- The customer app subscription filter: tab_id=eq.{tab_id}
-- It should trigger on any UPDATE to tab_orders where tab_id matches
