-- Categorize Uncategorized Products
-- This script analyzes uncategorized products and assigns them appropriate categories based on their names

-- First, let's see some examples of uncategorized products
SELECT 'Sample uncategorized products:' as info;
SELECT name, category FROM bar_products 
WHERE category = 'Uncategorized' 
LIMIT 10;

-- Now categorize uncategorized products based on their names
UPDATE bar_products 
SET category = CASE
  -- Beer categories
  WHEN LOWER(name) LIKE '%beer%' OR LOWER(name) LIKE '%lager%' OR LOWER(name) LIKE '%ale%' OR LOWER(name) LIKE '%stout%' OR LOWER(name) LIKE '%tusker%' THEN 'Beer'
  
  -- Wine categories
  WHEN LOWER(name) LIKE '%wine%' OR LOWER(name) LIKE '%red wine%' OR LOWER(name) LIKE '%white wine%' OR LOWER(name) LIKE '%rose%' OR LOWER(name) LIKE '%merlot%' OR LOWER(name) LIKE '%cabernet%' THEN 'Wine'
  
  -- Spirits categories
  WHEN LOWER(name) LIKE '%whiskey%' OR LOWER(name) LIKE '%vodka%' OR LOWER(name) LIKE '%gin%' OR LOWER(name) LIKE '%rum%' OR LOWER(name) LIKE '%tequila%' OR LOWER(name) LIKE '%brandy%' THEN 'Spirits'
  
  -- Cocktail categories
  WHEN LOWER(name) LIKE '%cocktail%' OR LOWER(name) LIKE '%mojito%' OR LOWER(name) LIKE '%martini%' OR LOWER(name) LIKE '%margarita%' OR LOWER(name) LIKE '%cosmopolitan%' THEN 'Cocktails'
  
  -- Non-Alcoholic categories
  WHEN LOWER(name) LIKE '%juice%' OR LOWER(name) LIKE '%soda%' OR LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%soft drink%' OR LOWER(name) LIKE '%coke%' OR LOWER(name) LIKE '%pepsi%' OR LOWER(name) LIKE '%fanta%' THEN 'Non-Alcoholic'
  
  -- Soft Drinks (alternative naming)
  WHEN LOWER(name) LIKE '%soft drink%' OR LOWER(name) LIKE '%carbonated%' OR LOWER(name) LIKE '%energy%' OR LOWER(name) LIKE '%powerade%' THEN 'Soft Drinks'
  
  -- Coffee categories
  WHEN LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%espresso%' OR LOWER(name) LIKE '%cappuccino%' OR(name) LIKE '%latte%' OR LOWER(name) LIKE '%americano%' THEN 'Coffee & Tea'
  
  -- Breakfast categories
  WHEN LOWER(name) LIKE '%breakfast%' OR LOWER(name) LIKE '%egg%' OR LOWER(name) LIKE '%pancake%' OR LOWER(name) LIKE '%waffle%' OR LOWER(name) LIKE '%toast%' OR LOWER(name) LIKE '%bacon%' THEN 'Breakfast'
  
  -- Starters/Appetizers
  WHEN LOWER(name) LIKE '%starter%' OR LOWER(name) LIKE '%appetizer%' OR LOWER(name) LIKE '%soup%' OR LOWER(name) LIKE '%salad%' OR LOWER(name) LIKE '%bruschetta%' OR LOWER(name) LIKE '%wings%' THEN 'Starters'
  
  -- Main Courses
  WHEN LOWER(name) LIKE '%burger%' OR LOWER(name) LIKE '%steak%' OR LOWER(name) LIKE '%chicken%' OR LOWER(name) LIKE '%fish%' OR LOWER(name) LIKE '%pasta%' OR LOWER(name) LIKE '%rice%' OR LOWER(name) LIKE '%nyama%' OR LOWER(name) LIKE '%ugali%' THEN 'Main Courses'
  
  -- Desserts
  WHEN LOWER(name) LIKE '%cake%' OR LOWER(name) LIKE '%ice cream%' OR LOWER(name) LIKE '%dessert%' OR LOWER(name) LIKE '%chocolate%' OR LOWER(name) LIKE '%cookie%' OR LOWER(name) LIKE '%brownie%' THEN 'Desserts'
  
  -- Snacks
  WHEN LOWER(name) LIKE '%chip%' OR LOWER(name) LIKE '%fries%' OR LOWER(name) LIKE '%popcorn%' OR LOWER(name) LIKE '%nuts%' OR LOWER(name) LIKE '%crisps%' THEN 'Snacks'
  
  -- Keep as Uncategorized if no match
  ELSE 'Uncategorized'
END
WHERE category = 'Uncategorized';

