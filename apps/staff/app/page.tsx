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
  type = 'order',
  onDismiss
}: { 
  isVisible: boolean; 
  type: 'order' | 'message';
  onDismiss: () => void;
}) => {
  const [count, setCount] = useState(3);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const timer = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isVisible]);
  
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
        onClick={onDismiss}
      />
      
      {/* Main Alert Content */}
      <div 
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4"
      >
        {/* Flashing border */}
        <div 
          className="absolute inset-0 border-[20px] border-orange-600 animate-pulse"
          style={{
            animation: 'borderPulse 1s infinite',
            boxShadow: '0 0 100px rgba(255, 100, 0, 0.8) inset'
          }}
        />
        
        {/* Main alert container */}
        <div 
          className="relative bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 rounded-3xl p-8 max-w-2xl w-full text-center shadow-2xl"
          style={{
            animation: 'pulseGlow 2s infinite',
            boxShadow: '0 0 150px rgba(255, 100, 0, 0.9)'
          }}
        >
          {/* Large icon */}
          <div className="mb-6">
            <div className="relative inline-block">
              {/* Outer glow */}
              <div className="absolute inset-0 bg-amber-400 blur-3xl opacity-70 rounded-full animate-ping"></div>
              
              {/* Icon container */}
              <div className="relative bg-white rounded-full p-6">
                <BellRing 
                  size={120} 
                  className="text-orange-600 animate-bounce"
                  style={{
                    filter: 'drop-shadow(0 0 20px rgba(255, 200, 0, 0.9))'
                  }}
                />
              </div>
              
              {/* Rotating rings */}
              <div className="absolute -inset-4 border-4 border-amber-400 rounded-full animate-spin"></div>
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
            <p className="text-3xl font-mono font-bold text-amber-400">
              Auto-hides in: <span className="countdown">{count}</span>s
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
        <div className="absolute top-4 left-4 w-16 h-16 bg-orange-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="absolute top-4 right-4 w-16 h-16 bg-orange-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="absolute bottom-4 left-4 w-16 h-16 bg-orange-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="absolute bottom-4 right-4 w-16 h-16 bg-orange-600 rounded-full animate-pulse flex items-center justify-center">
          <AlertCircle size={32} className="text-white" />
        </div>
      </div>
    </>
  );
};

