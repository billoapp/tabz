-- Clean up test tabs for device ID testing
-- This script removes all test data to test device ID enforcement fresh

-- First, delete all orders (they depend on tabs)
DELETE FROM tab_orders WHERE 1=1;

-- Delete all payments (they depend on tabs)
DELETE FROM tab_payments WHERE 1=1;

-- Then delete all tabs 
DELETE FROM tabs WHERE 1=1;

-- Reset the tab number sequence
ALTER SEQUENCE tab_number_seq RESTART WITH 1;

-- Show the results
SELECT 'All tabs, orders, and payments deleted. Device ID testing can now be done fresh.' as status;

-- Verify cleanup
SELECT 
  (SELECT COUNT(*) FROM tabs) as tabs_count,
  (SELECT COUNT(*) FROM tab_orders) as orders_count,
  (SELECT COUNT(*) FROM tab_payments) as payments_count;
