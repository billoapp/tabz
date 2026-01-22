# M-Pesa API Debug Issue

## Problem Identified
The M-Pesa settings API is returning success but not actually saving to database.

Database shows:
- `mpesa_business_shortcode`: null
- `mpesa_consumer_key_encrypted`: null  
- `mpesa_consumer_secret_encrypted`: null
- `mpesa_passkey_encrypted`: null

## Possible Causes
1. **API endpoint not being called** - Check network tab
2. **Database update failing silently** - Check API logs
3. **Wrong bar ID being used** - Check authentication
4. **Column names mismatch** - Check database schema
5. **Supabase permissions** - Check RLS policies

## Debug Steps
1. Check browser network tab for API calls
2. Check server logs for API execution
3. Verify bar ID matches between UI and API
4. Test API endpoint directly
5. Check Supabase RLS policies for bars table

## Expected vs Actual
**Expected**: Encrypted credentials saved to database
**Actual**: All M-Pesa fields remain null despite success message