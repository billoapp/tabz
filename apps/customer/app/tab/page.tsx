// apps/customer/app/tab/page.tsx - DEBUG VERSION
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Clock, CheckCircle, CreditCard, RefreshCw, User, UserCog, ThumbsUp, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function TabPage() {
  const router = useRouter();
  const [tab, setTab] = useState<any>(null);
  const [barName, setBarName] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingOrder, setApprovingOrder] = useState<string | null>(null);

  useEffect(() => {
    loadTabData();
    
    // Auto-refresh every 5 seconds to catch new staff orders
    const interval = setInterval(loadTabData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTabData = async () => {
    setLoading(true);
    
    const tabData = sessionStorage.getItem('currentTab');
    if (!tabData) {
      router.push('/');
      return;
    }

    const currentTab = JSON.parse(tabData);

    try {
      const { data: fullTab, error: tabError } = await (supabase as any)
        .from('tabs')
        .select(`
          *,
          bar:bars(name, location)
        `)
        .eq('id', currentTab.id)
        .single();

      if (tabError) throw tabError;

      setTab(fullTab);
      setBarName(fullTab.bar?.name || 'Bar');

      const { data: ordersData, error: ordersError } = await supabase
        .from('tab_orders')
        .select('*')
        .eq('tab_id', currentTab.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      console.log('✅ Orders loaded:', ordersData);
      
      // 🐛 DEBUG: Log each order's details
      ordersData?.forEach((order: any) => {
        console.log(`📦 Order ${order.id}:`, {
          status: order.status,
          initiated_by: order.initiated_by,
          isStaffOrder: order.initiated_by === 'staff',
          needsApproval: order.status === 'pending' && order.initiated_by === 'staff'
        });
      });
      
      setOrders(ordersData || []);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('tab_payments')
        .select('*')
        .eq('tab_id', currentTab.id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      setPayments(paymentsData || []);

    } catch (error) {
      console.error('Error loading tab:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    console.log('🟢 Approving order:', orderId);
    setApprovingOrder(orderId);
    
    try {
      const { error } = await (supabase as any)
        .from('tab_orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);

      if (error) throw error;

      console.log('✅ Staff order approved by customer');
      await loadTabData();
      
    } catch (error) {
      console.error('Error approving order:', error);
      alert('Failed to approve order. Please try again.');
    } finally {
      setApprovingOrder(null);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const confirmReject = window.confirm('Are you sure you want to reject this order? It will be cancelled.');
    if (!confirmReject) return;

    console.log('🔴 Rejecting order:', orderId);
    setApprovingOrder(orderId);

    try {
      const { error } = await (supabase as any)
        .from('tab_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;

      console.log('✅ Staff order rejected by customer');
      await loadTabData();
      
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order. Please try again.');
    } finally {
      setApprovingOrder(null);
    }
  };

  if (loading || !tab) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto mb-3 text-orange-500 animate-spin" />
          <p className="text-gray-500">Loading your tab...</p>
        </div>
      </div>
    );
  }

  const tabTotal = orders
    .filter(order => order.status === 'confirmed')
    .reduce((sum, order) => sum + parseFloat(order.total), 0);
  const paidTotal = payments
    .filter(payment => payment.status === 'success')
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const balance = tabTotal - paidTotal;

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Count pending staff orders that need approval
  const pendingStaffOrders = orders.filter(
    order => order.status === 'pending' && order.initiated_by === 'staff'
  ).length;

  console.log('🔔 Pending staff orders count:', pendingStaffOrders);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/menu')} className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30">
            <ArrowLeft size={24} />
          </button>
          <button onClick={loadTabData} className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30">
            <RefreshCw size={24} />
          </button>
        </div>
        
        <h1 className="text-2xl font-bold mb-1">Tab #{tab.tab_number}</h1>
        <p className="text-orange-100">{barName}</p>
        
        {/* Alert for pending approvals */}
        {pendingStaffOrders > 0 && (
          <div className="bg-yellow-400 text-yellow-900 rounded-lg p-3 mt-3 flex items-center gap-2 animate-pulse">
            <UserCog size={20} />
            <span className="font-semibold">
              {pendingStaffOrders} order{pendingStaffOrders > 1 ? 's' : ''} need{pendingStaffOrders === 1 ? 's' : ''} your approval!
            </span>
          </div>
        )}
        
        {/* Balance Card */}
        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-orange-100">Total Orders</span>
            <span className="font-semibold">KSh {tabTotal.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-orange-100">Paid</span>
            <span className="font-semibold">KSh {paidTotal.toFixed(0)}</span>
          </div>
          <div className="border-t border-white border-opacity-30 my-2"></div>
          <div className="flex items-center justify-between">
            <span className="font-bold">Balance</span>
            <span className="text-2xl font-bold">KSh {balance.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800">Orders</h2>
          <button 
            onClick={loadTabData}
            className="text-sm text-orange-600 font-medium flex items-center gap-1"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p>No orders yet</p>
            <button 
              onClick={() => router.push('/menu')}
              className="mt-4 text-orange-600 font-semibold"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          orders.map(order => {
            const orderItems = JSON.parse(order.items);
            const initiatedBy = order.initiated_by || 'customer';
            const isStaffOrder = initiatedBy === 'staff';
            const needsApproval = order.status === 'pending' && isStaffOrder;
            
            // 🐛 DEBUG: Log render decision
            console.log(`🎨 Rendering order ${order.id}:`, {
              initiatedBy,
              isStaffOrder,
              status: order.status,
              needsApproval,
              willShowButtons: needsApproval
            });
            
            return (
              <div 
                key={order.id} 
                className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                  isStaffOrder ? 'border-l-blue-500' : 'border-l-green-500'
                } ${needsApproval ? 'ring-2 ring-yellow-400' : ''}`}
              >
                {/* 🐛 DEBUG: Show raw data at top of card */}
                <div className="mb-2 p-2 bg-gray-100 rounded text-xs font-mono">
                  DEBUG: initiated_by={order.initiated_by || 'null'} | status={order.status} | needsApproval={String(needsApproval)}
                </div>

                {/* Header with badges */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Initiator Badge */}
                    {isStaffOrder ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-blue-700 bg-blue-100">
                        <UserCog size={14} />
                        Staff Added
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-green-700 bg-green-100">
                        <User size={14} />
                        Your Order
                      </span>
                    )}
                    
                    {/* Time */}
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} />
                      {timeAgo(order.created_at)}
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  <div>
                    {order.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">
                        <Clock size={12} />
                        {needsApproval ? 'Needs Approval' : 'Pending'}
                      </span>
                    ) : order.status === 'confirmed' ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                        <CheckCircle size={12} />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
                        <X size={12} />
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Order Items */}
                <div className="space-y-2 mb-3">
                  {orderItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.quantity}x {item.name}</span>
                      <span className="text-gray-900 font-medium">KSh {item.total}</span>
                    </div>
                  ))}
                </div>
                
                {/* Total */}
                <div className="border-t pt-2 flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-800">Order Total</span>
                  <span className="font-bold text-orange-600">KSh {parseFloat(order.total).toFixed(0)}</span>
                </div>

                {/* 🐛 DEBUG: Always show this section to test */}
                <div className="mb-3 p-2 bg-purple-100 rounded">
                  <p className="text-xs text-purple-900">
                    Testing: needsApproval = {String(needsApproval)}
                  </p>
                </div>

                {/* APPROVAL SECTION */}
                {needsApproval && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <UserCog size={20} className="text-yellow-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-900 mb-1">
                          Staff Member Added This Order
                        </p>
                        <p className="text-xs text-yellow-800">
                          Please review and approve or reject this order
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveOrder(order.id)}
                        disabled={approvingOrder === order.id}
                        className="flex-1 bg-green-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
                      >
                        <ThumbsUp size={18} />
                        {approvingOrder === order.id ? 'Approving...' : 'Approve Order'}
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.id)}
                        disabled={approvingOrder === order.id}
                        className="flex-1 bg-red-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
                      >
                        <X size={18} />
                        {approvingOrder === order.id ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Regular customer order pending message */}
                {order.status === 'pending' && !isStaffOrder && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-700 flex items-center gap-2">
                      <Clock size={14} />
                      Waiting for staff to confirm your order...
                    </p>
                  </div>
                )}

                {/* Cancelled message */}
                {order.status === 'cancelled' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600 flex items-center gap-2">
                      <X size={14} />
                      This order was cancelled
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pay Button */}
      {balance > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 border-t z-20">
          <button
            onClick={() => router.push('/payment')}
            className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 flex items-center justify-center gap-2 transition"
          >
            <CreditCard size={20} />
            Pay KSh {balance.toFixed(0)}
          </button>
        </div>
      )}
    </div>
  );
}