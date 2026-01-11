-- Fix Categories Mismatch
-- This script updates the categories table to match what's actually used in products

-- First, let's see what's currently in categories table
SELECT 'Current categories in table:' as info;
SELECT name, image_url FROM categories ORDER BY name;

-- Now update categories table to match actual usage
-- Delete existing categories that don't match product usage
DELETE FROM categories WHERE name NOT IN (
  SELECT DISTINCT category FROM (
    SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
    UNION
    SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
  ) as all_categories
);

-- Insert/update categories that are actually used
INSERT INTO categories (name, image_url, created_at) 
VALUES
  ('Beer', '/api/category-icons/beer', NOW()),
  ('Wine', '/api/category-icons/wine', NOW()),
  ('Main Courses', '/api/category-icons/main-courses', NOW()),
  ('Non-Alcoholic', '/api/category-icons/non-alcoholic', NOW()),
  ('Breakfast', '/api/category-icons/breakfast', NOW()),
  ('Starters', '/api/category-icons/starters', NOW()),
  ('Soft Drinks', '/api/category-icons/soft-drinks', NOW()),
  ('Spirits', '/api/category-icons/spirits', NOW()),
  ('Uncategorized', '/api/category-icons/uncategorized', NOW())
ON CONFLICT (name) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  created_at = NOW();

-- Verify the fix
SELECT 'Updated categories table:' as info;
SELECT name, image_url FROM categories ORDER BY name;

-- Success message
SELECT 'Categories table fixed to match product usage!' as message;
