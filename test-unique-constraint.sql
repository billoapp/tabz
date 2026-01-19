-- Test the unique constraint approach
DO $
BEGIN
    -- Test that the unique constraint works
    RAISE NOTICE 'Testing unique constraint approach...';
    
    -- This should work - creates unique constraint only for 'open' status
    -- When status is 'open', expression = 'open'
    -- When status is 'closed'/'overdue', expression = NULL (ignored in unique constraint)
    
    RAISE NOTICE 'Expression-based unique index should allow:';
    RAISE NOTICE '- Multiple closed/overdue tabs per device per bar';
    RAISE NOTICE '- Only one open tab per device per bar';
    
END $;

-- Show the planned index structure
SELECT 'Expression: (CASE WHEN status = ''open'' THEN ''open'' ELSE NULL END)' as explanation;
SELECT 'This creates uniqueness only when status = ''open''' as behavior;