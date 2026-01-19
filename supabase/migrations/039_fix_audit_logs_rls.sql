-- Fix audit_logs RLS policies for anonymous users
-- This allows the create_tab_if_not_exists function to insert audit logs

-- Enable RLS on audit_logs if not already enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow system functions to insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow reading audit logs with bar context" ON public.audit_logs;

-- Create policy to allow system functions to insert audit logs
-- This is needed for the create_tab_if_not_exists function
CREATE POLICY "Allow system functions to insert audit logs"
ON public.audit_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create policy to allow reading audit logs with bar context
CREATE POLICY "Allow reading audit logs with bar context"
ON public.audit_logs FOR SELECT
TO anon, authenticated
USING (
    bar_id IS NULL OR 
    bar_id = current_setting('app.current_bar_id', true)::UUID
);

-- Grant necessary permissions to anon and authenticated users
GRANT INSERT ON public.audit_logs TO anon;
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO anon;
GRANT SELECT ON public.audit_logs TO authenticated;

-- Success message
SELECT 'Audit logs RLS policies fixed - system functions can now insert audit logs' as status;