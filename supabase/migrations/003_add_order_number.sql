-- Add order number to tab_orders for dispute resolution
-- Migration: 003_add_order_number.sql

-- Add order_number column to tab_orders table
ALTER TABLE tab_orders 
ADD COLUMN order_number INTEGER;

-- Create index for order numbers
CREATE INDEX idx_orders_number ON tab_orders(order_number);

-- Add sequence for auto-incrementing order numbers per tab
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Function to get next order number for a tab
CREATE OR REPLACE FUNCTION get_next_order_number(p_tab_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_max_number INTEGER;
BEGIN
    -- Get the current max order number for this tab
    SELECT COALESCE(MAX(order_number), 0) INTO v_max_number
    FROM tab_orders 
    WHERE tab_id = p_tab_id;
    
    -- Return next number
    RETURN v_max_number + 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign order numbers
CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign if order_number is null
    IF NEW.order_number IS NULL THEN
        NEW.order_number := get_next_order_number(NEW.tab_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_order_number_trigger
    BEFORE INSERT ON tab_orders
    FOR EACH ROW
    EXECUTE FUNCTION assign_order_number();

-- Add comment
COMMENT ON COLUMN tab_orders.order_number IS 'Sequential order number per tab for dispute resolution';
