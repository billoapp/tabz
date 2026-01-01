-- =====================================================
-- DEBUG: Check order status flow
-- =====================================================

-- Show all orders with their status and who initiated them
SELECT 
    o.id,
    o.tab_id,
    t.tab_number,
    o.status,
    o.initiated_by,
    o.created_at,
    o.updated_at,
    o.confirmed_at,
    CASE 
        WHEN o.status = 'pending' THEN 'Waiting for action'
        WHEN o.status = 'confirmed' THEN 'Accepted/Confirmed'
        WHEN o.status = 'cancelled' THEN 'Cancelled'
        ELSE 'Unknown'
    END as status_description
FROM tab_orders o
JOIN tabs t ON o.tab_id = t.id
WHERE t.tab_number = 2  -- Change to the tab you're testing
ORDER BY o.created_at DESC;

-- Check what happens when staff accepts orders
-- Look for orders that changed from pending to confirmed
SELECT 
    'STATUS CHANGES' as info_type,
    o.id,
    o.status as current_status,
    o.initiated_by,
    o.created_at,
    o.updated_at,
    o.confirmed_at
FROM tab_orders o
JOIN tabs t ON o.tab_id = t.id
WHERE t.tab_number = 2
  AND o.status = 'confirmed'
  AND o.initiated_by = 'customer'
ORDER BY o.updated_at DESC;
