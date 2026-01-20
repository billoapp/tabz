# 🚨 URGENT: Database Fix Required

## The Issue
You're getting "❌ M-Pesa test failed: M-Pesa credentials not configured" because the database schema hasn't been updated yet.

## Root Cause
The `bars` table is missing the new M-Pesa credential columns, so when you try to save M-Pesa settings, they're not actually being stored in the database.

## IMMEDIATE ACTION REQUIRED

### Step 1: Check Current Schema
Run this in **Supabase SQL Editor** to see the current state:
```sql
-- Copy and paste contents of check-current-mpesa-schema.sql
```

### Step 2: Apply the Fix
Run this in **Supabase SQL Editor** to fix the schema:
```sql
-- Copy and paste contents of fix-mpesa-duplicates.sql
```

## What This Fix Does

1. **Consolidates duplicate columns** - Merges `payment_mpesa_enabled` into `mpesa_enabled`
2. **Removes security risks** - Drops old unencrypted `mpesa_passkey` column
3. **Cleans up schema** - Removes old unused M-Pesa columns
4. **Adds missing columns** - Ensures all new M-Pesa credential columns exist

## After Running the Fix

✅ M-Pesa settings will save successfully  
✅ "Test Connection" will work with valid credentials  
✅ No more "credentials not configured" errors  
✅ Database will have clean, secure M-Pesa schema  

## Test Steps After Fix

1. **Go to Staff Settings** → M-Pesa Setup
2. **Enter test credentials**:
   - Environment: Sandbox
   - Business Shortcode: 174379
   - Consumer Key: [from Daraja portal]
   - Consumer Secret: [from Daraja portal]  
   - Passkey: [from Daraja portal]
3. **Click "Save Settings"** - should see success message
4. **Click "Test Connection"** - should validate successfully

## If You Don't Have Daraja Credentials

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create account / login
3. Create a new app
4. Get Consumer Key, Consumer Secret, and Passkey from app settings
5. Use Business Shortcode: **174379** (standard sandbox)

---

**This database fix is the blocker preventing M-Pesa from working. Everything else is ready to go.**