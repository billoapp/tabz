-- Close tabs using the new logic (considering when they were opened)
-- This should close tabs that were opened on previous days OR after current closing time

-- 1. Preview what will be closed
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 as hours_old,
    CASE 
        WHEN t.opened_at::date < NOW()::date 
        THEN '🔴 PREVIOUS DAY TAB'
        ELSE '🔴 TODAY AFTER HOURS'
    END as closure_type,
    'WILL BE CLOSED' as action
FROM tabs t
WHERE t.status = 'open'
  AND (
    -- Zero confirmed balance AND no pending orders
    (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
     COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) <= 0
    AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') = 0
  )
  AND (
    -- Should be closed: opened previous day OR currently after hours
    t.opened_at::date < NOW()::date 
    OR (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
        EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) 
       NOT BETWEEN (9 * 60 + 30) AND (23 * 60 + 35)
  )
ORDER BY t.opened_at DESC;

-- 2. UNCOMMENT TO ACTUALLY CLOSE THE TABS
-- WARNING: This will close tabs in the database!

/*
UPDATE tabs 
SET 
    status = 'closed',
    closed_at = NOW(),
    closed_by = 'staff',
    closure_reason = CASE 
        WHEN opened_at::date < NOW()::date 
        THEN 'Auto-closed: Previous day tab with zero confirmed balance'
        ELSE 'Auto-closed: Zero confirmed balance after business hours'
    END
WHERE status = 'open'
  AND (
    -- Zero confirmed balance AND no pending orders
    (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = tabs.id AND status = 'confirmed'), 0) - 
     COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = tabs.id AND status = 'success'), 0)) <= 0
    AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = tabs.id AND status = 'pending') = 0
  )
  AND (
    -- Should be closed: opened previous day OR currently after hours
    opened_at::date < NOW()::date 
    OR (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
        EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) 
       NOT BETWEEN (9 * 60 + 30) AND (23 * 60 + 35)
  );

-- Show what was closed
SELECT 
    id,
    tab_number,
    status,
    opened_at,
    closed_at,
    closure_reason,
    EXTRACT(EPOCH FROM (closed_at - opened_at))/3600 as hours_open
FROM tabs 
WHERE closure_reason LIKE 'Auto-closed:%'
  AND closed_at > NOW() - INTERVAL '1 minute'
ORDER BY tab_number;
*/