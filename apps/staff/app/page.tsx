'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, DollarSign, Menu, X, Search, ArrowRight, AlertCircle, RefreshCw, LogOut, AlertTriangle, MessageCircle, BellRing } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { checkAndUpdateOverdueTabs } from '@/lib/businessHours';

// Format functions for thousand separators
const formatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

// Calculate average response time for both confirmed orders and acknowledged messages
const calculateAverageResponseTime = (tabs: any[], currentTime?: number): string => {
  const confirmedOrders = tabs.flatMap(tab => 
    (tab.orders || []).filter((o: any) => 
      o.status === 'confirmed' && 
      o.confirmed_at && 
      o.created_at &&
      o.initiated_by === 'customer'
    )
  );
  
  const orderResponseTimes = confirmedOrders.map(order => {
    const created = new Date(order.created_at).getTime();
    const confirmed = new Date(order.confirmed_at).getTime();
    return (confirmed - created) / (1000 * 60);
  });
  
  const acknowledgedMessages = tabs.flatMap(tab => 
    (tab.messages || []).filter((m: any) => 
      m.status === 'acknowledged' && 
      m.staff_acknowledged_at && 
      m.created_at &&
      m.initiated_by === 'customer'
    )
  );
  
  const messageResponseTimes = acknowledgedMessages.map(message => {
    const created = new Date(message.created_at).getTime();
    const acknowledged = new Date(message.staff_acknowledged_at).getTime();
    return (acknowledged - created) / (1000 * 60);
  });
  
  const allResponseTimes = [...orderResponseTimes, ...messageResponseTimes];
  
  if (allResponseTimes.length === 0) return '0m';
  
  const avgMinutes = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
  
  if (avgMinutes >= 1) {
    return `${avgMinutes.toFixed(1)}m`;
  } else {
    return '<1m';
  }
};

