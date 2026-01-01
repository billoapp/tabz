-- =====================================================
-- FIND: Get the actual UUID of Order #3
-- =====================================================

-- Find Order #3's actual UUID
SELECT 
    'ORDER #3 INFO' as info_type,
    o.id as order_uuid,
    o.tab_id,
    t.tab_number,
    o.status,
    o.total,
    o.initiated_by,
    o.created_at
FROM tab_orders o
JOIN tabs t ON o.tab_id = t.id
WHERE t.tab_number = 2
  AND o.total = 1400  -- The 1400 order we're looking for
ORDER BY o.created_at DESC;

-- Use the UUID from this query in the UPDATE statement:
UPDATE tab_orders 
SET status = 'cancelled', updated_at = NOW()
WHERE id = 'PASTE_THE_UUID_FROM_ABOVE_QUERY';
