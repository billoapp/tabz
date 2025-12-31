// apps/staff/app/overdue/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AlertTriangle, Calendar, DollarSign, Search, Filter, Eye, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

// Temporary format functions
const tempFormatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function OverdueTabsPage() {
  const router = useRouter();
  const { bar } = useAuth();
  const [overdueTabs, setOverdueTabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (bar) {
      loadOverdueTabs();
    }
  }, [bar]);

  const loadOverdueTabs = async () => {
    setLoading(true);
    try {
      if (!bar) return;
      
      const { data, error } = await supabase
        .from('tabs')
        .select(`
          *,
          orders:tab_orders(*),
          payments:tab_payments(*)
        `)
        .eq('status', 'overdue')
        .eq('bar_id', bar.id) // Only show this bar's overdue tabs
        .order('moved_to_overdue_at', { ascending: false });

      if (error) throw error;
      setOverdueTabs(data || []);
    } catch (error) {
      console.error('Error loading overdue tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTabBalance = (tab: any) => {
    const ordersTotal = tab.orders?.filter((order: any) => order.status === 'confirmed')
      .reduce((sum: number, order: any) => sum + parseFloat(order.total), 0) || 0;
    const paymentsTotal = tab.payments?.filter((p: any) => p.status === 'success')
      .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) || 0;
    return ordersTotal - paymentsTotal;
  };

  const getDisplayName = (tab: any) => {
    if (tab.notes) {
      try {
        const notes = JSON.parse(tab.notes);
        return notes.display_name || `Tab ${tab.tab_number}`;
      } catch (e) {}
    }
    return `Tab ${tab.tab_number}`;
  };

  const handleWriteOff = async (tabId: string, balance: number) => {
    const confirm = window.confirm(`Write off ${tempFormatCurrency(balance)} as bad debt? This action cannot be undone.`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from('tabs')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: 'staff',
          overdue_reason: `Written off as bad debt: ${tempFormatCurrency(balance)}`
        })
        .eq('id', tabId);

      if (error) throw error;

      alert('Tab written off successfully');
      loadOverdueTabs();
    } catch (error) {
      console.error('Error writing off tab:', error);
      alert('Failed to write off tab');
    }
  };

  const filteredTabs = overdueTabs.filter(tab => {
    const searchLower = searchTerm.toLowerCase();
    const displayName = getDisplayName(tab).toLowerCase();
    const tabNumber = tab.tab_number?.toString().toLowerCase() || '';
    return displayName.includes(searchLower) || tabNumber.includes(searchLower);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading overdue tabs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Main container with responsive width */}
      <div className="w-full lg:max-w-[80%] max-w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => router.push('/')}
            className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
          >
            <ArrowRight size={24} className="transform rotate-180" />
          </button>
          <h1 className="text-2xl font-bold">Overdue Tabs</h1>
          <div className="w-10"></div>
        </div>
        
        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-100">Bad Debt Management</p>
              <p className="text-2xl font-bold">{filteredTabs.length} Overdue Tabs</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-orange-100">Total Outstanding</p>
              <p className="text-2xl font-bold">
                {tempFormatCurrency(filteredTabs.reduce((sum, tab) => sum + getTabBalance(tab), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="p-4 bg-white border-b">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tab number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
        </div>
      </div>

      {/* Overdue Tabs Table */}
      <div className="p-4">
        {filteredTabs.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            <AlertTriangle size={48} className="mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-semibold mb-2">No Overdue Tabs</h3>
            <p className="text-sm">
              {searchTerm ? 'No tabs match your search criteria.' : 'Great job! No overdue tabs to manage.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <div className="grid grid-cols-5 gap-4 text-xs font-semibold text-gray-600 uppercase">
                <div>Tab</div>
                <div>Overdue Since</div>
                <div>Orders</div>
                <div>Outstanding</div>
                <div>Actions</div>
              </div>
            </div>
            
            {/* Table Rows */}
            {filteredTabs.map((tab) => {
              const balance = getTabBalance(tab);
              const displayName = getDisplayName(tab);
              const orderCount = tab.orders?.filter((order: any) => order.status === 'confirmed').length || 0;
              
              return (
                <div key={tab.id} className="border-b border-gray-100 px-4 py-3 hover:bg-gray-50">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="font-medium text-gray-800">{displayName}</p>
                      <p className="text-xs text-gray-500">#{tab.tab_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{timeAgo(tab.moved_to_overdue_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{orderCount} orders</p>
                    </div>
                    <div>
                      <p className="font-bold text-red-600">{tempFormatCurrency(balance)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedTab(tab);
                          setShowDetails(true);
                        }}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleWriteOff(tab.id, balance)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600"
                      >
                        Write Off
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Details Modal */}
      {showDetails && selectedTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {getDisplayName(selectedTab)} - Details
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Tab Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Tab Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Tab Number:</span>
                      <p className="font-medium">#{selectedTab.tab_number}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Opened:</span>
                      <p className="font-medium">{new Date(selectedTab.opened_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Overdue Since:</span>
                      <p className="font-medium">{new Date(selectedTab.moved_to_overdue_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className="font-medium text-red-600">Overdue</p>
                    </div>
                  </div>
                </div>

                {/* Orders */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Orders</h3>
                  <div className="space-y-2">
                    {selectedTab.orders?.filter((order: any) => order.status === 'confirmed').map((order: any) => {
                      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                      return (
                        <div key={order.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{items.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}</p>
                              <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <p className="font-semibold text-orange-600">{tempFormatCurrency(order.total)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payments */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Payments</h3>
                  <div className="space-y-2">
                    {selectedTab.payments?.map((payment: any) => (
                      <div key={payment.id} className="bg-green-50 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium capitalize">{payment.method}</p>
                            <p className="text-xs text-gray-500">{new Date(payment.created_at).toLocaleDateString()}</p>
                          </div>
                          <p className="font-semibold text-green-600">{tempFormatCurrency(payment.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-800">Total Outstanding:</span>
                    <span className="text-xl font-bold text-red-600">{tempFormatCurrency(getTabBalance(selectedTab))}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleWriteOff(selectedTab.id, getTabBalance(selectedTab));
                    setShowDetails(false);
                  }}
                  className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600"
                >
                  Write Off Debt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
