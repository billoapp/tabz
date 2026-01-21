-- Fix get_tab_balance function to use 'success' instead of 'completed'

CREATE OR REPLACE FUNCTION get_tab_balance(p_tab_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    order_total NUMERIC := 0;
    payment_total NUMERIC := 0;
    balance NUMERIC := 0;
BEGIN
    -- Sum confirmed orders for this tab
    SELECT COALESCE(SUM(total), 0) INTO order_total
    FROM tab_orders 
    WHERE tab_id = p_tab_id 
    AND status = 'confirmed';
    
    -- Sum successful payments for this tab - FIXED: use 'success' not 'completed'
    SELECT COALESCE(SUM(amount), 0) INTO payment_total
    FROM tab_payments 
    WHERE tab_id = p_tab_id 
    AND status = 'success';
    
    -- Calculate balance (orders - payments)
    balance := order_total - payment_total;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- Test the fixed function
SELECT 
    'Fixed balance test' as test_type,
    t.id,
    t.tab_number,
    get_tab_balance(t.id) as fixed_balance,
    -- Manual calculation for verification
    (SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') - 
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND status = 'success') as manual_balance,
    -- Should be 0 now
    get_tab_balance(t.id) - ((SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed') - 
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND status = 'success')) as difference
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.id IN ('39f72d41-f5e6-4663-a07c-b7de9d5332e4', '4a77423b-00f2-4a55-88e0-57a37c00a3fc', 'cb8c00d4-c249-42ed-98a1-e388f922165d')
ORDER BY t.tab_number;
