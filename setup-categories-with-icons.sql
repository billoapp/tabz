-- Setup Categories with Icons Script
-- This script recreates the categories table with proper icon mappings
-- Run this once to restore your categories with icon support

-- First, let's see what bars exist
SELECT id, name FROM bars;

-- Then recreate categories table with icon mappings
-- This will create categories like: Beer, Wine, Cocktails, Spirits, etc.
-- Each category will have an image_url pointing to our icon system

-- Categories to create (you can customize these):
INSERT INTO categories (name, image_url, created_at) VALUES
('Beer', '/api/category-icons/beer', NOW()),
('Wine', '/api/category-icons/wine', NOW()),
('Cocktails', '/api/category-icons/cocktails', NOW()),
('Spirits', '/api/category-icons/spirits', NOW()),
('Non-Alcoholic', '/api/category-icons/non-alcoholic', NOW()),
('Starters', '/api/category-icons/starters', NOW()),
('Main Courses', '/api/category-icons/main-courses', NOW()),
('Desserts', '/api/category-icons/desserts', NOW()),
('Snacks', '/api/category-icons/snacks', NOW()),
('Soft Drinks', '/api/category-icons/soft-drinks', NOW()),
('Coffee & Tea', '/api/category-icons/coffee-tea', NOW()),
('Breakfast', '/api/category-icons/breakfast', NOW()),
('Special Items', '/api/category-icons/special', NOW());

-- Update existing bar_products to use new category names
-- This maps old categories to new standardized ones
UPDATE bar_products 
SET category = CASE 
  WHEN category ILIKE '%beer%' OR category ILIKE '%ale%' OR category ILIKE '%stout%' THEN 'Beer'
  WHEN category ILIKE '%wine%' OR category ILIKE '%red%' OR category ILIKE '%white%' THEN 'Wine'
  WHEN category ILIKE '%cocktail%' OR category ILIKE '%martini%' OR category ILIKE '%mojito%' THEN 'Cocktails'
  WHEN category ILIKE '%spirit%' OR category ILIKE '%liquor%' THEN 'Spirits'
  WHEN category ILIKE '%non%' OR category ILIKE '%soft%' THEN 'Non-Alcoholic'
  WHEN category ILIKE '%starter%' OR category ILIKE '%appetizer%' THEN 'Starters'
  WHEN category ILIKE '%main%' OR category ILIKE '%course%' OR category ILIKE '%entree%' THEN 'Main Courses'
  WHEN category ILIKE '%dessert%' OR category ILIKE '%sweet%' OR category ILIKE '%cake%' OR category ILIKE '%pastry%' THEN 'Desserts'
  WHEN category ILIKE '%snack%' OR category ILIKE '%chip%' OR category ILIKE '%popcorn%' THEN 'Snacks'
  WHEN category ILIKE '%juice%' OR category ILIKE '%soda%' OR category ILIKE '%soft%' THEN 'Soft Drinks'
  WHEN category ILIKE '%coffee%' OR category ILIKE '%tea%' OR category ILIKE '%espresso%' OR category ILIKE '%cappuccino%' THEN 'Coffee & Tea'
  WHEN category ILIKE '%breakfast%' OR category ILIKE '%egg%' OR category ILIKE '%pancake%' THEN 'Breakfast'
  WHEN category ILIKE '%special%' OR category ILIKE '%chef%' OR category ILIKE '%house%' THEN 'Special Items'
  ELSE 'Uncategorized'
END;

-- Update custom_products to use new category names
UPDATE custom_products 
SET category = CASE 
  WHEN category ILIKE '%beer%' OR category ILIKE '%ale%' OR category ILIKE '%stout%' THEN 'Beer'
  WHEN category ILIKE '%wine%' OR category ILIKE '%red%' OR category ILIKE '%white%' THEN 'Wine'
  WHEN category ILIKE '%cocktail%' OR category ILIKE '%martini%' OR category ILIKE '%mojito%' THEN 'Cocktails'
  WHEN category ILIKE '%spirit%' OR category ILIKE '%liquor%' THEN 'Spirits'
  WHEN category ILIKE '%non%' OR category ILIKE '%soft%' THEN 'Non-Alcoholic'
  WHEN category ILIKE '%starter%' OR category ILIKE '%appetizer%' THEN 'Starters'
  WHEN category ILIKE '%main%' OR category ILIKE '%course%' OR category ILIKE '%entree%' THEN 'Main Courses'
  WHEN category ILIKE '%dessert%' OR category ILIKE '%sweet%' OR category ILIKE '%cake%' OR category ILIKE '%pastry%' THEN 'Desserts'
  WHEN category ILIKE '%snack%' OR category ILIKE '%chip%' OR category ILIKE '%popcorn%' THEN 'Snacks'
  WHEN category ILIKE '%juice%' OR category ILIKE '%soda%' OR category ILIKE '%soft%' THEN 'Soft Drinks'
  WHEN category ILIKE '%coffee%' OR category ILIKE '%tea%' OR category ILIKE '%espresso%' OR category ILIKE '%cappuccino%' THEN 'Coffee & Tea'
  WHEN category ILIKE '%breakfast%' OR category ILIKE '%egg%' OR category ILIKE '%pancake%' THEN 'Breakfast'
  WHEN category ILIKE '%special%' OR category ILIKE '%chef%' OR category ILIKE '%house%' THEN 'Special Items'
  ELSE 'Uncategorized'
END;

-- Verify the results
SELECT name, category FROM bar_products LIMIT 10;

-- Clean up any old categories that don't exist in bar_products
DELETE FROM categories 
WHERE name NOT IN (
  SELECT DISTINCT category FROM bar_products WHERE category IS NOT NULL AND category != ''
);

-- Success message
SELECT 'Categories recreated successfully!' as message;
