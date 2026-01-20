# Quick M-Pesa Debug Steps

## 1. Check Columns Exist
Run this in Supabase SQL Editor:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name LIKE 'mpesa_%'
ORDER BY column_name;
```

## 2. Test Direct Update
Run this in Supabase SQL Editor:
```sql
UPDATE bars 
SET 
  mpesa_enabled = true,
  mpesa_environment = 'sandbox',
  mpesa_business_shortcode = '174379',
  mpesa_consumer_key_encrypted = 'test_encrypted_key'
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
```

## 3. Check If Update Worked
```sql
SELECT 
  name,
  mpesa_enabled,
  mpesa_business_shortcode,
  CASE 
    WHEN mpesa_consumer_key_encrypted IS NOT NULL THEN 'HAS KEY'
    ELSE 'NO KEY'
  END as key_status
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
```

## 4. Test API in Browser
1. Go to Staff Settings page
2. Open browser console (F12)
3. Paste the contents of `test-mpesa-api-directly.js`
4. Press Enter to run it
5. Check the console output

## Expected Results
- **Columns**: Should show all mpesa_* columns
- **Direct Update**: Should work without errors
- **API Test**: Should show detailed logs of what's happening

This will help us identify if it's a:
- Database schema issue
- Permission issue  
- API logic issue
- Frontend issue