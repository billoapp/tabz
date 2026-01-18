-- Delete all closed tabs and their related data
-- This will permanently remove closed tabs from the system

-- 1. First, let's see what we're about to delete
SELECT 
    COUNT(*) as total_closed_tabs,
    MIN(opened_at) as oldest_tab,
    MAX(closed_at) as most_recently_closed
FROM tabs 
WHERE status = 'closed';

-- 2. Show the closed tabs we're about to delete
SELECT 
    id,
    tab_number,
    status,
    opened_at,
    closed_at,
    closed_by,
    EXTRACT(EPOCH FROM (closed_at - opened_at))/3600 as hours_open
FROM tabs 
WHERE status = 'closed'
ORDER BY tab_number;

-- 3. Count related data that will be cascade deleted
SELECT 
    'tab_orders' as table_name,
    COUNT(*) as records_count
FROM tab_orders 
WHERE tab_id IN (SELECT id FROM tabs WHERE status = 'closed')

UNION ALL

SELECT 
    'tab_payments' as table_name,
    COUNT(*) as records_count
FROM tab_payments 
WHERE tab_id IN (SELECT id FROM tabs WHERE status = 'closed')

UNION ALL

SELECT 
    'tab_telegram_messages' as table_name,
    COUNT(*) as records_count
FROM tab_telegram_messages 
WHERE tab_id IN (SELECT id FROM tabs WHERE status = 'closed');

-- 4. UNCOMMENT TO ACTUALLY DELETE THE CLOSED TABS
-- WARNING: This will permanently delete all closed tabs and their related data!

/*
-- Delete related data first (if not using CASCADE)
DELETE FROM tab_telegram_messages WHERE tab_id IN (SELECT id FROM tabs WHERE status = 'closed');
DELETE FROM tab_payments WHERE tab_id IN (SELECT id FROM tabs WHERE status = 'closed');
DELETE FROM tab_orders WHERE tab_id IN (SELECT id FROM tabs WHERE status = 'closed');

-- Delete the closed tabs
DELETE FROM tabs WHERE status = 'closed';

-- Verify deletion
SELECT 
    COUNT(*) as remaining_closed_tabs
FROM tabs 
WHERE status = 'closed';

SELECT 
    status,
    COUNT(*) as count
FROM tabs 
GROUP BY status
ORDER BY status;
*/