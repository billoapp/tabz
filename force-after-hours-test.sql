-- Force test the after-hours logic by manually closing tabs
-- This simulates what should happen automatically after 23:35 Kenya time

-- 1. Check current Kenya time
SELECT 
    NOW() AT TIME ZONE 'Africa/Nairobi' as current_kenya_time,
    EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_hour,
    EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_minute,
    CASE 
        WHEN (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
              EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) > (23 * 60 + 35)
             OR (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
                 EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) < (9 * 60 + 30)
        THEN 'AFTER HOURS - Should auto-close'
        ELSE 'BUSINESS HOURS - Should stay open'
    END as business_status;

-- 2. Show tabs that WOULD be closed if it were after hours
SELECT 
    t.id,
    t.tab_number,
    t.status,
    'WOULD BE CLOSED' as action,
    'Zero confirmed balance + no pending orders' as reason
FROM tabs t
WHERE t.status = 'open'
  AND (
    -- Zero confirmed balance AND no pending orders
    (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
     COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) <= 0
    AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') = 0
  )
ORDER BY t.tab_number;

-- 3. MANUAL FORCE CLOSE (uncomment to actually close tabs)
-- WARNING: This will close tabs regardless of business hours!

/*
UPDATE tabs 
SET 
    status = 'closed',
    closed_at = NOW(),
    closed_by = 'staff',
    closure_reason = 'Manual force close: Testing after-hours auto-closure'
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
    closure_reason,
    'SUCCESSFULLY CLOSED' as result
FROM tabs 
WHERE closure_reason = 'Manual force close: Testing after-hours auto-closure'
ORDER BY tab_number;
*/