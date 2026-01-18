-- Add support for "not_cold" preference in order items
-- Migration: 034_add_not_cold_preference.sql
-- Date: 2026-01-17

-- OVERVIEW:
-- This migration adds support for a "not_cold" preference field in order items
-- for customer orders. This allows customers to specify if they want drinks
-- served at room temperature instead of cold.

-- AFFECTED TABLES:
-- - tab_orders.items (JSON field) - will now support not_cold boolean

-- NEW JSON STRUCTURE for items array:
-- [
--   {
--     "product_id": "uuid",
--     "name": "string", 
--     "quantity": number,
--     "price": number,
--     "total": number,
--     "category": "string",
--     "not_cold": boolean (optional, for drinks only)
--   }
-- ]

-- DRINK CATEGORIES that support not_cold:
-- - "Beer & Cider"
-- - "Wine & Champagne" 
-- - "Spirits"
-- - "Liqueurs & Specialty"
-- - "Non-Alcoholic"

-- USAGE:
-- - Only shown in customer ordering interface for drink categories
-- - Default: false (drinks are cold by default)
-- - Staff will see this preference when viewing customer orders
-- - Not displayed in order history

-- Add a comment to the tab_orders table to document the new field
COMMENT ON COLUMN tab_orders.items IS 'JSON array of order items. Each item can have: product_id, name, quantity, price, total, category, and not_cold (boolean, for drinks only)';

-- Create an index to help with queries that might filter by items content
-- This is optional but can help with performance
CREATE INDEX IF NOT EXISTS idx_tab_orders_items_gin ON tab_orders USING gin (items);

-- Validation function to ensure not_cold is only used for drink categories
CREATE OR REPLACE FUNCTION validate_not_cold_preference()
RETURNS TRIGGER AS $$
DECLARE
    item JSONB;
    drink_categories TEXT[] := ARRAY['Beer & Cider', 'Wine & Champagne', 'Spirits', 'Liqueurs & Specialty', 'Non-Alcoholic'];
BEGIN
    -- Check each item in the items array
    FOR item IN SELECT jsonb_array_elements(NEW.items)
    LOOP
        -- If item has not_cold field, ensure it's only for drink categories
        IF item ? 'not_cold' AND item->>'not_cold' = 'true' THEN
            IF NOT (item->>'category' = ANY(drink_categories)) THEN
                RAISE EXCEPTION 'not_cold preference can only be set for drink categories: %', array_to_string(drink_categories, ', ');
            END IF;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate not_cold usage
DROP TRIGGER IF EXISTS validate_not_cold_trigger ON tab_orders;
CREATE TRIGGER validate_not_cold_trigger
    BEFORE INSERT OR UPDATE ON tab_orders
    FOR EACH ROW
    EXECUTE FUNCTION validate_not_cold_preference();