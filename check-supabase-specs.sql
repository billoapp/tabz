-- Check current Supabase database specs and functions

-- 1. Check if our functions exist
SELECT 
    proname as function_name,
    prosrc as function_definition
FROM pg_proc 
WHERE proname IN (
    'is_within_business_hours_at_time',
    'calculate_business_day_end', 
    'should_tab_be_overdue_unified',
    'get_tab_balance',
    'update_overdue_tabs_unified',
    'process_end_of_day_cleanup'
)
ORDER BY proname;

-- 2. Check bars table structure for business hours
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bars' 
  AND column_name LIKE '%business%'
ORDER BY column_name;

-- 3. Check tabs table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tabs'
ORDER BY column_name;

-- 4. Sample bar data to see business hours configuration
SELECT 
    id,
    name,
    business_hours_mode,
    business_hours_simple,
    business_hours_advanced,
    business_24_hours
FROM bars 
LIMIT 5;

-- 5. Find the specific problematic tab
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.bar_id,
    t.opened_at,
    t.opened_at::date as opened_date,
    CURRENT_DATE as today,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600/24 as days_open,
    get_tab_balance(t.id) as balance,
    b.name as bar_name,
    b.business_hours_mode,
    b.business_24_hours
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE t.status = 'open'
  AND get_tab_balance(t.id) > 0
  AND t.opened_at < CURRENT_DATE - INTERVAL '2 days'
ORDER BY t.opened_at DESC;
