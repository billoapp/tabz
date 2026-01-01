-- =====================================================
-- DEBUG: Check actual order statuses in database
-- =====================================================

-- Check the specific tab with the issue (replace with actual tab_id)
SELECT 
    'ORDER STATUS DEBUG' as debug_type,
    o.id,
    o.tab_id,
    t.tab_number,
    o.status,
    o.total,
    o.initiated_by,
    o.created_at,
    o.updated_at,
    CASE 
        WHEN o.status = 'pending' THEN 'Pending - Needs Action'
        WHEN o.status = 'confirmed' THEN 'Confirmed - In Bill'
        WHEN o.status = 'cancelled' THEN 'Cancelled - NOT in Bill'
        ELSE 'Unknown Status'
    END as status_description
FROM tab_orders o
JOIN tabs t ON o.tab_id = t.id
WHERE t.tab_number = 2  -- Change this to the specific tab number
ORDER BY o.created_at;

-- Check what the customer app should see (confirmed orders only)
SELECT 
    'CUSTOMER VIEW' as view_type,
    t.tab_number,
    COUNT(o.id) as total_orders_in_db,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.total ELSE 0 END), 0) as customer_bill_total
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
WHERE t.tab_number = 2
GROUP BY t.id, t.tab_number;

-- Check what staff app is showing (all orders regardless of status)
SELECT 
    'STAFF VIEW' as view_type,
    t.tab_number,
    COUNT(o.id) as all_orders_shown,
    COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_shown,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_shown,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_shown,
    COALESCE(SUM(o.total), 0) as total_shown_to_staff
FROM tabs t
LEFT JOIN tab_orders o ON t.id = o.tab_id
WHERE t.tab_number = 2
GROUP BY t.id, t.tab_number;
