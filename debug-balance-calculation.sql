-- Debug balance calculation issue
-- get_tab_balance() is not including all payments correctly

-- Check what get_tab_balance() returns vs manual calculation
SELECT 
    'Balance calculation debug' as test_type,
    t.id,
    t.tab_number,
    get_tab_balance(t.id) as function_balance,
    -- Manual calculation: confirmed orders - successful payments
    (SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') as confirmed_orders_total,
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND status = 'success') as successful_payments_total,
    -- Manual balance
    (SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') - 
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND status = 'success') as manual_balance,
    -- Difference
    get_tab_balance(t.id) - ((SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') - 
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND status = 'success')) as difference
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.id IN ('39f72d41-f5e6-4663-a07c-b7de9d5332e4', '4a77423b-00f2-4a55-88e0-57a37c00a3fc', 'cb8c00d4-c249-42ed-98a1-e388f922165d')
ORDER BY t.tab_number;

-- Check get_tab_balance function definition
SELECT 
    'Function definition' as info_type,
    proname as function_name,
    prosrc as function_definition
FROM pg_proc 
WHERE proname = 'get_tab_balance';
