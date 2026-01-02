import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return supabaseClient;
};

export const supabase = getSupabaseClient();