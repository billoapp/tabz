-- Function to check if tab can accept orders
-- This can be called by frontend before allowing order creation

CREATE OR REPLACE FUNCTION can_tab_accept_orders(p_tab_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tab RECORD;
    v_balance NUMERIC;
    v_result JSONB;
BEGIN
    -- Get tab details
    SELECT 
        id,
        status,
        opened_at,
        moved_to_overdue_at,
        overdue_reason
    INTO v_tab
    FROM tabs 
    WHERE id = p_tab_id;
    
    -- If tab not found
    IF NOT FOUND THEN
        SELECT jsonb_build_object(
            'can_order', false,
            'reason', 'Tab not found',
            'tab_status', null,
            'balance', 0
        ) INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Get current balance
    v_balance := get_tab_balance(p_tab_id);
    
    -- Build result based on tab status
    IF v_tab.status = 'overdue' THEN
        SELECT jsonb_build_object(
            'can_order', false,
            'reason', 'Tab is overdue - outstanding balance must be paid first',
            'tab_status', v_tab.status,
            'balance', v_balance,
            'overdue_since', v_tab.moved_to_overdue_at,
            'overdue_reason', v_tab.overdue_reason
        ) INTO v_result;
        
    ELSIF v_tab.status = 'closed' THEN
        SELECT jsonb_build_object(
            'can_order', false,
            'reason', 'Tab is closed - cannot accept new orders',
            'tab_status', v_tab.status,
            'balance', v_balance
        ) INTO v_result;
        
    ELSE  -- Open tabs
        SELECT jsonb_build_object(
            'can_order', true,
            'reason', 'Tab can accept orders',
            'tab_status', v_tab.status,
            'balance', v_balance
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION can_tab_accept_orders TO authenticated, anon;

-- Test the function
-- Test with actual tab IDs from your database
SELECT 
    t.id,
    t.tab_number,
    t.status,
    can_tab_accept_orders(t.id) as order_permissions
FROM tabs t
WHERE t.status IN ('open', 'overdue')
ORDER BY t.tab_number
LIMIT 5;
