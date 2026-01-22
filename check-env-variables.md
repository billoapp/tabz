# Check Environment Variables for Supabase Auth Issue

## 🔍 **Check Your `.env.local` File**

Your environment variables should look like this for **new secret-based auth**:

```bash
# NEW FORMAT (Current Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# M-Pesa Encryption Key
MPESA_ENCRYPTION_KEY=your-32-byte-encryption-key-here!!
```

## 🚨 **Legacy vs New Keys**

### **Legacy Format (OLD - might not work)**
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **New Format (CURRENT - should work)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 **How to Get New Keys**

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Copy the keys from the **Project API keys** section:
   - **URL**: Project URL
   - **anon public**: For `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret**: For `SUPABASE_SERVICE_ROLE_KEY`

## 🎯 **Check Your Supabase Client Setup**

Your `lib/supabase.ts` should look like:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
```

## 🚨 **Common Issues**

1. **Mixed Keys**: Using old URL format with new key format
2. **Wrong Service Key**: Using anon key instead of service_role key
3. **Missing NEXT_PUBLIC_**: Frontend needs `NEXT_PUBLIC_` prefix
4. **Cached Environment**: Need to restart dev server after changing env vars

## ✅ **Quick Fix Steps**

1. **Update `.env.local`** with new format keys
2. **Restart development server**: `npm run dev` or `yarn dev`
3. **Clear browser cache** and try again
4. **Run the auth checker script** to verify

If you're still using legacy keys, that's definitely why the database updates are failing silently!