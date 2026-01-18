-- Debug why a recently opened tab is marked as overdue
-- This should help identify the issue

-- First, let's check the specific tab that was incorrectly marked as overdue
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.opened_at::DATE as created_date,
    CURRENT_DATE as current_date,
    t.opened_at::DATE = CURRENT_DATE as is_created_today,
    NOW() - t.opened_at as age,
    get_tab_balance(t.id) as balance,
    b.name as bar_name,
    b.business_hours_mode,
    b.business_hours_simple,
    b.business_24_hours
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.status = 'overdue'
  AND t.opened_at > NOW() - INTERVAL '1 hour'  -- Recently opened tabs
ORDER BY t.opened_at DESC;

-- Check if the business hours function is working correctly
SELECT 
    t.id,
    t.tab_number,
    t.bar_id,
    is_within_business_hours_at_time(t.bar_id, NOW()) as currently_within_hours,
    is_within_business_hours_at_time(t.bar_id, t.opened_at) as was_within_hours_when_opened,
    should_tab_be_overdue_unified(t.id) as should_be_overdue_now
FROM tabs t
WHERE t.status = 'overdue'
  AND t.opened_at > NOW() - INTERVAL '1 hour'
ORDER BY t.opened_at DESC;

-- Check the current time and business hours for debugging
SELECT 
    NOW() as current_time,
    NOW() AT TIME ZONE 'Africa/Nairobi' as nairobi_time,
    EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_hour,
    EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) as current_minute;

-- Check business hours configuration for all bars
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_24_hours,
    is_within_business_hours_at_time(id, NOW()) as currently_open
FROM bars;

-- Test the overdue function step by step for the problematic tab
-- Replace 'TAB_ID_HERE' with the actual tab ID
/*
DO $$
DECLARE
    v_tab_id UUID := 'TAB_ID_HERE'; -- Replace with actual tab ID
    v_tab RECORD;
    v_balance NUMERIC;
    v_is_past_closing BOOLEAN;
BEGIN
    -- Get tab details
    SELECT 
        bar_id, 
        opened_at,
        opened_at::DATE as created_date
    INTO v_tab
    FROM tabs 
    WHERE id = v_tab_id;
    
    RAISE NOTICE 'Tab opened at: %, Created date: %, Current date: %', 
        v_tab.opened_at, v_tab.created_date, CURRENT_DATE;
    
    -- Get balance
    v_balance := get_tab_balance(v_tab_id);
    RAISE NOTICE 'Tab balance: %', v_balance;
    
    -- Check if past closing
    v_is_past_closing := NOT is_within_business_hours_at_time(v_tab.bar_id, NOW());
    RAISE NOTICE 'Is past closing: %', v_is_past_closing;
    
    -- Check if created today
    RAISE NOTICE 'Created today: %', v_tab.created_date = CURRENT_DATE;
    
    -- Final result
    RAISE NOTICE 'Should be overdue: %', 
        v_balance > 0 AND v_is_past_closing AND v_tab.created_date = CURRENT_DATE;
END $$;
*/