export default function TabsPage() {
  const router = useRouter();
  const { user, bar, loading: authLoading, signOut } = useAuth();
  const mounted = useRef(true);
  
  const [tabs, setTabs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState<'order' | 'message'>('order');

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

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
      
      // Add subscription for telegram message updates (tab-specific)
      const telegramSubscription = supabase
        .channel(`telegram-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tab_telegram_messages'
          },
          (payload: any) => {
            console.log('🔔 STAFF APP: Telegram update received:', {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              table: payload.table,
              schema: payload.schema
            });
            
            // Show high-visibility alert for new customer messages
            if (payload.new?.initiated_by === 'customer') {
              console.log('🚨 STAFF APP: Customer message detected - triggering MESSAGE alert');
              if (mounted.current) {
                setAlertType('message');
                setShowAlert(true);
                
                // Auto-hide after 5 seconds
                setTimeout(() => {
                  if (mounted.current) {
                    setShowAlert(false);
                  }
                }, 5000);
              }
            } else {
              console.log('ℹ️ STAFF APP: Message not from customer, ignoring:', payload.new?.initiated_by);
            }
            
            loadTabs();
          }
        )
        .subscribe();

      // Add subscription for message acknowledgments (customer notifications)
      const telegramAckSubscription = supabase
        .channel(`telegram-ack-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tab_telegram_messages'
          },
          (payload: any) => {
            console.log('🔔 Telegram acknowledgment update:', payload.eventType, payload.new);
            
            // When staff acknowledges a message, this could trigger customer notification
            if (payload.new?.staff_acknowledged_at && !payload.old?.staff_acknowledged_at) {
              console.log('📋 Message acknowledged by staff - customer should be notified');
              // Here you would send notification to customer that message was received
            }
            
            loadTabs();
          }
        )
        .subscribe();
      
      // Add subscription for customer orders (staff alerts)
      const customerOrderSubscription = supabase
        .channel(`customer-order-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tab_orders'
          },
          (payload: any) => {
            console.log('🛒 Customer order insert:', payload.eventType, payload.new);
            
            // Show high-visibility alert for new customer orders
            if (payload.new?.initiated_by === 'customer') {
              console.log('🚨 Triggering ORDER alert');
              if (mounted.current) {
                setAlertType('order');
                setShowAlert(true);
                
                // Auto-hide after 5 seconds
                setTimeout(() => {
                  if (mounted.current) {
                    setShowAlert(false);
                  }
                }, 5000);
              }
            }
            
            loadTabs();
          }
        )
        .subscribe();

      // Add subscription for staff order actions (customer notifications)
      const staffOrderSubscription = supabase
        .channel(`staff-order-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tab_orders'
          },
          (payload: any) => {
            console.log('🛒 Staff order insert:', payload.eventType, payload.new);
            
            // When staff creates/accepts an order, notify customer
            if (payload.new?.initiated_by === 'staff') {
              console.log('🚨 Staff created/accepted order - notify customer');
              // Here you would send notification to customer
              // This could be via Telegram, push notification, etc.
            }
            
            loadTabs();
          }
        )
        .subscribe();

      // 🔥 CRITICAL FIX: Add subscription for customer cancellations
      const customerCancellationSubscription = supabase
        .channel(`customer-cancellation-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tab_orders',
            filter: `initiated_by=eq.staff` // Only staff-initiated orders
          },
          async (payload: any) => {
            console.log('🔄 Staff order update:', {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            });
            
            // Check if customer cancelled a staff order
            const isCustomerCancellation = (
              payload.new?.status === 'cancelled' && 
              payload.old?.status === 'pending' &&
              payload.new?.cancelled_by === 'customer'
            );
            
            if (isCustomerCancellation) {
              console.log('❌ Customer cancelled staff order:', payload.new.id);
              
              // Show toast notification to staff
              // You would need to implement a toast system or show a banner
              console.log('📢 NOTIFY STAFF: Customer rejected your order');
              
              // Refresh tabs data
              await loadTabs();
            }
          }
        )
        .subscribe();

      // 🔥 CRITICAL FIX: Add subscription for staff cancellations
      const staffCancellationSubscription = supabase
        .channel(`staff-cancellation-updates-${bar.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tab_orders',
            filter: `initiated_by=eq.customer` // Only customer-initiated orders
          },
          async (payload: any) => {
            console.log('🔄 Customer order update:', {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            });
            
            // Check if staff cancelled a customer order
            const isStaffCancellation = (
              payload.new?.status === 'cancelled' && 
              payload.old?.status !== 'cancelled' &&
              payload.new?.cancelled_by === 'staff'
            );
            
            if (isStaffCancellation) {
              console.log('❌ Staff cancelled customer order:', payload.new.id);
              
              // Refresh tabs data to remove cancelled order from UI
              await loadTabs();
              
              // Show toast notification to staff (optional)
              console.log('📢 Staff: Order cancelled successfully');
            }
          }
        )
        .subscribe();
    
      return () => {
        clearInterval(interval);
        telegramSubscription.unsubscribe();
        telegramAckSubscription.unsubscribe();
        customerOrderSubscription.unsubscribe();
        staffOrderSubscription.unsubscribe();
        customerCancellationSubscription.unsubscribe();
        staffCancellationSubscription.unsubscribe();
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
    // Only count non-cancelled orders
    const validOrders = tab.orders?.filter((o: any) => o.status !== 'cancelled') || [];
    const ordersTotal = validOrders.reduce((sum: number, order: any) => 
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
    
    // Filter out cancelled orders when checking for pending
    const hasPendingOrders = tab.orders?.some((o: any) => 
      o.status === 'pending' && 
      o.status !== 'cancelled'
    );
    const hasPendingMessages = (tab.unreadMessages || 0) > 0;
    const matchesPendingFilter = filterStatus !== 'pending' || hasPendingOrders || hasPendingMessages;
    
    return matchesSearch && matchesFilter && matchesPendingFilter;
  }).sort((a, b) => {
    const aHasPendingOrders = a.orders?.some((o: any) => 
      o.status === 'pending' && 
      o.status !== 'cancelled'
    );
    const bHasPendingOrders = b.orders?.some((o: any) => 
      o.status === 'pending' && 
      o.status !== 'cancelled'
    );
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
    totalRevenue: tabs.reduce((sum, tab) => {
      // Only count non-cancelled orders for revenue
      const validOrders = tab.orders?.filter((o: any) => o.status !== 'cancelled') || [];
      return sum + (validOrders.reduce((s: number, o: any) => s + parseFloat(o.total), 0) || 0);
    }, 0),
    pendingOrders: tabs.reduce((sum, tab) => 
      sum + (tab.orders?.filter((o: any) => 
        o.status === 'pending' && 
        o.status !== 'cancelled'
      ).length || 0), 0),
    pendingMessages: tabs.reduce((sum, tab) => 
      sum + (tab.unreadMessages || 0), 0),
  };

  const totalPending = stats.pendingOrders + stats.pendingMessages;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-600 animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full lg:max-w-[80%] max-w-full">
        {/* HEADER - Updated orange colors */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{bar?.name || 'Bar'}</h1>
              <p className="text-orange-200 text-sm">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={loadTabs}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition"
              >
                <RefreshCw size={24} />
              </button>
              <button 
                onClick={() => {
                  console.log('🚨 Test button clicked!');
                  setAlertType('order');
                  setShowAlert(true);
                  
                  setTimeout(() => {
                    setShowAlert(false);
                  }, 5000);
                }}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition"
                title="Test Alert"
              >
                <BellRing size={24} />
              </button>
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition"
              >
                {showMenu ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* STATS CARDS - Updated colors */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-4 border border-orange-300/20">
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} className="text-orange-200" />
                <span className="text-sm text-orange-200">Avg Response Time</span>
              </div>
              <p className="text-2xl font-bold text-white">{calculateAverageResponseTime(tabs)}</p>
            </div>
            <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-4 border border-orange-300/20">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-orange-200" />
                <span className="text-sm text-orange-200">Orders</span>
              </div>
              <p className="text-2xl font-bold text-white">{tabs.reduce((sum, tab) => sum + (tab.orders?.filter((o: any) => o.status !== 'cancelled').length || 0), 0)}</p>
            </div>
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 rounded-lg p-4 border-2 border-amber-400 shadow-lg shadow-amber-500/25">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-white animate-pulse" />
                <span className="text-sm text-white font-bold">Pending</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalPending}</p>
            </div>
            <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-4 border border-orange-300/20">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-orange-200" />
                <span className="text-sm text-orange-200">Revenue</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
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
                <button onClick={() => { router.push('/'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium hover:bg-orange-50 px-2 rounded">
                  <Users size={20} />
                  Active Tabs
                </button>
                <button onClick={() => { router.push('/overdue'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium text-orange-600 hover:bg-orange-50 px-2 rounded">
                  <AlertTriangle size={20} />
                  Overdue Tabs
                </button>
                <button onClick={() => { router.push('/reports'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium hover:bg-orange-50 px-2 rounded">
                  <DollarSign size={20} />
                  Reports & Export
                </button>
                <button onClick={() => { router.push('/menu'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium hover:bg-orange-50 px-2 rounded">
                  <Menu size={20} />
                  Menu Management
                </button>
                <button onClick={() => { router.push('/settings'); setShowMenu(false); }} className="flex items-center gap-3 w-full text-left py-2 font-medium hover:bg-orange-50 px-2 rounded">
                  <Menu size={20} />
                  Settings
                </button>
                <hr className="my-4" />
                <button onClick={signOut} className="flex items-center gap-3 w-full text-left py-2 font-medium text-orange-600 hover:bg-orange-50 px-2 rounded">
                  <LogOut size={20} />
                  Sign Out
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* SEARCH AND FILTERS */}
        <div className="p-4 bg-white border-b border-orange-100 sticky top-0 z-10">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tab name or number..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none transition"
              />
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {['all', 'pending', 'open', 'overdue', 'closed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  filterStatus === status 
                    ? 'bg-orange-600 text-white shadow' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'pending' ? `⚡ Pending (${totalPending})` : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CARDS - Changed from rounded-xl to rounded-lg (less rounded) */}
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
                const hasPendingOrders = tab.orders?.some((o: any) => 
                  o.status === 'pending' && 
                  o.status !== 'cancelled'
                );
                const hasPendingMessages = (tab.unreadMessages || 0) > 0;
                const hasPending = hasPendingOrders || hasPendingMessages;
                
                return (
                  <div 
                    key={tab.id} 
                    onClick={() => router.push(`/tabs/${tab.id}`)}
                    className={`rounded-lg p-4 shadow-sm hover:shadow-lg cursor-pointer transition transform hover:scale-105 ${
                      hasPendingOrders 
                        ? 'bg-gradient-to-br from-red-900 to-red-800 border-2 border-red-500 animate-pulse text-white' 
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-bold truncate ${hasPendingOrders ? 'text-white' : 'text-gray-800'}`}>{getDisplayName(tab)}</h3>
                        <div className="flex items-center gap-2">
                          {tab.unreadMessages > 0 && (
                            <div className="bg-blue-500 text-white rounded-lg p-1 relative">
                              <MessageCircle size={14} />
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded w-4 h-4 flex items-center justify-center">
                                {tab.unreadMessages}
                              </span>
                            </div>
                          )}
                          {hasPending && (
                            <span className="flex items-center justify-center w-6 h-6 bg-amber-500 rounded animate-pulse">
                              <AlertCircle size={14} className="text-amber-900" />
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs ${hasPendingOrders ? 'text-gray-300' : 'text-gray-500'}`}>Opened {timeAgo(tab.opened_at)}</p>
                    </div>

                    {/* Balance section */}
                    <div className={`text-center py-4 rounded-lg mb-3 ${
                      hasPendingOrders ? 'bg-gray-800' : 'bg-orange-50'
                    }`}>
                      <p className={`text-2xl font-bold ${
                        hasPendingOrders 
                          ? 'text-white' 
                          : balance > 0 ? 'text-orange-700' : 'text-green-600'
                      }`}>
                        {formatCurrency(balance)}
                      </p>
                      <p className={`text-xs ${hasPendingOrders ? 'text-gray-400' : 'text-gray-500'}`}>
                        Balance
                      </p>
                    </div>

                    <div className={`flex items-center justify-between text-xs pt-3 border-t ${
                      hasPendingOrders 
                        ? 'text-gray-300 border-gray-700' 
                        : 'text-gray-600 border-gray-100'
                    }`}>
                      <span>{tab.orders?.filter((o: any) => o.status !== 'cancelled').length || 0} orders</span>
                      <span className={hasPendingOrders ? 'text-yellow-300 font-medium' : 'text-yellow-600 font-medium'}>
                        {tab.orders?.filter((o: any) => o.status === 'pending' && o.status !== 'cancelled').length || 0} pending
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* HIGH VISIBILITY ALERT OVERLAY */}
        <HighVisibilityAlert 
          isVisible={showAlert} 
          type={alertType}
          onDismiss={() => setShowAlert(false)}
        />

        {/* CSS Animations */}
        <style jsx global>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          
          @keyframes flash-red {
            0%, 100% { 
              border-color: #ef4444;
              box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
            }
            50% { 
              border-color: #dc2626;
              box-shadow: 0 0 16px rgba(220, 38, 38, 0.6);
            }
          }
          
          .animate-flash-red {
            animation: flash-red 1.5s ease-in-out infinite;
          }
          
          @keyframes flash {
            0%, 100% { background-color: rgba(0, 0, 0, 0.9); }
            50% { background-color: rgba(220, 38, 38, 0.9); }
          }
          
          @keyframes borderPulse {
            0%, 100% { border-color: rgba(245, 158, 11, 0.5); }
            50% { border-color: rgba(245, 158, 11, 1); }
          }
          
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 150px rgba(255, 100, 0, 0.5); }
            50% { box-shadow: 0 0 200px rgba(255, 100, 0, 1); }
          }
          
          .countdown {
            font-variant-numeric: tabular-nums;
          }
        `}</style>
      </div>
    </div>
  );
}