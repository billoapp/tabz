-- Test script to enable table setup for a bar
-- Replace 'your-bar-id' with an actual bar ID from your database

-- Enable table setup for a test bar with 20 tables
UPDATE bars 
SET 
  table_setup_enabled = true,
  table_count = 20
WHERE name = 'Popos'; -- or use WHERE id = 'your-bar-id'

-- Verify the update
SELECT id, name, table_setup_enabled, table_count 
FROM bars 
WHERE table_setup_enabled = true;