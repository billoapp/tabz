-- Final timezone fix - create business day end correctly

-- The issue: we need 23:00 local time = 20:00 UTC
-- But our calculations are giving 02:00 UTC

-- Test the correct approach
SELECT 
    'Correct approach test' as test_type,
    MAKE_TIMESTAMPTZ(2026, 1, 21, 23, 0, 0, 'Africa/Nairobi') as correct_local_time,
    MAKE_TIMESTAMPTZ(2026, 1, 21, 23, 0, 0, 'Africa/Nairobi') AT TIME ZONE 'UTC' as correct_utc_time;

-- Create the final fixed function
CREATE OR REPLACE FUNCTION calculate_business_day_end_fixed(
    p_bar_id UUID, 
    p_date TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_bar RECORD;
    v_date_local DATE;
    v_close_hour INTEGER;
    v_close_minute INTEGER;
    v_close_next_day BOOLEAN;
    v_business_end_local TIMESTAMPTZ;
    v_business_end_utc TIMESTAMPTZ;
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
    
    -- If bar not found or 24 hours, return NULL
    IF NOT FOUND OR v_bar.business_24_hours = true OR v_bar.business_hours_mode = '24hours' THEN
        RETURN NULL;
    END IF;
    
    -- If no business hours configured, return NULL
    IF v_bar.business_hours_mode IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get local date
    v_date_local := (p_date AT TIME ZONE 'Africa/Nairobi')::DATE;
    
    IF v_bar.business_hours_mode = 'simple' THEN
        -- Simple mode: same hours every day
        IF v_bar.business_hours_simple IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- Parse business hours
        v_close_hour := SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 1)::INTEGER;
        v_close_minute := SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 2)::INTEGER;
        v_close_next_day := (v_bar.business_hours_simple->>'closeNextDay')::BOOLEAN;
        
        -- Create business end time in local timezone using MAKE_TIMESTAMPTZ
        v_business_end_local := MAKE_TIMESTAMPTZ(
            EXTRACT(YEAR FROM v_date_local)::INTEGER,
            EXTRACT(MONTH FROM v_date_local)::INTEGER,
            EXTRACT(DAY FROM v_date_local)::INTEGER,
            v_close_hour,
            v_close_minute,
            0,
            'Africa/Nairobi'
        );
        
        -- Handle overnight hours
        IF v_close_next_day THEN
            v_business_end_local := v_business_end_local + INTERVAL '1 day';
        END IF;
        
        -- Convert to UTC for comparison
        v_business_end_utc := v_business_end_local AT TIME ZONE 'UTC';
        
    ELSE
        RETURN NULL; -- Advanced mode not implemented
    END IF;
    
    RETURN v_business_end_utc;
END;
$$ LANGUAGE plpgsql;

-- Test the fixed function
SELECT 
    'Fixed function test' as test_type,
    calculate_business_day_end_fixed('96f1a3aa-523b-49f3-8138-cefef2d2ba65', NOW()) as business_day_end_fixed;

-- Replace the original function
DROP FUNCTION IF EXISTS calculate_business_day_end(UUID, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION calculate_business_day_end(
    p_bar_id UUID, 
    p_date TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN calculate_business_day_end_fixed(p_bar_id, p_date);
END;
$$ LANGUAGE plpgsql;

-- Test the replacement
SELECT 
    'Final test' as test_type,
    calculate_business_day_end('96f1a3aa-523b-49f3-8138-cefef2d2ba65', NOW()) as final_business_day_end;
