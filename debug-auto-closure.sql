-- Debug why tabs with zero balance aren't auto-closing after hours

-- 1. Check current business hours settings for the bar
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_hours_advanced,
    business_24_hours,
    timezone
FROM bars 
LIMIT 1;

-- 2. Check current time vs business hours (manual calculation)
-- Assuming business hours are 09:30 - 23:35 Kenya time
SELECT 
    NOW() as current_utc_time,
    NOW() AT TIME ZONE 'Africa/Nairobi' as current_kenya_time,
    EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_hour,
    EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_minute,
    (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
     EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) as current_total_minutes,
    -- Business hours in minutes
    (9 * 60 + 30) as open_minutes,  -- 09:30 = 570 minutes
    (23 * 60 + 35) as close_minutes, -- 23:35 = 1415 minutes
    -- Is currently within business hours?
    CASE 
        WHEN (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
              EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) 
             BETWEEN (9 * 60 + 30) AND (23 * 60 + 35)
        THEN 'OPEN - Within business hours'
        ELSE 'CLOSED - Outside business hours'
    END as business_status;

-- 3. Check tabs that should be auto-closed
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    -- Confirmed balance
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Pending orders count
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_orders_count,
    -- Should be auto-closed?
    CASE 
        WHEN (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
              COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) <= 0
             AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') = 0
        THEN '✅ SHOULD AUTO-CLOSE (zero balance, no pending)'
        WHEN (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') > 0
        THEN '⏳ KEEP OPEN (has pending orders)'
        ELSE '❓ KEEP OPEN (positive balance)'
    END as auto_close_decision,
    -- Time since opened
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 as hours_open
FROM tabs t
WHERE t.status = 'open'
ORDER BY t.tab_number;

-- 4. Manual test: What would happen if we ran the auto-close logic now?
-- This simulates the checkAndUpdateOverdueTabs function
WITH tab_analysis AS (
    SELECT 
        t.id,
        t.tab_number,
        t.status,
        -- Confirmed balance
        COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
        COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
        -- Pending orders
        (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_count,
        -- Business hours check (assuming closed after 23:35)
        CASE 
            WHEN (EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) * 60 + 
                  EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi'))) 
                 BETWEEN (9 * 60 + 30) AND (23 * 60 + 35)
            THEN false  -- Open
            ELSE true   -- Closed
        END as is_after_hours
    FROM tabs t
    WHERE t.status = 'open'
)
SELECT 
    *,
    CASE 
        WHEN confirmed_balance <= 0 AND pending_count = 0 AND is_after_hours
        THEN '🔴 SHOULD BE AUTO-CLOSED NOW'
        WHEN confirmed_balance <= 0 AND pending_count = 0 AND NOT is_after_hours
        THEN '🟡 WILL AUTO-CLOSE AFTER HOURS'
        WHEN confirmed_balance > 0 AND is_after_hours
        THEN '🟠 SHOULD BE MARKED OVERDUE'
        ELSE '🟢 CORRECTLY OPEN'
    END as expected_action
FROM tab_analysis
ORDER BY tab_number;