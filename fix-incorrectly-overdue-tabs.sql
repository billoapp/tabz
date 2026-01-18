-- Fix tabs that were incorrectly marked as overdue
-- This will revert tabs that shouldn't be overdue back to 'open' status

-- First, let's see which tabs were incorrectly marked as overdue
SELECT 
    'INCORRECTLY_OVERDUE' as issue,
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.moved_to_overdue_at,
    NOW() - t.opened_at as age,
    get_tab_balance(t.id) as balance,
    b.name as bar_name,
    b.business_hours_simple
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.status = 'overdue'
  AND t.opened_at > NOW() - INTERVAL '2 hours'  -- Recently opened tabs
  AND (
    -- Bar has no business hours configured (should default to always open)
    b.business_hours_simple IS NULL 
    OR 
    -- Or tab was opened within the last hour and bar should be open
    (t.opened_at > NOW() - INTERVAL '1 hour' AND b.business_hours_simple IS NOT NULL)
  );

-- Fix the incorrectly marked overdue tabs
UPDATE tabs 
SET 
    status = 'open',
    moved_to_overdue_at = NULL,
    overdue_reason = NULL
WHERE status = 'overdue'
  AND opened_at > NOW() - INTERVAL '2 hours'  -- Recently opened tabs
  AND id IN (
    SELECT t.id
    FROM tabs t
    JOIN bars b ON t.bar_id = b.id
    WHERE t.status = 'overdue'
      AND t.opened_at > NOW() - INTERVAL '2 hours'
      AND (
        -- Bar has no business hours configured (should default to always open)
        b.business_hours_simple IS NULL 
        OR 
        -- Or it's a very recent tab that shouldn't be overdue yet
        t.opened_at > NOW() - INTERVAL '30 minutes'
      )
  );

-- Show the results
SELECT 
    'FIXED_TABS' as result,
    COUNT(*) as tabs_fixed
FROM tabs 
WHERE status = 'open' 
  AND opened_at > NOW() - INTERVAL '2 hours';