// Calculate pending wait time for items still waiting for response
const calculatePendingWaitTime = (tabs: any[], currentTime?: number): string => {
  const allPendingItems = tabs.flatMap(tab => [
    ...(tab.orders || [])
      .filter((o: any) => o.status === 'pending')
      .map((order: any) => ({
        created_at: order.created_at,
        type: 'order'
      })),
    ...(tab.unreadMessages > 0 ? Array(tab.unreadMessages).fill(null).map(() => ({
        created_at: new Date().toISOString(),
        type: 'message'
      })) : [])
  ]);
  
  if (allPendingItems.length === 0) return '0m';
  
  const now = currentTime || Date.now();
  
  const totalElapsed = allPendingItems.reduce((total, item) => {
    const created = new Date(item.created_at).getTime();
    const elapsed = Math.floor((now - created) / 1000);
    return total + elapsed;
  }, 0);
  
  const avgSeconds = Math.floor(totalElapsed / allPendingItems.length);
  const hours = Math.floor(avgSeconds / 3600);
  const minutes = Math.floor((avgSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// HIGH-VISIBILITY ALERT OVERLAY
const HighVisibilityAlert = ({ 
  isVisible, 
  type = 'order' 
}: { 
  isVisible: boolean; 
  type: 'order' | 'message' 
}) => {
  if (!isVisible) return null;
  
  return (
    <>
      {/* Overlay with black/red flashing background */}
      <div 
        className="fixed inset-0 z-[9998]"
        style={{
          animation: 'flash 0.5s infinite alternate',
          backgroundColor: 'rgba(0, 0, 0, 0.9)'
        }}
      />
      
      {/* Main Alert Content */}
      <div 
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4"
      >
        {/* Flashing border */}
        <div 
          className="absolute inset-0 border-[20px] border-red-600 animate-pulse"
          style={{
            animation: 'borderPulse 1s infinite',
            boxShadow: '0 0 100px rgba(255, 0, 0, 0.8) inset'
          }}
        />
        
        {/* Main alert container */}
        <div 
          className="relative bg-gradient-to-br from-red-600 via-orange-500 to-yellow-500 rounded-3xl p-8 max-w-2xl w-full text-center shadow-2xl"
          style={{
            animation: 'pulseGlow 2s infinite',
            boxShadow: '0 0 150px rgba(255, 100, 0, 0.9)'
          }}
        >
          {/* Large icon */}
          <div className="mb-6">
            <div className="relative inline-block">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-70 rounded-full animate-ping"></div>
              
              {/* Icon container */}
              <div className="relative bg-white rounded-full p-6">
                <BellRing 
                  size={120} 
                  className="text-red-600 animate-bounce"
                  style={{
                    filter: 'drop-shadow(0 0 20px rgba(255, 255, 0, 0.9))'
                  }}
                />
              </div>
              
              {/* Rotating rings */}
              <div className="absolute -inset-4 border-4 border-yellow-400 rounded-full animate-spin"></div>
              <div className="absolute -inset-8 border-4 border-orange-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }}></div>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4 animate-pulse">
            {type === 'order' ? '🚨 NEW ORDER! 🚨' : '📢 NEW MESSAGE! 📢'}
          </h1>
          
          {/* Subtitle */}
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {type === 'order' ? 'Customer placed an order' : 'Customer sent a message'}
          </h2>
          
          {/* Action text */}
          <p className="text-xl text-white mb-8">
            Check the pending section immediately!
          </p>
          
          {/* Countdown timer */}
          <div className="bg-black bg-opacity-50 rounded-2xl p-4 mb-6 inline-block">
            <p className="text-3xl font-mono font-bold text-yellow-400">
              Auto-hides in: <span className="countdown">3</span>s
            </p>
          </div>
          
          {/* Instructions */}
          <div className="bg-white bg-opacity-20 rounded-xl p-4">
            <p className="text-lg text-white font-semibold">
              Click anywhere or press ESC to dismiss
            </p>
          </div>
        </div>
        
        {/* Corner indicators */}
        <div className="absolute top-4 left-4 w-16 h-16 bg-red-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="absolute top-4 right-4 w-16 h-16 bg-red-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="absolute bottom-4 left-4 w-16 h-16 bg-red-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="absolute bottom-4 right-4 w-16 h-16 bg-red-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
      </div>
      
      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes flash {
          0%, 100% { background-color: rgba(0, 0, 0, 0.9); }
          50% { background-color: rgba(139, 0, 0, 0.9); }
        }
        
        @keyframes borderPulse {
          0%, 100% { 
            border-color: #dc2626;
            box-shadow: 0 0 100px rgba(255, 0, 0, 0.8) inset;
          }
          50% { 
            border-color: #fbbf24;
            box-shadow: 0 0 150px rgba(255, 165, 0, 0.9) inset;
          }
        }
        
        @keyframes pulseGlow {
          0%, 100% { 
            box-shadow: 0 0 150px rgba(255, 100, 0, 0.9);
          }
          50% { 
            box-shadow: 0 0 200px rgba(255, 200, 0, 1);
          }
        }
        
        .countdown {
          display: inline-block;
          animation: countdown 1s steps(1) infinite;
        }
        
        @keyframes countdown {
          0% { content: "3"; }
          33% { content: "2"; }
          66% { content: "1"; }
          100% { content: "0"; }
        }
      `}</style>
    </>
  );
};

export default function TabsPage() {
  const router = useRouter();
  const { user, bar, loading: authLoading, signOut } = useAuth();
  
  const [tabs, setTabs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState<'order' | 'message'>('order');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio for alert sound
  useEffect(() => {
    // Create alarm sound using Web Audio API for maximum volume
    const createAlarmSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create multiple oscillators for a harsh, attention-grabbing sound
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Connect oscillators
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Emergency siren-like frequencies
        osc1.frequency.setValueAtTime(800, audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);
        osc1.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.6);
        
        osc2.frequency.setValueAtTime(600, audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
        osc2.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.6);
        
        // Maximum volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.8, audioContext.currentTime + 0.1); // Loud!
        
        return { osc1, osc2, gainNode, audioContext };
      } catch (error) {
        console.log('Web Audio API not available:', error);
        return null;
      }
    };

    // Play the alarm sound
    const playAlarm = () => {
      const sound = createAlarmSound();
      if (sound) {
        sound.osc1.start();
        sound.osc2.start();
        
        // Stop after 2 seconds
        setTimeout(() => {
          sound.osc1.stop();
          sound.osc2.stop();
          sound.audioContext.close();
        }, 2000);
      } else {
        // Fallback: Use multiple audio elements for maximum chance of playing
        try {
          const audio1 = new Audio('https://assets.mixkit.co/active_storage/sfx/259/259-preview.mp3'); // Alarm sound
          const audio2 = new Audio('https://assets.mixkit.co/active_storage/sfx/250/250-preview.mp3'); // Bell sound
          
          audio1.volume = 1;
          audio2.volume = 1;
          
          audio1.play().catch(e => console.log('Audio 1 failed:', e));
          setTimeout(() => audio2.play().catch(e => console.log('Audio 2 failed:', e)), 300);
        } catch (error) {
          console.log('All audio methods failed:', error);
        }
      }
    };

    // Store the function for later use
    (window as any).playAlarmSound = playAlarm;
  }, []);

  // Play alarm sound
  const playAlertSound = () => {
    if (typeof (window as any).playAlarmSound === 'function') {
      (window as any).playAlarmSound();
    }
  };

  // Handle ESC key to dismiss alert
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAlert) {
        setShowAlert(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAlert]);

  // Handle click to dismiss alert
  useEffect(() => {
    const handleClick = () => {
      if (showAlert) {
        setShowAlert(false);
      }
    };
    
    if (showAlert) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [showAlert]);

  // Load tabs function
  const loadTabs = async () => {
    if (!bar) return;
    
    try {
      const { data: tabsData, error } = await supabase
        .from('tabs')
        .select('*, bars(id, name, location)')
        .eq('bar_id', bar.id)
        .order('tab_number', { ascending: false });

      if (error) throw error;

      // Check for overdue tabs based on business hours
      await checkAndUpdateOverdueTabs(tabsData || []);

      const tabsWithDetails = await Promise.all(
        (tabsData || []).map(async (tab: any) => {
          const [ordersResult, paymentsResult, messagesResult] = await Promise.all([
            supabase
              .from('tab_orders')
              .select('id, total, status, created_at, confirmed_at, initiated_by')
              .eq('tab_id', tab.id)
              .order('created_at', { ascending: false }),
            
            supabase
              .from('tab_payments')
              .select('id, amount, status, created_at')
              .eq('tab_id', tab.id)
              .order('created_at', { ascending: false }),
              
            supabase
              .from('tab_telegram_messages')
              .select('id, status, created_at, staff_acknowledged_at, initiated_by, tab_id')
              .eq('tab_id', tab.id)
              .eq('status', 'pending')
              .eq('initiated_by', 'customer')
          ]);

          return {
            ...tab,
            bar: tab.bars,
            orders: ordersResult.data || [],
            payments: paymentsResult.data || [],
            unreadMessages: messagesResult.data?.length || 0
          };
        })
      );

      setTabs(tabsWithDetails);
    } catch (error) {
      console.error('Error loading tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bar) {
      loadTabs();
      const interval = setInterval(loadTabs, 10000);
      
      // Add subscription for telegram message updates
      const telegramSubscription = supabase
        .channel(`global-telegram-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tab_telegram_messages',
            filter: `bar_id=eq.${bar.id}`
          },
          (payload: any) => {
            console.log('🔔 Global telegram update:', payload.eventType, payload.new);
            
            // Show high-visibility alert for new customer messages
            if (payload.eventType === 'INSERT' && payload.new?.initiated_by === 'customer') {
              console.log('🚨 Triggering MESSAGE alert');
              playAlertSound();
              setAlertType('message');
              setShowAlert(true);
              
              // Auto-hide after 5 seconds (longer for visibility)
              setTimeout(() => {
                setShowAlert(false);
              }, 5000);
            }
            
            loadTabs();
          }
        )
        .subscribe();
      
      // Add subscription for order updates
      const orderSubscription = supabase
        .channel(`global-order-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tab_orders',
            filter: `bar_id=eq.${bar.id}`
          },
          (payload: any) => {
            console.log('🛒 Global order update:', payload.eventType, payload.new);
            
            // Show high-visibility alert for new customer orders
            if (payload.eventType === 'INSERT' && payload.new?.initiated_by === 'customer') {
              console.log('🚨 Triggering ORDER alert');
              playAlertSound();
              setAlertType('order');
              setShowAlert(true);
              
              // Auto-hide after 5 seconds
              setTimeout(() => {
                setShowAlert(false);
              }, 5000);
            }
            
            loadTabs();
          }
        )
        .subscribe();
    
      return () => {
        clearInterval(interval);
        telegramSubscription.unsubscribe();
        orderSubscription.unsubscribe();
      };
    }
  }, [bar]);

  // Listen for message acknowledgment events
  useEffect(() => {
    const handleMessageAcknowledged = (event: CustomEvent) => {
      console.log('📨 Message acknowledged event received for tab:', event.detail.tabId);
      loadTabs();
    };

    window.addEventListener('messageAcknowledged' as any, handleMessageAcknowledged);
  
    return () => {
      window.removeEventListener('messageAcknowledged' as any, handleMessageAcknowledged);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getDisplayName = (tab: any) => {
    if (tab.notes) {
      try {
        const notes = JSON.parse(tab.notes);
        return notes.display_name || `Tab ${tab.tab_number || 'Unknown'}`;
      } catch (e) {
        return `Tab ${tab.tab_number || 'Unknown'}`;
      }
    }
    return `Tab ${tab.tab_number || 'Unknown'}`;
  };

  const getTabBalance = (tab: any) => {
    const ordersTotal = tab.orders?.reduce((sum: number, order: any) => 
      sum + parseFloat(order.total), 0) || 0;
    const paymentsTotal = tab.payments?.filter((p: any) => p.status === 'success')
      .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) || 0;
    return ordersTotal - paymentsTotal;
  };

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const filteredTabs = tabs.filter(tab => {
    const displayName = getDisplayName(tab);
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         tab.tab_number?.toString().includes(searchQuery) || 
                         tab.owner_identifier?.includes(searchQuery);
    const matchesFilter = filterStatus === 'all' || tab.status === filterStatus;
    
    const hasPendingOrders = tab.orders?.some((o: any) => o.status === 'pending');
    const hasPendingMessages = (tab.unreadMessages || 0) > 0;
    const matchesPendingFilter = filterStatus !== 'pending' || hasPendingOrders || hasPendingMessages;
    
    return matchesSearch && matchesFilter && matchesPendingFilter;
  }).sort((a, b) => {
    const aHasPendingOrders = a.orders?.some((o: any) => o.status === 'pending');
    const bHasPendingOrders = b.orders?.some((o: any) => o.status === 'pending');
    const aHasPendingMessages = (a.unreadMessages || 0) > 0;
    const bHasPendingMessages = (b.unreadMessages || 0) > 0;
    
    const aHasPending = aHasPendingOrders || aHasPendingMessages;
    const bHasPending = bHasPendingOrders || bHasPendingMessages;
    
    if (aHasPending && !bHasPending) return -1;
    if (!aHasPending && bHasPending) return 1;
    
    const statusPriority = { open: 0, closed: 1, overdue: 2 };
    const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
    const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    return (b.tab_number || 0) - (a.tab_number || 0);
  });

  const stats = {
    totalTabs: tabs.filter(t => t.status === 'open').length,
    totalRevenue: tabs.reduce((sum, tab) => 
      sum + (tab.orders?.reduce((s: number, o: any) => s + parseFloat(o.total), 0) || 0), 0),
    pendingOrders: tabs.reduce((sum, tab) => 
      sum + (tab.orders?.filter((o: any) => o.status === 'pending').length || 0), 0),
    pendingMessages: tabs.reduce((sum, tab) => 
      sum + (tab.unreadMessages || 0), 0),
  };

  const totalPending = stats.pendingOrders + stats.pendingMessages;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full lg:max-w-[80%] max-w-full">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{bar?.name || 'Bar'}</h1>
              <p className="text-orange-100 text-sm">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={loadTabs}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
              >
                <RefreshCw size={24} />
              </button>
              <button 
                onClick={() => {
                  console.log('🚨 Test button clicked!');
                  playAlertSound();
                  setAlertType('order');
                  setShowAlert(true);
                  
                  setTimeout(() => {
                    setShowAlert(false);
                  }, 5000);
                }}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
                title="Test Alert"
              >
                <BellRing size={24} />
              </button>
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
              >
                {showMenu ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} className="text-orange-100" />
                <span className="text-sm text-orange-100">Avg Response Time</span>
              </div>
              <p className="text-2xl font-bold text-white">{calculateAverageResponseTime(tabs)}</p>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-orange-100" />
                <span className="text-sm text-orange-100">Orders</span>
              </div>
              <p className="text-2xl font-bold">{tabs.reduce((sum, tab) => sum + (tab.orders?.length || 0), 0)}</p>
            </div>
            <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-4 border-2 border-red-400 shadow-lg shadow-red-500/25">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-white animate-pulse" />
                <span className="text-sm text-white font-bold">Pending</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalPending}</p>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-orange-100" />
                <span className="text-sm text-orange-100">Revenue</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>

        {showMenu && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end"
            onClick={() => setShowMenu(false)}
          >
            <div className="w-64 bg-white shadow-xl p-6 h-full" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowMenu(false)} className="mb-6">
                <X size={24} />
              </button>
              <nav className="space-y-4">
                <button onClick={() => { router.push('/'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium">
                  <Users size={20} />
                  Active Tabs
                </button>
                <button onClick={() => { router.push('/overdue'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium text-red-600">
                  <AlertTriangle size={20} />
                  Overdue Tabs
                </button>
                <button onClick={() => { router.push('/reports'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium">
                  <DollarSign size={20} />
                  Reports & Export
                </button>
                <button onClick={() => { router.push('/menu'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium">
                  <Menu size={20} />
                  Menu Management
                </button>
                <button onClick={() => { router.push('/settings'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium">
                  <Menu size={20} />
                  Settings
                </button>
                <hr className="my-4" />
                <button onClick={signOut} className="flex items-center gap-3 w-full text-left py-2 font-medium text-red-600">
                  <LogOut size={20} />
                  Sign Out
                </button>
              </nav>
            </div>
          </div>
        )}

        <div className="p-4 bg-white border-b sticky top-0 z-10">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tab name or number..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {['all', 'pending', 'open', 'overdue', 'closed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  filterStatus === status 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {status === 'pending' ? `⚡ Pending (${totalPending})` : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 pb-24">
          {filteredTabs.length === 0 ? (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No tabs found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTabs.map(tab => {
                const balance = getTabBalance(tab);
                const hasPendingOrders = tab.orders?.some((o: any) => o.status === 'pending');
                const hasPendingMessages = (tab.unreadMessages || 0) > 0;
                const hasPending = hasPendingOrders || hasPendingMessages;
                
                return (
                  <div 
                    key={tab.id} 
                    onClick={() => router.push(`/tabs/${tab.id}`)}
                    className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg cursor-pointer transition transform hover:scale-105"
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-800 truncate">{getDisplayName(tab)}</h3>
                        <div className="flex items-center gap-2">
                          {tab.unreadMessages > 0 && (
                            <div className="bg-blue-500 text-white rounded-full p-1 relative">
                              <MessageCircle size={14} />
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                {tab.unreadMessages}
                              </span>
                            </div>
                          )}
                          {hasPending && (
                            <span className="flex items-center justify-center w-6 h-6 bg-yellow-400 rounded-full animate-pulse">
                              <AlertCircle size={14} className="text-yellow-900" />
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">Opened {timeAgo(tab.opened_at)}</p>
                    </div>

                    <div className="text-center py-4 bg-orange-50 rounded-lg mb-3">
                      <p className={`text-2xl font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {formatCurrency(balance)}
                      </p>
                      <p className="text-xs text-gray-500">Balance</p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 pt-3 border-t border-gray-100">
                      <span>{tab.orders?.length || 0} orders</span>
                      <div className="text-right">
                        {hasPending ? (
                          <div className="text-yellow-600 font-medium">
                            <div className="flex items-center gap-1">
                              <AlertCircle size={10} />
                              <span className="font-mono text-xs">
                                {calculatePendingWaitTime([{
                                  orders: tab.orders?.filter((o: any) => o.status === 'pending') || [],
                                  unreadMessages: tab.unreadMessages || 0
                                }], currentTime)}
                              </span>
                            </div>
                            <div className="text-xs">
                              {(tab.orders?.filter((o: any) => o.status === 'pending').length || 0) + (tab.unreadMessages || 0)} pending
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600 font-medium">No pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <style jsx global>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
      
      {/* HIGH VISIBILITY ALERT OVERLAY */}
      <HighVisibilityAlert 
        isVisible={showAlert} 
        type={alertType} 
      />
    </div>
  );
}