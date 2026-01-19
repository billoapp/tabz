# M-Pesa Setup Fix Guide

## Issue Identified
The M-Pesa settings save is failing because the database migration `040_add_mpesa_credentials.sql` was not applied to the production database. The `bars` table is missing the required M-Pesa credential columns.

## Current Database State
The `bars` table has these old M-Pesa columns:
- `mpesa_till_number` (old)
- `mpesa_paybill_number` (old) 
- `mpesa_passkey` (old, unencrypted)

But is missing these new required columns:
- `mpesa_enabled`
- `mpesa_environment`
- `mpesa_business_shortcode`
- `mpesa_consumer_key_encrypted`
- `mpesa_consumer_secret_encrypted`
- `mpesa_passkey_encrypted`
- `mpesa_callback_url`
- `mpesa_setup_completed`
- `mpesa_last_test_at`
- `mpesa_test_status`

## Fix Steps

### Step 1: Check Current Schema
Run this in Supabase SQL Editor:
```sql
-- Copy and paste contents of check-mpesa-columns.sql
```

### Step 2: Apply Missing Columns
If columns are missing, run this in Supabase SQL Editor:
```sql
-- Copy and paste contents of fix-mpesa-columns.sql
```

### Step 3: Verify Fix
After running the fix, check again:
```sql
-- Run check-mpesa-columns.sql again to verify
```

### Step 4: Test M-Pesa Settings
1. Go to Staff Settings → M-Pesa Setup
2. Try saving M-Pesa settings
3. Check browser console for detailed logs
4. Should see "✅ M-Pesa settings saved successfully"

## Alternative: Manual Column Addition

If the automated script doesn't work, add columns manually:

```sql
-- Add columns one by one
ALTER TABLE bars ADD COLUMN mpesa_enabled BOOLEAN DEFAULT false;
ALTER TABLE bars ADD COLUMN mpesa_environment VARCHAR(20) DEFAULT 'sandbox';
ALTER TABLE bars ADD COLUMN mpesa_business_shortcode VARCHAR(20);
ALTER TABLE bars ADD COLUMN mpesa_consumer_key_encrypted TEXT;
ALTER TABLE bars ADD COLUMN mpesa_consumer_secret_encrypted TEXT;
ALTER TABLE bars ADD COLUMN mpesa_passkey_encrypted TEXT;
ALTER TABLE bars ADD COLUMN mpesa_callback_url TEXT;
ALTER TABLE bars ADD COLUMN mpesa_setup_completed BOOLEAN DEFAULT false;
ALTER TABLE bars ADD COLUMN mpesa_last_test_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bars ADD COLUMN mpesa_test_status VARCHAR(20) DEFAULT 'pending';

-- Add constraints
ALTER TABLE bars ADD CONSTRAINT bars_mpesa_environment_check 
    CHECK (mpesa_environment IN ('sandbox', 'production'));
ALTER TABLE bars ADD CONSTRAINT bars_mpesa_test_status_check 
    CHECK (mpesa_test_status IN ('pending', 'success', 'failed'));
```

## Debugging

### Check API Logs
The M-Pesa settings API now has detailed logging. Check browser console for:
- `🔧 M-Pesa settings API called`
- `📝 Request body received`
- `✅ Bar ID validated`
- `🔐 Encrypting credentials...`
- `💾 Updating database...`
- `✅ M-Pesa settings saved successfully`

### Common Error Messages
- **"Database schema not updated"**: Run the fix SQL script
- **"column does not exist"**: Missing M-Pesa columns in bars table
- **"Failed to encrypt credentials"**: Server-side encryption issue
- **"Bar ID is required"**: Authentication problem

### Test Credentials (Sandbox)
For testing, use Daraja sandbox credentials:
- **Environment**: Sandbox
- **Business Shortcode**: 174379
- **Consumer Key**: Get from developer.safaricom.co.ke
- **Consumer Secret**: Get from developer.safaricom.co.ke
- **Passkey**: Get from developer.safaricom.co.ke

## Files Modified
- `apps/staff/app/api/mpesa-settings/route.ts` - New API endpoint with encryption
- `apps/staff/app/settings/page.tsx` - Updated to use API endpoint
- `fix-mpesa-columns.sql` - Database fix script
- `check-mpesa-columns.sql` - Schema verification script

## Security Notes
- Credentials are encrypted server-side using AES-256-GCM
- Sensitive data is never logged (marked as [REDACTED])
- Credentials are cleared from client state after saving
- Each bar stores their own encrypted credentials (multi-tenant)

## Next Steps After Fix
1. Apply database schema fix
2. Test M-Pesa settings save
3. Test M-Pesa connection
4. Test end-to-end STK Push flow
5. Verify callback handling
6. Test with real Daraja credentials (small amounts)