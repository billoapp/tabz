'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface Bar {
  id: string;
  name: string;
  role: string;
}

interface BarContextType {
  currentBarId: string | null;
  userBars: Bar[];
  setCurrentBar: (barId: string) => Promise<void>;
  isLoading: boolean;
}

const BarContext = createContext<BarContextType | undefined>(undefined);

export function BarProvider({ children }: { children: ReactNode }) {
  const [currentBarId, setCurrentBarId] = useState<string | null>(null);
  const [userBars, setUserBars] = useState<Bar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's bars on mount
  useEffect(() => {
    loadUserBars();
  }, []);

  async function loadUserBars() {
    try {
      setIsLoading(true);

      const { data: { user } } = await (supabase as any).auth.getUser() as { data: { user: any }, error: any };
      if (!user) {
        console.log('No authenticated user found');
        setIsLoading(false);
        return;
      }

      console.log('Loading bars for user:', user.id);

      // Query user_bars table
      const { data, error } = await (supabase as any)
        .from('user_bars')
        .select(`
          bar_id,
          role,
          bars!inner (
            id,
            name
          )
        `)
        .eq('user_id', user.id) as { data: any, error: any };

      if (error) {
        console.error('Error loading user_bars:', error);

        // Fallback: try to get bar_id from user metadata (old approach)
        const barId = user.user_metadata?.bar_id;
        if (barId) {
          console.log('Using fallback bar_id from metadata:', barId);

          // Try to load the bar info
          const { data: barData } = await (supabase as any)
            .from('bars')
            .select('id, name')
            .eq('id', barId)
            .single() as { data: any, error: any };

          const fallbackBar = {
            id: barId,
            name: barData?.name || 'Default Bar',
            role: 'owner'
          };

          setUserBars([fallbackBar]);
          await setCurrentBar(barId);
          setIsLoading(false);
          return;
        }

        console.error('No bars found for user');
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('User has no bars assigned');
        setIsLoading(false);
        return;
      }

      const bars = data.map((ub: any) => ({
        id: ub.bar_id,
        name: ub.bars?.name || 'Unknown Bar',
        role: ub.role
      }));

      console.log('Loaded bars:', bars);
      setUserBars(bars);

      // Set first bar as current by default
      if (bars.length > 0) {
        await setCurrentBar(bars[0].id);
      }

    } catch (error) {
      console.error('Failed to load bars:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function setCurrentBar(barId: string) {
    try {
      console.log('Setting current bar to:', barId);

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(barId)) {
        throw new Error(`Invalid bar ID format: ${barId}`);
      }

      console.log('Calling set_bar_context RPC...');
      const { error } = await (supabase as any).rpc('set_bar_context', {
        p_bar_id: barId
      }) as { data: any, error: any };

      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      setCurrentBarId(barId);
      localStorage.setItem('currentBarId', barId);
      console.log('Bar context set successfully to:', barId);

    } catch (error) {
      console.error('Failed to set bar context:', error);
      throw error;
    }
  }

  return (
    <BarContext.Provider value={{ currentBarId, userBars, setCurrentBar, isLoading }}>
      {children}
    </BarContext.Provider>
  );
}

export function useBar() {
  const context = useContext(BarContext);
  if (!context) {
    throw new Error('useBar must be used within BarProvider');
  }
  return context;
}