# M-Pesa Over-Engineered Components Cleanup

## Overview

This directory contains SQL scripts to safely remove the over-engineered M-Pesa system components that were replaced by the simplified M-Pesa payment system.

## What Was Removed

### Files Deleted
- `packages/shared/lib/diagnostics/mpesa-diagnostic.ts` - Over-engineered diagnostic service
- `apps/staff/app/api/payments/mpesa/test/route.ts` - Complex test endpoint
- `apps/staff/app/api/payments/mpesa/stk-push/route.ts` - Over-engineered STK Push endpoint
- `apps/staff/app/api/mpesa-settings/route.ts` - Complex settings management
- `apps/customer/app/api/payments/mpesa/status/[transactionId]/route.ts` - Transaction status endpoint
- `apps/customer/app/api/debug/mpesa-decrypt/route.ts` - Debug decryption endpoint
- `apps/staff/app/api/diagnostics/mpesa/route.ts` - Diagnostic endpoint

### Database Tables to Remove
- `mpesa_credentials` - Encrypted credential storage (replaced by environment variables)
- `mpesa_transactions` - Duplicate transaction tracking (replaced by tab_payments)
- `mpesa_credential_events` - Audit logging for credentials
- `mpesa_rate_limit_logs` - Rate limiting logs

### What Remains (Simplified System)
- `tab_payments` table - Simple payment records for all payment methods
- M-Pesa configuration columns in `bars` table
- Environment variables for M-Pesa credentials
- Simple service utilities in `packages/shared/lib/services/`

## SQL Scripts

### 1. `backup-mpesa-data-before-cleanup.sql`
**Purpose**: Creates backup tables with timestamp suffix  
**When to use**: Before cleanup if you want to preserve historical data  
**Safe to skip**: Yes, if you don't need historical data

### 2. `step-by-step-mpesa-cleanup.sql`
**Purpose**: Individual steps to safely remove over-engineered components  
**When to use**: For careful, step-by-step cleanup with verification  
**Recommended**: Yes, for production environments

### 3. `cleanup-over-engineered-mpesa-tables.sql`
**Purpose**: Complete cleanup in one script  
**When to use**: For quick cleanup in development environments  
**Caution**: Test in development first

## Usage Instructions

### Step 1: Verify Simplified System Works
Before running any cleanup scripts, ensure the simplified M-Pesa system is working:

1. Test payment initiation: `POST /api/payments/mpesa`
2. Test callback handling: `POST /api/mpesa/callback`
3. Verify payments appear in `tab_payments` table
4. Test tab auto-close functionality

### Step 2: Backup (Optional)
If you want to preserve historical data:
```sql
-- Run this in your database
\i database/backup-mpesa-data-before-cleanup.sql
```

### Step 3: Run Cleanup
For production (recommended):
```sql
-- Run each step individually and verify results
\i database/step-by-step-mpesa-cleanup.sql
```

For development (faster):
```sql
-- Run complete cleanup
\i database/cleanup-over-engineered-mpesa-tables.sql
```

### Step 4: Verify Cleanup
After cleanup, verify:
1. Over-engineered tables are gone
2. `tab_payments` and `bars` tables still exist
3. Simplified M-Pesa system still works
4. No broken references in application code

## Environment Variables Required

After cleanup, ensure these environment variables are set:

```bash
# M-Pesa Sandbox Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback

# M-Pesa Production Configuration (when ready)
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=your_prod_consumer_key
MPESA_CONSUMER_SECRET=your_prod_consumer_secret
MPESA_BUSINESS_SHORTCODE=your_prod_shortcode
MPESA_PASSKEY=your_prod_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

## Benefits of Cleanup

- **Reduced Complexity**: From 2000+ lines to ~100 lines
- **Fewer Database Tables**: From 4+ tables to 1 table (tab_payments)
- **Simpler Deployment**: Environment variables instead of encrypted database storage
- **Better Maintainability**: Clear, simple code structure
- **Consistent Architecture**: Same pattern as cash payments

## Rollback Plan

If you need to rollback:
1. Restore from backup tables (if created)
2. Restore deleted files from git history
3. Re-run database migrations for over-engineered tables
4. Update environment configuration

## Support

If you encounter issues during cleanup:
1. Check application logs for errors
2. Verify environment variables are set correctly
3. Test simplified M-Pesa endpoints manually
4. Restore from backup if needed