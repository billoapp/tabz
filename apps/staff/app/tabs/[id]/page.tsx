// apps/staff/app/tabs/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, Clock, CheckCircle, Phone, Wallet, Plus, RefreshCw, User, UserCog, ShoppingCart, Trash2, X, MessageCircle, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { timeAgo as kenyaTimeAgo } from '@/lib/formatUtils';
import { checkTabOverdueStatus } from '@/lib/businessHours';
import { useRealtimeSubscription, ConnectionStatusIndicator } from '@tabeza/shared';

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

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}) => {
  if (!isOpen) return null;

  const typeStyles = {
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const buttonStyles = {
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    danger: 'bg-red-500 hover:bg-red-600',
    info: 'bg-blue-500 hover:bg-blue-600'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full ${typeStyles[type]}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
            <p className="text-gray-600">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-3 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${buttonStyles[type]}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const TabDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const tabId = params.id as string;
  const { showToast } = useToast();
  
  const [tab, setTab] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [newOrderNotification, setNewOrderNotification] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Connection status state
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  
  // Telegram message state
  const [telegramMessages, setTelegramMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Close tab confirmation state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingTab, setClosingTab] = useState(false);
  const [closeTabReason, setCloseTabReason] = useState<'close' | 'overdue'>('close');

  // Optimistic updates state
  const [optimisticOrders, setOptimisticOrders] = useState<Map<string, any>>(new Map());

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
    loadTelegramMessages();
  }, [tabId]);

  const loadTelegramMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('tab_telegram_messages')
        .select('*')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTelegramMessages(data || []);
    } catch (error) {
      console.error('Error loading telegram messages:', error);
    }
  };

  // Expose addToCart to child windows
  useEffect(() => {
    // @ts-ignore
    window.addToCart = (item: CartItem) => {
      addToCart(item);
    };
  }, []);

  // Listen for postMessage from Quick-Order page
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'ADD_TO_CART') {
        console.log('📨 Received ADD_TO_CART message:', event.data.item);
        addToCart(event.data.item);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Real-time timer for pending orders
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const realtimeConfigs = [
    {
      channelName: `tab-orders-${tabId}`,
      table: 'tab_orders',
      filter: `tab_id=eq.${tabId}`,
      event: 'INSERT' as const,
      handler: async (payload: any) => {
        if (payload.new?.initiated_by === 'customer') {
          setNewOrderNotification(payload.new);
          
          setTimeout(() => {
            setNewOrderNotification(null);
          }, 10000);
        }
        
        loadTabData();
      }
    },
    {
      channelName: `tab-payments-${tabId}`,
      table: 'tab_payments',
      filter: `tab_id=eq.${tabId}`,
      event: '*' as const,
      handler: async (payload: any) => {
        loadTabData();
      }
    },
    {
      channelName: `tab-telegram-${tabId}`,
      table: 'tab_telegram_messages',
      filter: `tab_id=eq.${tabId}`,
      event: '*' as const,
      handler: async (payload: any) => {
        console.log('📨 Telegram update in detail page:', payload.eventType);
        loadTelegramMessages();
        
        // Show notification for new customer messages
        if (payload.eventType === 'INSERT' && payload.new?.initiated_by === 'customer') {
          showToast({
            type: 'info',
            title: 'New Customer Message',
            message: payload.new?.message || 'Customer sent a new message'
          });
        }
      }
    },
    {
      channelName: `tab-status-${tabId}`,
      table: 'tabs',
      filter: `id=eq.${tabId}`,
      event: 'UPDATE' as const,
      handler: async (payload: any) => {
        if (payload.new?.status === 'closed' && payload.old?.status !== 'closed') {
          showToast({
            type: 'warning',
            title: 'Tab Closed',
            message: 'This tab was automatically closed'
          });
        }
        
        loadTabData();
      }
    }
  ];

  const { connectionStatus, retryCount, reconnect, isConnected } = useRealtimeSubscription(
    realtimeConfigs,
    [tabId],
    {
      maxRetries: 10,
      retryDelay: [1000, 2000, 5000, 10000, 30000, 60000],
      debounceMs: 300,
      onConnectionChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'retrying') => {
        console.log('📡 Staff app connection status changed:', status);
        // Show connection status indicator when not connected
        if (status === 'connected') {
          setShowConnectionStatus(false);
        } else {
          setShowConnectionStatus(true);
        }
      }
    }
  );

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

      // Check if tab should be marked as overdue based on business hours
      await checkTabOverdueStatus(tabData.id);

    } catch (error) {
      console.error('❌ Error loading tab:', error);
      showToast({
        type: 'error',
        title: 'Failed to Load Tab',
        message: 'Redirecting to dashboard...'
      });
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
        console.log('🔥 Loading items from session storage:', items);
        
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
      showToast({
        type: 'warning',
        title: 'Cart Empty',
        message: 'Please add items to cart first'
      });
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

      showToast({
        type: 'success',
        title: 'Order Sent',
        message: 'Order sent to customer for approval!'
      });
      clearCart();
      loadTabData();
      
    } catch (error: any) {
      console.error('Error creating order:', error);
      showToast({
        type: 'error',
        title: 'Failed to Create New Product',
        message: error.message
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleMarkServed = async (orderId: string, initiatedBy: string) => {
    if (initiatedBy === 'staff') {
      showToast({
        type: 'warning',
        title: 'Cannot Approve',
        message: 'Customer must approve staff-initiated orders'
      });
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
      showToast({
        type: 'error',
        title: 'Failed to Mark Served',
        message: 'Please try again'
      });
    }
  };

  const handleCancelOrder = async (orderId: string, initiatedBy: string) => {
    if (initiatedBy === 'staff') {
      showToast({
        type: 'warning',
        title: 'Cannot Cancel',
        message: 'Customer must cancel staff-initiated orders'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tab_orders')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'staff'
        })
        .eq('id', orderId);

      if (error) throw error;

      showToast({
        type: 'success',
        title: 'Order Cancelled',
        message: 'Customer order has been cancelled'
      });

      loadTabData();
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      showToast({
        type: 'error',
        title: 'Failed to Cancel Order',
        message: 'Please try again'
      });
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
        <div className="text-center p-8 max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Tab Not Found</h2>
          <p className="text-gray-600 mb-6">This tab may have been closed, expired, or is no longer accessible.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600"
          >
            Back to Dashboard
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

  // Calculate pending amounts
  const pendingStaffOrdersTotal = tab.orders
    ?.filter((order: any) => order.status === 'pending' && order.initiated_by === 'staff')
    .reduce((sum: number, order: any) => sum + parseFloat(order.total), 0) || 0;

  const pendingCustomerOrdersTotal = tab.orders
    ?.filter((order: any) => order.status === 'pending' && order.initiated_by === 'customer')
    .reduce((sum: number, order: any) => sum + parseFloat(order.total), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{tab.name}</h1>
              <p className="text-orange-200">{tab.bar?.name || 'Bar'}</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* New Order Notification */}
        {newOrderNotification && (
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 m-4 rounded-xl shadow-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold mb-1">New Order!</h3>
                <p className="text-sm">Customer ordered {tempFormatCurrency(newOrderNotification.total)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCancelOrder(newOrderNotification.id, newOrderNotification.initiated_by)}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600"
                >
                  Cancel
                </button>
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
          <div className="bg-white rounded-xl shadow-sm">
            {/* Orders Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4 p-4 border-b">
                <h2 className="text-lg font-bold text-gray-800">Orders</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock size={16} />
                  <span>Real-time updates enabled</span>
                </div>
              </div>
              
              {(!tab.orders || tab.orders.length === 0) ? (
                <div className="p-6 text-center text-gray-500">
                  <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {tab.orders.map((order: any) => {
                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    const initiatedBy = order.initiated_by || 'customer';
                    const orderStyle = getOrderStyle(initiatedBy);
                    
                    return (
                      <div key={order.id} className={`border rounded-lg p-4 ${orderStyle.borderColor} ${orderStyle.bgColor}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {orderStyle.icon}
                            <span className={`text-xs font-medium px-2 py-1 rounded ${orderStyle.labelColor}`}>
                              {orderStyle.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {order.order_number ? `#${order.order_number}` : ''}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{tempFormatCurrency(order.total)}</p>
                            <p className="text-xs text-gray-500">{timeAgo(order.created_at)}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-1 mb-3">
                          {items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.quantity}x {item.name}</span>
                              <span className="text-gray-500">{tempFormatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded ${
                            order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {order.status === 'confirmed' ? 'Confirmed' :
                             order.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                          </span>
                          
                          {order.status === 'pending' && (
                            <>
                              {initiatedBy === 'customer' ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleCancelOrder(order.id, initiatedBy)}
                                    className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleMarkServed(order.id, initiatedBy)}
                                    className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-600"
                                  >
                                    Mark as Served
                                  </button>
                                </div>
                              ) : (
                                <div className="w-full bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium text-center">
                                  ⏳ Waiting for customer approval
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Cash Payment Button */}
            <div className="p-4 border-t">
              <button
                onClick={() => {
                  const amount = prompt('Enter cash amount:');
                  if (amount && !isNaN(Number(amount))) {
                    // Handle cash payment logic here
                  }
                }}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
              >
                + Add Cash Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabDetailPage;