-- ============================================
-- CRITICAL FIX: Tab Enforcement & Device Validation
-- Prevents users from creating multiple tabs per bar
-- ============================================

-- 1. Create trigger function to prevent multiple open tabs per device per bar
CREATE OR REPLACE FUNCTION prevent_multiple_open_tabs()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_count INTEGER;
BEGIN
    -- Only check for INSERT and UPDATE operations that set status to 'open'
    IF (TG_OP = 'INSERT' AND NEW.status = 'open') OR 
       (TG_OP = 'UPDATE' AND NEW.status = 'open' AND OLD.status != 'open') THEN
        
        -- Check if there's already an open tab for this device at this bar
        SELECT COUNT(*) INTO v_existing_count
        FROM tabs 
        WHERE bar_id = NEW.bar_id 
          AND owner_identifier = NEW.owner_identifier 
          AND status = 'open'
          AND id != NEW.id; -- Exclude current record for updates
        
        IF v_existing_count > 0 THEN
            RAISE EXCEPTION 'SECURITY_VIOLATION: Device already has an open tab at this bar. owner_identifier=%, bar_id=%', 
                NEW.owner_identifier, NEW.bar_id
                USING ERRCODE = '23505'; -- unique_violation error code
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger to enforce the constraint
DROP TRIGGER IF EXISTS trigger_prevent_multiple_open_tabs ON tabs;
CREATE TRIGGER trigger_prevent_multiple_open_tabs
    BEFORE INSERT OR UPDATE ON tabs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_multiple_open_tabs();

-- Add comment for documentation
COMMENT ON FUNCTION prevent_multiple_open_tabs() IS 
'SECURITY: Prevents users from creating multiple open tabs at the same bar';

