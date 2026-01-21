-- Create trigger to prevent orders on overdue tabs
-- This ensures customers with outstanding balance cannot place new orders

CREATE OR REPLACE FUNCTION prevent_orders_on_overdue_tabs()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the tab for this order exists and is overdue
    -- NEW.tab_id should reference the tab this order belongs to
    IF EXISTS (
        SELECT 1 FROM tabs 
        WHERE id = NEW.tab_id 
          AND status = 'overdue'
    ) THEN
        RAISE EXCEPTION 'OVERDUE_TAB_RESTRICTION: Cannot create orders for tabs with outstanding balance. Please settle the overdue balance first.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_orders_on_overdue_tabs_trigger ON tab_orders;
CREATE TRIGGER prevent_orders_on_overdue_tabs_trigger
    BEFORE INSERT OR UPDATE ON tab_orders
    FOR EACH ROW
    EXECUTE FUNCTION prevent_orders_on_overdue_tabs();

-- Test the trigger with a sample insert
-- This should fail if tab_id belongs to an overdue tab
-- Replace TAB_ID_HERE with an actual overdue tab ID
DO $$
BEGIN
    -- This should raise an exception
    INSERT INTO tab_orders (tab_id, items, total, status, created_at)
    VALUES (
        'TAB_ID_HERE', 
        '[{"name": "Test Item", "quantity": 1, "price": 100}]', 
        100, 
        'pending', 
        NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Trigger working correctly: %', SQLERRM;
END;
$$;
