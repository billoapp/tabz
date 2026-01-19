import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  // Skip initialization during build time
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    return null;
  }
  
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables:', {
        url: !!supabaseUrl,
        key: !!supabaseKey,
        urlValue: supabaseUrl,
        keyValue: supabaseKey ? 'present' : 'missing'
      });
      
      // During build time, return null instead of throwing
      if (typeof window === 'undefined') {
        return null;
      }
      
      throw new Error('Missing Supabase environment variables');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return supabaseClient;
};

// Export a safe client that can be null during build
export const supabase = getSupabaseClient();