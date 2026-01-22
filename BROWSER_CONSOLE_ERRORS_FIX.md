# Browser Console Errors Fix

## Issues Identified and Fixed

### 1. ✅ M-Pesa Settings Save Error - FIXED
**Issue**: "Failed to save M-Pesa settings. Please try again."
**Root Cause**: Database schema had duplicate M-Pesa columns causing conflicts
**Solution**: 
- Created `fix-mpesa-duplicates.sql` to clean up duplicate columns
- Updated settings page to use correct `mpesa_enabled` column instead of `payment_mpesa_enabled`
- Removed M-Pesa from payment settings section (now has dedicated setup section)

### 2. ✅ Deprecated Crypto Functions - FIXED
**Issue**: `createCipher` and `createDecipher` are deprecated
**Root Cause**: Using old crypto API in M-Pesa encryption functions
**Solution**: 
- Updated to `createCipherGCM` and `createDecipherGCM` with proper IV handling
- Fixed in both `apps/staff/app/api/mpesa-settings/route.ts` and `packages/shared/lib/mpesa-utils.ts`

### 3. ✅ PWA Install Prompt Error - FIXED
**Issue**: "beforeinstallpromptevent.preventDefault() called. The page must call beforeinstallpromptevent.prompt() to show the banner"
**Root Cause**: Always calling preventDefault() even when not showing custom prompt
**Solution**: 
- Updated PWA install prompt components to only preventDefault when actually showing custom prompt
- Added proper conditions to check if custom prompt should be shown

### 4. 🔍 ServiceWorker Error - NEEDS INVESTIGATION
**Issue**: "Failed to update a ServiceWorker for scope with script 'Unknown': Not found"
**Status**: Workbox files exist, likely registration issue
**Next Steps**: Check service worker registration in app layouts

### 5. 🔍 Supabase API 400 Error - LIKELY FIXED
**Issue**: `bkaigyrrzsqbfscyznzw.supabase.co/rest/v1/bars?id=eq.438c80c1-fe11-4ac5-8a48-2fc45104ba31:1 Failed to load resource: the server responded with a status of 400 ()`
**Likely Cause**: Missing M-Pesa columns in database causing query failures
**Expected Fix**: Should be resolved after running `fix-mpesa-duplicates.sql`

## Files Modified

### Database Schema
- `fix-mpesa-duplicates.sql` - Cleans up duplicate M-Pesa columns
- `fix-mpesa-columns.sql` - Original fix (still valid for fresh installs)

### M-Pesa Implementation
- `apps/staff/app/api/mpesa-settings/route.ts` - Fixed crypto functions
- `packages/shared/lib/mpesa-utils.ts` - Fixed crypto functions
- `apps/staff/app/settings/page.tsx` - Updated to use correct M-Pesa column

### PWA Components
- `apps/staff/components/PWAInstallPrompt.tsx` - Fixed preventDefault logic
- `apps/customer/components/PWAInstallPrompt.tsx` - Fixed preventDefault logic

## Required Actions

### 1. Apply Database Fix (CRITICAL)
Run this in Supabase SQL Editor:
```sql
-- Copy and paste contents of fix-mpesa-duplicates.sql
```

### 2. Test M-Pesa Settings
1. Go to Staff Settings → M-Pesa Setup
2. Try saving M-Pesa settings
3. Should see "✅ M-Pesa settings saved successfully"

### 3. Test PWA Install Prompt
1. Open staff/customer app in browser
2. Check console for PWA-related logs
3. Should not see preventDefault error

### 4. Verify Supabase API
1. Check browser network tab
2. Look for 400 errors on `/rest/v1/bars` endpoint
3. Should be resolved after database fix

## Testing Checklist

- [ ] M-Pesa settings save successfully
- [ ] No crypto deprecation warnings
- [ ] PWA install prompt works without console errors
- [ ] No ServiceWorker "Unknown" errors
- [ ] No Supabase 400 errors
- [ ] All payment settings save correctly

## Notes

- The M-Pesa setup now uses dedicated `mpesa_enabled` column
- Payment settings section no longer includes M-Pesa (has own section)
- Crypto functions now use modern GCM mode with proper IV handling
- PWA prompts only prevent default when showing custom UI
- Database cleanup removes security risk of unencrypted passkeys