-- Also update custom_products
UPDATE custom_products 
SET category = CASE
  -- Beer categories
  WHEN LOWER(name) LIKE '%beer%' OR LOWER(name) LIKE '%lager%' OR LOWER(name) LIKE '%ale%' OR LOWER(name) LIKE '%stout%' OR LOWER(name) LIKE '%tusker%' THEN 'Beer'
  
  -- Wine categories
  WHEN LOWER(name) LIKE '%wine%' OR LOWER(name) LIKE '%red wine%' OR LOWER(name) LIKE '%white wine%' OR LOWER(name) LIKE '%rose%' OR LOWER(name) LIKE '%merlot%' OR LOWER(name) LIKE '%cabernet%' THEN 'Wine'
  
  -- Spirits categories
  WHEN LOWER(name) LIKE '%whiskey%' OR LOWER(name) LIKE '%vodka%' OR LOWER(name) LIKE '%gin%' OR LOWER(name) LIKE '%rum%' OR LOWER(name) LIKE '%tequila%' OR LOWER(name) LIKE '%brandy%' THEN 'Spirits'
  
  -- Cocktail categories
  WHEN LOWER(name) LIKE '%cocktail%' OR LOWER(name) LIKE '%mojito%' OR LOWER(name) LIKE '%martini%' OR LOWER(name) LIKE '%margarita%' OR LOWER(name) LIKE '%cosmopolitan%' THEN 'Cocktails'
  
  -- Non-Alcoholic categories
  WHEN LOWER(name) LIKE '%juice%' OR LOWER(name) LIKE '%soda%' OR LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%soft drink%' OR LOWER(name) LIKE '%coke%' OR LOWER(name) LIKE '%pepsi%' OR LOWER(name) LIKE '%fanta%' THEN 'Non-Alcoholic'
  
  -- Soft Drinks (alternative naming)
  WHEN LOWER(name) LIKE '%soft drink%' OR LOWER(name) LIKE '%carbonated%' OR LOWER(name) LIKE '%energy%' OR LOWER(name) LIKE '%powerade%' THEN 'Soft Drinks'
  
  -- Coffee categories
  WHEN LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%espresso%' OR LOWER(name) LIKE '%cappuccino%' OR (name) LIKE '%latte%' OR LOWER(name) LIKE '%americano%' THEN 'Coffee & Tea'
  
  -- Breakfast categories
  WHEN LOWER(name) LIKE '%breakfast%' OR LOWER(name) LIKE '%egg%' OR LOWER(name) LIKE '%pancake%' OR LOWER(name) LIKE '%waffle%' OR LOWER(name) LIKE '%toast%' OR LOWER(name) LIKE '%bacon%' THEN 'Breakfast'
  
  -- Starters/Appetizers
  WHEN LOWER(name) LIKE '%starter%' OR LOWER(name) LIKE '%appetizer%' OR LOWER(name) LIKE '%soup%' OR LOWER(name) LIKE '%salad%' OR LOWER(name) LIKE '%bruschetta%' OR LOWER(name) LIKE '%wings%' THEN 'Starters'
  
  -- Main Courses
  WHEN LOWER(name) LIKE '%burger%' OR LOWER(name) LIKE '%steak%' OR LOWER(name) LIKE '%chicken%' OR LOWER(name) LIKE '%fish%' OR LOWER(name) LIKE '%pasta%' OR LOWER(name) LIKE '%rice%' OR LOWER(name) LIKE '%nyama%' OR LOWER(name) LIKE '%ugali%' THEN 'Main Courses'
  
  -- Desserts
  WHEN LOWER(name) LIKE '%cake%' OR LOWER(name) LIKE '%ice cream%' OR LOWER(name) LIKE '%dessert%' OR LOWER(name) LIKE '%chocolate%' OR LOWER(name) LIKE '%cookie%' OR LOWER(name) LIKE '%brownie%' THEN 'Desserts'
  
  -- Snacks
  WHEN LOWER(name) LIKE '%chip%' OR LOWER(name) LIKE '%fries%' OR LOWER(name) LIKE '%popcorn%' OR LOWER(name) LIKE '%nuts%' OR LOWER(name) LIKE '%crisps%' THEN 'Snacks'
  
  -- Keep as Uncategorized if no match
  ELSE 'Uncategorized'
END
WHERE category = 'Uncategorized';

-- Update categories table to include new categories
INSERT INTO categories (name, image_url, created_at) 
VALUES
  ('Cocktails', '/api/category-icons/cocktails', NOW()),
  ('Coffee & Tea', '/api/category-icons/coffee-tea', NOW()),
  ('Desserts', '/api/category-icons/desserts', NOW()),
  ('Snacks', '/api/category-icons/snacks', NOW())
ON CONFLICT (name) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  created_at = NOW();

-- Verify the results
SELECT 'Category distribution after categorization:' as info;
SELECT category, COUNT(*) as count 
FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION ALL
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
GROUP BY category 
ORDER BY count DESC;

-- Success message
SELECT 'Products categorized successfully!' as message;
