-- Populate Categories Table from Existing Products
-- This script extracts categories from existing products and populates the categories table

-- First, let's see what categories exist in your products
SELECT 'Current categories in products table:' as info;
SELECT DISTINCT category, COUNT(*) as count 
FROM products 
WHERE category IS NOT NULL AND category != ''
GROUP BY category 
ORDER BY category;

-- Now populate the categories table with existing categories
INSERT INTO categories (name, image_url, created_at)
SELECT DISTINCT category, '/api/category-icons/' || LOWER(REPLACE(category, ' ', '-')), NOW()
FROM products 
WHERE category IS NOT NULL AND category != ''
AND category NOT IN (SELECT name FROM categories);

-- Also add categories from custom products
INSERT INTO categories (name, image_url, created_at)
SELECT DISTINCT category, '/api/category-icons/' || LOWER(REPLACE(category, ' ', '-')), NOW()
FROM custom_products 
WHERE category IS NOT NULL AND category != ''
AND category NOT IN (SELECT name FROM categories);

-- Verify the results
SELECT 'Categories table after population:' as info;
SELECT * FROM categories ORDER BY name;

-- Success message
SELECT 'Categories table populated successfully!' as message;
