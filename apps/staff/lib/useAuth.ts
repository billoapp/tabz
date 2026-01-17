'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bar, setBar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        loadUserData(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔐 Checking authentication...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Auth session error:', error);
        router.push('/login');
        return;
      }
      
      if (!session) {
        console.log('❌ No session found, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('✅ Session found:', { userId: session.user.id, email: session.user.email });
      await loadUserData(session.user);
    } catch (error) {
      console.error('❌ Auth check error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (user: any) => {
    setUser(user);
    
    const barId = user.user_metadata?.bar_id;
    console.log('🔐 Loading user data:', { userId: user.id, barId });
    
    if (barId) {
      try {
        const { data: barData, error } = await supabase
          .from('bars')
          .select('*')
          .eq('id', barId)
          .single();
        
        if (error) {
          console.error('❌ Error loading bar data:', error);
        } else {
          console.log('✅ Bar data loaded:', barData);
          setBar(barData);
        }
      } catch (error) {
        console.error('❌ Exception loading bar data:', error);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return { user, bar, loading, signOut };
}