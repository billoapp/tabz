-- Add RLS policies for staff to view products
-- Allow staff users to view active products for autocomplete
-- This policy is more specific than the general authenticated policy
CREATE POLICY "staff_view_active_products" ON products
FOR SELECT
TO authenticated
USING (active = true);

-- Drop the conflicting broad policy if it exists
DROP POLICY IF EXISTS "allow_authenticated_manage_products" ON products;
