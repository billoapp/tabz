-- Analyze Uncategorized Products to Create New Categories
-- This script shows what the uncategorized products are so we can create appropriate categories

-- Show sample of uncategorized products to understand patterns
SELECT 'Sample uncategorized products (first 20):' as info;
SELECT name, category FROM bar_products 
WHERE category = 'Uncategorized' 
ORDER BY name
LIMIT 20;

-- Show all uncategorized products grouped by first letter to see patterns
SELECT 'Uncategorized products by first letter:' as info;
SELECT UPPER(LEFT(name, 1)) as first_letter, COUNT(*) as count
FROM bar_products 
WHERE category = 'Uncategorized' 
GROUP BY UPPER(LEFT(name, 1))
ORDER BY first_letter;

-- Show products that might be similar (group by common words)
SELECT 'Products with common words:' as info;
SELECT 
  CASE 
    WHEN LOWER(name) LIKE '%chicken%' THEN 'Chicken Items'
    WHEN LOWER(name) LIKE '%beef%' THEN 'Beef Items' 
    WHEN LOWER(name) LIKE '%pork%' THEN 'Pork Items'
    WHEN LOWER(name) LIKE '%fish%' THEN 'Fish Items'
    WHEN LOWER(name) LIKE '%rice%' THEN 'Rice Items'
    WHEN LOWER(name) LIKE '%potato%' THEN 'Potato Items'
    WHEN LOWER(name) LIKE '%bread%' THEN 'Bread Items'
    WHEN LOWER(name) LIKE '%cheese%' THEN 'Cheese Items'
    WHEN LOWER(name) LIKE '%tomato%' THEN 'Tomato Items'
    WHEN LOWER(name) LIKE '%onion%' THEN 'Onion Items'
    WHEN LOWER(name) LIKE '%salad%' THEN 'Salad Items'
    WHEN LOWER(name) LIKE '%soup%' THEN 'Soup Items'
    WHEN LOWER(name) LIKE '%sandwich%' THEN 'Sandwich Items'
    WHEN LOWER(name) LIKE '%pizza%' THEN 'Pizza Items'
    WHEN LOWER(name) LIKE '%pasta%' THEN 'Pasta Items'
    WHEN LOWER(name) LIKE '%sauce%' THEN 'Sauce Items'
    WHEN LOWER(name) LIKE '%grill%' THEN 'Grilled Items'
    WHEN LOWER(name) LIKE '%fried%' THEN 'Fried Items'
    WHEN LOWER(name) LIKE '%roast%' THEN 'Roasted Items'
    ELSE 'Other Items'
  END as category_group,
  COUNT(*) as count,
  STRING_AGG(name, ', ' ORDER BY name) as examples
FROM bar_products 
WHERE category = 'Uncategorized' 
GROUP BY 
  CASE 
    WHEN LOWER(name) LIKE '%chicken%' THEN 'Chicken Items'
    WHEN LOWER(name) LIKE '%beef%' THEN 'Beef Items' 
    WHEN LOWER(name) LIKE '%pork%' THEN 'Pork Items'
    WHEN LOWER(name) LIKE '%fish%' THEN 'Fish Items'
    WHEN LOWER(name) LIKE '%rice%' THEN 'Rice Items'
    WHEN LOWER(name) LIKE '%potato%' THEN 'Potato Items'
    WHEN LOWER(name) LIKE '%bread%' THEN 'Bread Items'
    WHEN LOWER(name) LIKE '%cheese%' THEN 'Cheese Items'
    WHEN LOWER(name) LIKE '%tomato%' THEN 'Tomato Items'
    WHEN LOWER(name) LIKE '%onion%' THEN 'Onion Items'
    WHEN LOWER(name) LIKE '%salad%' THEN 'Salad Items'
    WHEN LOWER(name) LIKE '%soup%' THEN 'Soup Items'
    WHEN LOWER(name) LIKE '%sandwich%' THEN 'Sandwich Items'
    WHEN LOWER(name) LIKE '%pizza%' THEN 'Pizza Items'
    WHEN LOWER(name) LIKE '%pasta%' THEN 'Pasta Items'
    WHEN LOWER(name) LIKE '%sauce%' THEN 'Sauce Items'
    WHEN LOWER(name) LIKE '%grill%' THEN 'Grilled Items'
    WHEN LOWER(name) LIKE '%fried%' THEN 'Fried Items'
    WHEN LOWER(name) LIKE '%roast%' THEN 'Roasted Items'
    ELSE 'Other Items'
  END
ORDER BY count DESC;
