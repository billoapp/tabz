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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_bars')
        .select(`
          bar_id,
          role,
          bars (
            id,
            name
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const bars = data.map((ub: any) => ({
        id: ub.bar_id,
        name: ub.bars?.name || 'Unknown Bar',
        role: ub.role
      }));

      setUserBars(bars);
      
      // Set first bar as current by default
      if (bars.length > 0 && !currentBarId) {
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
      // Call RPC to set session variable
      const { error } = await supabase.rpc('set_bar_context', { bar_id: barId });
      
      if (error) throw error;
      
      setCurrentBarId(barId);
      
      // Optionally store in localStorage for persistence
      localStorage.setItem('currentBarId', barId);
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
