-- Fix the specific tab that was incorrectly marked as overdue
-- This tab should NOT be overdue if it was opened recently and the bar is currently open

-- First, check if this tab should actually be overdue
SELECT 
    'BEFORE_FIX' as status,
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    NOW() - t.opened_at as age,
    get_tab_balance(t.id) as balance,
    is_within_business_hours_at_time(t.bar_id, NOW()) as bar_currently_open,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    b.name as bar_name,
    b.business_hours_simple
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.id = '4c8a5f2f-2580-45f2-a4d8-a64261955e91';

-- Fix the tab if it shouldn't be overdue
UPDATE tabs 
SET 
    status = 'open',
    moved_to_overdue_at = NULL,
    overdue_reason = NULL
WHERE id = '4c8a5f2f-2580-45f2-a4d8-a64261955e91'
  AND should_tab_be_overdue_unified(id) = FALSE;

-- Check the result
SELECT 
    'AFTER_FIX' as status,
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    NOW() - t.opened_at as age,
    get_tab_balance(t.id) as balance,
    is_within_business_hours_at_time(t.bar_id, NOW()) as bar_currently_open,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    b.name as bar_name
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.id = '4c8a5f2f-2580-45f2-a4d8-a64261955e91';