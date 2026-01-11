-- Comprehensive Categorization Based on Actual Product Analysis
-- This creates proper categories for all the uncategorized items

-- Create new categories for the specific items we found
INSERT INTO categories (name, image_url, created_at) 
VALUES
  ('Whiskey', '/api/category-icons/whiskey', NOW()),
  ('Gin', '/api/category-icons/gin', NOW()),
  ('Vodka', '/api/category-icons/vodka', NOW()),
  ('Rum', '/api/category-icons/rum', NOW()),
  ('Brandy & Liqueur', '/api/category-icons/brandy', NOW()),
  ('Tequila', '/api/category-icons/tequila', NOW()),
  ('Cider', '/api/category-icons/cider', NOW()),
  ('Energy Drinks', '/api/category-icons/energy', NOW()),
  ('Cigarettes & Tobacco', '/api/category-icons/tobacco', NOW()),
  ('Vapes', '/api/category-icons/vapes', NOW()),
  ('Traditional Kenyan', '/api/category-icons/kenyan', NOW()),
  ('Pizza', '/api/category-icons/pizza', NOW()),
  ('Side Dishes', '/api/category-icons/sides', NOW()),
  ('Convenience Items', '/api/category-icons/convenience', NOW())
ON CONFLICT (name) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  created_at = NOW();

