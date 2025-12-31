'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, DollarSign, Menu, X, Search, ArrowRight, AlertCircle, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

// Format functions for thousand separators
const formatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

// Calculate average service time from confirmed orders across all tabs
const calculateAverageServiceTime = (tabs: any[]): string => {
  const allConfirmedOrders = tabs.flatMap(tab => 
    (tab.orders || []).filter((o: any) => 
      o.status === 'confirmed' && 
      o.confirmed_at && 
      o.status !== 'cancelled'  // Exclude cancelled orders
    )
  );
  
  console.log('📊 Service Time Debug:', {
    totalTabs: tabs.length,
    allOrders: tabs.flatMap(tab => tab.orders || []).length,
    confirmedOrders: tabs.flatMap(tab => (tab.orders || []).filter((o: any) => o.status === 'confirmed')).length,
    cancelledOrders: tabs.flatMap(tab => (tab.orders || []).filter((o: any) => o.status === 'cancelled')).length,
    confirmedWithTimestamp: allConfirmedOrders.length,
    sampleOrder: allConfirmedOrders[0]
  });
  
  if (allConfirmedOrders.length === 0) return '0m';
  
  const totalTime = allConfirmedOrders.reduce((sum, order) => {
    const created = new Date(order.created_at).getTime();
    const confirmed = new Date(order.confirmed_at).getTime();
    const serviceTimeSeconds = Math.floor((confirmed - created) / 1000);
    console.log(`Order ${order.id}: ${serviceTimeSeconds}s (${serviceTimeSeconds/60}m)`);
    return sum + serviceTimeSeconds;
  }, 0);
  
  const avgSeconds = Math.floor(totalTime / allConfirmedOrders.length);
  const avgMinutes = Math.floor(avgSeconds / 60);
  
  console.log(`📊 Average Service Time: ${avgSeconds}s = ${avgMinutes}m`);
  
  if (avgMinutes > 0) {
    return `${avgMinutes}m`;
  } else {
    return '<1m';
  }
};

// Real-time timer format for pending orders
const formatPendingTime = (createdAt: string, currentTime: number): string => {
  const created = new Date(createdAt).getTime();
  const elapsed = Math.floor((currentTime - created) / 1000); // seconds
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
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

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('👤 Current user bar_id:', user?.user_metadata?.bar_id);
      console.log('👤 User email:', user?.email);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (bar) {
      loadTabs();
      const interval = setInterval(loadTabs, 10000);
      return () => clearInterval(interval);
    }
  }, [bar]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const loadTabs = async () => {
    if (!bar) return;
    
    try {
      console.log('🔍 Loading tabs for bar_id:', bar.id);
      
      const { data: tabsData, error } = await supabase
        .from('tabs')
        .select('*, bars(id, name, location)')
        .eq('bar_id', bar.id)
        .order('tab_number', { ascending: false });

      if (error) throw error;

      console.log('✅ Tabs loaded:', tabsData?.length || 0, 'tabs for bar:', bar.name);

      const tabsWithDetails = await Promise.all(
        (tabsData || []).map(async (tab: any) => {
          const [ordersResult, paymentsResult] = await Promise.all([
            supabase
              .from('tab_orders')
              .select('id, total, status, created_at, confirmed_at')
              .eq('tab_id', tab.id)
              .order('created_at', { ascending: false }),
            
            supabase
              .from('tab_payments')
              .select('id, amount, status, created_at')
              .eq('tab_id', tab.id)
              .order('created_at', { ascending: false })
          ]);

          return {
            ...tab,
            bar: tab.bars,
            orders: ordersResult.data || [],
            payments: paymentsResult.data || []
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
    
    // Special handling for 'pending' filter - show tabs with pending orders
    const hasPendingOrders = tab.orders?.some((o: any) => o.status === 'pending');
    const matchesPendingFilter = filterStatus !== 'pending' || hasPendingOrders;
    
    return matchesSearch && matchesFilter && matchesPendingFilter;
  }).sort((a, b) => {
    // Priority sorting: pending orders first, then by status priority, then by tab number
    const aHasPending = a.orders?.some((o: any) => o.status === 'pending');
    const bHasPending = b.orders?.some((o: any) => o.status === 'pending');
    
    // Tabs with pending orders come first
    if (aHasPending && !bHasPending) return -1;
    if (!aHasPending && bHasPending) return 1;
    
    // Then by status priority: open -> closed -> overdue
    const statusPriority = { open: 0, closed: 1, overdue: 2 };
    const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
    const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Finally by tab number (descending for newest first)
    return (b.tab_number || 0) - (a.tab_number || 0);
  });

  const stats = {
    totalTabs: tabs.filter(t => t.status === 'open').length,
    totalRevenue: tabs.reduce((sum, tab) => 
      sum + (tab.orders?.reduce((s: number, o: any) => s + parseFloat(o.total), 0) || 0), 0),
    pendingOrders: tabs.reduce((sum, tab) => 
      sum + (tab.orders?.filter((o: any) => o.status === 'pending').length || 0), 0),
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Loading tabs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Main container with responsive width */}
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
                <span className="text-sm text-orange-100">Tabs</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalTabs}</p>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-orange-100" />
                <span className="text-sm text-orange-100">Orders</span>
              </div>
              <p className="text-2xl font-bold">{tabs.reduce((sum, tab) => sum + (tab.orders?.length || 0), 0)}</p>
            </div>
            <div className="bg-red-500 bg-opacity-30 backdrop-blur-sm rounded-xl p-4 border border-red-300">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-red-100 animate-pulse" />
                <span className="text-sm text-red-100 font-semibold">Pending</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.pendingOrders}</p>
            </div>
            <div className="bg-green-500 bg-opacity-30 backdrop-blur-sm rounded-xl p-4 border border-green-300">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={16} className="text-green-100" />
                <span className="text-sm text-green-100 font-semibold">Time</span>
              </div>
              <p className="text-2xl font-bold text-white">{calculateAverageServiceTime(tabs)}</p>
            </div>
          </div>
        </div>

        {showMenu && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setShowMenu(false)}>
            <div className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl p-6" onClick={e => e.stopPropagation()}>
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
            {['all', 'pending', 'open', 'closed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  filterStatus === status 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {status === 'pending' ? '⚡ Pending' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Layout - 4 columns */}
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
                
                return (
                  <div 
                    key={tab.id} 
                    onClick={() => router.push(`/tabs/${tab.id}`)}
                    className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg cursor-pointer transition transform hover:scale-105"
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-800 truncate">{getDisplayName(tab)}</h3>
                        {hasPendingOrders && (
                          <span className="flex items-center justify-center w-6 h-6 bg-yellow-400 rounded-full animate-pulse">
                            <AlertCircle size={14} className="text-yellow-900" />
                          </span>
                        )}
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
                        {tab.orders?.filter((o: any) => o.status === 'pending').length > 0 ? (
                          <div className="text-yellow-600 font-medium">
                            <div className="flex items-center gap-1">
                              <AlertCircle size={10} />
                              {tab.orders
                                .filter((o: any) => o.status === 'pending')
                                .slice(0, 1) // Show only the oldest pending order time
                                .map((pendingOrder: any) => (
                                  <span key={pendingOrder.id} className="font-mono text-xs">
                                    {formatPendingTime(pendingOrder.created_at, currentTime)}
                                  </span>
                                ))}
                            </div>
                            <div className="text-xs">
                              {tab.orders?.filter((o: any) => o.status === 'pending').length || 0} pending
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
    </div>
  );
}