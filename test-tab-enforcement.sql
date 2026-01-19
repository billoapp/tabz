-- ============================================
-- TEST SCRIPT: Tab Enforcement Validation
-- Tests the new tab enforcement system
-- ============================================

-- Setup test data
DO $$
DECLARE
    v_test_bar_id UUID;
    v_test_device_id TEXT := 'test_device_123';
    v_result JSONB;
BEGIN
    -- Get or create a test bar
    SELECT id INTO v_test_bar_id FROM bars LIMIT 1;
    
    IF v_test_bar_id IS NULL THEN
        INSERT INTO bars (name, location) 
        VALUES ('Test Bar', 'Test Location')
        RETURNING id INTO v_test_bar_id;
    END IF;
    
    RAISE NOTICE '🧪 Starting Tab Enforcement Tests';
    RAISE NOTICE '   Test Bar ID: %', v_test_bar_id;
    RAISE NOTICE '   Test Device ID: %', v_test_device_id;
    
    -- Clean up any existing test data
    DELETE FROM tabs WHERE owner_identifier LIKE v_test_device_id || '%';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 1: First Tab Creation ===';
    
    -- Test 1: Create first tab (should succeed)
    SELECT create_tab_if_not_exists(
        v_test_bar_id,
        v_test_device_id,
        'Test User'
    ) INTO v_result;
    
    IF (v_result->>'success')::boolean AND NOT (v_result->>'existing')::boolean THEN
        RAISE NOTICE '✅ PASS: First tab created successfully';
        RAISE NOTICE '   Tab ID: %', v_result->'tab'->>'id';
        RAISE NOTICE '   Tab Number: %', v_result->'tab'->>'tab_number';
    ELSE
        RAISE NOTICE '❌ FAIL: First tab creation failed';
        RAISE NOTICE '   Result: %', v_result;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 2: Duplicate Tab Prevention ===';
    
    -- Test 2: Try to create second tab (should return existing)
    SELECT create_tab_if_not_exists(
        v_test_bar_id,
        v_test_device_id,
        'Test User 2'
    ) INTO v_result;
    
    IF (v_result->>'success')::boolean AND (v_result->>'existing')::boolean THEN
        RAISE NOTICE '✅ PASS: Duplicate tab prevented, existing tab returned';
        RAISE NOTICE '   Message: %', v_result->>'message';
    ELSE
        RAISE NOTICE '❌ FAIL: Duplicate tab was created (SECURITY ISSUE!)';
        RAISE NOTICE '   Result: %', v_result;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 3: Direct Database Insert Prevention ===';
    
    -- Test 3: Try direct insert (should fail due to trigger)
    BEGIN
        INSERT INTO tabs (bar_id, owner_identifier, tab_number, status)
        VALUES (v_test_bar_id, v_test_device_id || '_' || v_test_bar_id, 999, 'open');
        
        RAISE NOTICE '❌ FAIL: Direct insert succeeded (SECURITY ISSUE!)';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLSTATE = '23505' THEN
                RAISE NOTICE '✅ PASS: Direct insert blocked by trigger constraint';
            ELSE
                RAISE NOTICE '⚠️  UNEXPECTED: Direct insert failed with different error: %', SQLERRM;
            END IF;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 4: Suspicious Activity Detection ===';
    
    -- Test 4: Check suspicious activity detection
    SELECT check_suspicious_tab_activity(
        v_test_device_id,
        v_test_bar_id
    ) INTO v_result;
    
    RAISE NOTICE '📊 Suspicious Activity Check:';
    RAISE NOTICE '   Is Suspicious: %', v_result->>'is_suspicious';
    RAISE NOTICE '   Risk Score: %', v_result->>'risk_score';
    RAISE NOTICE '   Recent Attempts: %', v_result->>'recent_attempts';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 5: Different Bar Same Device ===';
    
    -- Test 5: Create tab at different bar (should succeed)
    DECLARE
        v_test_bar_2_id UUID;
    BEGIN
        -- Create second test bar
        INSERT INTO bars (name, location) 
        VALUES ('Test Bar 2', 'Test Location 2')
        RETURNING id INTO v_test_bar_2_id;
        
        SELECT create_tab_if_not_exists(
            v_test_bar_2_id,
            v_test_device_id,
            'Test User Bar 2'
        ) INTO v_result;
        
        IF (v_result->>'success')::boolean AND NOT (v_result->>'existing')::boolean THEN
            RAISE NOTICE '✅ PASS: Tab created at different bar';
            RAISE NOTICE '   New Bar Tab ID: %', v_result->'tab'->>'id';
        ELSE
            RAISE NOTICE '❌ FAIL: Could not create tab at different bar';
            RAISE NOTICE '   Result: %', v_result;
        END IF;
        
        -- Clean up second bar
        DELETE FROM tabs WHERE bar_id = v_test_bar_2_id;
        DELETE FROM bars WHERE id = v_test_bar_2_id;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== TEST 6: Tab Count Verification ===';
    
    -- Test 6: Verify only one open tab exists per bar
    DECLARE
        v_open_tabs_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_open_tabs_count
        FROM tabs 
        WHERE bar_id = v_test_bar_id 
          AND owner_identifier LIKE v_test_device_id || '%'
          AND status = 'open';
          
        IF v_open_tabs_count = 1 THEN
            RAISE NOTICE '✅ PASS: Exactly 1 open tab exists';
        ELSE
            RAISE NOTICE '❌ FAIL: Found % open tabs (should be 1)', v_open_tabs_count;
        END IF;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== CLEANUP ===';
    
    -- Cleanup test data
    DELETE FROM tabs WHERE owner_identifier LIKE v_test_device_id || '%';
    
    RAISE NOTICE '🧹 Test data cleaned up';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TAB ENFORCEMENT TESTS COMPLETED';
    RAISE NOTICE '   If all tests passed, the security fix is working correctly';
    RAISE NOTICE '   Users can no longer create multiple tabs per bar';
    
END $$;