-- Now categorize all the uncategorized products with comprehensive rules
UPDATE bar_products 
SET category = CASE
  -- WHISKEY CATEGORY
  WHEN LOWER(name) LIKE '%jameson%' OR LOWER(name) LIKE '%jack daniel%' OR LOWER(name) LIKE '%jw%' OR 
       LOWER(name) LIKE '%johnnie walker%' OR LOWER(name) LIKE '%black label%' OR LOWER(name) LIKE '%red label%' OR
       LOWER(name) LIKE '%gold label%' OR LOWER(name) LIKE '%green label%' OR LOWER(name) LIKE '%white walker%' OR
       LOWER(name) LIKE '%chivas%' OR LOWER(name) LIKE '%ballantines%' OR LOWER(name) LIKE '%glenfiddich%' OR
       LOWER(name) LIKE '%glenlivet%' OR LOWER(name) LIKE '%glen silver%' OR LOWER(name) LIKE '%famous grouse%' OR
       LOWER(name) LIKE '%grants%' OR LOWER(name) LIKE '%singleton%' OR LOWER(name) LIKE '%talisker%' OR
       LOWER(name) LIKE '%lagavuldre%' OR LOWER(name) LIKE '%old smuggler%' OR LOWER(name) LIKE '%scotch leader%' OR
       LOWER(name) LIKE '%passport scotch%' OR LOWER(name) LIKE '%william lawsons%' OR LOWER(name) LIKE '%dunhill%' OR
       LOWER(name) LIKE '%j & b%' OR LOWER(name) LIKE '%jagermeister%' OR LOWER(name) LIKE '%bullet bourbon%' OR
       LOWER(name) LIKE '%dalwhine%' THEN 'Whiskey'
  
  -- GIN CATEGORY  
  WHEN LOWER(name) LIKE '%gordons%' OR LOWER(name) LIKE '%gibeys%' OR LOWER(name) LIKE '%beefeater%' OR
       LOWER(name) LIKE '%tanquar%' OR LOWER(name) LIKE '%tanguar%' OR LOWER(name) LIKE '%monkey shoulder%' OR
       LOWER(name) LIKE '%gentlema%' OR LOWER(name) LIKE '%camino%' OR LOWER(name) LIKE '%ketel citron%' OR
       LOWER(name) LIKE '%sheridane%' OR LOWER(name) LIKE '%sheridan%' THEN 'Gin'
  
  -- VODKA CATEGORY
  WHEN LOWER(name) LIKE '%smirnoff%' OR LOWER(name) LIKE '%ciroc%' OR LOWER(name) LIKE '%absolut%' OR
       LOWER(name) LIKE '%grey goose%' OR LOWER(name) LIKE '%ketel one%' THEN 'Vodka'
  
  -- RUM CATEGORY
  WHEN LOWER(name) LIKE '%captain morgan%' OR LOWER(name) LIKE '%bacardi%' OR LOWER(name) LIKE '%havana%' OR
       LOWER(name) LIKE '%malibu%' OR LOWER(name) LIKE '%appleton%' OR LOWER(name) LIKE '%matusalem%' THEN 'Rum'
  
  -- BRANDY & LIQUEUR CATEGORY
  WHEN LOWER(name) LIKE '%baileys%' OR LOWER(name) LIKE '%amarula%' OR LOWER(name) LIKE '%courvosier%' OR
       LOWER(name) LIKE '%hennessy%' OR LOWER(name) LIKE '%hennesyn%' OR LOWER(name) LIKE '%remy martin%' OR
       LOWER(name) LIKE '%martell%' OR LOWER(name) LIKE '%marotel%' OR LOWER(name) LIKE '%moet%' OR
       LOWER(name) LIKE '%don julio%' OR LOWER(name) LIKE '%jose cuarvo%' OR LOWER(name) LIKE '%patron%' OR
       LOWER(name) LIKE '%southern comfort%' OR LOWER(name) LIKE '%sambuca%' OR LOWER(name) LIKE '%jagermeister%' OR
       LOWER(name) LIKE '%olmeca%' OR LOWER(name) LIKE '%tulamore dew%' OR LOWER(name) LIKE '%best cream%' OR
       LOWER(name) LIKE '%black & white%' OR LOWER(name) LIKE '%blue label%' OR LOWER(name) LIKE '%bond7%' OR
       LOWER(name) LIKE '%platinum%' OR LOWER(name) LIKE '%zappa%' OR LOWER(name) LIKE '%vat69%' OR
       LOWER(name) LIKE '%viceroy%' OR LOWER(name) LIKE '%camino clear%' OR LOWER(name) LIKE '%gordons clear%' OR
       LOWER(name) LIKE '%gibeys clear%' OR LOWER(name) LIKE '%gordons orange%' OR LOWER(name) LIKE '%gordons pink%' OR
       LOWER(name) LIKE '%gibeys pink%' OR LOWER(name) LIKE '%malty clear%' OR LOWER(name) LIKE '%malty pink%' OR
       LOWER(name) LIKE '%snapp%' OR LOWER(name) LIKE '%richot%' THEN 'Brandy & Liqueur'
  
  -- TEQUILA CATEGORY
  WHEN LOWER(name) LIKE '%don julio%' OR LOWER(name) LIKE '%jose cuarvo%' OR LOWER(name) LIKE '%patron%' OR
       LOWER(name) LIKE '%herradura%' OR LOWER(name) LIKE '%el jimador%' OR LOWER(name) LIKE '%olmeca%' THEN 'Tequila'
  
  -- CIDER CATEGORY
  WHEN LOWER(name) LIKE '%cider%' OR LOWER(name) LIKE '%savanna%' OR LOWER(name) LIKE '%honey cider%' OR
       LOWER(name) LIKE '%hunters%' OR LOWER(name) LIKE '%ko cider%' OR LOWER(name) LIKE '%sikera%' THEN 'Cider'
  
  -- ENERGY DRINKS CATEGORY
  WHEN LOWER(name) LIKE '%redbull%' OR LOWER(name) LIKE '%monster%' OR LOWER(name) LIKE '%energy%' OR
       LOWER(name) LIKE '%powerade%' OR LOWER(name) LIKE '%gatorade%' THEN 'Energy Drinks'
  
  -- CIGARETTES & TOBACCO CATEGORY
  WHEN LOWER(name) LIKE '%rothman%' OR LOWER(name) LIKE '%embassy%' OR LOWER(name) LIKE '%sportman%' OR
       LOWER(name) LIKE '%matchbox%' OR LOWER(name) LIKE '%lighter%' OR LOWER(name) LIKE '%cigarette%' OR
       LOWER(name) LIKE '%tobacco%' THEN 'Cigarettes & Tobacco'
  
  -- VAPES CATEGORY
  WHEN LOWER(name) LIKE '%vape%' OR LOWER(name) LIKE '%disposable vape%' OR LOWER(name) LIKE '%rechargeable vape%' OR
       LOWER(name) LIKE '%9000 puff%' OR LOWER(name) LIKE '%3000 puff%' THEN 'Vapes'
  
  -- TRADITIONAL KENYAN CATEGORY
  WHEN LOWER(name) LIKE '%chapati%' OR LOWER(name) LIKE '%sukuma%' OR LOWER(name) LIKE '%ugali%' OR
       LOWER(name) LIKE '%nyama%' OR LOWER(name) LIKE '%kachumbari%' OR LOWER(name) LIKE '%samosa%' OR
       LOWER(name) LIKE '%mandazi%' OR LOWER(name) LIKE '%githeri%' OR LOWER(name) LIKE '%mukimo%' THEN 'Traditional Kenyan'
  
  -- PIZZA CATEGORY
  WHEN LOWER(name) LIKE '%pizza%' OR LOWER(name) LIKE '%piza%' THEN 'Pizza'
  
  -- SIDE DISHES CATEGORY
  WHEN LOWER(name) LIKE '%mashed potato%' OR LOWER(name) LIKE '%roasted potato%' OR LOWER(name) LIKE '%fries%' OR
       LOWER(name) LIKE '%chips%' OR LOWER(name) LIKE '%rice%' OR LOWER(name) LIKE '%cabbage%' OR
       LOWER(name) LIKE '%salad%' OR LOWER(name) LIKE '%vegetable%' THEN 'Side Dishes'
  
  -- CONVENIENCE ITEMS CATEGORY
  WHEN LOWER(name) LIKE '%condom%' OR LOWER(name) LIKE '%empty bottle%' OR LOWER(name) LIKE '%take away tins%' OR
       LOWER(name) LIKE '%disposable%' OR LOWER(name) LIKE '%meal deal%' OR LOWER(name) LIKE '%shisha%' OR
       LOWER(name) LIKE '%dawa%' THEN 'Convenience Items'
  
  -- SPECIFIC DRINK CATEGORIES
  WHEN LOWER(name) LIKE '%beer%' OR LOWER(name) LIKE '%lager%' OR LOWER(name) LIKE '%ale%' OR LOWER(name) LIKE '%stout%' OR LOWER(name) LIKE '%tusker%' THEN 'Beer'
  WHEN LOWER(name) LIKE '%wine%' OR LOWER(name) LIKE '%red wine%' OR LOWER(name) LIKE '%white wine%' OR LOWER(name) LIKE '%rose%' OR LOWER(name) LIKE '%merlot%' OR LOWER(name) LIKE '%cabernet%' THEN 'Wine'
  WHEN LOWER(name) LIKE '%juice%' OR LOWER(name) LIKE '%soda%' OR LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%soft drink%' OR LOWER(name) LIKE '%coke%' OR LOWER(name) LIKE '%pepsi%' OR LOWER(name) LIKE '%fanta%' OR LOWER(name) LIKE '%schweps%' OR LOWER(name) LIKE '%tonic%' THEN 'Non-Alcoholic'
  WHEN LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%espresso%' OR LOWER(name) LIKE '%cappuccino%' OR LOWER(name) LIKE '%latte%' OR LOWER(name) LIKE '%americano%' THEN 'Coffee & Tea'
  WHEN LOWER(name) LIKE '%breakfast%' OR LOWER(name) LIKE '%egg%' OR LOWER(name) LIKE '%pancake%' OR LOWER(name) LIKE '%waffle%' OR LOWER(name) LIKE '%toast%' OR LOWER(name) LIKE '%bacon%' THEN 'Breakfast'
  WHEN LOWER(name) LIKE '%starter%' OR LOWER(name) LIKE '%appetizer%' OR LOWER(name) LIKE '%soup%' OR LOWER(name) LIKE '%wings%' THEN 'Starters'
  WHEN LOWER(name) LIKE '%burger%' OR LOWER(name) LIKE '%steak%' OR LOWER(name) LIKE '%chicken%' OR LOWER(name) LIKE '%fish%' OR LOWER(name) LIKE '%pasta%' OR LOWER(name) LIKE '%spaghetti%' THEN 'Main Courses'
  WHEN LOWER(name) LIKE '%cake%' OR LOWER(name) LIKE '%ice cream%' OR LOWER(name) LIKE '%dessert%' OR LOWER(name) LIKE '%chocolate%' OR LOWER(name) LIKE '%cookie%' OR LOWER(name) LIKE '%brownie%' THEN 'Desserts'
  WHEN LOWER(name) LIKE '%chip%' OR LOWER(name) LIKE '%popcorn%' OR LOWER(name) LIKE '%nuts%' OR LOWER(name) LIKE '%crisps%' THEN 'Snacks'
  
  -- Keep as Uncategorized if no match
  ELSE 'Uncategorized'
