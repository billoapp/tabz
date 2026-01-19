-- ============================================
-- FIX: JSONB Type Error in Tab Enforcement
-- Fixes COALESCE type mismatch between text and jsonb
-- ============================================

-- Drop and recreate the function with proper type handling for TEXT notes column
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
    v_notes JSONB;
    v_existing_notes JSONB;
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
            -- Parse existing notes (handle TEXT column)
            BEGIN
                IF v_existing_tab.notes IS NULL OR v_existing_tab.notes = '' THEN
                    v_existing_notes := '{}'::jsonb;
                ELSE
                    v_existing_notes := v_existing_tab.notes::jsonb;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    v_existing_notes := '{}'::jsonb;
            END;
            
            -- Update with new display name
            v_existing_notes := v_existing_notes || jsonb_build_object(
                'display_name', p_display_name,
                'updated_at', extract(epoch from NOW())::bigint
            );
            
            UPDATE tabs 
            SET notes = v_existing_notes::text,
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
        
        -- Create new tab (store notes as TEXT)
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
            v_notes::text,
            NOW(),
            NOW(),
            NOW()
        )
        RETURNING * INTO v_new_tab;
        
        -- Log the creation (only if audit_logs table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
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
        END IF;
        
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

-- Success message
SELECT 'JSONB type error fixed - notes column handled as TEXT' as status;