-- Remove RLS from slideshow_images to work like bar_products
-- This makes slideshow images publicly accessible like menu images

-- 1. Disable Row Level Security
ALTER TABLE slideshow_images DISABLE ROW LEVEL SECURITY;

-- 2. Drop existing RLS policies (quoted with escaped underscores)
DROP POLICY IF EXISTS "Users_can_view_slideshow_images_for_their_bar";
DROP POLICY IF EXISTS "Users_can_manage_slideshow_images_for_their_bar";

-- 3. Create simple public access policy (like menu images)
CREATE POLICY "Slideshow_images_are_publicly_accessible" 
ON slideshow_images FOR SELECT 
USING (bucket_id IN ('menu-images', 'menu-files'));

-- 4. Grant necessary permissions
GRANT ALL ON slideshow_images TO authenticated;
GRANT ALL ON slideshow_images TO anon;

-- 5. Success message
SELECT 'Slideshow images RLS removed - now publicly accessible like menu images' as status;
