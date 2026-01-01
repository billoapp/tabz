'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Search, X, CreditCard, Clock, CheckCircle, Minus, User, UserCog, ThumbsUp, ChevronDown, ChevronUp, Eye, EyeOff, Phone, CreditCardIcon, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatUtils';

// Temporary format function to bypass import issue
const tempFormatCurrency = (amount: number | string, decimals = 0): string => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return 'KSh 0';
  return `KSh ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)}`;
};

export const dynamic = 'force-dynamic';

// Guard against missing Supabase client during build
if (!supabase) {
  throw new Error('Supabase client not initialized. Check environment variables.');
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url?: string;
}

interface BarProduct {
  id: string;
  bar_id: string;
  product_id: string;
  sale_price: number;
  active: boolean;
  product?: Product;
}

interface Tab {
  id: string;
  status: string;
  bar_id: string;
  tab_number?: string;
  notes?: string;
  bar?: {
    id: string;
    name: string;
    location?: string;
  };
}

export default function MenuPage() {
  const router = useRouter();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('Your Tab');
  const [barName, setBarName] = useState('Loading...');
  const [barProducts, setBarProducts] = useState<BarProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCart, setShowCart] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [menuExpanded, setMenuExpanded] = useState(true);
  const [paymentCollapsed, setPaymentCollapsed] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activePaymentMethod, setActivePaymentMethod] = useState<'mpesa' | 'cards' | 'cash'>('mpesa');
  const loadAttempted = useRef(false);

  // Helper function to get display image with category fallback
  const getDisplayImage = (product: any, categoryName?: string) => {
    if (!product || typeof product !== 'object') return null;
    if (product && product.image_url) {
      return product.image_url;
    }
    const category = categories.find(cat =>
      cat.name === (categoryName || product?.category)
    );
    return category?.image_url || null;
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const ordersRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  // Handle scroll for parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!tab?.id) return;

    console.log('📡 Setting up real-time subscriptions for tab:', tab.id);

    // Subscribe to orders changes
    const ordersSubscription = supabase
      .channel(`tab-orders-${tab.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tab_orders',
          filter: `tab_id=eq.${tab.id}`
        },
        async (payload) => {
          console.log('📦 Real-time order update:', payload);
          // Refresh orders data
          const { data: ordersData, error } = await supabase
            .from('tab_orders')
            .select('*')
            .eq('tab_id', tab.id)
            .order('created_at', { ascending: false });
          
          if (!error && ordersData) {
            setOrders(ordersData);
          }
        }
      )
      .subscribe();

    // Subscribe to payments changes
    const paymentsSubscription = supabase
      .channel(`tab-payments-${tab.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tab_payments',
          filter: `tab_id=eq.${tab.id}`
        },
        async (payload) => {
          console.log('💳 Real-time payment update:', payload);
          // Refresh payments data
          const { data: paymentsData, error } = await supabase
            .from('tab_payments')
            .select('*')
            .eq('tab_id', tab.id)
            .order('created_at', { ascending: false });
          
          if (!error && paymentsData) {
            setPayments(paymentsData);
          }
        }
      )
      .subscribe();

    // Subscribe to tab changes
    const tabSubscription = supabase
      .channel(`tab-${tab.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tabs',
          filter: `id=eq.${tab.id}`
        },
        async (payload) => {
          console.log('📋 Real-time tab update:', payload);
          if (payload.eventType === 'UPDATE') {
            const updatedTab = payload.new as Tab;
            
            if (updatedTab.status === 'closed') {
              console.log('🛑 Tab was closed, redirecting to home');
              sessionStorage.removeItem('currentTab');
              sessionStorage.removeItem('cart');
              router.replace('/');
              return;
            }
            
            const { data: fullTab, error } = await supabase
              .from('tabs')
              .select('*, bar:bars(id, name, location)')
              .eq('id', tab.id)
              .maybeSingle();
            
            if (!error && fullTab) {
              setTab(fullTab as Tab);
              setBarName((fullTab as any).bar?.name || 'Bar');
              
              let name = 'Your Tab';
              if ((fullTab as any).notes) {
                try {
                  const notes = JSON.parse((fullTab as any).notes);
                  name = notes.display_name || `Tab ${(fullTab as any).tab_number || ''}`;
                } catch (e) {
                  name = (fullTab as any).tab_number ? `Tab ${(fullTab as any).tab_number}` : 'Your Tab';
                }
              } else if ((fullTab as any).tab_number) {
                name = `Tab ${(fullTab as any).tab_number}`;
              }
              setDisplayName(name);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up real-time subscriptions');
      ordersSubscription.unsubscribe();
      paymentsSubscription.unsubscribe();
      tabSubscription.unsubscribe();
    };
  }, [tab?.id, router]);

  const toggleMenu = () => {
    setMenuExpanded(!menuExpanded);
  };

  useEffect(() => {
    if (loadAttempted.current) {
      console.log('⏭️ Load already attempted, skipping...');
      return;
    }
    loadAttempted.current = true;
    console.log('🔄 Menu page: Starting loadTabData...');
    loadTabData();
  }, []);

  const loadTabData = async () => {
    console.log('📋 Menu page: loadTabData called');
    await new Promise(resolve => setTimeout(resolve, 100));
    const tabData = sessionStorage.getItem('currentTab');
    console.log('📦 Menu page: Retrieved tab data from sessionStorage:', tabData ? 'Found' : 'Not found');
    if (!tabData) {
      console.error('❌ Menu page: No tab data found in sessionStorage');
      console.log('📦 All sessionStorage keys:', Object.keys(sessionStorage));
      await new Promise(resolve => setTimeout(resolve, 500));
      const retryTabData = sessionStorage.getItem('currentTab');
      if (!retryTabData) {
        console.error('❌ Menu page: Still no tab data after retry, redirecting to home');
        router.replace('/');
        return;
      }
      console.log('✅ Menu page: Found tab data on retry');
    }
    const finalTabData = tabData || sessionStorage.getItem('currentTab');
    let currentTab;
    try {
      currentTab = JSON.parse(finalTabData!);
      console.log('✅ Menu page: Parsed tab data:', currentTab.id);
      if (!currentTab?.id) {
        throw new Error('Invalid tab data - missing ID');
      }
    } catch (error) {
      console.error('❌ Menu page: Invalid session data', error);
      sessionStorage.removeItem('currentTab');
      sessionStorage.removeItem('cart');
      router.replace('/');
      return;
    }
    try {
      console.log('🔍 Menu page: Fetching full tab data from Supabase...');
      const { data: fullTab, error: tabError } = await supabase
        .from('tabs')
        .select('*, bar:bars(id, name, location)')
        .eq('id', currentTab.id)
        .maybeSingle();

      if (tabError) {
        console.error('❌ Menu page: Error fetching tab:', tabError);
        throw tabError;
      }
      if (!fullTab) {
        console.error('❌ Menu page: Tab not found in database');
        sessionStorage.removeItem('currentTab');
        sessionStorage.removeItem('cart');
        router.replace('/');
        return;
      }
      console.log('✅ Menu page: Full tab loaded:', fullTab);
      setTab(fullTab as Tab);
      setBarName((fullTab as any).bar?.name || 'Bar');
      let name = 'Your Tab';
      if ((fullTab as any).notes) {
        try {
          const notes = JSON.parse((fullTab as any).notes);
          name = notes.display_name || `Tab ${(fullTab as any).tab_number || ''}`;
        } catch (e) {
          name = (fullTab as any).tab_number ? `Tab ${(fullTab as any).tab_number}` : 'Your Tab';
        }
      } else if ((fullTab as any).tab_number) {
        name = `Tab ${(fullTab as any).tab_number}`;
      }
      setDisplayName(name);
      if ((fullTab as any).bar?.id) {
        try {
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .order('name');
          if (categoriesError) {
            const { data: retryData, error: retryError } = await supabase
              .from('categories')
              .select('*');
            if (!retryError) {
              setCategories(retryData || []);
            }
          } else {
            setCategories(categoriesData || []);
          }
        } catch (error) {
          console.error('Error loading categories:', error);
        }
        try {
          const { data: barProductsData, error: barProductsError } = await supabase
            .from('bar_products')
            .select('id, bar_id, product_id, custom_product_id, name, description, category, image_url, sale_price, active')
            .eq('bar_id', (fullTab as any).bar.id)
            .eq('active', true);
          if (barProductsError) {
            console.error('Error loading bar products:', barProductsError);
          } else if (barProductsData && barProductsData.length > 0) {
            const transformedProducts = barProductsData.map((bp: any) => ({
              id: bp.id,
              bar_id: bp.bar_id,
              product_id: bp.product_id || bp.custom_product_id,
              sale_price: bp.sale_price,
              active: bp.active,
              product: {
                id: bp.product_id || bp.custom_product_id,
                name: bp.name,
                description: bp.description || '',
                category: bp.category || 'Uncategorized',
                image_url: bp.image_url
              }
            }));
            setBarProducts(transformedProducts as BarProduct[]);
          }
        } catch (error) {
          console.error('Error loading products:', error);
        }
      }
      try {
        const { data: ordersData, error: ordersError } = await supabase
          .from('tab_orders')
          .select('*')
          .eq('tab_id', currentTab.id)
          .order('created_at', { ascending: false });
        if (!ordersError) setOrders(ordersData || []);
      } catch (error) {
        console.error('Error loading orders:', error);
      }
      try {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('tab_payments')
          .select('*')
          .eq('tab_id', currentTab.id)
          .order('created_at', { ascending: false });
        if (!paymentsError) setPayments(paymentsData || []);
      } catch (error) {
        console.error('Error loading payments:', error);
      }
    } catch (error) {
      console.error('Error loading tab:', error);
    } finally {
      setLoading(false);
    }
    getPendingOrderTime();
  };

  const handleCloseTab = async () => {
    try {
      if (!tab) {
        console.error('No tab to close');
        return;
      }

      const { error } = await (supabase as any)
        .from('tabs')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', tab.id);

      if (error) {
        console.error('Error closing tab:', error);
        alert('Failed to close tab');
        return;
      }

      sessionStorage.removeItem('currentTab');
      sessionStorage.removeItem('cart');
      sessionStorage.removeItem('oldestPendingCustomerOrderTime');

      router.replace('/');
    } catch (error) {
      console.error('Error in handleCloseTab:', error);
      alert('An error occurred while closing the tab');
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    setApprovingOrder(orderId);
    try {
      const { error } = await (supabase as any)
        .from('tab_orders')
        .update({ 
          status: 'confirmed', 
          confirmed_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error approving order:', error);
        alert('Failed to approve order');
        return;
      }
    } catch (error) {
      console.error('Error in handleApproveOrder:', error);
      alert('An error occurred while approving the order');
    } finally {
      setApprovingOrder(null);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    setApprovingOrder(orderId);
    try {
      const { error } = await (supabase as any)
        .from('tab_orders')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error rejecting order:', error);
        alert('Failed to reject order');
        return;
      }
    } catch (error) {
      console.error('Error in handleRejectOrder:', error);
      alert('An error occurred while rejecting the order');
    } finally {
      setApprovingOrder(null);
    }
  };

  const categoryOptions = ['All', ...new Set(
    barProducts
      .map(bp => bp.product?.category)
      .filter((cat): cat is string => cat !== undefined && cat !== null && cat.trim() !== '')
  )];

  let filteredProducts = selectedCategory === 'All'
    ? barProducts
    : barProducts.filter(bp => bp.product?.category === selectedCategory);

  if (searchQuery.trim()) {
    filteredProducts = filteredProducts.filter(bp =>
      bp.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const addToCart = (barProduct: BarProduct) => {
    const product = barProduct.product;
    if (!product) return;
    const existing = cart.find(c => c.bar_product_id === barProduct.id);
    const newCart = existing
      ? cart.map(c => c.bar_product_id === barProduct.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...cart, {
        bar_product_id: barProduct.id,
        product_id: barProduct.product_id,
        name: product.name,
        price: barProduct.sale_price,
        category: product.category,
        image_url: product.image_url,
        quantity: 1
      }];
    setCart(newCart);
    sessionStorage.setItem('cart', JSON.stringify(newCart));
  };

  const updateCartQuantity = (barProductId: string, delta: number) => {
    const newCart = cart.map(item => {
      if (item.bar_product_id === barProductId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0);
    setCart(newCart);
    sessionStorage.setItem('cart', JSON.stringify(newCart));
  };

  const confirmOrder = async () => {
    if (cart.length === 0) return;
    setSubmittingOrder(true);
    try {
      const orderItems = cart.map(item => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }));
      const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const orderSubmissionTime = new Date().toISOString();
      
      // ✅ DO NOT SET order_number - let database trigger handle it
      const { error } = await (supabase as any)
        .from('tab_orders')
        .insert({
          tab_id: tab!.id,
          items: orderItems,
          total: cartTotal,
          status: 'pending',
          initiated_by: 'customer'
        });
      if (error) throw error;
      sessionStorage.setItem('oldestPendingCustomerOrderTime', orderSubmissionTime);
      sessionStorage.removeItem('cart');
      setCart([]);
      setShowCart(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(`Failed to create order: ${error.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const processPayment = async () => {
    if (activePaymentMethod === 'cash') {
      alert('Cash payment confirmed. Please wait for staff to confirm.');
      return;
    }
    if (activePaymentMethod === 'mpesa' && (!phoneNumber || !paymentAmount)) {
      alert('Please enter phone number and amount');
      return;
    }
    if (activePaymentMethod === 'cards' && !paymentAmount) {
      alert('Please enter amount');
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from('tab_payments')
        .insert({
          tab_id: tab!.id,
          amount: parseFloat(paymentAmount),
          method: activePaymentMethod,
          status: 'success',
          reference: `PAY${Date.now()}`
        });
      if (error) throw error;
      alert('Payment successful! 🎉');
      setPaymentAmount('');
      setPhoneNumber('');
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const tabTotal = orders.filter(order => order.status === 'confirmed').reduce((sum, order) => sum + parseFloat(order.total), 0);
  const paidTotal = payments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const balance = tabTotal - paidTotal;
  const pendingStaffOrders = orders.filter(o => o.status === 'pending' && o.initiated_by === 'staff').length;

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getPendingOrderTime = () => {
    const pendingCustomerOrders = orders.filter(o => o.status === 'pending' && o.initiated_by === 'customer');
    if (pendingCustomerOrders.length === 0) {
      sessionStorage.removeItem('oldestPendingCustomerOrderTime');
      return null;
    }
    const oldestPendingOrder = pendingCustomerOrders.reduce((oldest, current) => {
      return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
    }, pendingCustomerOrders[0]);
    const storedSubmissionTimeStr = sessionStorage.getItem('oldestPendingCustomerOrderTime');
    let orderTime;
    if (storedSubmissionTimeStr) {
      orderTime = new Date(storedSubmissionTimeStr).getTime();
    } else {
      orderTime = new Date(oldestPendingOrder.created_at).getTime();
      sessionStorage.setItem('oldestPendingCustomerOrderTime', new Date(orderTime).toISOString());
    }
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - orderTime) / 1000);
    return {
      elapsed: elapsedSeconds,
      orderId: oldestPendingOrder.id,
      orderTime: new Date(orderTime).toISOString()
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your tab...</p>
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
            Start New Tab
          </button>
        </div>
      </div>
    );
  }

  const parallaxOffset = scrollY * 0.5;
  
  // ✅ FIXED: Use database order_number directly, no client-side numbering
  const lastOrder = orders[0]; // Most recent order (already sorted desc)
  const lastOrderTotal = lastOrder ? parseFloat(lastOrder.total).toFixed(0) : '0';
  const lastOrderTime = lastOrder ? timeAgo(lastOrder.created_at) : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{displayName}</h1>
            <p className="text-sm text-orange-100">{barName}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 bg-white bg-opacity-20 rounded-lg text-sm">Menu</button>
            <button onClick={() => ordersRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 bg-white bg-opacity-20 rounded-lg text-sm">Orders</button>
            <button onClick={() => paymentRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 bg-white bg-opacity-20 rounded-lg text-sm">Pay</button>
          </div>
        </div>
      </div>

      {/* Pending Staff Orders Alert */}
      {pendingStaffOrders > 0 && (
        <div className="bg-yellow-400 border-b-2 border-yellow-500 p-3 animate-pulse">
          <div className="flex items-center gap-2">
            <UserCog size={20} className="text-yellow-900" />
            <p className="text-sm font-bold text-yellow-900">
              {pendingStaffOrders} order{pendingStaffOrders > 1 ? 's' : ''} need your approval! Scroll to Orders ↓
            </p>
          </div>
        </div>
      )}

      {/* Timer Modal */}
      {(() => {
        const pendingTime = getPendingOrderTime();
        if (!pendingTime) return null;
        const elapsedSeconds = pendingTime.elapsed;
        const maxTimeSeconds = 900;
        const elapsedPercentage = Math.min((elapsedSeconds / maxTimeSeconds) * 100, 100);
        const getStrokeColor = (percentage: number) => {
          if (percentage <= 33) return "url(#gradient-green)";
          else if (percentage <= 66) return "url(#gradient-orange)";
          else return "url(#gradient-red)";
        };
        const circumference = 2 * Math.PI * 45;
        const segmentLength = (elapsedPercentage / 100) * circumference;
        const strokeDasharray = `${segmentLength} ${circumference}`;
        const startOffset = circumference * 0.25;
        const strokeDashoffset = startOffset;
        const strokeColor = getStrokeColor(elapsedPercentage);
        return (
          <div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 flex flex-col items-center justify-center animate-fadeIn">
            <div className="relative" style={{ width: '45vw', height: '45vw', maxWidth: '280px', maxHeight: '280px' }}>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400 to-red-500 opacity-20 animate-pulse-slow"></div>
              <svg className="absolute inset-0 w-full h-full">
                <circle cx="50%" cy="50%" r="45%" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
                <defs>
                  <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                  <linearGradient id="gradient-red" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock size={32} className="text-orange-500 mb-2 animate-pulse" />
                <div className="text-5xl font-bold text-gray-800 animate-pulse-number">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-6 text-center max-w-xs">
              We'll notify you when your order is confirmed!
            </p>
          </div>
        );
      })()}

      {/* Menu Section */}
      <div ref={menuRef} className="bg-white relative overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-red-50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Menu</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {categoryOptions.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === category
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide px-4 pb-4">
            <div className="flex gap-4 pb-4" style={{ paddingLeft: '16px' }}>
              {filteredProducts.map((barProduct, index) => {
                const product = barProduct.product;
                if (!product) return null;
                const displayImage = product ? getDisplayImage(product, product.category) : null;
                return (
                  <div
                    key={barProduct.id}
                    className="flex-shrink-0 w-64"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className="bg-white rounded-lg overflow-hidden border border-gray-100 cursor-pointer transform transition-all hover:scale-105 flex flex-col"
                      onClick={() => addToCart(barProduct)}
                    >
                      <div className="w-full pb-[125%] relative bg-gray-100">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt={product.name || 'Product'}
                            className="absolute inset-0 w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = 'absolute inset-0 flex items-center justify-center text-4xl text-gray-400 font-semibold bg-gradient-to-br from-gray-200 to-gray-300';
                                fallback.textContent = product.category?.charAt(0) || 'P';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-4xl text-gray-400 font-semibold bg-gradient-to-br from-gray-200 to-gray-300">
                            {product.category?.charAt(0) || 'P'}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-medium text-gray-900">{product.name || 'Product'}</h3>
                        <p className="text-xs text-gray-500 mt-1">{tempFormatCurrency(barProduct.sale_price)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Orders Section */}
      <div ref={ordersRef} className="bg-gray-50 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order History</h2>
        {orders.length > 0 && (
          <div className="flex items-center justify-between mb-4 bg-white rounded-lg border border-gray-100 p-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last Order</p>
              <p className="text-2xl font-bold text-gray-900">{tempFormatCurrency(lastOrderTotal)}</p>
              <p className="text-xs text-gray-400 mt-1">{lastOrderTime}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-orange-500">{tempFormatCurrency(tabTotal)}</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-0">
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500"><p>No orders yet</p></div>
          ) : (
            orders.filter(order => order.status !== 'cancelled').map((order, index) => {
              const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
              const initiatedBy = order.initiated_by || 'customer';
              const isStaffOrder = initiatedBy === 'staff';
              const needsApproval = order.status === 'pending' && isStaffOrder;
              
              // ✅ FIXED: Use database order_number directly
              const orderNumber = order.order_number || '?';
              
              return (
                <div key={order.id}>
                  <div className="py-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900">Order #{orderNumber}</span>
                        <span className="text-xs text-gray-400">{timeAgo(order.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{tempFormatCurrency(order.total)}</p>
                    </div>
                    <div className="space-y-1">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <p className="text-xs text-gray-600">{item.quantity}x {item.name}</p>
                          <p className="text-xs text-gray-500">{tempFormatCurrency(item.total)}</p>
                        </div>
                      ))}
                    </div>
                    {needsApproval && (
                      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mt-3">
                        <div className="flex items-start gap-2 mb-3">
                          <UserCog size={20} className="text-yellow-700 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-yellow-900 mb-1">Staff Member Added This Order</p>
                            <p className="text-xs text-yellow-800">Please review and approve or reject</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveOrder(order.id)} disabled={approvingOrder === order.id} className="flex-1 bg-green-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2">
                            <ThumbsUp size={16} />
                            {approvingOrder === order.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button onClick={() => handleRejectOrder(order.id)} disabled={approvingOrder === order.id} className="flex-1 bg-red-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-red-600 disabled:bg-gray-300 flex items-center justify-center gap-2">
                            <X size={16} />
                            {approvingOrder === order.id ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    )}
                    {order.status === 'pending' && !isStaffOrder && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-3">
                        <p className="text-xs text-yellow-700 flex items-center gap-1">
                          <Clock size={12} />
                          Waiting for staff confirmation...
                        </p>
                      </div>
                    )}
                  </div>
                  {index < orders.length - 1 && (
                    <div className="border-b border-gray-100"></div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payment Section */}
      {balance > 0 && (
        <div ref={paymentRef} className="bg-white p-4">
          <div 
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => setPaymentCollapsed(!paymentCollapsed)}
          >
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-600">{tempFormatCurrency(balance)}</span>
              {paymentCollapsed ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronUp size={16} className="text-gray-400" />
              )}
            </div>
          </div>
          
          {!paymentCollapsed && (
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setActivePaymentMethod('mpesa')}
                  className={`px-4 py-2 font-medium text-sm ${activePaymentMethod === 'mpesa'
                      ? 'text-orange-500 border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Phone size={16} />
                    M-Pesa
                  </div>
                </button>
                <button
                  onClick={() => setActivePaymentMethod('cards')}
                  className={`px-4 py-2 font-medium text-sm ${activePaymentMethod === 'cards'
                      ? 'text-orange-500 border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <CreditCardIcon size={16} />
                    Cards
                  </div>
                </button>
                <button
                  onClick={() => setActivePaymentMethod('cash')}
                  className={`px-4 py-2 font-medium text-sm ${activePaymentMethod === 'cash'
                      ? 'text-orange-500 border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} />
                    Cash
                  </div>
                </button>
              </div>
              {activePaymentMethod === 'cards' && (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">VISA</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">•••• 4242</p>
                      <p className="text-xs text-gray-400">Expires 12/26</p>
                    </div>
                  </div>
                  <button className="text-xs text-orange-500 font-medium">Change</button>
                </div>
              )}
              <div className="border-t border-gray-100 pt-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
                  <p className="text-3xl font-bold text-orange-600">{tempFormatCurrency(balance)}</p>
                </div>
                <div className="space-y-4">
                  {activePaymentMethod === 'mpesa' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">M-Pesa Number</label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                          placeholder="0712345678"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Amount to Pay</label>
                        <input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                          placeholder="0"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setPaymentAmount((balance / 2).toFixed(0))}
                            className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium"
                          >
                            Half
                          </button>
                          <button
                            onClick={() => setPaymentAmount(balance.toFixed(0))}
                            className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium"
                          >
                            Full
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  {activePaymentMethod === 'cards' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Amount to Pay</label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                        placeholder="0"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setPaymentAmount((balance / 2).toFixed(0))}
                          className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium"
                        >
                          Half
                        </button>
                        <button
                          onClick={() => setPaymentAmount(balance.toFixed(0))}
                          className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium"
                        >
                          Full
                        </button>
                      </div>
                    </div>
                  )}
                  {activePaymentMethod === 'cash' && (
                    <div className="text-center py-4">
                      <div className="bg-gray-100 rounded-xl p-6 mb-4">
                        <DollarSign size={48} className="mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600">Please request cash payment from staff</p>
                        <p className="text-sm text-gray-500 mt-2">Your payment will be confirmed by the restaurant system</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={processPayment}
                    disabled={
                      (activePaymentMethod === 'mpesa' && (!phoneNumber || !paymentAmount)) ||
                      (activePaymentMethod === 'cards' && !paymentAmount) ||
                      submittingOrder
                    }
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {submittingOrder ? 'Processing...' : 'Pay Now'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {balance === 0 && orders.filter(order => order.status === 'confirmed').length > 0 && (
        <div className="bg-white p-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">All Paid! 🎉</h2>
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-4 text-center">
            <div className="text-5xl mb-3">✓</div>
            <p className="text-lg font-bold text-green-800 mb-2">Your tab is fully paid!</p>
            <p className="text-sm text-gray-600">You can close your tab or continue ordering</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="w-full bg-green-500 text-white py-4 rounded-xl font-semibold hover:bg-green-600 shadow-lg flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} />
              Close My Tab
            </button>
            <button
              onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="w-full bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300"
            >
              Order More Drinks
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            💡 Tip: Close your tab when you're done to avoid confusion on your next visit
          </p>
        </div>
      )}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-3">Close Your Tab?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to close your tab? You'll need to start a new one if you want to order again later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCloseConfirm(false);
                  handleCloseTab();
                }}
                className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600"
              >
                Yes, Close Tab
              </button>
            </div>
          </div>
        </div>
      )}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Your Cart</h3>
              <button onClick={() => setShowCart(false)}><X size={24} /></button>
            </div>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.bar_product_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">
                        {item.category === 'Beer' ? '🍺' :
                          item.category === 'Wine' ? '🍷' :
                            item.category === 'Spirits' ? '🥃' :
                              item.category === 'Cocktails' ? '🍸' :
                                item.category === 'Non-Alcoholic' ? '🥤' : '🍴'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-gray-600">{tempFormatCurrency(item.price)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCartQuantity(item.bar_product_id, -1)} className="bg-gray-100 p-1 rounded"><Minus size={16} /></button>
                    <span className="font-bold w-8 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartQuantity(item.bar_product_id, 1)} className="bg-orange-500 text-white p-1 rounded"><Plus size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between mb-4">
                <span className="font-bold">Total</span>
                <span className="text-xl font-bold text-orange-600">{tempFormatCurrency(cartTotal)}</span>
              </div>
              <button onClick={confirmOrder} disabled={submittingOrder} className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300">
                {submittingOrder ? 'Submitting...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
      {cartCount > 0 && (
        <button onClick={() => setShowCart(true)} className="fixed bottom-6 right-6 bg-orange-500 text-white rounded-full p-4 shadow-lg hover:bg-orange-600 flex items-center gap-2 z-20">
          <ShoppingCart size={24} />
          <span className="font-bold">{cartCount}</span>
          <span className="ml-2 font-bold">{tempFormatCurrency(cartTotal)}</span>
        </button>
      )}
    </div>
  );
}