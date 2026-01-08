-- ============================================
-- ADD RLS POLICIES FOR PAYMENT SETTINGS COLUMNS
-- ============================================

-- Update existing bars RLS policy to include payment settings columns
DROP POLICY IF EXISTS bars_isolation ON bars;

CREATE POLICY bars_isolation ON bars
    FOR ALL
    USING (id = current_setting('app.current_bar_id', true)::UUID)
    WITH CHECK (id = current_setting('app.current_bar_id', true)::UUID);

-- Grant access to payment settings for authenticated users
GRANT SELECT ON bars TO authenticated;
GRANT UPDATE ON bars TO authenticated;

-- Success message
SELECT 'RLS policies for payment settings columns completed successfully' as status;