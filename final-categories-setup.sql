-- FINAL CATEGORIES SETUP
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

-- Verify the final categories
SELECT 'Final 13 Categories Created:' as info;
SELECT 
  name,
  image_url,
  CASE 
    WHEN name = 'Beer & Cider' THEN '🍺 Beer icon'
    WHEN name = 'Wine & Champagne' THEN '🍷 Wine icon'
    WHEN name = 'Spirits' THEN '🥃 Glasses icon'
    WHEN name = 'Liqueurs & Specialty' THEN '🍸 Martini icon'
    WHEN name = 'Non-Alcoholic' THEN '🥤 Droplets icon'
    WHEN name = 'Pizza' THEN '🍕 Pizza icon'
    WHEN name = 'BBQ & Choma' THEN '🔥 Flame icon'
    WHEN name = 'Starters & Appetizers' THEN '🥗 Leaf icon'
    WHEN name = 'Main Courses' THEN '🍽️ Utensils icon'
    WHEN name = 'Side Dishes' THEN '🍚 Wheat icon'
    WHEN name = 'Bakery & Breakfast' THEN '🍳 Egg icon'
    WHEN name = 'Desserts & Snacks' THEN '🍰 Cake icon'
    WHEN name = 'Convenience & Other' THEN '📦 Package icon'
    ELSE '❓ Unknown'
  END as icon_mapping
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

-- Update products to use these exact category names
-- DRINKS
UPDATE bar_products 
SET category = 'Beer & Cider' 
WHERE category IN ('Beer', 'Cider', 'Beer & Cider');

UPDATE custom_products 
SET category = 'Beer & Cider' 
WHERE category IN ('Beer', 'Cider', 'Beer & Cider');

UPDATE bar_products 
SET category = 'Wine & Champagne' 
WHERE category IN ('Wine', 'Champagne', 'Wine & Champagne');

UPDATE custom_products 
SET category = 'Wine & Champagne' 
WHERE category IN ('Wine', 'Champagne', 'Wine & Champagne');

UPDATE bar_products 
SET category = 'Spirits' 
WHERE category IN ('Spirits', 'Whiskey', 'Gin', 'Vodka', 'Rum', 'Tequila');

UPDATE custom_products 
SET category = 'Spirits' 
WHERE category IN ('Spirits', 'Whiskey', 'Gin', 'Vodka', 'Rum', 'Tequila');

UPDATE bar_products 
SET category = 'Liqueurs & Specialty' 
WHERE category IN ('Liqueurs', 'Specialty', 'Cocktails', 'Brandy', 'Liqueurs & Specialty');

UPDATE custom_products 
SET category = 'Liqueurs & Specialty' 
WHERE category IN ('Liqueurs', 'Specialty', 'Cocktails', 'Brandy', 'Liqueurs & Specialty');

UPDATE bar_products 
SET category = 'Non-Alcoholic' 
WHERE category IN ('Non-Alcoholic', 'Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

UPDATE custom_products 
SET category = 'Non-Alcoholic' 
WHERE category IN ('Non-Alcoholic', 'Soft Drinks', 'Coffee & Tea', 'Juice', 'Water', 'Energy Drinks');

-- FOOD
UPDATE bar_products 
SET category = 'Pizza' 
WHERE category IN ('Pizza');

UPDATE custom_products 
SET category = 'Pizza' 
WHERE category IN ('Pizza');

UPDATE bar_products 
SET category = 'BBQ & Choma' 
WHERE category IN ('BBQ', 'Choma', 'Grill', 'BBQ & Choma');

UPDATE custom_products 
SET category = 'BBQ & Choma' 
WHERE category IN ('BBQ', 'Choma', 'Grill', 'BBQ & Choma');

UPDATE bar_products 
SET category = 'Starters & Appetizers' 
WHERE category IN ('Starters', 'Appetizers', 'Salad', 'Starters & Appetizers');

UPDATE custom_products 
SET category = 'Starters & Appetizers' 
WHERE category IN ('Starters', 'Appetizers', 'Salad', 'Starters & Appetizers');

UPDATE bar_products 
SET category = 'Main Courses' 
WHERE category IN ('Main Courses', 'Main', 'Meal', 'Dish');

UPDATE custom_products 
SET category = 'Main Courses' 
WHERE category IN ('Main Courses', 'Main', 'Meal', 'Dish');

UPDATE bar_products 
SET category = 'Side Dishes' 
WHERE category IN ('Side Dishes', 'Side', 'Accompaniment');

UPDATE custom_products 
SET category = 'Side Dishes' 
WHERE category IN ('Side Dishes', 'Side', 'Accompaniment');

UPDATE bar_products 
SET category = 'Bakery & Breakfast' 
WHERE category IN ('Bakery', 'Breakfast', 'Bread', 'Egg', 'Bakery & Breakfast');

UPDATE custom_products 
SET category = 'Bakery & Breakfast' 
WHERE category IN ('Bakery', 'Breakfast', 'Bread', 'Egg', 'Bakery & Breakfast');

UPDATE bar_products 
SET category = 'Desserts & Snacks' 
WHERE category IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn', 'Desserts & Snacks');

UPDATE custom_products 
SET category = 'Desserts & Snacks' 
WHERE category IN ('Desserts', 'Snacks', 'Cake', 'Ice Cream', 'Popcorn', 'Desserts & Snacks');

UPDATE bar_products 
SET category = 'Convenience & Other' 
WHERE category IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape', 'Convenience & Other');

UPDATE custom_products 
SET category = 'Convenience & Other' 
WHERE category IN ('Convenience', 'Other', 'Traditional', 'Smoking', 'Tobacco', 'Vape', 'Convenience & Other');

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
