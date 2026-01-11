-- Debug Category Images
-- Check if categories table has the correct image_url values for our 13 final categories

SELECT 'Current categories in database:' as info;
SELECT name, image_url, created_at FROM categories ORDER BY name;

-- Check which categories are being used in products
SELECT 'Categories used in products:' as info;
SELECT DISTINCT category, COUNT(*) as product_count
FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION ALL
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
GROUP BY category 
ORDER BY product_count DESC;

-- Check if our 13 final categories exist with proper image URLs
SELECT 'Final 13 categories check:' as info;
SELECT 
  name,
  CASE 
    WHEN name IN ('Beer & Cider', 'Wine & Champagne', 'Spirits', 'Liqueurs & Specialty', 'Non-Alcoholic',
                'Pizza', 'BBQ & Choma', 'Starters & Appetizers', 'Main Courses', 'Side Dishes',
                'Bakery & Breakfast', 'Desserts & Snacks', 'Convenience & Other') 
    THEN '✅ Final category'
    ELSE '❌ Not in final list'
  END as status,
  image_url
FROM categories 
ORDER BY name;
