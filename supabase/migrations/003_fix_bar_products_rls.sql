-- Update RLS policy for bar_products to work with session settings
DROP POLICY IF EXISTS bar_products_isolation ON bar_products;

-- New policy that uses session settings for bar isolation
CREATE POLICY bar_products_isolation ON bar_products
    FOR ALL
    USING (bar_id = current_setting('app.current_bar_id', true)::uuid)
    WITH CHECK (bar_id = current_setting('app.current_bar_id', true)::uuid);
