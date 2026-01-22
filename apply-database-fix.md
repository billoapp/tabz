# Apply Database Fix for M-Pesa Setup

## CRITICAL: Run this SQL script in Supabase SQL Editor

**Copy and paste the entire contents of `fix-mpesa-duplicates.sql` into your Supabase SQL Editor and run it.**

This will fix the database schema issues causing:
- ❌ Failed to save M-Pesa settings: Failed to encrypt credentials
- ❌ Database column conflicts
- ❌ Missing M-Pesa columns

## Steps:

1. **Open Supabase Dashboard** → Your Project → SQL Editor
2. **Copy the entire contents** of `fix-mpesa-duplicates.sql` 
3. **Paste into SQL Editor** and click "Run"
4. **Verify success** - should see column status output
5. **Test M-Pesa settings** - go to Staff Settings → M-Pesa Setup

## After running the fix:

✅ M-Pesa settings should save successfully  
✅ No more "Failed to encrypt credentials" errors  
✅ Clean database schema with proper M-Pesa columns  
✅ Removed security risk of unencrypted passkeys  

## If you get errors:

- Check that you have admin access to the database
- Make sure you're running in the correct Supabase project
- Contact support if you see permission errors

---

**This fix is required before M-Pesa functionality will work properly.**