END
WHERE category = 'Uncategorized';

-- Also update custom_products with same logic
UPDATE custom_products 
SET category = CASE
  -- WHISKEY CATEGORY
  WHEN LOWER(name) LIKE '%jameson%' OR LOWER(name) LIKE '%jack daniel%' OR LOWER(name) LIKE '%jw%' OR 
       LOWER(name) LIKE '%johnnie walker%' OR LOWER(name) LIKE '%black label%' OR LOWER(name) LIKE '%red label%' OR
       LOWER(name) LIKE '%gold label%' OR LOWER(name) LIKE '%green label%' OR LOWER(name) LIKE '%white walker%' OR
       LOWER(name) LIKE '%chivas%' OR LOWER(name) LIKE '%ballantines%' OR LOWER(name) LIKE '%glenfiddich%' OR
       LOWER(name) LIKE '%glenlivet%' OR LOWER(name) LIKE '%glen silver%' OR LOWER(name) LIKE '%famous grouse%' OR
       LOWER(name) LIKE '%grants%' OR LOWER(name) LIKE '%singleton%' OR LOWER(name) LIKE '%talisker%' OR
       LOWER(name) LIKE '%lagavuldre%' OR LOWER(name) LIKE '%old smuggler%' OR LOWER(name) LIKE '%scotch leader%' OR
       LOWER(name) LIKE '%passport scotch%' OR LOWER(name) LIKE '%william lawsons%' OR LOWER(name) LIKE '%dunhill%' OR
       LOWER(name) LIKE '%j & b%' OR LOWER(name) LIKE '%jagermeister%' OR LOWER(name) LIKE '%bullet bourbon%' OR
       LOWER(name) LIKE '%dalwhine%' THEN 'Whiskey'
  
  -- GIN CATEGORY  
  WHEN LOWER(name) LIKE '%gordons%' OR LOWER(name) LIKE '%gibeys%' OR LOWER(name) LIKE '%beefeater%' OR
       LOWER(name) LIKE '%tanquar%' OR LOWER(name) LIKE '%tanguar%' OR LOWER(name) LIKE '%monkey shoulder%' OR
       LOWER(name) LIKE '%gentlema%' OR LOWER(name) LIKE '%camino%' OR LOWER(name) LIKE '%ketel citron%' OR
       LOWER(name) LIKE '%sheridane%' OR LOWER(name) LIKE '%sheridan%' THEN 'Gin'
  
  -- VODKA CATEGORY
  WHEN LOWER(name) LIKE '%smirnoff%' OR LOWER(name) LIKE '%ciroc%' OR LOWER(name) LIKE '%absolut%' OR
       LOWER(name) LIKE '%grey goose%' OR LOWER(name) LIKE '%ketel one%' THEN 'Vodka'
  
  -- RUM CATEGORY
  WHEN LOWER(name) LIKE '%captain morgan%' OR LOWER(name) LIKE '%bacardi%' OR LOWER(name) LIKE '%havana%' OR
       LOWER(name) LIKE '%malibu%' OR LOWER(name) LIKE '%appleton%' OR LOWER(name) LIKE '%matusalem%' THEN 'Rum'
  
  -- BRANDY & LIQUEUR CATEGORY
  WHEN LOWER(name) LIKE '%baileys%' OR LOWER(name) LIKE '%amarula%' OR LOWER(name) LIKE '%courvosier%' OR
       LOWER(name) LIKE '%hennessy%' OR LOWER(name) LIKE '%hennesyn%' OR LOWER(name) LIKE '%remy martin%' OR
       LOWER(name) LIKE '%martell%' OR LOWER(name) LIKE '%marotel%' OR LOWER(name) LIKE '%moet%' OR
       LOWER(name) LIKE '%don julio%' OR LOWER(name) LIKE '%jose cuarvo%' OR LOWER(name) LIKE '%patron%' OR
       LOWER(name) LIKE '%southern comfort%' OR LOWER(name) LIKE '%sambuca%' OR LOWER(name) LIKE '%jagermeister%' OR
       LOWER(name) LIKE '%olmeca%' OR LOWER(name) LIKE '%tulamore dew%' OR LOWER(name) LIKE '%best cream%' OR
       LOWER(name) LIKE '%black & white%' OR LOWER(name) LIKE '%blue label%' OR LOWER(name) LIKE '%bond7%' OR
       LOWER(name) LIKE '%platinum%' OR LOWER(name) LIKE '%zappa%' OR LOWER(name) LIKE '%vat69%' OR
       LOWER(name) LIKE '%viceroy%' OR LOWER(name) LIKE '%camino clear%' OR LOWER(name) LIKE '%gordons clear%' OR
       LOWER(name) LIKE '%gibeys clear%' OR LOWER(name) LIKE '%gordons orange%' OR LOWER(name) LIKE '%gordons pink%' OR
       LOWER(name) LIKE '%gibeys pink%' OR LOWER(name) LIKE '%malty clear%' OR LOWER(name) LIKE '%malty pink%' OR
       LOWER(name) LIKE '%snapp%' OR LOWER(name) LIKE '%richot%' THEN 'Brandy & Liqueur'
  
  -- TEQUILA CATEGORY
  WHEN LOWER(name) LIKE '%don julio%' OR LOWER(name) LIKE '%jose cuarvo%' OR LOWER(name) LIKE '%patron%' OR
       LOWER(name) LIKE '%herradura%' OR LOWER(name) LIKE '%el jimador%' OR LOWER(name) LIKE '%olmeca%' THEN 'Tequila'
  
  -- CIDER CATEGORY
  WHEN LOWER(name) LIKE '%cider%' OR LOWER(name) LIKE '%savanna%' OR LOWER(name) LIKE '%honey cider%' OR
       LOWER(name) LIKE '%hunters%' OR LOWER(name) LIKE '%ko cider%' OR LOWER(name) LIKE '%sikera%' THEN 'Cider'
  
  -- ENERGY DRINKS CATEGORY
  WHEN LOWER(name) LIKE '%redbull%' OR LOWER(name) LIKE '%monster%' OR LOWER(name) LIKE '%energy%' OR
       LOWER(name) LIKE '%powerade%' OR LOWER(name) LIKE '%gatorade%' THEN 'Energy Drinks'
  
  -- CIGARETTES & TOBACCO CATEGORY
  WHEN LOWER(name) LIKE '%rothman%' OR LOWER(name) LIKE '%embassy%' OR LOWER(name) LIKE '%sportman%' OR
       LOWER(name) LIKE '%matchbox%' OR LOWER(name) LIKE '%lighter%' OR LOWER(name) LIKE '%cigarette%' OR
       LOWER(name) LIKE '%tobacco%' THEN 'Cigarettes & Tobacco'
  
  -- VAPES CATEGORY
  WHEN LOWER(name) LIKE '%vape%' OR LOWER(name) LIKE '%disposable vape%' OR LOWER(name) LIKE '%rechargeable vape%' OR
       LOWER(name) LIKE '%9000 puff%' OR LOWER(name) LIKE '%3000 puff%' THEN 'Vapes'
  
  -- TRADITIONAL KENYAN CATEGORY
  WHEN LOWER(name) LIKE '%chapati%' OR LOWER(name) LIKE '%sukuma%' OR LOWER(name) LIKE '%ugali%' OR
       LOWER(name) LIKE '%nyama%' OR LOWER(name) LIKE '%kachumbari%' OR LOWER(name) LIKE '%samosa%' OR
       LOWER(name) LIKE '%mandazi%' OR LOWER(name) LIKE '%githeri%' OR LOWER(name) LIKE '%mukimo%' THEN 'Traditional Kenyan'
  
  -- PIZZA CATEGORY
  WHEN LOWER(name) LIKE '%pizza%' OR LOWER(name) LIKE '%piza%' THEN 'Pizza'
  
  -- SIDE DISHES CATEGORY
  WHEN LOWER(name) LIKE '%mashed potato%' OR LOWER(name) LIKE '%roasted potato%' OR LOWER(name) LIKE '%fries%' OR
       LOWER(name) LIKE '%chips%' OR LOWER(name) LIKE '%rice%' OR LOWER(name) LIKE '%cabbage%' OR
       LOWER(name) LIKE '%salad%' OR LOWER(name) LIKE '%vegetable%' THEN 'Side Dishes'
  
  -- CONVENIENCE ITEMS CATEGORY
  WHEN LOWER(name) LIKE '%condom%' OR LOWER(name) LIKE '%empty bottle%' OR LOWER(name) LIKE '%take away tins%' OR
       LOWER(name) LIKE '%disposable%' OR LOWER(name) LIKE '%meal deal%' OR LOWER(name) LIKE '%shisha%' OR
       LOWER(name) LIKE '%dawa%' THEN 'Convenience Items'
  
  -- SPECIFIC DRINK CATEGORIES
  WHEN LOWER(name) LIKE '%beer%' OR LOWER(name) LIKE '%lager%' OR LOWER(name) LIKE '%ale%' OR LOWER(name) LIKE '%stout%' OR LOWER(name) LIKE '%tusker%' THEN 'Beer'
  WHEN LOWER(name) LIKE '%wine%' OR LOWER(name) LIKE '%red wine%' OR LOWER(name) LIKE '%white wine%' OR LOWER(name) LIKE '%rose%' OR LOWER(name) LIKE '%merlot%' OR LOWER(name) LIKE '%cabernet%' THEN 'Wine'
  WHEN LOWER(name) LIKE '%juice%' OR LOWER(name) LIKE '%soda%' OR LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%soft drink%' OR LOWER(name) LIKE '%coke%' OR LOWER(name) LIKE '%pepsi%' OR LOWER(name) LIKE '%fanta%' OR LOWER(name) LIKE '%schweps%' OR LOWER(name) LIKE '%tonic%' THEN 'Non-Alcoholic'
  WHEN LOWER(name) LIKE '%coffee%' OR LOWER(name) LIKE '%espresso%' OR LOWER(name) LIKE '%cappuccino%' OR LOWER(name) LIKE '%latte%' OR LOWER(name) LIKE '%americano%' THEN 'Coffee & Tea'
  WHEN LOWER(name) LIKE '%breakfast%' OR LOWER(name) LIKE '%egg%' OR LOWER(name) LIKE '%pancake%' OR LOWER(name) LIKE '%waffle%' OR LOWER(name) LIKE '%toast%' OR LOWER(name) LIKE '%bacon%' THEN 'Breakfast'
  WHEN LOWER(name) LIKE '%starter%' OR LOWER(name) LIKE '%appetizer%' OR LOWER(name) LIKE '%soup%' OR LOWER(name) LIKE '%wings%' THEN 'Starters'
  WHEN LOWER(name) LIKE '%burger%' OR LOWER(name) LIKE '%steak%' OR LOWER(name) LIKE '%chicken%' OR LOWER(name) LIKE '%fish%' OR LOWER(name) LIKE '%pasta%' OR LOWER(name) LIKE '%spaghetti%' THEN 'Main Courses'
  WHEN LOWER(name) LIKE '%cake%' OR LOWER(name) LIKE '%ice cream%' OR LOWER(name) LIKE '%dessert%' OR LOWER(name) LIKE '%chocolate%' OR LOWER(name) LIKE '%cookie%' OR LOWER(name) LIKE '%brownie%' THEN 'Desserts'
  WHEN LOWER(name) LIKE '%chip%' OR LOWER(name) LIKE '%popcorn%' OR LOWER(name) LIKE '%nuts%' OR LOWER(name) LIKE '%crisps%' THEN 'Snacks'
  
  -- Keep as Uncategorized if no match
  ELSE 'Uncategorized'
END
WHERE category = 'Uncategorized';

-- Verify the results
SELECT 'Final category distribution:' as info;
SELECT category, COUNT(*) as count 
FROM (
  SELECT category FROM bar_products WHERE category IS NOT NULL AND category != ''
  UNION ALL
  SELECT category FROM custom_products WHERE category IS NOT NULL AND category != ''
) as all_categories
GROUP BY category 
ORDER BY count DESC;

-- Success message
SELECT 'Comprehensive categorization completed!' as message;
