# Daraja Sandbox Keys Information

## Do Daraja Sandbox Keys Expire?

**Yes, Daraja sandbox keys do expire, but the expiration varies by credential type:**

### Consumer Key & Consumer Secret
- **Expiration**: These typically don't expire unless you regenerate them
- **Location**: Found in your Daraja developer portal app settings
- **Regeneration**: You can regenerate these anytime in the developer portal

### Access Tokens
- **Expiration**: 1 hour (3600 seconds)
- **Auto-renewal**: Our system automatically generates new tokens as needed
- **No manual action**: You don't need to worry about these

### Passkey
- **Expiration**: Usually doesn't expire unless changed by Safaricom
- **Stability**: Most stable credential, rarely changes
- **Updates**: Only when Safaricom updates their sandbox environment

## Common Issues

### "M-Pesa credentials not configured"
This error means:
1. **Database schema not fixed** - Run `fix-mpesa-duplicates.sql` first
2. **Credentials not saved** - Check if M-Pesa settings save successfully
3. **Encryption failed** - Check server logs for encryption errors

### "Failed to generate access token"
This usually means:
1. **Consumer Key/Secret expired** - Regenerate in Daraja portal
2. **Wrong environment** - Check if using sandbox vs production
3. **Network issues** - Safaricom API might be down

## Testing Your Credentials

1. **Save credentials** in Staff Settings → M-Pesa Setup
2. **Click "Test Connection"** to validate
3. **Check logs** in browser console for detailed error messages
4. **Success message** should show environment and business shortcode

## Getting Fresh Sandbox Credentials

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Login to your account
3. Go to your app → Keys
4. Copy the Consumer Key, Consumer Secret, and Passkey
5. Use Business Shortcode: **174379** (standard sandbox shortcode)

## Next Steps After Database Fix

Once you run the database fix (`fix-mpesa-duplicates.sql`):
1. M-Pesa settings should save without errors
2. Test connection should work with valid credentials
3. You can proceed with STK Push testing
4. Callback URL will be automatically configured

The key is fixing the database schema first - that's the root cause of most M-Pesa errors right now.