-- Remove mpesa_callback_url column from bars table
-- The callback URL is now global for all tenants, not per-bar configuration

-- Remove the column (this will also remove any data in it)
ALTER TABLE bars DROP COLUMN IF EXISTS mpesa_callback_url;

-- Verify the column is removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'bars' 
  AND table_schema = 'public' 
  AND column_name = 'mpesa_callback_url';

-- Should return no rows if successfully removed