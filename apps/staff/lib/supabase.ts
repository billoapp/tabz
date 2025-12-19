import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_DB_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_DB_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);