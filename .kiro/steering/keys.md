---
inclusion: always
---
<!------------------------------------------------------------------------------------
   Add rules to this file or a short description and have Kiro refine them for you.
   
   Learn about inclusion modes: https://kiro.dev/docs/steering/#inclusion-modes
-------------------------------------------------------------------------------------> 
# Environment Variable Naming Standards

## Required Key Names (Exact Format)

### Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 
- `SUPABASE_SECRET_KEY`

### hCaptcha Configuration  
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`
- `HCAPTCHA_SECRET_KEY` (server-side only)

### Push Notifications (VAPID)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### M-Pesa Configuration
- `MPESA_KMS_KEY`
- `MPESA_MOCK_MODE`

## Naming Rules

1. **Public keys**: Must start with `NEXT_PUBLIC_` (client-side accessible)
2. **Secret keys**: Must NOT start with `NEXT_PUBLIC_` (server-side only)
3. **Never expose secrets**: Secret keys should never be public
4. **Consistent naming**: Use exact key names listed above

## Validation

Run validation before committing:
```bash
node dev-tools/scripts/validate-env-keys.js
```