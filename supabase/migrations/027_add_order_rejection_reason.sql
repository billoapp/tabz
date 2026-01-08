-- Add rejection reason functionality for staff order rejections
-- Migration: 027_add_order_rejection_reason.sql

-- Create ENUM type for rejection reasons
CREATE TYPE rejection_reason AS ENUM (
    'wrong_items',
    'already_ordered',
    'change_mind'
);

-- Add rejection_reason column to tab_orders
ALTER TABLE tab_orders 
ADD COLUMN rejection_reason rejection_reason;

-- Add cancelled_by column to track who cancelled the order
ALTER TABLE tab_orders 
ADD COLUMN cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'staff', 'system'));

-- Add comments for documentation
COMMENT ON COLUMN tab_orders.rejection_reason IS 'Reason why customer rejected a staff-initiated order';
COMMENT ON COLUMN tab_orders.cancelled_by IS 'Who cancelled the order (customer/staff/system)';

-- Create index on rejection_reason for analytics
CREATE INDEX idx_tab_orders_rejection_reason ON tab_orders(rejection_reason);

-- Create index on cancelled_by for analytics  
CREATE INDEX idx_tab_orders_cancelled_by ON tab_orders(cancelled_by);

-- Update existing cancelled orders to have cancelled_by = 'customer' for backwards compatibility
UPDATE tab_orders 
SET cancelled_by = 'customer' 
WHERE status = 'cancelled' AND cancelled_by IS NULL;
