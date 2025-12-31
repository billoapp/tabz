// apps/staff/app/tabs/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, Clock, CheckCircle, Phone, Wallet, Plus, RefreshCw, User, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Temporary format functions to bypass import issue
const tempFormatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

const tempFormatDigitalTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function TabDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [newOrderNotification, setNewOrderNotification] = useState<any>(null);

  useEffect(() => {
    loadTabData();
  }, [tabId]);

  useEffect(() => {
    if (!tabId) return;

    // Subscribe to new orders for this specific tab
    const orderSubscription = supabase
      .channel(`tab_orders_${tabId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'tab_orders',
          filter: `tab_id=eq.${tabId}`
        }, 
        (payload) => {
          console.log('New order received:', payload.new);
          
          // Only show notification for customer orders (not staff orders)
          if (payload.new.initiated_by === 'customer') {
            setNewOrderNotification(payload.new);
            
            // Auto-hide notification after 10 seconds
            setTimeout(() => {
              setNewOrderNotification(null);
            }, 10000);
          }
          
          // Refresh tab data to show the new order
          loadTabData();
        }
      )
      .subscribe();

    // Subscribe to payment changes for this specific tab
    const paymentSubscription = supabase
      .channel(`tab_payments_${tabId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tab_payments',
          filter: `tab_id=eq.${tabId}`
        }, 
        (payload) => {
          console.log('🔍 Payment change detected:', payload);
          console.log('🔍 Payment event type:', payload.eventType);
          console.log('🔍 Payment data:', payload.new);
          
          // Refresh tab data to show the payment
          loadTabData();
        }
      )
      .subscribe();

    // Subscribe to tab status changes
    const tabSubscription = supabase
      .channel(`tab_status_${tabId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'tabs',
          filter: `id=eq.${tabId}`
        }, 
        (payload) => {
          console.log('🔍 Tab status change detected:', payload);
          console.log('🔍 Old status:', payload.old?.status);
          console.log('🔍 New status:', payload.new?.status);
          
          // If tab was closed, show notification
          if (payload.new?.status === 'closed' && payload.old?.status !== 'closed') {
            console.log('🛑 Tab was automatically closed!');
            alert('⚠️ Tab was automatically closed!');
          }
          
          // Refresh tab data
          loadTabData();
        }
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
      paymentSubscription.unsubscribe();
      tabSubscription.unsubscribe();
    };
  }, [tabId]);

  const loadTabData = async () => {
    setLoading(true);
    
    try {
      // First get the tab data
      const { data: tabData, error: tabError } = await supabase
        .from('tabs')
        .select('*')
        .eq('id', tabId)
        .single();

      if (tabError) throw tabError;

      // Then get the bar data separately
      const { data: barData, error: barError } = await supabase
        .from('bars')
        .select('id, name, location')
        .eq('id', tabData.bar_id)
        .single();

      if (barError) throw barError;

      // Get orders
      const { data: ordersResult, error: ordersError } = await supabase
        .from('tab_orders')
        .select('*')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Get payments
      const { data: paymentsResult, error: paymentsError } = await supabase
        .from('tab_payments')
        .select('*')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      const fullTabData = {
        ...tabData,
        bar: barData,
        orders: ordersResult || [],
        payments: paymentsResult || []
      };

      console.log('✅ Tab loaded:', fullTabData);
      console.log('🔍 Tab status:', tabData.status);
      console.log('🔍 Tab balance after reload:', getTabBalance());
      setTab(fullTabData);

      let name = `Tab ${tabData.tab_number || 'Unknown'}`;
      if (tabData.notes) {
        try {
          const notes = JSON.parse(tabData.notes);
          name = notes.display_name || name;
        } catch (e) {}
      }
      setDisplayName(name);

    } catch (error) {
      console.error('❌ Error loading tab:', error);
      alert('Failed to load tab. Redirecting...');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkServed = async (orderId: string, initiatedBy: string) => {
    if (initiatedBy === 'staff') {
      alert('⚠️ Cannot approve staff-initiated orders. Customer must approve.');
      return;
    }

    try {
      const { error } = await supabase
        .from('tab_orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);

      if (error) throw error;

      console.log('✅ Order marked as served');
      loadTabData();
      
    } catch (error) {
      console.error('Error marking served:', error);
      alert('Failed to mark order as served');
    }
  };

  const handleAddCashPayment = async () => {
    const amount = prompt('Enter cash amount:');
    if (!amount || isNaN(Number(amount))) return;

    try {
      console.log('🔍 Adding cash payment:', amount);
      console.log('🔍 Current balance before payment:', getTabBalance());
      
      const { error } = await supabase
        .from('tab_payments')
        .insert({
          tab_id: tabId,
          amount: parseFloat(amount),
          method: 'cash',
          status: 'success',
          reference: `CASH_${Date.now()}`
        });

      if (error) throw error;

      console.log('✅ Cash payment added successfully');
      console.log('🔍 Reloading tab data...');
      loadTabData();
      
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Failed to add payment');
    }
  };

  const handleCloseTab = async () => {
    const balance = getTabBalance();
    
    if (balance > 0) {
      // Instead of write-off, push to overdue
      const confirm = window.confirm(`Tab has ${tempFormatCurrency(balance)} outstanding balance. Push to overdue (bad debt)?`);
      if (!confirm) return;
      
      try {
        const { error } = await supabase
          .from('tabs')
          .update({ 
            status: 'overdue',
            moved_to_overdue_at: new Date().toISOString(),
            overdue_reason: 'Unpaid balance pushed to bad debt'
          })
          .eq('id', tabId);

        if (error) throw error;

        alert('Tab pushed to overdue successfully');
        router.push('/');
        
      } catch (error) {
        console.error('Error pushing to overdue:', error);
        alert('Failed to push to overdue');
      }
      return;
    }
    
    // Only allow closing if balance is zero
    try {
      const { error } = await supabase
        .from('tabs')
        .update({ 
          status: 'closed', 
          closed_at: new Date().toISOString(),
          closed_by: 'staff'
        })
        .eq('id', tabId);

      if (error) throw error;

      alert('Tab closed successfully');
      router.push('/');
      
    } catch (error) {
      console.error('Error closing tab:', error);
      alert('Failed to close tab');
    }
  };

  const getTabBalance = () => {
    if (!tab) return 0;
    const ordersTotal = tab.orders?.filter((order: any) => order.status === 'confirmed')
      .reduce((sum: number, order: any) => sum + parseFloat(order.total), 0) || 0;
    const paymentsTotal = tab.payments?.filter((p: any) => p.status === 'success')
      .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) || 0;
    return ordersTotal - paymentsTotal;
  };

  const timeAgo = (dateStr: string, isPayment = false) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    // For payments, always show date/time, never timer
    if (isPayment) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // For orders, show timer for recent events
    if (seconds < 60) return tempFormatDigitalTime(seconds);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getOrderStyle = (initiatedBy: string) => {
    if (initiatedBy === 'staff') {
      return {
        borderColor: 'border-l-4 border-l-blue-500',
        bgColor: 'bg-blue-50',
        icon: <UserCog size={16} className="text-blue-600" />,
        label: 'Staff Order',
        labelColor: 'text-blue-700 bg-blue-100'
      };
    }
    return {
      borderColor: 'border-l-4 border-l-green-500',
      bgColor: 'bg-green-50',
      icon: <User size={16} className="text-green-600" />,
      label: 'Customer Order',
      labelColor: 'text-green-700 bg-green-100'
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Loading tab...</p>
        </div>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Tab not found</p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium"
          >
            Back to Tabs
          </button>
        </div>
      </div>
    );
  }

  const balance = getTabBalance();
  const ordersTotal = tab.orders?.filter((order: any) => order.status === 'confirmed')
    .reduce((sum: number, order: any) => sum + parseFloat(order.total), 0) || 0;
  const paymentsTotal = tab.payments?.filter((p: any) => p.status === 'success')
    .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Main container with responsive width */}
      <div className="w-full lg:max-w-[70%] max-w-full">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
            >
              <ArrowRight size={24} className="transform rotate-180" />
            </button>
            <button 
              onClick={loadTabData}
              className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
            >
              <RefreshCw size={24} />
            </button>
          </div>
          
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">{displayName}</h1>
              <p className="text-orange-100">{tab.bar?.name || 'Bar'}</p>
              <p className="text-sm text-orange-100 mt-1">Opened {timeAgo(tab.opened_at)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              tab.status === 'open' ? 'bg-green-500' :
              tab.status === 'closing' ? 'bg-yellow-500' :
              tab.status === 'overdue' ? 'bg-red-500' :
              'bg-gray-500'
            }`}>
              {tab.status.toUpperCase()}
            </span>
          </div>

          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-orange-100">Total Orders</span>
              <span className="font-semibold">{tempFormatCurrency(ordersTotal)}</span>
            </div>
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-orange-100">Payments</span>
              <span className="font-semibold">- {tempFormatCurrency(paymentsTotal)}</span>
            </div>
            <div className="border-t border-white border-opacity-30 my-2"></div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">Balance</span>
              <span className={`text-2xl font-bold ${balance > 0 ? '' : 'text-green-300'}`}>
                {tempFormatCurrency(balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Add this notification banner after line 226 (after the header div) */}
        {newOrderNotification && (
          <div className="bg-green-500 text-white p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <Plus size={20} />
                </div>
                <div>
                  <p className="font-bold">New Customer Order!</p>
                  <p className="text-sm opacity-90">
                    {/* Fixed error handling for items */}
                    {(() => {
                      try {
                        const items = typeof newOrderNotification.items === 'string' 
                          ? JSON.parse(newOrderNotification.items) 
                          : newOrderNotification.items;
                        return Array.isArray(items) ? items.length : 0;
                      } catch (e) {
                        console.error('Error parsing items:', e);
                        return 0;
                      }
                    })()} items • 
                    {tempFormatCurrency(newOrderNotification.total)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMarkServed(newOrderNotification.id, newOrderNotification.initiated_by)}
                  className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => setNewOrderNotification(null)}
                  className="bg-white bg-opacity-20 px-4 py-2 rounded-lg font-semibold hover:bg-opacity-30"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">Orders</h2>
            <button
              onClick={() => router.push(`/tabs/${tabId}/add-order`)}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600"
            >
              <Plus size={20} />
              Add Order
            </button>
          </div>
          
          <div className="space-y-3 mb-6">
            {(!tab.orders || tab.orders.length === 0) ? (
              <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              tab.orders.map((order: any) => {
                const orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                const initiatedBy = order.initiated_by || 'customer';
                const orderStyle = getOrderStyle(initiatedBy);
                
                return (
                  <div key={order.id} className={`bg-white rounded-xl p-4 shadow-sm ${orderStyle.borderColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {orderStyle.icon}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${orderStyle.labelColor}`}>
                          {orderStyle.label}
                        </span>
                      </div>
                      <div className="text-right">
                        {order.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">
                            <Clock size={12} />
                            {initiatedBy === 'staff' ? 'Awaiting Customer' : 'Pending'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                            <CheckCircle size={12} />
                            Served
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="space-y-1 mb-2">
                          {orderItems.map((item: any, idx: number) => (
                            <p key={idx} className="text-sm text-gray-700">
                              {item.quantity}x {item.name}
                            </p>
                          ))}
                        </div>
                        <p className="text-sm text-gray-500">{timeAgo(order.created_at)}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-orange-600">{tempFormatCurrency(order.total)}</p>
                      </div>
                    </div>
                    
                    {order.status === 'pending' && (
                      <>
                        {initiatedBy === 'customer' ? (
                          <button
                            onClick={() => handleMarkServed(order.id, initiatedBy)}
                            className="w-full bg-green-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-600"
                          >
                            Mark as Served
                          </button>
                        ) : (
                          <div className="w-full bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium text-center">
                            ⏳ Waiting for customer approval
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">Payments</h2>
              <button
                onClick={handleAddCashPayment}
                className="text-sm text-orange-600 font-medium"
              >
                + Add Cash
              </button>
            </div>
            
            {(!tab.payments || tab.payments.length === 0) ? (
              <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                <Wallet size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No payments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tab.payments.map((payment: any) => (
                  <div key={payment.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {payment.method === 'mpesa' ? (
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Phone size={20} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Wallet size={20} className="text-blue-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 capitalize">{payment.method}</p>
                        <p className="text-sm text-gray-500">{timeAgo(payment.created_at, true)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600">+ {tempFormatCurrency(payment.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pb-6">
            <button
              onClick={handleCloseTab}
              className={`w-full py-4 rounded-xl font-semibold ${
                balance === 0 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {balance === 0 ? 'Close Tab' : `Push to Overdue (${tempFormatCurrency(balance)})`}
            </button>
            
            <button className="w-full bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300">
              Transfer Tab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}