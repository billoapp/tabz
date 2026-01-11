-- Safe Update Categories to Final 13 Categories
-- This script handles duplicates properly by using UPSERT logic

-- First, let's see the current mapping
SELECT 'Current categories before update:' as info;
SELECT name, image_url FROM categories ORDER BY name;

-- Delete old categories that will be consolidated
DELETE FROM categories 
WHERE name IN ('Beer', 'Cider', 'Wine', 'Champagne', 'Soft Drinks', 'Coffee & Tea', 
               'Juice', 'Water', 'Energy Drinks', 'Cocktails', 'Liqueurs', 'Specialty',
               'Starters', 'Appetizers', 'Salad', 'Bakery', 'Breakfast', 'Bread', 'Egg',
               'Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn',
               'Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape');

-- Insert/Update the final 13 categories
INSERT INTO categories (name, image_url, created_at) VALUES
('Beer & Cider', '/api/category-icons/beer', NOW()),
('Wine & Champagne', '/api/category-icons/wine', NOW()),
('Spirits', '/api/category-icons/spirits', NOW()),
('Liqueurs & Specialty', '/api/category-icons/liqueurs', NOW()),
('Non-Alcoholic', '/api/category-icons/non-alcoholic', NOW()),
('Pizza', '/api/category-icons/pizza', NOW()),
('BBQ & Choma', '/api/category-icons/bbq', NOW()),
('Starters & Appetizers', '/api/category-icons/starters', NOW()),
('Main Courses', '/api/category-icons/main-courses', NOW()),
('Side Dishes', '/api/category-icons/side-dishes', NOW()),
('Bakery & Breakfast', '/api/category-icons/bakery-breakfast', NOW()),
('Desserts & Snacks', '/api/category-icons/desserts-snacks', NOW()),
('Convenience & Other', '/api/category-icons/convenience', NOW())
ON CONFLICT (name) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  created_at = NOW();

-- Show the updated categories
SELECT 'Updated categories (should be 13):' as info;
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

-- Now update products to use the new category names
-- Beer & Cider
UPDATE bar_products 
SET category = 'Beer & Cider' 
WHERE category IN ('Beer', 'Cider');

UPDATE custom_products 
SET category = 'Beer & Cider' 
WHERE category IN ('Beer', 'Cider');

-- Wine & Champagne
UPDATE bar_products 
SET category = 'Wine & Champagne' 
WHERE category IN ('Wine', 'Champagne');

UPDATE custom_products 
SET category = 'Wine & Champagne' 
WHERE category IN ('Wine', 'Champagne');

-- Non-Alcoholic (combine multiple categories)
UPDATE bar_products 
SET category = 'Non-Alcoholic' 
WHERE category IN ('Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

UPDATE custom_products 
SET category = 'Non-Alcoholic' 
WHERE category IN ('Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

-- Liqueurs & Specialty
UPDATE bar_products 
SET category = 'Liqueurs & Specialty' 
WHERE category IN ('Cocktails', 'Liqueurs', 'Specialty');

UPDATE custom_products 
SET category = 'Liqueurs & Specialty' 
WHERE category IN ('Cocktails', 'Liqueurs', 'Specialty');

-- Starters & Appetizers
UPDATE bar_products 
SET category = 'Starters & Appetizers' 
WHERE category IN ('Starters', 'Appetizers', 'Salad');

UPDATE custom_products 
SET category = 'Starters & Appetizers' 
WHERE category IN ('Starters', 'Appetizers', 'Salad');

-- Bakery & Breakfast
UPDATE bar_products 
SET category = 'Bakery & Breakfast' 
WHERE category IN ('Bakery', 'Breakfast', 'Bread', 'Egg');

UPDATE custom_products 
SET category = 'Bakery & Breakfast' 
WHERE category IN ('Bakery', 'Breakfast', 'Bread', 'Egg');

-- Desserts & Snacks
UPDATE bar_products 
SET category = 'Desserts & Snacks' 
WHERE category IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn');

UPDATE custom_products 
SET category = 'Desserts & Snacks' 
WHERE category IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn');

-- Convenience & Other
UPDATE bar_products 
SET category = 'Convenience & Other' 
WHERE category IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape');

UPDATE custom_products 
SET category = 'Convenience & Other' 
WHERE category IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape');

-- Show final product distribution
SELECT 'Final product distribution:' as info;
SELECT category, COUNT(*) as count
FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION ALL
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
GROUP BY category 
ORDER BY count DESC;
