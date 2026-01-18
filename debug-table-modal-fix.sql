-- Debug and fix table modal issues
-- This script will help identify and resolve table modal problems

-- 1. Check if the migration was applied
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name IN ('table_setup_enabled', 'table_count');

-- 2. Check current bar configuration
SELECT id, name, table_setup_enabled, table_count 
FROM bars 
ORDER BY name;

-- 3. Enable table setup for Popos bar (adjust bar name as needed)
UPDATE bars 
SET 
  table_setup_enabled = true,
  table_count = 20
WHERE name = 'Popos' OR name ILIKE '%popos%';

-- 4. Verify the update worked
SELECT id, name, table_setup_enabled, table_count 
FROM bars 
WHERE table_setup_enabled = true;

-- 5. Check if there are any tabs with table assignments
SELECT t.id, t.tab_number, t.notes, b.name as bar_name
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.notes IS NOT NULL
AND t.notes LIKE '%table_number%'
ORDER BY t.created_at DESC
LIMIT 10;