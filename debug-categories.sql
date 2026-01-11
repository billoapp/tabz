-- Debug Categories Script
-- Run this to check what's happening with your categories

-- Check if categories table exists and has data
SELECT 'Categories table check:' as info;
SELECT COUNT(*) as category_count FROM categories;

-- Show all current categories
SELECT 'Current categories:' as info;
SELECT id, name, image_url, created_at FROM categories ORDER BY name;

-- Check what categories are actually being used in bar_products
SELECT 'Categories used in bar_products:' as info;
SELECT DISTINCT category, COUNT(*) as count 
FROM bar_products 
WHERE category IS NOT NULL AND category != ''
GROUP BY category 
ORDER BY category;

-- Check what categories are used in custom_products
SELECT 'Categories used in custom_products:' as info;
SELECT DISTINCT category, COUNT(*) as count 
FROM custom_products 
WHERE category IS NOT NULL AND category != ''
GROUP BY category 
ORDER BY category;

-- Check if there are any bars with products
SELECT 'Bars with products:' as info;
SELECT b.id, b.name, COUNT(bp.id) as product_count
FROM bars b
LEFT JOIN bar_products bp ON b.id = bp.bar_id AND bp.active = true
GROUP BY b.id, b.name
ORDER BY product_count DESC;

-- Check if the staff app is loading categories correctly
SELECT 'Sample bar_products for testing:' as info;
SELECT bp.id, bp.name, bp.category, bp.image_url, b.name as bar_name
FROM bar_products bp
JOIN bars b ON bp.bar_id = b.id
WHERE bp.active = true
LIMIT 5;
