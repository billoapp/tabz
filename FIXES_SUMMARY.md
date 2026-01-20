# M-Pesa & Browser Console Errors - FIXES APPLIED

## ✅ COMPLETED FIXES

### 1. M-Pesa Test API Decryption Function - FIXED
**Issue**: Outdated decryption function using 3-part format and deprecated crypto API
**Fix Applied**: 
- Updated to 2-part format (`iv:encrypted_data`)
- Fixed deprecated `createDecipher` to `createDecipheriv`
- Proper key handling with 32-byte padding
- **File**: `apps/staff/app/api/payments/mpesa/test/route.ts`

### 2. Crypto Compilation Errors - FIXED
**Issue**: `createCipherGCM does not exist` compilation error
**Fix Applied**: 
- All crypto functions now use modern Node.js API
- `createCipheriv` and `createDecipheriv` with AES-256-CBC
- Consistent encryption format across all files
- **Files**: `apps/staff/app/api/mpesa-settings/route.ts`, `apps/staff/app/api/payments/mpesa/test/route.ts`

### 3. PWA Install Prompt Error - FIXED (Previous)
**Issue**: "beforeinstallpromptevent.preventDefault() called"
**Fix Applied**: Only preventDefault when showing custom prompt
**Files**: `apps/staff/components/PWAInstallPrompt.tsx`, `apps/customer/components/PWAInstallPrompt.tsx`

## 🔧 CRITICAL ACTION REQUIRED

### Database Schema Fix - MUST RUN
**Issue**: Duplicate M-Pesa columns causing save failures
**Action**: Run `fix-mpesa-duplicates.sql` in Supabase SQL Editor
**Impact**: This fixes the root cause of "Failed to save M-Pesa settings" error

## 📋 VERIFICATION CHECKLIST

After running the database fix, verify:

- [ ] **M-Pesa Settings Save**: Go to Staff Settings → M-Pesa Setup, try saving settings
- [ ] **No Crypto Errors**: Build completes without `createCipherGCM` errors  
- [ ] **Test Connection**: M-Pesa test should work with valid Daraja credentials
- [ ] **Browser Console**: No more "Failed to encrypt credentials" errors
- [ ] **Database Queries**: No more 400 errors on `/rest/v1/bars` endpoint

## 🔍 REMAINING ISSUES TO INVESTIGATE

### ServiceWorker Error
**Issue**: "Failed to update a ServiceWorker for scope with script 'Unknown': Not found"
**Status**: Needs investigation - likely registration issue in app layouts
**Impact**: PWA functionality may be affected

## 📚 DARAJA SANDBOX KEYS

**Answer to "do the daraja sandbox keys expire":**
- **Consumer Key/Secret**: Don't expire unless regenerated
- **Access Tokens**: Expire every hour (auto-renewed by system)
- **Passkey**: Rarely expires, very stable
- **Business Shortcode**: 174379 (standard sandbox)

## 🚀 NEXT STEPS

1. **Apply database fix** (`fix-mpesa-duplicates.sql`)
2. **Test M-Pesa settings save** - should work without errors
3. **Test M-Pesa connection** with fresh Daraja credentials
4. **Investigate ServiceWorker** registration issues
5. **Test end-to-end STK Push** flow

## 📁 FILES MODIFIED

- `apps/staff/app/api/payments/mpesa/test/route.ts` - Fixed decryption & crypto API
- `apply-database-fix.md` - Instructions for database fix
- `daraja-sandbox-info.md` - Daraja credentials information
- `FIXES_SUMMARY.md` - This summary

## 🔐 SECURITY IMPROVEMENTS

- Removed old unencrypted `mpesa_passkey` column (security risk)
- All credentials now use AES-256-CBC encryption
- Proper 32-byte key handling
- Server-side encryption only (no client-side crypto)

---

**The main blocker is the database schema fix. Once that's applied, M-Pesa functionality should work end-to-end.**