-- Add table setup functionality to bars
ALTER TABLE bars 
ADD COLUMN table_setup_enabled BOOLEAN DEFAULT false,
ADD COLUMN table_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN bars.table_setup_enabled IS 'Whether this bar uses table number system';
COMMENT ON COLUMN bars.table_count IS 'Number of tables available (1 to table_count)';

-- Update RLS policies to allow reading these new columns
-- (The existing RLS policies should already cover these columns)