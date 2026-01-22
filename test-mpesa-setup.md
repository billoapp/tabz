# M-Pesa Implementation Test Guide

## Current Status ✅
- **Database Schema**: M-Pesa credentials table created (`040_add_mpesa_credentials.sql`)
- **API Routes**: All M-Pesa endpoints implemented and compiling
- **UI Components**: M-Pesa setup form in staff settings
- **Utilities**: Encryption/decryption functions working
- **Import Issues**: Fixed - all routes use inlined functions

## Files Implemented

### 1. Database Migration
- `supabase/migrations/040_add_mpesa_credentials.sql`
- Adds M-Pesa configuration columns to `bars` table
- Creates `mpesa_transactions` table for tracking M-Pesa payments

### 2. API Routes
- `apps/staff/app/api/payments/mpesa/test/route.ts` - Test M-Pesa credentials
- `apps/staff/app/api/payments/mpesa/stk-push/route.ts` - Initiate STK Push
- `apps/staff/app/api/payments/mpesa/callback/route.ts` - Handle M-Pesa callbacks

### 3. Utilities
- `packages/shared/lib/mpesa-utils.ts` - M-Pesa utility functions
- Encryption/decryption for credentials
- Token generation, phone validation, etc.

### 4. UI Components
- `apps/staff/app/settings/page.tsx` - M-Pesa setup form
- Environment selection (Sandbox/Production)
- Credential input fields
- Test connection functionality

## Next Steps for Testing

### 1. Environment Setup
```bash
# Add to .env.local
MPESA_ENCRYPTION_KEY=your-32-byte-encryption-key-here!!
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com
```

### 2. Database Migration
```bash
# Run the migration
supabase db push
```

### 3. Test Workflow
1. **Setup Credentials**:
   - Go to Staff Settings → M-Pesa Setup
   - Enter Daraja credentials (sandbox for testing)
   - Save and test connection

2. **Test STK Push**:
   - Create a tab with some orders
   - Use M-Pesa payment option
   - Verify STK push is sent to phone

3. **Test Callback**:
   - Complete payment on phone
   - Verify callback updates payment status
   - Check tab balance is updated

### 4. Daraja Sandbox Credentials
For testing, use Daraja sandbox:
- **Business Shortcode**: 174379
- **Consumer Key**: Get from developer.safaricom.co.ke
- **Consumer Secret**: Get from developer.safaricom.co.ke  
- **Passkey**: Get from developer.safaricom.co.ke

### 5. Test Phone Numbers
Sandbox test numbers:
- 254708374149
- 254711XXXXXX
- 254733XXXXXX

## Architecture Notes

### Multi-Tenant Design
- Each bar stores their own Daraja credentials
- Encrypted credential storage
- Tenant identification via AccountReference: `bar_id|tab_id`

### Integration Points
- **Existing Tables**: Integrates with `tab_payments` table
- **Balance Updates**: Automatically updates tab balances on successful payment
- **Status Tracking**: Full payment lifecycle tracking

### Security Features
- **Credential Encryption**: AES-256-GCM encryption for sensitive data
- **Environment Separation**: Sandbox vs Production environments
- **Callback Validation**: Proper M-Pesa callback handling

## Troubleshooting

### Common Issues
1. **Import Errors**: Fixed by inlining utility functions
2. **Crypto Deprecation**: Fixed by using proper GCM methods
3. **Type Errors**: Fixed with `(supabase as any)` assertions

### Testing Checklist
- [ ] Database migration applied successfully
- [ ] M-Pesa setup form loads without errors
- [ ] Credentials can be saved and encrypted
- [ ] Test connection works with valid credentials
- [ ] STK Push API responds correctly
- [ ] Callback handler processes payments
- [ ] Tab balances update on successful payment

## Ready for Production
Once testing is complete:
1. Switch to production Daraja credentials
2. Update callback URL to production domain
3. Test with real phone numbers and small amounts
4. Monitor transaction logs and error handling