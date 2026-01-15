import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Missing Supabase environment variables, using fallback client');
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

// Don't initialize immediately - wait for first access
export const supabase = {
  get client() {
    return getSupabaseClient();
  },
  // Proxy common methods to avoid breaking existing code
  from: (...args: any[]) => getSupabaseClient().from(...args),
  auth: {
    get getUser() {
      return getSupabaseClient().auth.getUser.bind(getSupabaseClient().auth);
    },
    get signOut() {
      return getSupabaseClient().auth.signOut.bind(getSupabaseClient().auth);
    }
  }
};