-- Simple test to check categories table
-- Run this in your Supabase SQL editor

-- Check if categories table exists and has data
SELECT 'Categories table count:' as info;
SELECT COUNT(*) as total FROM categories;

-- Show first 5 categories
SELECT 'First 5 categories:' as info;
SELECT name, image_url FROM categories LIMIT 5;

-- Check what categories are actually used in products
SELECT 'Categories used in products:' as info;
SELECT DISTINCT category, COUNT(*) as count 
FROM bar_products 
WHERE category IS NOT NULL AND category != ''
GROUP BY category 
ORDER BY count DESC
LIMIT 10;
