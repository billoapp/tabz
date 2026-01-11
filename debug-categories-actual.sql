-- Debug Categories Table - What's Actually in There?
-- Run this to see what's happening with your categories

-- Check what's actually in the categories table
SELECT 'Categories table contents:' as info;
SELECT id, name, image_url, created_at FROM categories ORDER BY name;

-- Check what categories are being used in bar_products
SELECT 'Categories used in bar_products:' as info;
SELECT DISTINCT category, COUNT(*) as count 
FROM bar_products 
WHERE category IS NOT NULL AND category != ''
GROUP BY category 
ORDER BY category;

-- Check what categories are being used in custom_products
SELECT 'Categories used in custom_products:' as info;
SELECT DISTINCT category, COUNT(*) as count 
FROM custom_products 
WHERE category IS NOT NULL AND category != ''
GROUP BY category 
ORDER BY category;

-- Check if there's a mismatch between categories table and actual usage
SELECT 'Categories in table but not used in products:' as info;
SELECT name FROM categories 
WHERE name NOT IN (
  SELECT DISTINCT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION
  SELECT DISTINCT category FROM custom_products WHERE category IS NOT NULL AND category != ''
);

SELECT 'Categories used in products but not in table:' as info;
SELECT DISTINCT category FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
WHERE category NOT IN (SELECT name FROM categories);
