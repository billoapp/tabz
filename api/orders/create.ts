import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_DB_URL!,
  process.env.SUPABASE_SECRET_KEY!  // Bypasses RLS
);

