-- Fix existing menu URLs in the database
-- Run this in your Supabase SQL Editor

-- 1. Check current URLs (should show paths instead of full URLs)
SELECT 
  id,
  static_menu_url,
  static_menu_type,
  menu_type
FROM bars 
WHERE static_menu_url IS NOT NULL;

-- 2. Update all existing menu URLs to use full Supabase storage URLs
UPDATE bars 
SET static_menu_url = 'https://bkaigyrrzsqbfscyznzw.supabase.co/storage/v1/object/public/menu-files/' || static_menu_url
WHERE static_menu_url IS NOT NULL 
  AND static_menu_url NOT LIKE 'https://%'  -- Only update if it's not already a full URL
  AND static_menu_url LIKE 'menus/%';       -- Only update if it looks like a menu path

-- 3. Verify the fix (should now show full URLs)
SELECT 
  id,
  static_menu_url,
  static_menu_type,
  menu_type
FROM bars 
WHERE static_menu_url IS NOT NULL;