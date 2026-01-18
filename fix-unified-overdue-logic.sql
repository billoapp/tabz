-- Unified Overdue Logic Fix
-- Requirements:
-- 1. Tab is overdue if it has balance AND is outside business hours of THAT DAY it was created
-- 2. Tabs with 0 balance auto-close/delete at end of business day
-- 3. Overdue tabs go to overdue page for manager decision (no auto-close)

-- First, let's create a function to check if a specific time is within business hours for a bar
CREATE OR REPLACE FUNCTION is_within_business_hours_at_time(
    p_bar_id UUID, 
    p_check_time TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
    v_bar RECORD;
    v_current_hour INTEGER;
    v_current_minute INTEGER;
    v_current_total_minutes INTEGER;
    v_open_total_minutes INTEGER;
    v_close_total_minutes INTEGER;
    v_day_name TEXT;
    v_day_hours JSONB;
BEGIN
    -- Get bar business hours configuration
    SELECT 
        business_hours_mode,
        business_hours_simple,
        business_hours_advanced,
        business_24_hours
    INTO v_bar
    FROM bars 
    WHERE id = p_bar_id;
    
    -- If bar not found, default to closed
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Handle 24 hours mode
    IF v_bar.business_24_hours = true OR v_bar.business_hours_mode = '24hours' THEN
        RETURN TRUE;
    END IF;
    
    -- If no business hours configured, default to closed
    IF v_bar.business_hours_mode IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Convert check time to local time and extract components
    v_current_hour := EXTRACT(HOUR FROM (p_check_time AT TIME ZONE 'Africa/Nairobi'));
    v_current_minute := EXTRACT(MINUTE FROM (p_check_time AT TIME ZONE 'Africa/Nairobi'));
    v_current_total_minutes := v_current_hour * 60 + v_current_minute;
    
    IF v_bar.business_hours_mode = 'simple' THEN
        -- Simple mode: same hours every day
        IF v_bar.business_hours_simple IS NULL THEN
            RETURN FALSE;
        END IF;
        
        -- Parse open time (format: "HH:MM")
        v_open_total_minutes := 
            (SPLIT_PART(v_bar.business_hours_simple->>'openTime', ':', 1)::INTEGER * 60) +
            SPLIT_PART(v_bar.business_hours_simple->>'openTime', ':', 2)::INTEGER;
            
        -- Parse close time
        v_close_total_minutes := 
            (SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 1)::INTEGER * 60) +
            SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 2)::INTEGER;
        
        -- Handle overnight hours (e.g., 20:00 to 04:00)
        IF (v_bar.business_hours_simple->>'closeNextDay')::BOOLEAN = true OR v_close_total_minutes < v_open_total_minutes THEN
            -- Venue is open overnight: current time >= open OR current time <= close
            RETURN v_current_total_minutes >= v_open_total_minutes OR v_current_total_minutes <= v_close_total_minutes;
        ELSE
            -- Normal hours: current time between open and close
            RETURN v_current_total_minutes >= v_open_total_minutes AND v_current_total_minutes <= v_close_total_minutes;
        END IF;
        
    ELSIF v_bar.business_hours_mode = 'advanced' THEN
        -- Advanced mode: different hours per day
        IF v_bar.business_hours_advanced IS NULL THEN
            RETURN FALSE;
        END IF;
        
        -- Get day name (0 = Sunday, 1 = Monday, etc.)
        v_day_name := CASE EXTRACT(DOW FROM (p_check_time AT TIME ZONE 'Africa/Nairobi'))
            WHEN 0 THEN 'sunday'
            WHEN 1 THEN 'monday'
            WHEN 2 THEN 'tuesday'
            WHEN 3 THEN 'wednesday'
            WHEN 4 THEN 'thursday'
            WHEN 5 THEN 'friday'
            WHEN 6 THEN 'saturday'
        END;
        
        v_day_hours := v_bar.business_hours_advanced->v_day_name;
        
        IF v_day_hours IS NULL OR v_day_hours->>'open' IS NULL OR v_day_hours->>'close' IS NULL THEN
            RETURN FALSE; -- Closed on this day
        END IF;
        
        -- Parse open time
        v_open_total_minutes := 
            (SPLIT_PART(v_day_hours->>'open', ':', 1)::INTEGER * 60) +
            SPLIT_PART(v_day_hours->>'open', ':', 2)::INTEGER;
            
        -- Parse close time
        v_close_total_minutes := 
            (SPLIT_PART(v_day_hours->>'close', ':', 1)::INTEGER * 60) +
            SPLIT_PART(v_day_hours->>'close', ':', 2)::INTEGER;
        
        -- Handle overnight hours
        IF (v_day_hours->>'closeNextDay')::BOOLEAN = true OR v_close_total_minutes < v_open_total_minutes THEN
            -- Venue is open overnight: current time >= open OR current time <= close
            RETURN v_current_total_minutes >= v_open_total_minutes OR v_current_total_minutes <= v_close_total_minutes;
        ELSE
            -- Normal hours: current time between open and close
            RETURN v_current_total_minutes >= v_open_total_minutes AND v_current_total_minutes <= v_close_total_minutes;
        END IF;
    END IF;
    
    -- Default to closed for any other mode
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create the unified overdue checking function
CREATE OR REPLACE FUNCTION should_tab_be_overdue_unified(p_tab_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tab RECORD;
    v_balance NUMERIC;
    v_tab_created_date DATE;
    v_current_date DATE;
    v_closing_time TIMESTAMPTZ;
    v_is_past_closing BOOLEAN;
BEGIN
    -- Get tab details
    SELECT 
        bar_id, 
        opened_at,
        opened_at::DATE as created_date
    INTO v_tab
    FROM tabs 
    WHERE id = p_tab_id AND status = 'open';
    
    -- If tab not found or not open, not overdue
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get current balance (only confirmed orders)
    v_balance := get_tab_balance(p_tab_id);
    
    -- If no balance, not overdue
    IF v_balance <= 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Get dates
    v_tab_created_date := v_tab.created_date;
    v_current_date := CURRENT_DATE;
    
    -- Only check overdue status for tabs created TODAY
    -- Tabs from previous days should be handled separately
    IF v_tab_created_date != v_current_date THEN
        RETURN FALSE; -- Old tabs handled by cleanup process
    END IF;
    
    -- Check if we're currently past the closing time for the day the tab was created
    -- Since tab was created today, we check current time against today's business hours
    v_is_past_closing := NOT is_within_business_hours_at_time(v_tab.bar_id, NOW());
    
    -- Tab is overdue if:
    -- 1. Has outstanding balance AND
    -- 2. Created today AND
    -- 3. We're currently past closing time
    RETURN v_balance > 0 AND v_is_past_closing;
END;
$$ LANGUAGE plpgsql;

-- Create function to process end-of-day cleanup
CREATE OR REPLACE FUNCTION process_end_of_day_cleanup()
RETURNS TABLE(
    action TEXT,
    tab_id UUID,
    tab_number INTEGER,
    balance NUMERIC,
    reason TEXT
) AS $$
DECLARE
    v_tab RECORD;
    v_balance NUMERIC;
    v_has_pending_orders BOOLEAN;
BEGIN
    -- Process all open tabs
    FOR v_tab IN 
        SELECT t.id, t.tab_number, t.bar_id, t.opened_at
        FROM tabs t
        WHERE t.status = 'open'
        ORDER BY t.opened_at
    LOOP
        -- Get balance
        v_balance := get_tab_balance(v_tab.id);
        
        -- Check for pending orders
        SELECT EXISTS(
            SELECT 1 FROM tab_orders 
            WHERE tab_id = v_tab.id AND status = 'pending'
        ) INTO v_has_pending_orders;
        
        -- Decision logic:
        IF v_balance <= 0 AND NOT v_has_pending_orders THEN
            -- Delete tabs with zero balance and no pending orders
            DELETE FROM tabs WHERE id = v_tab.id;
            
            RETURN QUERY SELECT 
                'DELETED'::TEXT,
                v_tab.id,
                v_tab.tab_number,
                v_balance,
                'Zero balance, no pending orders'::TEXT;
                
        ELSIF v_balance > 0 THEN
            -- Mark tabs with balance as overdue
            UPDATE tabs 
            SET 
                status = 'overdue',
                moved_to_overdue_at = NOW(),
                overdue_reason = 'Outstanding balance after business hours'
            WHERE id = v_tab.id;
            
            RETURN QUERY SELECT 
                'MARKED_OVERDUE'::TEXT,
                v_tab.id,
                v_tab.tab_number,
                v_balance,
                'Outstanding balance after business hours'::TEXT;
                
        ELSE
            -- Keep tabs with pending orders (will be processed when orders are resolved)
            RETURN QUERY SELECT 
                'KEPT_OPEN'::TEXT,
                v_tab.id,
                v_tab.tab_number,
                v_balance,
                'Has pending orders'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to update overdue tabs (for real-time checking)
CREATE OR REPLACE FUNCTION update_overdue_tabs_unified()
RETURNS TABLE(
    tabs_marked_overdue INTEGER,
    tabs_kept_open INTEGER
) AS $$
DECLARE
    v_marked_overdue INTEGER := 0;
    v_kept_open INTEGER := 0;
    v_tab RECORD;
BEGIN
    -- Check all open tabs
    FOR v_tab IN 
        SELECT id FROM tabs WHERE status = 'open'
    LOOP
        IF should_tab_be_overdue_unified(v_tab.id) THEN
            -- Mark as overdue
            UPDATE tabs 
            SET 
                status = 'overdue',
                moved_to_overdue_at = NOW(),
                overdue_reason = 'Outstanding balance after business hours'
            WHERE id = v_tab.id;
            
            v_marked_overdue := v_marked_overdue + 1;
        ELSE
            v_kept_open := v_kept_open + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_marked_overdue, v_kept_open;
END;
$$ LANGUAGE plpgsql;

-- Test the functions with current data
SELECT 
    'Testing Unified Logic' as test_type,
    COUNT(*) as total_open_tabs,
    COUNT(CASE WHEN should_tab_be_overdue_unified(id) THEN 1 END) as should_be_overdue
FROM tabs 
WHERE status = 'open';

-- Show which tabs would be marked overdue
SELECT 
    t.id,
    t.tab_number,
    t.opened_at,
    t.opened_at::DATE as created_date,
    CURRENT_DATE as current_date,
    get_tab_balance(t.id) as balance,
    should_tab_be_overdue_unified(t.id) as should_be_overdue,
    is_within_business_hours_at_time(t.bar_id, NOW()) as currently_within_hours,
    b.name as bar_name
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.status = 'open'
  AND get_tab_balance(t.id) > 0
ORDER BY t.opened_at DESC;

-- Preview end-of-day cleanup (without executing)
SELECT * FROM process_end_of_day_cleanup();

-- UNCOMMENT TO ACTUALLY RUN THE UNIFIED UPDATE
-- SELECT * FROM update_overdue_tabs_unified();