-- Safe Schema Inspection Script
-- This will show current table structures without modifying anything
-- Run this with: npx supabase db remote --schema=public < inspect_current_schema.sql

-- Check bar_products table structure
SELECT 'bar_products table structure:' as info;
\d bar_products;

-- Check products table structure  
SELECT 'products table structure:' as info;
\d products;

-- Check custom_products table structure
SELECT 'custom_products table structure:' as info;
\d custom_products;

-- Check categories table structure
SELECT 'categories table structure:' as info;
\d categories;

-- Sample data check for images
SELECT 'Sample bar_products with images:' as info;
SELECT id, name, category, image_url FROM bar_products WHERE image_url IS NOT NULL LIMIT 5;

SELECT 'Sample products with images:' as info;
SELECT id, name, category, image_url FROM products WHERE image_url IS NOT NULL LIMIT 5;

SELECT 'Sample categories with images:' as info;
SELECT id, name, image_url FROM categories WHERE image_url IS NOT NULL LIMIT 5;
