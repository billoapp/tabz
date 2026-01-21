-- Clean up overdue tabs with zero balance

-- First, let's see what moved these tabs to overdue
SELECT 
    'Overdue history' as info_type,
    t.id,
    t.tab_number,
    t.status,
    t.moved_to_overdue_at,
    t.overdue_reason,
    get_tab_balance(t.id) as current_balance,
    -- Check orders and payments at the time they were moved to overdue
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND created_at <= t.moved_to_overdue_at AND status = 'confirmed') as orders_at_overdue_time,
    (SELECT COALESCE(SUM(total), 0) FROM tab_orders WHERE tab_id = t.id AND created_at <= t.moved_to_overdue_at AND status = 'confirmed') as order_total_at_overdue,
    (SELECT COUNT(*) FROM tab_payments WHERE tab_id = t.id AND created_at <= t.moved_to_overdue_at AND status = 'success') as payments_at_overdue_time,
    (SELECT COALESCE(SUM(amount), 0) FROM tab_payments WHERE tab_id = t.id AND created_at <= t.moved_to_overdue_at AND status = 'success') as payment_total_at_overdue
FROM tabs t
WHERE t.bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
  AND t.status = 'overdue'
  AND get_tab_balance(t.id) <= 0
ORDER BY t.moved_to_overdue_at DESC;

-- Create function to clean up zero balance overdue tabs
CREATE OR REPLACE FUNCTION cleanup_zero_balance_overdue_tabs()
RETURNS TABLE(
    tab_id UUID,
    tab_number INTEGER,
    old_status TEXT,
    new_status TEXT,
    balance NUMERIC,
    reason TEXT
) AS $$
BEGIN
    -- Update overdue tabs with zero balance to closed status
    UPDATE tabs 
    SET 
        status = 'closed',
        moved_to_overdue_at = NULL,
        overdue_reason = NULL
    WHERE status = 'overdue' 
      AND get_tab_balance(id) <= 0;
    
    -- Return what was updated
    RETURN QUERY
    SELECT 
        t.id as tab_id,
        t.tab_number,
        'overdue' as old_status,
        'closed' as new_status,
        get_tab_balance(t.id) as balance,
        'Auto-cleanup: Zero balance overdue tab moved to closed' as reason
    FROM tabs t
    WHERE t.status = 'closed'
      AND get_tab_balance(t.id) <= 0
      AND t.moved_to_overdue_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup
SELECT 
    'Cleanup results' as info_type,
    *
FROM cleanup_zero_balance_overdue_tabs()
WHERE tab_id IN (
    SELECT id FROM tabs 
    WHERE bar_id = '96f1a3aa-523b-49f3-8138-cefef2d2ba65'
      AND status = 'overdue'
      AND get_tab_balance(id) <= 0
);
