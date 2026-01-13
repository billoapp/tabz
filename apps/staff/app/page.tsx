'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, DollarSign, Menu, X, Search, ArrowRight, AlertCircle, RefreshCw, LogOut, AlertTriangle, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { checkAndUpdateOverdueTabs } from '@/lib/businessHours';
import LargeAnimatedClock from '@/components/LargeAnimatedClock';

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
  // Get confirmed orders (order placed → confirmed) - only customer-initiated orders
  const confirmedOrders = tabs.flatMap(tab => 
    (tab.orders || []).filter((o: any) => 
      o.status === 'confirmed' && 
      o.confirmed_at && 
      o.created_at &&
      o.initiated_by === 'customer' // Only count customer-initiated orders
    )
  );
  
  // Calculate order response times (in minutes)
  const orderResponseTimes = confirmedOrders.map(order => {
    const created = new Date(order.created_at).getTime();
    const confirmed = new Date(order.confirmed_at).getTime();
    return (confirmed - created) / (1000 * 60); // in minutes
  });
  
  // Get acknowledged customer messages (message sent → staff acknowledged)
  const acknowledgedMessages = tabs.flatMap(tab => 
    (tab.messages || []).filter((m: any) => 
      m.status === 'acknowledged' && 
      m.staff_acknowledged_at && 
      m.created_at &&
      m.initiated_by === 'customer' // Only count customer-initiated messages
    )
  );
  
  // Calculate message response times (in minutes)
  const messageResponseTimes = acknowledgedMessages.map(message => {
    const created = new Date(message.created_at).getTime();
    const acknowledged = new Date(message.staff_acknowledged_at).getTime();
    return (acknowledged - created) / (1000 * 60); // in minutes
  });
  
  // Combine all response times
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

export default function TabsPage() {
  const router = useRouter();
  const { user, bar, loading: authLoading, signOut } = useAuth();
  
  const [tabs, setTabs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Clock display state
  const [showClock, setShowClock] = useState(false);
  const [clockType, setClockType] = useState<'order' | 'message'>('order');

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
            filter: `bar_id=eq.${bar.id}` // Filter by this bar
          },
          (payload: any) => {
            console.log(' Global telegram update:', payload.eventType);
            
            // Show animated clock for new customer messages
            if (payload.eventType === 'INSERT' && payload.new?.initiated_by === 'customer') {
              setClockType('message');
              setShowClock(true);
            }
            
            loadTabs(); // Refresh tabs when messages change
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
            filter: `bar_id=eq.${bar.id}` // Filter by this bar
          },
          (payload: any) => {
            console.log(' Global order update:', payload.eventType);
            
            // Show animated clock for new customer orders
            if (payload.eventType === 'INSERT' && payload.new?.initiated_by === 'customer') {
              setClockType('order');
              setShowClock(true);
            }
            
            loadTabs(); // Refresh tabs when orders change
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

  // NEW: Listen for message acknowledgment events from detail pages
  useEffect(() => {
    const handleMessageAcknowledged = (event: CustomEvent) => {
      console.log('📨 Message acknowledged event received for tab:', event.detail.tabId);
      loadTabs(); // Refresh dashboard when messages are acknowledged
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
              .eq('status', 'pending')  // ONLY PENDING
              .eq('initiated_by', 'customer')  // ONLY FROM CUSTOMER
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
      
      {/* Large Animated Clock Overlay */}
      <LargeAnimatedClock
        isVisible={showClock}
        onClose={() => setShowClock(false)}
        type={clockType}
      />
    </div>
  );
}