-- 3. Create function to check for existing open tab (with row locking)
CREATE OR REPLACE FUNCTION check_existing_open_tab(
    p_bar_id UUID,
    p_device_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_existing_tab tabs%ROWTYPE;
    v_owner_identifier TEXT;
    v_result JSONB;
BEGIN
    -- Construct owner identifier (device_id + bar_id format)
    v_owner_identifier := p_device_id || '_' || p_bar_id::text;
    
    -- Check for existing open tab with row lock to prevent race conditions
    SELECT * INTO v_existing_tab
    FROM tabs 
    WHERE bar_id = p_bar_id 
      AND owner_identifier = v_owner_identifier 
      AND status = 'open'
    FOR UPDATE NOWAIT; -- Fail fast if locked
    
    IF FOUND THEN
        SELECT jsonb_build_object(
            'has_tab', true,
            'tab', row_to_json(v_existing_tab)
        ) INTO v_result;
    ELSE
        SELECT jsonb_build_object(
            'has_tab', false,
            'tab', null
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN lock_not_available THEN
        -- Another process is creating a tab, assume it exists
        SELECT jsonb_build_object(
            'has_tab', true,
            'tab', null,
            'locked', true
        ) INTO v_result;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 4. Create atomic tab creation function
CREATE OR REPLACE FUNCTION create_tab_if_not_exists(
    p_bar_id UUID,
    p_device_id TEXT,
    p_display_name TEXT DEFAULT NULL,
    p_notes JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_existing_tab tabs%ROWTYPE;
    v_new_tab tabs%ROWTYPE;
    v_owner_identifier TEXT;
    v_tab_number INTEGER;
    v_notes JSONB; -- Fixed: Added missing variable declaration
    v_result JSONB;
BEGIN
    -- Construct owner identifier
    v_owner_identifier := p_device_id || '_' || p_bar_id::text;
    
    -- Check for existing open tab (with row lock to prevent race conditions)
    SELECT * INTO v_existing_tab
    FROM tabs 
    WHERE bar_id = p_bar_id 
      AND owner_identifier = v_owner_identifier 
      AND status = 'open'
    FOR UPDATE;
    
    IF FOUND THEN
        -- Update display name if provided and different
        IF p_display_name IS NOT NULL THEN
            UPDATE tabs 
            SET notes = jsonb_build_object(
                'display_name', p_display_name,
                'updated_at', extract(epoch from NOW())::bigint
            ) || COALESCE(
                CASE 
                    WHEN notes IS NULL OR notes::text = '' THEN '{}'::jsonb
                    ELSE notes::jsonb
                END, 
                '{}'::jsonb
            ),
            updated_at = NOW()
            WHERE id = v_existing_tab.id
            RETURNING * INTO v_existing_tab;
        END IF;
        
        -- Return existing tab
        SELECT jsonb_build_object(
            'success', true,
            'existing', true,
            'tab', row_to_json(v_existing_tab),
            'message', 'Existing tab found'
        ) INTO v_result;
    ELSE
        -- Generate next tab number for this bar
        SELECT COALESCE(MAX(tab_number), 0) + 1 
        INTO v_tab_number
        FROM tabs 
        WHERE bar_id = p_bar_id;
        
        -- Prepare notes with display name
        IF p_display_name IS NOT NULL THEN
            v_notes := jsonb_build_object(
                'display_name', p_display_name,
                'created_via', 'atomic_function',
                'device_id', p_device_id,
                'created_at_timestamp', extract(epoch from NOW())::bigint
            );
        ELSE
            v_notes := jsonb_build_object(
                'display_name', 'Tab ' || v_tab_number,
                'created_via', 'atomic_function',
                'device_id', p_device_id,
                'created_at_timestamp', extract(epoch from NOW())::bigint
            );
        END IF;
        
        -- Merge with provided notes if any
        IF p_notes IS NOT NULL AND p_notes != '{}'::jsonb THEN
            v_notes := v_notes || p_notes;
        END IF;
        
        -- Create new tab
        INSERT INTO tabs (
            bar_id, 
            owner_identifier, 
            tab_number, 
            status, 
            notes,
            opened_at,
            created_at,
            updated_at
        )
        VALUES (
            p_bar_id, 
            v_owner_identifier, 
            v_tab_number, 
            'open', 
            v_notes,
            NOW(),
            NOW(),
            NOW()
        )
        RETURNING * INTO v_new_tab;
        
        -- Log the creation
        INSERT INTO audit_logs (bar_id, tab_id, action, details)
        VALUES (
            p_bar_id,
            v_new_tab.id,
            'create_tab_atomic',
            jsonb_build_object(
                'device_id', p_device_id,
                'tab_number', v_tab_number,
                'display_name', p_display_name,
                'method', 'atomic_function'
            )
        );
        
        SELECT jsonb_build_object(
            'success', true,
            'existing', false,
            'tab', row_to_json(v_new_tab),
            'message', 'New tab created successfully'
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN unique_violation THEN
        -- Handle race condition - tab was created by another process
        -- Try to fetch the existing tab
        SELECT * INTO v_existing_tab
        FROM tabs 
        WHERE bar_id = p_bar_id 
          AND owner_identifier = v_owner_identifier 
          AND status = 'open';
          
        IF FOUND THEN
            SELECT jsonb_build_object(
                'success', true,
                'existing', true,
                'tab', row_to_json(v_existing_tab),
                'message', 'Tab created by concurrent process'
            ) INTO v_result;
        ELSE
            -- This shouldn't happen, but handle gracefully
            SELECT jsonb_build_object(
                'success', false,
                'error', 'CONCURRENT_CREATION_FAILED',
                'message', 'Tab creation failed due to concurrent access'
            ) INTO v_result;
        END IF;
        
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to detect suspicious tab activity
CREATE OR REPLACE FUNCTION check_suspicious_tab_activity(
    p_device_id TEXT,
    p_bar_id UUID,
    p_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_recent_attempts INTEGER;
    v_different_fingerprints INTEGER;
    v_closed_tabs_today INTEGER;
    v_risk_score INTEGER := 0;
    v_is_suspicious BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Count recent tab creation attempts (last 10 minutes)
    SELECT COUNT(*) INTO v_recent_attempts
    FROM tabs 
    WHERE owner_identifier LIKE p_device_id || '%'
      AND created_at > NOW() - INTERVAL '10 minutes';
    
    -- Count tabs closed today (potential abuse pattern)
    SELECT COUNT(*) INTO v_closed_tabs_today
    FROM tabs 
    WHERE owner_identifier LIKE p_device_id || '%'
      AND status = 'closed'
      AND closed_at > CURRENT_DATE;
    
    -- Count different fingerprints for this device (if devices table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devices') THEN
        SELECT COUNT(DISTINCT fingerprint) INTO v_different_fingerprints
        FROM devices 
        WHERE device_id = p_device_id;
    ELSE
        v_different_fingerprints := 0;
    END IF;
    
    -- Calculate risk score
    v_risk_score := 0;
    
    -- Recent attempts penalty
    IF v_recent_attempts > 5 THEN
        v_risk_score := v_risk_score + 50;
    ELSIF v_recent_attempts > 3 THEN
        v_risk_score := v_risk_score + 25;
    ELSIF v_recent_attempts > 1 THEN
        v_risk_score := v_risk_score + 10;
    END IF;
    
    -- Multiple fingerprints penalty
    IF v_different_fingerprints > 3 THEN
        v_risk_score := v_risk_score + 30;
    ELSIF v_different_fingerprints > 1 THEN
        v_risk_score := v_risk_score + 15;
    END IF;
    
    -- Multiple closed tabs penalty
    IF v_closed_tabs_today > 5 THEN
        v_risk_score := v_risk_score + 40;
    ELSIF v_closed_tabs_today > 2 THEN
        v_risk_score := v_risk_score + 20;
    END IF;
    
    -- Determine if suspicious (threshold: 50)
    v_is_suspicious := v_risk_score >= 50;
    
    SELECT jsonb_build_object(
        'is_suspicious', v_is_suspicious,
        'risk_score', v_risk_score,
        'recent_attempts', v_recent_attempts,
        'fingerprint_changes', v_different_fingerprints,
        'closed_tabs_today', v_closed_tabs_today,
        'threshold', 50,
        'recommendations', CASE 
            WHEN v_risk_score >= 80 THEN jsonb_build_array('BLOCK_DEVICE', 'ALERT_STAFF', 'REQUIRE_VERIFICATION')
            WHEN v_risk_score >= 50 THEN jsonb_build_array('ALERT_STAFF', 'MONITOR_CLOSELY')
            WHEN v_risk_score >= 25 THEN jsonb_build_array('MONITOR_CLOSELY')
            ELSE jsonb_build_array('NORMAL_OPERATION')
        END
    ) INTO v_result;
    
    -- Log suspicious activity
    IF v_is_suspicious THEN
        INSERT INTO audit_logs (bar_id, action, details)
        VALUES (
            p_bar_id,
            'suspicious_activity_detected',
            jsonb_build_object(
                'device_id', p_device_id,
                'risk_score', v_risk_score,
                'recent_attempts', v_recent_attempts,
                'fingerprint_changes', v_different_fingerprints,
                'closed_tabs_today', v_closed_tabs_today
            )
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION check_existing_open_tab TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_tab_if_not_exists TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_suspicious_tab_activity TO authenticated, anon;

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tabs_owner_identifier_status 
ON tabs (owner_identifier, status);

CREATE INDEX IF NOT EXISTS idx_tabs_created_at_recent 
ON tabs (created_at DESC);

-- 8. Update audit log for this migration
INSERT INTO audit_logs (action, details)
SELECT 
    'SECURITY_FIX_TAB_ENFORCEMENT',
    jsonb_build_object(
        'migration_version', '036',
        'fixed_at', NOW(),
        'description', 'Added trigger constraint and atomic functions to prevent multiple tabs per device per bar',
        'security_level', 'CRITICAL',
        'components', jsonb_build_array(
            'trigger_constraint',
            'atomic_tab_creation',
            'suspicious_activity_detection',
            'race_condition_prevention'
        )
    )
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs');

-- 9. Verification queries
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
    v_function_exists BOOLEAN;
BEGIN
    -- Check if trigger was created
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_prevent_multiple_open_tabs'
    ) INTO v_trigger_exists;
    
    -- Check if function was created
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_tab_if_not_exists'
    ) INTO v_function_exists;
    
    -- Report status
    RAISE NOTICE 'Tab Enforcement Fix Status:';
    RAISE NOTICE '  Trigger Constraint: %', CASE WHEN v_trigger_exists THEN '✅ CREATED' ELSE '❌ FAILED' END;
    RAISE NOTICE '  Atomic Function: %', CASE WHEN v_function_exists THEN '✅ CREATED' ELSE '❌ FAILED' END;
    
    IF v_trigger_exists AND v_function_exists THEN
        RAISE NOTICE '🔒 SECURITY FIX APPLIED SUCCESSFULLY';
        RAISE NOTICE '   Users can no longer create multiple tabs per bar';
    ELSE
        RAISE EXCEPTION 'CRITICAL: Security fix failed to apply properly';
    END IF;
END $$;

-- Success message
SELECT '🔒 CRITICAL SECURITY FIX APPLIED: Tab enforcement now active' as status;