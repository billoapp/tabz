# M-Pesa Schema Cleanup & Function Explanation

## Current Save Function Flow

### 1. **Validation**
- Validates bar ID exists
- Validates user has access to bar
- Validates M-Pesa credentials format (PayBill, not Till)
- Validates all required fields present

### 2. **Encryption** 
- Encrypts Consumer Key using AES-256-GCM
- Encrypts Consumer Secret using AES-256-GCM  
- Encrypts Passkey using AES-256-GCM
- Each gets unique IV + AuthTag + Encrypted Data

### 3. **Storage**
- Saves to `mpesa_credentials` table (NEW secure table)
- Uses `tenant_id` = bar ID
- Sets `is_active` = mpesa_enabled
- Sets `environment` = sandbox/production
- Sets `business_shortcode` = PayBill number

### 4. **Audit Logging**
- Creates entry in `mpesa_credential_events`
- Logs who, when, what changed
- Tracks all credential operations

## Column Purpose & Status

| Column | Table | Status | Purpose | When Set |
|--------|-------|--------|---------|----------|
| `mpesa_enabled` | mpesa_credentials | ✅ CURRENT | Enable/disable M-Pesa | User toggles |
| `mpesa_setup_completed` | bars | ❌ LEGACY | Setup completion flag | After test passes |
| `payment_mpesa_enabled` | bars | ❌ DUPLICATE | Same as above | User toggles |
| `mpesa_callback_url` | bars | ❌ LEGACY | Per-bar callback | Not needed |
| `is_active` | mpesa_credentials | ✅ CURRENT | Same as mpesa_enabled | User toggles |

## When `mpesa_setup_completed` Turns True

Currently: **After successful test of credentials**

1. User saves credentials → `mpesa_setup_completed = false`
2. User clicks "Test M-Pesa" → API tests OAuth token generation
3. If test succeeds → `mpesa_setup_completed = true`
4. If test fails → `mpesa_setup_completed = false`

## Schema Issues to Fix

### 1. **Duplicate Columns**
- `payment_mpesa_enabled` (bars) vs `is_active` (mpesa_credentials)
- Both track the same thing - should use only `is_active`

### 2. **Legacy Columns**
- `mpesa_callback_url` - Not needed (central callback URL)
- `mpesa_setup_completed` - Should be in `mpesa_credentials` table

### 3. **Missing Columns**
- `mpesa_credentials` needs `setup_completed` column
- `mpesa_credentials` needs `last_test_at` column
- `mpesa_credentials` needs `test_status` column

## Recommended Schema Cleanup

### Add to `mpesa_credentials`:
```sql
ALTER TABLE mpesa_credentials 
ADD COLUMN setup_completed BOOLEAN DEFAULT false,
ADD COLUMN last_test_at TIMESTAMPTZ,
ADD COLUMN test_status TEXT DEFAULT 'pending' CHECK (test_status IN ('pending', 'success', 'failed'));
```

### Remove from `bars` (after migration):
```sql
ALTER TABLE bars 
DROP COLUMN mpesa_callback_url,
DROP COLUMN payment_mpesa_enabled,
DROP COLUMN mpesa_setup_completed;
```

## Current Save Function Summary

**What it does:**
1. ✅ Validates input and permissions
2. ✅ Encrypts credentials securely  
3. ✅ Stores in secure `mpesa_credentials` table
4. ✅ Logs audit trail
5. ❌ **Missing**: Doesn't update test status properly
6. ❌ **Missing**: Doesn't clean up legacy columns

**What it should do additionally:**
1. Update test status to 'pending' after save
2. Clear any previous test results
3. Use only the new secure table
4. Ignore legacy columns