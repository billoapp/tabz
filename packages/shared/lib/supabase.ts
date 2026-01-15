import { createClient } from '@supabase/supabase-js'

let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Missing Supabase environment variables in shared package');
      // Create a fallback client that won't crash the app
      supabaseClient = createClient(
        'https://placeholder.supabase.co', 
        'placeholder-key'
      );
    } else {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
  }
  
  return supabaseClient;
};

// Export the client directly for consistent usage
export const supabase = getSupabaseClient();
