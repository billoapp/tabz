-- Test the updated logic that considers when tabs were opened
-- Tabs should be closed if they were opened on previous days OR after current closing time

-- 1. Check tab ages and when they should be closed
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::date as opened_date,
    NOW()::date as current_date,
    -- Tab age
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 as hours_since_opened,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/(3600*24) as days_since_opened,
    -- Was opened on previous day?
    CASE 
        WHEN t.opened_at::date < NOW()::date 
        THEN 'YES - Opened on previous day'
        ELSE 'NO - Opened today'
    END as opened_previous_day,
    -- Current business hours status
    CASE 
        WHEN (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
              EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) 
             BETWEEN (9 * 60 + 30) AND (23 * 60 + 35)
        THEN 'CURRENTLY OPEN'
        ELSE 'CURRENTLY CLOSED'
    END as current_business_status,
    -- Should be closed? (opened previous day OR currently after hours)
    CASE 
        WHEN t.opened_at::date < NOW()::date 
        THEN '🔴 YES - Previous day tab'
        WHEN (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
              EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) 
             NOT BETWEEN (9 * 60 + 30) AND (23 * 60 + 35)
        THEN '🔴 YES - After hours today'
        ELSE '🟢 NO - Within hours today'
    END as should_be_closed,
    -- Confirmed balance
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Pending orders
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_count
FROM tabs t
WHERE t.status = 'open'
ORDER BY t.opened_at DESC;

-- 2. Show tabs that should be auto-closed with new logic
SELECT 
    t.id,
    t.tab_number,
    t.opened_at,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 as hours_old,
    -- Confirmed balance
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Pending orders
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_count,
    -- Reason for closure
    CASE 
        WHEN t.opened_at::date < NOW()::date 
        THEN 'Previous day tab with zero balance'
        ELSE 'Today tab after closing hours with zero balance'
    END as closure_reason
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