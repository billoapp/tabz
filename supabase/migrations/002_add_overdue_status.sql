-- Add overdue status to tabs
-- Migration: 002_add_overdue_status.sql

-- Update tabs table to include overdue status
ALTER TABLE tabs 
DROP CONSTRAINT IF EXISTS tabs_status_check;

ALTER TABLE tabs 
ADD CONSTRAINT tabs_status_check 
CHECK (status IN ('open', 'overdue', 'closed'));

-- Add device_id tracking for overdue tabs recall
ALTER TABLE tabs 
ADD COLUMN device_identifier TEXT, -- Store device ID for overdue recall
ADD COLUMN moved_to_overdue_at TIMESTAMPTZ, -- When tab was marked overdue
ADD COLUMN overdue_reason TEXT; -- Reason for marking overdue

-- Create index for finding overdue tabs by bar
CREATE INDEX idx_tabs_bar_overdue ON tabs(bar_id, status) WHERE status = 'overdue';

-- Create index for finding overdue tabs by device
CREATE INDEX idx_tabs_device_overdue ON tabs(device_identifier, status) WHERE status = 'overdue';

-- Add comment
COMMENT ON COLUMN tabs.status IS 'Tab status: open, overdue, closed';
COMMENT ON COLUMN tabs.device_identifier IS 'Device ID for recalling overdue tabs';
COMMENT ON COLUMN tabs.moved_to_overdue_at IS 'Timestamp when tab was marked as overdue';
COMMENT ON COLUMN tabs.overdue_reason IS 'Reason why tab was marked as overdue';
