-- Function to set bar context for RLS policies
CREATE OR REPLACE FUNCTION set_bar_context(p_bar_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_bar_id', p_bar_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_bar_context TO authenticated;
GRANT EXECUTE ON FUNCTION set_bar_context TO service_role;
