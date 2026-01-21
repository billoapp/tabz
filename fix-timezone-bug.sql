-- Fix timezone conversion bug in calculate_business_day_end function
-- The issue is that we're creating local date but then converting incorrectly

-- Test the current broken calculation
SELECT 
    'Current broken calculation' as test_type,
    '2026-01-21'::DATE as local_date,
    ('2026-01-21'::DATE || ' 23:00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as broken_result;

-- Test the correct calculation
SELECT 
    'Fixed calculation' as test_type,
    '2026-01-21'::DATE as local_date,
    ('2026-01-21 23:00:00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as fixed_result;

-- The fix: create proper timestamp with timezone
SELECT 
    'Proper fix' as test_type,
    NOW() as current_time,
    (NOW() AT TIME ZONE 'Africa/Nairobi')::DATE as today_local,
    ((NOW() AT TIME ZONE 'Africa/Nairobi')::DATE || ' 23:00:00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as proper_business_end;

-- Update the calculate_business_day_end function with timezone fix
CREATE OR REPLACE FUNCTION calculate_business_day_end(
    p_bar_id UUID, 
    p_date TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_bar RECORD;
    v_day_name TEXT;
    v_day_hours JSONB;
    v_open_hour INTEGER;
    v_open_minute INTEGER;
    v_close_hour INTEGER;
    v_close_minute INTEGER;
    v_open_time TIMESTAMPTZ;
    v_close_time TIMESTAMPTZ;
    v_date_local DATE;
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
    
    -- If bar not found, return NULL (no business hours)
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Handle 24 hours mode - never closes, so never overdue
    IF v_bar.business_24_hours = true OR v_bar.business_hours_mode = '24hours' THEN
        RETURN NULL;
    END IF;
    
    -- If no business hours configured, return NULL
    IF v_bar.business_hours_mode IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Convert to local date for day calculation - FIXED VERSION
    v_date_local := (p_date AT TIME ZONE 'Africa/Nairobi')::DATE;
    
    IF v_bar.business_hours_mode = 'simple' THEN
        -- Simple mode: same hours every day
        IF v_bar.business_hours_simple IS NULL THEN
            RETURN NULL; -- No hours configured
        END IF;
        
        -- Parse times
        v_open_hour := SPLIT_PART(v_bar.business_hours_simple->>'openTime', ':', 1)::INTEGER;
        v_open_minute := SPLIT_PART(v_bar.business_hours_simple->>'openTime', ':', 2)::INTEGER;
        v_close_hour := SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 1)::INTEGER;
        v_close_minute := SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 2)::INTEGER;
        
        -- Create timestamps for the specific date - FIXED VERSION
        v_open_time := (v_date_local || ' ' || 
            LPAD(v_open_hour::TEXT, 2, '0') || ':' || 
            LPAD(v_open_minute::TEXT, 2, '0') || ':00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi';
            
        v_close_time := (v_date_local || ' ' || 
            LPAD(v_close_hour::TEXT, 2, '0') || ':' || 
            LPAD(v_close_minute::TEXT, 2, '0') || ':00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi';
        
        -- Handle overnight hours (e.g., 20:00 to 04:00)
        IF (v_bar.business_hours_simple->>'closeNextDay')::BOOLEAN = true OR v_close_time < v_open_time THEN
            -- If close time is next day, add one day to close time
            v_close_time := v_close_time + INTERVAL '1 day';
        END IF;
        
    ELSIF v_bar.business_hours_mode = 'advanced' THEN
        -- Advanced mode: different hours per day
        IF v_bar.business_hours_advanced IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- Get day name
        v_day_name := CASE EXTRACT(DOW FROM v_date_local)
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
            RETURN NULL; -- Closed on this day
        END IF;
        
        -- Parse times
        v_open_hour := SPLIT_PART(v_day_hours->>'open', ':', 1)::INTEGER;
        v_open_minute := SPLIT_PART(v_day_hours->>'open', ':', 2)::INTEGER;
        v_close_hour := SPLIT_PART(v_day_hours->>'close', ':', 1)::INTEGER;
        v_close_minute := SPLIT_PART(v_day_hours->>'close', ':', 2)::INTEGER;
        
        -- Create timestamps for the specific date - FIXED VERSION
        v_open_time := (v_date_local || ' ' || 
            LPAD(v_open_hour::TEXT, 2, '0') || ':' || 
            LPAD(v_open_minute::TEXT, 2, '0') || ':00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi';
            
        v_close_time := (v_date_local || ' ' || 
            LPAD(v_close_hour::TEXT, 2, '0') || ':' || 
            LPAD(v_close_minute::TEXT, 2, '0') || ':00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi';
        
        -- Handle overnight hours
        IF (v_day_hours->>'closeNextDay')::BOOLEAN = true OR v_close_time < v_open_time THEN
            -- If close time is next day, add one day to close time
            v_close_time := v_close_time + INTERVAL '1 day';
        END IF;
    END IF;
    
    RETURN v_close_time;
END;
$$ LANGUAGE plpgsql;

-- Test the fixed function
SELECT 
    'Fixed function test' as test_type,
    calculate_business_day_end('96f1a3aa-523b-49f3-8138-cefef2d2ba65', NOW()) as business_day_end_fixed;
