-- Check which of these zero-balance tabs have pending orders
SELECT 
    t.id,
    t.tab_number,
    t.status,
    -- Confirmed balance (should be 0 for all)
    COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
    COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0) as confirmed_balance,
    -- Pending orders count
    (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_orders_count,
    -- List pending order details
    (SELECT STRING_AGG(
        'Order #' || COALESCE(order_number, SUBSTRING(id::text, 1, 8)) || 
        ' (' || total || ' KSh, ' || initiated_by || ')', 
        '; '
    ) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') as pending_order_details,
    -- Auto-close decision
    CASE 
        WHEN (COALESCE((SELECT SUM(total) FROM tab_orders WHERE tab_id = t.id AND status = 'confirmed'), 0) - 
              COALESCE((SELECT SUM(amount) FROM tab_payments WHERE tab_id = t.id AND status = 'success'), 0)) <= 0
             AND (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') = 0
        THEN '✅ SHOULD AUTO-CLOSE'
        WHEN (SELECT COUNT(*) FROM tab_orders WHERE tab_id = t.id AND status = 'pending') > 0
        THEN '⏳ KEEP OPEN - Has pending orders'
        ELSE '❓ KEEP OPEN - Other reason'
    END as auto_close_decision
FROM tabs t
WHERE t.status = 'open'
  AND t.id IN (
    '4800e4d2-c9f6-46b8-9924-553b3fba5137',
    '82238eca-ac5c-4a0b-83c8-7b7223b2cb10',
    'c95cbfb6-64bb-404f-a0c2-68ba918b7988',
    '849aa8fe-3974-483b-a6ed-dfe8b62a66e4',
    '62d85430-753c-4430-aa2b-6a6c18ecbe63',
    '3101f025-f4b8-434e-a11a-bb5019ee8511',
    'fd97b726-729a-4a2c-98ec-01a989e3f18d',
    'a12fc739-e750-4adc-85ad-1a4b8f5c26b5',
    'f3d3e573-70ae-402c-bf09-98f1c1e447a1',
    'c3c75cd5-20bf-45ed-8a2f-91cd47a38524',
    'da36eb33-50de-4be1-86ef-be122041878d',
    '702c9807-45cd-4a35-8203-cc7d7f040bc8',
    '6ab2c067-f0a6-4fce-8311-936bc25b2b6e',
    '9d82f7aa-c7c8-41d5-b092-238729ab0f9a',
    '64f13c72-2e59-41fb-b92f-643d3d1b1962'
  )
ORDER BY t.tab_number;