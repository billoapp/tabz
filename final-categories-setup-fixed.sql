-- FINAL CATEGORIES SETUP - FIXED VERSION
-- This creates the exact 13 final categories with correct icons

-- Clear existing categories to start fresh
DELETE FROM categories;

-- Insert the final 13 categories with exact names and icons
INSERT INTO categories (name, image_url, created_at) VALUES
-- DRINKS
('Beer & Cider', '/api/category-icons/beer', NOW()),
('Wine & Champagne', '/api/category-icons/wine', NOW()),
('Spirits', '/api/category-icons/spirits', NOW()),
('Liqueurs & Specialty', '/api/category-icons/liqueurs', NOW()),
('Non-Alcoholic', '/api/category-icons/non-alcoholic', NOW()),
-- FOOD
('Pizza', '/api/category-icons/pizza', NOW()),
('BBQ & Choma', '/api/category-icons/bbq', NOW()),
('Starters & Appetizers', '/api/category-icons/starters', NOW()),
('Main Courses', '/api/category-icons/main-courses', NOW()),
('Side Dishes', '/api/category-icons/side-dishes', NOW()),
('Bakery & Breakfast', '/api/category-icons/bakery-breakfast', NOW()),
('Desserts & Snacks', '/api/category-icons/desserts-snacks', NOW()),
('Convenience & Other', '/api/category-icons/convenience', NOW());

-- Update products to use these exact category names
-- Beer & Cider
UPDATE bar_products 
SET category = 'Beer & Cider' 
WHERE category IN ('Beer', 'Cider', 'Beer & Cider');

UPDATE custom_products 
SET category = 'Beer & Cider' 
WHERE category IN ('Beer', 'Cider', 'Beer & Cider');

-- Wine & Champagne
UPDATE bar_products 
SET category = 'Wine & Champagne' 
WHERE category IN ('Wine', 'Champagne', 'Wine & Champagne');

UPDATE custom_products 
SET category = 'Wine & Champagne' 
WHERE category IN ('Wine', 'Champagne', 'Wine & Champagne');

-- Spirits
UPDATE bar_products 
SET category = 'Spirits' 
WHERE category IN ('Spirits', 'Whiskey', 'Gin', 'Vodka', 'Rum', 'Tequila');

UPDATE custom_products 
SET category = 'Spirits' 
WHERE category IN ('Spirits', 'Whiskey', 'Gin', 'Vodka', 'Rum', 'Tequila');

-- Liqueurs & Specialty
UPDATE bar_products 
SET category = 'Liqueurs & Specialty' 
WHERE category IN ('Liqueurs', 'Specialty', 'Cocktails', 'Brandy', 'Liqueurs & Specialty');

UPDATE custom_products 
SET category = 'Liqueurs & Specialty' 
WHERE category IN ('Liqueurs', 'Specialty', 'Cocktails', 'Brandy', 'Liqueurs & Specialty');

-- Non-Alcoholic
UPDATE bar_products 
SET category = 'Non-Alcoholic' 
WHERE category IN ('Non-Alcoholic', 'Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

UPDATE custom_products 
SET category = 'Non-Alcoholic' 
WHERE category IN ('Non-Alcoholic', 'Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

-- Pizza
UPDATE bar_products 
SET category = 'Pizza' 
WHERE category = 'Pizza';

UPDATE custom_products 
SET category = 'Pizza' 
WHERE category = 'Pizza';

-- BBQ & Choma
UPDATE bar_products 
SET category = 'BBQ & Choma' 
WHERE category IN ('BBQ', 'Choma', 'Grill', 'BBQ & Choma');

UPDATE custom_products 
SET category = 'BBQ & Choma' 
WHERE category IN ('BBQ', 'Choma', 'Grill', 'BBQ & Choma');

-- Starters & Appetizers
UPDATE bar_products 
SET category = 'Starters & Appetizers' 
WHERE category IN ('Starters', 'Appetizers', 'Salad', 'Starters & Appetizers');

UPDATE custom_products 
SET category = 'Starters & Appetizers' 
WHERE category IN ('Starters', 'Appetizers', 'Salad', 'Starters & Appetizers');

-- Main Courses
UPDATE bar_products 
SET category = 'Main Courses' 
WHERE category IN ('Main Courses', 'Main', 'Meal', 'Dish');

UPDATE custom_products 
SET category = 'Main Courses' 
WHERE category IN ('Main Courses', 'Main', 'Meal', 'Dish');

-- Side Dishes
UPDATE bar_products 
SET category = 'Side Dishes' 
WHERE category IN ('Side Dishes', 'Side', 'Accompaniment');

UPDATE custom_products 
SET category = 'Side Dishes' 
WHERE category IN ('Side Dishes', 'Side', 'Accompaniment');

-- Bakery & Breakfast
UPDATE bar_products 
SET category = 'Bakery & Breakfast' 
WHERE category IN ('Bakery', 'Breakfast', 'Bread', 'Egg', 'Bakery & Breakfast');

UPDATE custom_products 
SET category = 'Bakery & Breakfast' 
WHERE category IN ('Bakery', 'Breakfast', 'Bread', 'Egg', 'Bakery & Breakfast');

-- Desserts & Snacks
UPDATE bar_products 
SET category = 'Desserts & Snacks' 
WHERE category IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn', 'Desserts & Snacks');

UPDATE custom_products 
SET category = 'Desserts & Snacks' 
WHERE category IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn', 'Desserts & Snacks');

-- Convenience & Other
UPDATE bar_products 
SET category = 'Convenience & Other' 
WHERE category IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape', 'Convenience & Other');

UPDATE custom_products 
SET category = 'Convenience & Other' 
WHERE category IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape', 'Convenience & Other');

-- Verify the final categories
SELECT 'Final 13 Categories Created:' as info;
SELECT 
  name,
  image_url,
  CASE 
    WHEN name IN ('Beer & Cider', 'Wine & Champagne', 'Spirits', 'Liqueurs & Specialty', 'Non-Alcoholic',
                'Pizza', 'BBQ & Choma', 'Starters & Appetizers', 'Main Courses', 'Side Dishes',
                'Bakery & Breakfast', 'Desserts & Snacks', 'Convenience & Other') 
    THEN '✅ Final category'
    ELSE '❌ Not in final list'
  END as status
FROM categories 
ORDER BY 
  CASE 
    WHEN name = 'Beer & Cider' THEN 1
    WHEN name = 'Wine & Champagne' THEN 2
    WHEN name = 'Spirits' THEN 3
    WHEN name = 'Liqueurs & Specialty' THEN 4
    WHEN name = 'Non-Alcoholic' THEN 5
    WHEN name = 'Pizza' THEN 6
    WHEN name = 'BBQ & Choma' THEN 7
    WHEN name = 'Starters & Appetizers' THEN 8
    WHEN name = 'Main Courses' THEN 9
    WHEN name = 'Side Dishes' THEN 10
    WHEN name = 'Bakery & Breakfast' THEN 11
    WHEN name = 'Desserts & Snacks' THEN 12
    WHEN name = 'Convenience & Other' THEN 13
    ELSE 99
  END;

-- Show final product distribution
SELECT 'Final Product Distribution:' as info;
SELECT category, COUNT(*) as count
FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION ALL
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
GROUP BY category 
ORDER BY count DESC;
