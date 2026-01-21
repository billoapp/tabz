-- Simple timezone fix - calculate business day end directly

-- Test different approaches to get correct timezone conversion
SELECT 
    'Test 1: Direct timezone conversion' as test_type,
    NOW() as current_utc,
    NOW() AT TIME ZONE 'Africa/Nairobi' as current_local,
    (NOW() AT TIME ZONE 'Africa/Nairobi')::DATE as today_local;

-- Test the correct business day end calculation
SELECT 
    'Test 2: Business day end calculation' as test_type,
    '23:00' as close_time_local,
    ((NOW() AT TIME ZONE 'Africa/Nairobi')::DATE || ' 23:00:00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi' as business_end_local,
    (((NOW() AT TIME ZONE 'Africa/Nairobi')::DATE || ' 23:00:00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'UTC' as business_end_utc;

-- Create a completely new, simpler function
CREATE OR REPLACE FUNCTION calculate_business_day_end_simple(
    p_bar_id UUID, 
    p_date TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_bar RECORD;
    v_date_local DATE;
    v_close_hour INTEGER;
    v_close_minute INTEGER;
    v_close_time_local TIMESTAMPTZ;
    v_close_time_utc TIMESTAMPTZ;
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
        
        -- Parse close time
        v_close_hour := SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 1)::INTEGER;
        v_close_minute := SPLIT_PART(v_bar.business_hours_simple->>'closeTime', ':', 2)::INTEGER;
        
        -- Create close time in local timezone
        v_close_time_local := (v_date_local || ' ' || 
            LPAD(v_close_hour::TEXT, 2, '0') || ':' || 
            LPAD(v_close_minute::TEXT, 2, '0') || ':00')::TIMESTAMPTZ AT TIME ZONE 'Africa/Nairobi';
        
        -- Handle overnight hours
        IF (v_bar.business_hours_simple->>'closeNextDay')::BOOLEAN = true THEN
            v_close_time_local := v_close_time_local + INTERVAL '1 day';
        END IF;
        
        -- Convert to UTC for comparison
        v_close_time_utc := v_close_time_local AT TIME ZONE 'UTC';
        
    ELSE
        RETURN NULL; -- Advanced mode not implemented in this simple version
    END IF;
    
    RETURN v_close_time_utc;
END;
$$ LANGUAGE plpgsql;

-- Test the simple function
SELECT 
    'Simple function test' as test_type,
    calculate_business_day_end_simple('96f1a3aa-523b-49f3-8138-cefef2d2ba65', NOW()) as simple_business_day_end;

-- Test with specific times
SELECT 
    'Specific time test' as test_type,
    calculate_business_day_end_simple('96f1a3aa-523b-49f3-8138-cefef2d2ba65', '2026-01-21 12:00:00+00'::TIMESTAMPTZ) as today_noon_end,
    calculate_business_day_end_simple('96f1a3aa-523b-49f3-8138-cefef2d2ba65', '2026-01-20 12:00:00+00'::TIMESTAMPTZ) as yesterday_noon_end;
