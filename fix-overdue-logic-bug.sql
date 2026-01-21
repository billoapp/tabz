-- Fix the logic bug in should_tab_be_overdue_unified
-- The issue: function only checks tabs with status = 'open'
-- But overdue tabs already have status = 'overdue'

-- Test the current broken logic
SELECT 
    'Current logic test' as test_type,
    t.id,
    t.status,
    get_tab_balance(t.id) as balance,
    should_tab_be_overdue_unified(t.id) as current_result
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status IN ('open', 'overdue')
ORDER BY t.opened_at DESC;

-- Fix the function to check both open and overdue tabs
CREATE OR REPLACE FUNCTION should_tab_be_overdue_unified(p_tab_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tab RECORD;
    v_balance NUMERIC;
    v_tab_created_date DATE;
    v_tab_opened_time TIMESTAMPTZ;
    v_business_day_end TIMESTAMPTZ;
    v_is_past_business_day BOOLEAN;
BEGIN
    -- Get tab details - check both open and overdue tabs
    SELECT 
        bar_id, 
        opened_at,
        opened_at::DATE as created_date,
        status
    INTO v_tab
    FROM tabs 
    WHERE id = p_tab_id AND status IN ('open', 'overdue');
    
    -- If tab not found or not open/overdue, not applicable
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get current balance (only confirmed orders)
    v_balance := get_tab_balance(p_tab_id);
    
    -- If no balance, not overdue
    IF v_balance <= 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate when the business day ends for the day the tab was opened
    v_business_day_end := calculate_business_day_end(v_tab.bar_id, v_tab.opened_at);
    
    -- If we can't determine business hours (24hr or not configured), never go overdue
    IF v_business_day_end IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Tab is overdue if:
    -- 1. Has outstanding balance AND
    -- 2. Current time is past the business day end for when tab was opened
    RETURN v_balance > 0 AND NOW() > v_business_day_end;
END;
$$ LANGUAGE plpgsql;

-- Test the fixed function
SELECT 
    'Fixed function test' as test_type,
    t.id,
    t.tab_number,
    t.status,
    get_tab_balance(t.id) as balance,
    calculate_business_day_end(t.bar_id, t.opened_at) as business_day_end,
    should_tab_be_overdue_unified(t.id) as fixed_result
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status IN ('open', 'overdue')
ORDER BY t.opened_at DESC;
