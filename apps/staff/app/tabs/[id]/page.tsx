// apps/staff/app/tabs/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, Clock, CheckCircle, Phone, Wallet, Plus, RefreshCw, User, UserCog, ShoppingCart, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Temporary format functions
const tempFormatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  type: 'catalog' | 'custom';
  product_id?: string;
}

export default function TabDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  
  const [tab, setTab] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [newOrderNotification, setNewOrderNotification] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const storedCart = localStorage.getItem(`tab_cart_${tabId}`);
    if (storedCart) {
      try {
        const items = JSON.parse(storedCart);
        console.log('📦 Loading cart from localStorage:', items);
        setCartItems(items);
      } catch (e) {
        console.error('Error loading cart from localStorage:', e);
      }
    }
  }, [tabId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cartItems.length > 0) {
      localStorage.setItem(`tab_cart_${tabId}`, JSON.stringify(cartItems));
    } else {
      localStorage.removeItem(`tab_cart_${tabId}`);
    }
  }, [cartItems, tabId]);

  useEffect(() => {
    loadTabData();
    loadCartFromSession();
  }, [tabId]);

  // Expose addToCart to child windows
  useEffect(() => {
    // @ts-ignore
    window.addToCart = (item: CartItem) => {
      addToCart(item);
    };
  }, []);

  // Real-time timer for pending orders
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!tabId) return;

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
          if (payload.new.initiated_by === 'customer') {
            setNewOrderNotification(payload.new);
            
            setTimeout(() => {
              setNewOrderNotification(null);
            }, 10000);
          }
          
          loadTabData();
        }
      )
      .subscribe();

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
          loadTabData();
        }
      )
      .subscribe();

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
          if (payload.new?.status === 'closed' && payload.old?.status !== 'closed') {
            alert('⚠️ Tab was automatically closed!');
          }
          
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
      const { data: tabData, error: tabError } = await supabase
        .from('tabs')
        .select('*')
        .eq('id', tabId)
        .single();

      if (tabError) throw tabError;

      const { data: barData, error: barError } = await supabase
        .from('bars')
        .select('id, name, location')
        .eq('id', tabData.bar_id)
        .single();

      if (barError) throw barError;

      const { data: ordersResult, error: ordersError } = await supabase
        .from('tab_orders')
        .select('*')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

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

  const loadCartFromSession = () => {
    const stored = sessionStorage.getItem('tab_cart_items');
    if (stored) {
      try {
        const items = JSON.parse(stored);
        console.log('📥 Loading items from session storage:', items);
        
        // Instead of replacing, APPEND to existing cart
        setCartItems(prev => {
          const mergedItems = [...prev];
          
          items.forEach((newItem: CartItem) => {
            // Generate a truly unique ID for each new item
            const uniqueItem = {
              ...newItem,
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
            };
            mergedItems.push(uniqueItem);
          });
          
          console.log('🛒 Merged cart items:', mergedItems);
          return mergedItems;
        });
        
        // Clear session storage after loading
        sessionStorage.removeItem('tab_cart_items');
      } catch (e) {
        console.error('Error loading cart from session:', e);
      }
    }
  };

  const addToCart = (item: CartItem) => {
    console.log('➕ Adding item to cart:', item);
    
    setCartItems(prev => {
      // Create a truly unique ID for this item
      const uniqueItem = {
        ...item,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
      };
      
      console.log('🛒 Previous cart items:', prev);
      console.log('🆕 New item with unique ID:', uniqueItem);
      
      // Simply add the new item to the array
      const newCart = [...prev, uniqueItem];
      console.log('✅ Updated cart items:', newCart);
      return newCart;
    });
  };

  const updateCartItemQuantity = (id: string, delta: number) => {
    setCartItems(prev => 
      prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const removeCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem(`tab_cart_${tabId}`);
  };

  const getCartTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const submitCartOrder = async () => {
    if (cartItems.length === 0) {
      alert('Please add items to cart first');
      return;
    }

    setSubmittingOrder(true);

    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.type === 'catalog' ? item.product_id : null,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }));

      const total = getCartTotal();

      const { error } = await supabase
        .from('tab_orders')
        .insert({
          tab_id: tabId,
          items: orderItems,
          total: total,
          status: 'pending',
          initiated_by: 'staff'
        });

      if (error) throw error;

      alert('✅ Order sent to customer for approval!');
      clearCart();
      loadTabData();
      
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(`Failed to create order: ${error.message}`);
    } finally {
      setSubmittingOrder(false);
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
        .update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

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

      loadTabData();
      
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Failed to add payment');
    }
  };

  const handleCloseTab = async () => {
    const balance = getTabBalance();
    
    if (balance > 0) {
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
    
    if (isPayment) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (seconds < 60) return `${seconds}s ago`;
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
                    {(() => {
                      try {
                        const items = typeof newOrderNotification.items === 'string' 
                          ? JSON.parse(newOrderNotification.items) 
                          : newOrderNotification.items;
                        return Array.isArray(items) ? items.length : 0;
                      } catch (e) {
                        return 0;
                      }
                    })()} items • {tempFormatCurrency(newOrderNotification.total)}
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
          {/* Order Creation Buttons - Always visible */}
          <div className="flex gap-4 mb-6 justify-center">
            <button
              onClick={() => router.push(`/tabs/${tabId}/quick-order`)}
              className="text-orange-600 font-medium hover:text-orange-700 flex items-center gap-2"
            >
              <Plus size={18} />
              Create Order
            </button>
            <button
              onClick={() => router.push(`/tabs/${tabId}/add-order`)}
              className="text-purple-600 font-medium hover:text-purple-700 flex items-center gap-2"
            >
              <ShoppingCart size={18} />
              Browse Catalog
            </button>
          </div>

          {/* Cart Section */}
          {cartItems.length > 0 && (
            <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingCart size={20} />
                  <div>
                    <h2 className="font-bold text-lg">Current Cart</h2>
                    <p className="text-sm text-orange-100">{cartItems.length} items • {tempFormatCurrency(getCartTotal())}</p>
                  </div>
                </div>
                <button
                  onClick={clearCart}
                  className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${item.type === 'catalog' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                          {item.type === 'catalog' ? 'Catalog' : 'Custom'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{tempFormatCurrency(item.price)} each</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-white border rounded-lg">
                        <button
                          onClick={() => updateCartItemQuantity(item.id, -1)}
                          className="p-2 hover:bg-gray-100"
                        >
                          <X size={16} />
                        </button>
                        <span className="font-bold w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQuantity(item.id, 1)}
                          className="p-2 hover:bg-gray-100"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeCartItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-orange-600">{tempFormatCurrency(getCartTotal())}</p>
                  </div>
                  <button
                    onClick={submitCartOrder}
                    disabled={submittingOrder}
                    className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <CheckCircle size={20} />
                    {submittingOrder ? 'Sending...' : 'Send to Customer'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orders Section */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Recent Orders</h2>
            
            {(!tab.orders || tab.orders.length === 0) ? (
              <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tab.orders.filter((order: any) => order.status !== 'cancelled').map((order: any) => {
                  const initiatedBy = order.initiated_by || 'customer';
                  const orderStyle = getOrderStyle(initiatedBy);
                  const orderNumber = order.order_number || order.id?.substring(0, 8) || 'N/A';
                  
                  let orderItems = [];
                  try {
                    orderItems = typeof order.items === 'string' 
                      ? JSON.parse(order.items) 
                      : order.items;
                  } catch (e) {
                    orderItems = [];
                  }

                  return (
                    <div key={order.id} className={`bg-white rounded-xl p-4 shadow-sm ${orderStyle.borderColor}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {orderStyle.icon}
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${orderStyle.labelColor}`}>
                            {orderStyle.label}
                          </span>
                          <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
                            #{orderNumber}
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
                })}
              </div>
            )}
          </div>

          {/* Payments Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">Payments</h2>
              <button
                onClick={handleAddCashPayment}
                className="text-sm text-orange-600 font-medium"
              >
                + Receive Cash
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

          {/* Action Buttons */}
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