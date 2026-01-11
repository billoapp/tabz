-- Update Categories to Final 13 Categories
-- This script updates existing categories to match our final 13 categories

-- First, let's see the current mapping
SELECT 'Current categories before update:' as info;
SELECT name, image_url FROM categories ORDER BY name;

-- Update old categories to new final categories
UPDATE categories 
SET name = 'Beer & Cider', image_url = '/api/category-icons/beer'
WHERE name IN ('Beer', 'Cider');

UPDATE categories 
SET name = 'Wine & Champagne', image_url = '/api/category-icons/wine'
WHERE name IN ('Wine', 'Champagne');

UPDATE categories 
SET name = 'Spirits', image_url = '/api/category-icons/spirits'
WHERE name = 'Spirits';

UPDATE categories 
SET name = 'Liqueurs & Specialty', image_url = '/api/category-icons/liqueurs'
WHERE name IN ('Liqueurs', 'Specialty', 'Cocktails');

UPDATE categories 
SET name = 'Non-Alcoholic', image_url = '/api/category-icons/non-alcoholic'
WHERE name IN ('Non-Alcoholic', 'Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

UPDATE categories 
SET name = 'Pizza', image_url = '/api/category-icons/pizza'
WHERE name = 'Pizza';

UPDATE categories 
SET name = 'BBQ & Choma', image_url = '/api/category-icons/bbq'
WHERE name IN ('BBQ', 'Choma', 'Grill');

UPDATE categories 
SET name = 'Starters & Appetizers', image_url = '/api/category-icons/starters'
WHERE name IN ('Starters', 'Appetizers', 'Salad');

UPDATE categories 
SET name = 'Main Courses', image_url = '/api/category-icons/main-courses'
WHERE name = 'Main Courses';

UPDATE categories 
SET name = 'Side Dishes', image_url = '/api/category-icons/side-dishes'
WHERE name IN ('Side Dishes', 'Side', 'Accompaniment');

UPDATE categories 
SET name = 'Bakery & Breakfast', image_url = '/api/category-icons/bakery-breakfast'
WHERE name IN ('Bakery', 'Breakfast', 'Bread', 'Egg');

UPDATE categories 
SET name = 'Desserts & Snacks', image_url = '/api/category-icons/desserts-snacks'
WHERE name IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn');

UPDATE categories 
SET name = 'Convenience & Other', image_url = '/api/category-icons/convenience'
WHERE name IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape');

-- Keep Uncategorized as is (it's a valid fallback)
UPDATE categories 
SET name = 'Uncategorized', image_url = '/api/category-icons/uncategorized'
WHERE name = 'Uncategorized';

-- Remove duplicates that might have been created
DELETE FROM categories 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM categories 
  GROUP BY name
);

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
