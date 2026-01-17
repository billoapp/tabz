-- Fix tab closing issues
-- 1. Update closed_by constraint to allow 'system' value
-- 2. Check for any missing columns that might cause 400 errors

-- First, let's check the current constraint on closed_by
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'tabs'::regclass 
AND conname LIKE '%closed_by%';

-- Drop the existing constraint if it exists
ALTER TABLE tabs DROP CONSTRAINT IF EXISTS tabs_closed_by_check;

-- Add new constraint that allows 'customer', 'staff', and 'system'
ALTER TABLE tabs ADD CONSTRAINT tabs_closed_by_check 
CHECK (closed_by IN ('customer', 'staff', 'system'));

-- Check if closure_reason column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tabs' AND column_name = 'closure_reason'
    ) THEN
        ALTER TABLE tabs ADD COLUMN closure_reason TEXT;
    END IF;
END $$;

-- Verify the bars table has all required alert columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name IN (
    'alert_timeout', 
    'alert_sound_enabled', 
    'alert_custom_audio_url', 
    'alert_custom_audio_name', 
    'alert_volume'
)
ORDER BY column_name;