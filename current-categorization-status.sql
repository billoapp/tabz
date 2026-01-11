-- Current Categorization Status Check
-- This shows exactly what categories exist and how many items are in each

-- Check current categories table
SELECT 'Categories in table:' as info;
SELECT name, image_url, created_at FROM categories ORDER BY name;

-- Check current distribution across all products
SELECT 'Current category distribution:' as info;
SELECT category, COUNT(*) as count 
FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION ALL
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
GROUP BY category 
ORDER BY count DESC;

-- Check if there are any uncategorized items remaining
SELECT 'Uncategorized items count:' as info;
SELECT COUNT(*) as uncategorized_count
FROM (
  SELECT category FROM bar_products WHERE category = 'Uncategorized'
  UNION ALL
  SELECT category FROM custom_products WHERE category = 'Uncategorized'
) as uncategorized;

-- Show sample of uncategorized items if any exist
SELECT 'Sample uncategorized items:' as info;
SELECT name, category FROM bar_products 
WHERE category = 'Uncategorized' 
ORDER BY name
LIMIT 10;
