'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactDOM from 'react-dom/client';
import { ShoppingCart, Plus, Search, X, CreditCard, Clock, CheckCircle, Minus, User, UserCog, ThumbsUp, ChevronDown, ChevronUp, Eye, EyeOff, Phone, CreditCardIcon, DollarSign, MessageCircle, Send, AlertCircle, FileText, ZoomIn, ZoomOut, Maximize2, Package,
  // Food & Drink Icons
  Coffee, Utensils, Pizza, Sandwich, Cookie, IceCream, Apple, Beef, Fish, Wine, Beer, Sunrise, Sunset, Moon, Star, Heart, Flame, Zap, Droplets, Leaf, Wheat, Milk, Egg, ChefHat, Cake, Candy, Popcorn, IceCream2, Glasses, Martini, LayoutGrid } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatUtils';
import { useVibrate } from '@/hooks/useVibrate';
import { useSound } from '@/hooks/useSound';
import { telegramMessageQueries } from '@/lib/telegram-queries';
import { MessageAlert, InitiatedBy } from '../../../../packages/shared/types';
import { TokensService } from '../../../../packages/shared/tokens-service';
import { useRealtimeSubscription, ConnectionStatusIndicator } from '../../../../packages/shared';
import { useToast } from '@/components/ui/Toast';
import { TokenNotifications, useTokenNotifications } from '../../components/TokenNotifications';
import PDFViewer from '../../../../components/PDFViewer'; 
import MessagePanel from './MessagePanel';
import { playCustomerNotification } from '@/lib/notifications'; // ADDED MISSING IMPORT

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
  // Added notification columns
  notifications_enabled?: boolean;
  sound_enabled?: boolean;
  vibration_enabled?: boolean;
  bar?: {
    id: string;
    name: string;
    location?: string;
  };
}

// Define proper types for the response time queries
interface OrderResponseData {
  created_at: string;
  confirmed_at: string;
  status: string;
  initiated_by: string;
}

interface MessageResponseData {
  created_at: string;
  staff_acknowledged_at: string;
  status: string;
  initiated_by: string;
}

export default function MenuPage() {
  const router = useRouter();
  const { buzz } = useVibrate(); 
  const playAcceptanceSound = useSound(); // Use synthetic beep by default
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
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now()); // Add this state for real-time updates
  const [processedOrders, setProcessedOrders] = useState<Set<string>>(new Set()); // Track processed orders for notifications
  const [acceptanceModal, setAcceptanceModal] = useState<{
    show: boolean;
    orderTotal: string;
    message: string;
  }>({ show: false, orderTotal: '', message: '' });

  // Rejection reason modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState<string>('');

  // Debug: Monitor showRejectModal changes
  useEffect(() => {
    console.log('🚫 showRejectModal changed to:', showRejectModal);
  }, [showRejectModal]);

  // Rejection reasons enum (max 3 as requested)
  const rejectionReasons = [
    { value: 'wrong_items', label: 'Wrong items ordered' },
    { value: 'already_ordered', label: 'Already ordered this' },
    { value: 'change_mind', label: 'Changed my mind' }
  ];

  const [activePaymentMethod, setActivePaymentMethod] = useState<'mpesa' | 'cards' | 'cash'>('mpesa');
  const [paymentSettings, setPaymentSettings] = useState({
    mpesa_enabled: true,
    card_enabled: true,
    cash_enabled: true
  });
  const [loadingPaymentSettings, setLoadingPaymentSettings] = useState(true);
  const { showToast } = useToast();
  
  // Token service instance
  const tokensService = new TokensService(supabase);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const { showNotification } = useTokenNotifications();

  // Telegram messaging state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSentModal, setMessageSentModal] = useState(false);
  const [telegramMessages, setTelegramMessages] = useState<any[]>([]);
  const [newMessageAlert, setNewMessageAlert] = useState<any>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [showMessagePanel, setShowMessagePanel] = useState(false);
  
  // Static menu states
  const [menuType, setMenuType] = useState<'interactive' | 'static'>('interactive');
  const [staticMenuUrl, setStaticMenuUrl] = useState<string | null>(null);
  const [staticMenuType, setStaticMenuType] = useState<'pdf' | 'image' | 'slideshow' | null>(null);
  const [showStaticMenu, setShowStaticMenu] = useState(false); // Start collapsed by default
  const [imageScale, setImageScale] = useState(1);

  // Slideshow state for static slideshows
  const [slideshowImages, setSlideshowImages] = useState<string[]>([]);
  // Slideshow settings are read from the DB schema when present; no default transitionSpeed assumed
  const [slideshowSettings, setSlideshowSettings] = useState<Record<string, any> | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);

  // FIVE COLLAPSIBLE SECTIONS - food menu starts open, others closed
  const [foodMenuCollapsed, setFoodMenuCollapsed] = useState(false); // Start open
  const [drinksMenuCollapsed, setDrinksMenuCollapsed] = useState(true);
  const [cartCollapsed, setCartCollapsed] = useState(true);
  const [paymentCollapsed, setPaymentCollapsed] = useState(true);

  // NEW: Average response time state
  const [averageResponseTime, setAverageResponseTime] = useState<number | null>(null);
  const [responseTimeLoading, setResponseTimeLoading] = useState(false);

  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  
  // Not cold preferences for drinks
  const [notColdPreferences, setNotColdPreferences] = useState<Record<string | number, boolean>>({});
  
  // Define drink categories that support "not cold" preference
  const drinkCategories = ['Beer & Cider', 'Wine & Champagne', 'Spirits', 'Liqueurs & Specialty', 'Non-Alcoholic'];

  const loadAttempted = useRef(false);

  // Helper function to get display image - product image only, fallback to icon
  const getDisplayImage = (product: any) => {
    if (!product || typeof product !== 'object') return null;
    
    // Only check if product has its own image
    if (product.image_url) {
      console.log('📸 Customer using product image:', product.image_url);
      return product.image_url;
    }
    
    console.log('❌ Customer no product image found, will use category icon for:', product.category);
    return null;
  };

  // Helper function to get icon for category based on final category list
  const getCategoryIcon = (categoryName: string) => {
    const category = categoryName.toLowerCase();
    
    // Debug logging
    console.log('🔍 Customer getCategoryIcon called with:', categoryName);
    
    // DRINKS CATEGORIES
    if (category.includes('beer & cider') || category.includes('beer') || category.includes('cider')) {
      console.log('🍺 Customer returning Beer icon for:', categoryName);
      return Beer;
    }
    if (category.includes('wine & champagne') || category.includes('wine') || category.includes('champagne')) {
      console.log('🍷 Customer returning Wine icon for:', categoryName);
      return Wine;
    }
    if (category.includes('spirits') || category.includes('whiskey') || category.includes('gin') || category.includes('vodka') || category.includes('rum') || category.includes('tequila')) {
      console.log('🥃 Customer returning Glasses icon for:', categoryName);
      return Glasses;
    }
    if (category.includes('liqueurs & specialty') || category.includes('liqueur') || category.includes('brandy') || category.includes('cocktail')) {
      console.log('🍸 Customer returning Martini icon for:', categoryName);
      return Martini;
    }
    if (category.includes('non-alcoholic') || category.includes('soft drink') || category.includes('juice') || category.includes('water') || category.includes('energy') || category.includes('coffee') || category.includes('tea')) {
      console.log('🥤 Customer returning Droplets icon for:', categoryName);
      return Droplets;
    }
    
    // FOOD CATEGORIES
    if (category.includes('pizza')) {
      console.log('🍕 Customer returning Pizza icon for:', categoryName);
      return Pizza;
    }
    if (category.includes('bbq') || category.includes('choma') || category.includes('grill')) {
      console.log('🔥 Customer returning Flame icon for:', categoryName);
      return Flame;
    }
    if (category.includes('starters') || category.includes('appetizers') || category.includes('salad')) {
      console.log('🥗 Customer returning Leaf icon for:', categoryName);
      return Leaf;
    }
    if (category.includes('main courses') || category.includes('main') || category.includes('meal') || category.includes('dish')) {
      console.log('🍽️ Customer returning Utensils icon for:', categoryName);
      return Utensils;
    }
    if (category.includes('side dishes') || category.includes('side') || category.includes('accompaniment')) {
      console.log('🍚 Customer returning Wheat icon for:', categoryName);
      return Wheat;
    }
    if (category.includes('bakery') || category.includes('breakfast') || category.includes('bread') || category.includes('egg')) {
      console.log('🍳 Customer returning Egg icon for:', categoryName);
      return Egg;
    }
    if (category.includes('desserts') || category.includes('snacks') || category.includes('cake') || category.includes('ice cream') || category.includes('popcorn')) {
      console.log('🍰 Customer returning Cake icon for:', categoryName);
      return Cake;
    }
    if (category.includes('convenience') || category.includes('other') || category.includes('traditional') || category.includes('smoking') || category.includes('tobacco') || category.includes('vape')) {
      console.log('📦 Customer returning Package icon for:', categoryName);
      return Package;
    }
    
    // Default
    console.log('📦 Customer returning default LayoutGrid icon for:', categoryName);
    return LayoutGrid;
  };

  // Helper function to check if an item is a drink
  const isDrinkItem = (item: any): boolean => {
    return item.category ? drinkCategories.includes(item.category) : false;
  };

  // Helper function to check if a product is a drink
  const isDrinkProduct = (product: any): boolean => {
    if (!product?.category) return false;
    return drinkCategories.includes(product.category);
  };

  // Helper function to check if a product is food
  const isFoodProduct = (product: any): boolean => {
    if (!product?.category) return false;
    return !drinkCategories.includes(product.category);
  };

  // Toggle not cold preference
  const toggleNotCold = (itemId: string | number) => {
    setNotColdPreferences(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const foodMenuRef = useRef<HTMLDivElement>(null);
  const drinksMenuRef = useRef<HTMLDivElement>(null);
  const ordersRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  // Timer for real-time updates - FIX: Add this useEffect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Handle scroll for parallax effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load cart from sessionStorage on component mount
  useEffect(() => {
    const cartData = sessionStorage.getItem('cart');
    if (cartData) {
      try {
        setCart(JSON.parse(cartData));
        console.log('🛒 Cart loaded from sessionStorage:', JSON.parse(cartData));
      } catch (error) {
        console.error('Error parsing cart data:', error);
        setCart([]);
      }
    }
  }, []);

  // Load user's token balance
  useEffect(() => {
    const loadTokenBalance = async () => {
      console.log('🪙 Loading token balance...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('👤 User found for token balance:', user.id);
        const balance = await tokensService.getBalance(user.id);
        console.log('💰 Token balance result:', balance);
        setCurrentBalance(balance?.balance || 0);
        console.log('🪙 Set token balance to:', balance?.balance || 0);
      } else {
        console.log('❌ No user found for token balance');
      }
    };

    loadTokenBalance();
  }, [tab?.id]);

  // NEW: Function to calculate average response time for this bar
  // NEW: Function to calculate average response time for this bar (COPIED FROM STAFF APP)
  // NEW: Function to calculate average response time for this bar (COPIED FROM STAFF APP)
  const calculateAverageResponseTime = async (barId: string) => {
    console.log('🔍 [CUSTOMER] Starting response time calculation for bar:', barId);
    setResponseTimeLoading(true);
    try {
      // Get all tabs for this bar with their orders and messages (SAME AS STAFF APP)
      const { data: tabsData, error: tabsError } = await supabase
        .from('tabs')
        .select(`
          id,
          orders:tab_orders(id, status, created_at, confirmed_at, initiated_by),
          messages:tab_telegram_messages(id, status, created_at, staff_acknowledged_at, initiated_by)
        `)
        .eq('bar_id', barId);
      
      if (tabsError || !tabsData) {
        console.error('❌ [CUSTOMER] Error fetching tabs:', tabsError);
        setAverageResponseTime(null);
        setResponseTimeLoading(false);
        return;
      }
      
      console.log('📋 [CUSTOMER] Loaded tabs with data:', tabsData.length);
      
      // Get confirmed orders (order placed → confirmed) - only customer-initiated orders
      const confirmedOrders = (tabsData as any[]).flatMap((tab: any) => 
        (tab.orders || []).filter((o: any) => 
          o.status === 'confirmed' && 
          o.confirmed_at && 
          o.created_at &&
          o.initiated_by === 'customer'
        )
      );
      
      console.log('📦 [CUSTOMER] Found confirmed customer orders:', confirmedOrders.length);
      
      // Calculate order response times (in minutes)
      const orderResponseTimes = confirmedOrders.map((order: any) => {
        const created = new Date(order.created_at).getTime();
        const confirmed = new Date(order.confirmed_at).getTime();
        const timeInMinutes = (confirmed - created) / (1000 * 60);
        console.log('⏱️ [CUSTOMER] Order response time:', timeInMinutes.toFixed(1), 'minutes');
        return timeInMinutes;
      });
      
      // Get acknowledged customer messages (message sent → staff acknowledged)
      const acknowledgedMessages = (tabsData as any[]).flatMap((tab: any) => 
        (tab.messages || []).filter((m: any) => 
          m.status === 'acknowledged' && 
          m.staff_acknowledged_at && 
          m.created_at &&
          m.initiated_by === 'customer'
        )
      );
      
      console.log('💬 [CUSTOMER] Found acknowledged customer messages:', acknowledgedMessages.length);
      
      // Calculate message response times (in minutes)
      const messageResponseTimes = acknowledgedMessages.map((message: any) => {
        const created = new Date(message.created_at).getTime();
        const acknowledged = new Date(message.staff_acknowledged_at).getTime();
        const timeInMinutes = (acknowledged - created) / (1000 * 60);
        console.log('⏱️ [CUSTOMER] Message response time:', timeInMinutes.toFixed(1), 'minutes');
        return timeInMinutes;
      });
      
      // Combine all response times
      const allResponseTimes = [...orderResponseTimes, ...messageResponseTimes];
      
      console.log('📊 [CUSTOMER] Total response times:', allResponseTimes.length);
      
      if (allResponseTimes.length === 0) {
        console.log('❌ [CUSTOMER] No response time data available');
        setAverageResponseTime(null);
        setResponseTimeLoading(false);
        return;
      }
      
      const avgMinutes = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
      const roundedAvg = Math.round(avgMinutes);
      setAverageResponseTime(roundedAvg);
      
      console.log('✅ [CUSTOMER] Average response time calculated:', {
        average: roundedAvg + ' minutes',
        totalSamples: allResponseTimes.length,
        fromOrders: orderResponseTimes.length,
        fromMessages: messageResponseTimes.length
      });
    } catch (error) {
      console.error('[CUSTOMER] Error calculating average response time:', error);
      setAverageResponseTime(null);
    } finally {
      setResponseTimeLoading(false);
    }
  };
  
  // Load average response time when tab is loaded
  useEffect(() => {
    if (tab?.bar_id) {
      calculateAverageResponseTime(tab.bar_id);
    }
  }, [tab?.bar_id]);

  // Customer notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState({
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true
  });

  // Load notification preferences when tab loads - FIXED VERSION
  // Load notification preferences when tab loads - FIXED VERSION
  const loadNotificationPrefs = async () => {
    if (!tab) return;
    
    try {
      // Only query columns that exist in the database
      const { data, error } = await supabase
        .from('tabs')
        .select('sound_enabled, vibration_enabled, notes')
        .eq('id', tab.id)
        .single();
      
      if (error) {
        console.error('Error loading notification preferences:', error);
        // Use defaults on error
        setNotificationPrefs({
          notificationsEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true
        });
        return;
      }
      
      // Type assertion to handle the data
      const tabData = data as {
        sound_enabled?: boolean;
        vibration_enabled?: boolean;
        notes?: string;
      };
      
      if (!tabData) {
        // Use defaults if no data
        setNotificationPrefs({
          notificationsEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true
        });
        return;
      }
      
      // Extract values from database columns
      const soundEnabled = tabData.sound_enabled ?? true;
      const vibrationEnabled = tabData.vibration_enabled ?? true;
      
      // For notifications_enabled, we need to check if both sound AND vibration are enabled
      // or check in notes, or default to true
      let notificationsEnabled = true;
      
      if (tabData.notes) {
        try {
          const notes = JSON.parse(tabData.notes);
          // Check if notifications_enabled exists in notes (legacy storage)
          if (typeof notes.notifications_enabled !== 'undefined') {
            notificationsEnabled = notes.notifications_enabled;
          } else {
            // If not in notes, determine based on sound and vibration
            notificationsEnabled = soundEnabled || vibrationEnabled;
          }
        } catch (e) {
          // If JSON parse fails, determine based on sound and vibration
          notificationsEnabled = soundEnabled || vibrationEnabled;
        }
      } else {
        // No notes, determine based on sound and vibration
        notificationsEnabled = soundEnabled || vibrationEnabled;
      }
      
      setNotificationPrefs({
        notificationsEnabled,
        soundEnabled,
        vibrationEnabled
      });
      
      console.log('🔔 Loaded notification preferences:', {
        notificationsEnabled,
        soundEnabled,
        vibrationEnabled,
        fromNotes: !!tabData.notes
      });
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      // Use defaults on error
      setNotificationPrefs({
        notificationsEnabled: true,
        soundEnabled: true,
        vibrationEnabled: true
      });
    }
  };

  // Load notification preferences when tab loads
  useEffect(() => {
    if (tab?.id) {
      loadNotificationPrefs();
    }
  }, [tab?.id]);

  // Set up real-time subscriptions with improved error handling and debouncing
  const realtimeConfigs = [
    {
      channelName: `tab-${tab?.id}`,
      table: 'tab_orders',
      filter: tab?.id ? `tab_id=eq.${tab.id}` : undefined,
      event: '*' as const,
      handler: async (payload: any) => {
        console.log('📦 Real-time order update received:', payload);
        console.log('📊 Payload details:', {
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
          table: payload.table,
          schema: payload.schema
        });
        
        // Check if customer approved a staff order (NEW)
        const isCustomerApproval = (
          (payload.new?.status === 'confirmed' && 
           payload.old?.status === 'pending' && 
           payload.new?.initiated_by === 'staff')
        );
        
        console.log('👤 Is customer approval?', isCustomerApproval);
        console.log('📋 Processed orders:', Array.from(processedOrders));
        
        if (isCustomerApproval && !processedOrders.has(payload.new.id)) {
          console.log('✅ Customer approved staff order:', payload.new.id);
          
          // Mark this order as processed to avoid duplicate notifications
          setProcessedOrders(prev => new Set([...prev, payload.new.id]));
          
          // Show success feedback
          showToast({
            type: 'success',
            title: 'Order Approved!',
            message: 'Staff order has been approved and will be prepared'
          });
          
          // Close rejection modal if open
          setShowRejectModal(false);
          
          // Refresh orders data
          await loadTabData();
        }
        
        // Check if customer rejected a staff order (NEW)
        const isCustomerRejection = (
          (payload.new?.status === 'cancelled' && 
           payload.old?.status === 'pending' && 
           payload.new?.initiated_by === 'staff' &&
           payload.new?.cancelled_by === 'customer')
        );
        
        if (isCustomerRejection && !processedOrders.has(payload.new.id)) {
          console.log('❌ Customer rejected staff order:', payload.new.id);
          
          // Mark this order as processed to avoid duplicate notifications
          setProcessedOrders(prev => new Set([...prev, payload.new.id]));
          
          // Show rejection feedback
          showToast({
            type: 'info',
            title: 'Order Rejected',
            message: 'Staff order has been rejected'
          });
          
          // Close rejection modal if open
          setShowRejectModal(false);
          
          // Refresh orders data
          await loadTabData();
        }
        
        // Check if staff accepted an order (multiple scenarios)
        const isStaffAcceptance = (
          // Scenario 1: pending -> confirmed (staff accepts customer order)
          (payload.new?.status === 'confirmed' && 
           payload.old?.status === 'pending' && 
           payload.new?.initiated_by === 'customer') ||
          // Scenario 2: Any change to confirmed status for customer orders
          (payload.new?.status === 'confirmed' && 
           payload.new?.initiated_by === 'customer' && 
           payload.old?.status !== 'confirmed')
        );
        
        // Check if order was served/completed (for notification purposes only)
        const isOrderCompleted = (
          (payload.new?.status === 'served' || payload.new?.status === 'completed') &&
          payload.old?.status !== 'served' && payload.old?.status !== 'completed'
        );
        
        console.log('🤖 Is staff acceptance?', isStaffAcceptance);
        console.log('📋 Processed orders:', Array.from(processedOrders));
        
        if (isStaffAcceptance && !processedOrders.has(payload.new.id)) {
          console.log('🎉 Staff accepted order:', payload.new.id);
          
          // Mark this order as processed to avoid duplicate notifications
          setProcessedOrders(prev => new Set([...prev, payload.new.id]));
          
          console.log('🔔 Showing acceptance modal with notifications...');
          
          // Trigger vibration and sound
          buzz([200, 100, 200]); // Vibration pattern: buzz-pause-buzz
          playAcceptanceSound(); // Play acceptance sound
          
          // Show modal instead of toast
          setAcceptanceModal({
            show: true,
            orderTotal: payload.new.total, // Pass the number, not formatted string
            message: 'Your order has been accepted and is being prepared'
          });
        } else if (isOrderCompleted && !processedOrders.has(payload.new.id)) {
          console.log('✅ Order completed:', payload.new.id);
          
          // Mark this order as processed to avoid duplicate notifications
          setProcessedOrders(prev => new Set([...prev, payload.new.id]));
        } else {
          console.log('❌ Not showing modal - conditions not met:', {
            isStaffAcceptance,
            alreadyProcessed: processedOrders.has(payload.new?.id),
            orderId: payload.new?.id
          });
        }
        
        // Refresh orders data
        const { data: ordersData, error } = await supabase
          .from('tab_orders')
          .select('*')
          .eq('tab_id', tab?.id || '')
          .order('created_at', { ascending: false });
        
        if (!error && ordersData) {
          setOrders(ordersData);
        }
      }
    },
    {
      channelName: `tab-${tab?.id}`,
      table: 'tabs',
      filter: tab?.id ? `id=eq.${tab.id}` : undefined,
      event: '*' as const,
      handler: async (payload: any) => {
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
            .eq('id', tab?.id || '')
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
    },
    {
      channelName: `tab-${tab?.id}`,
      table: 'tab_payments',
      filter: tab?.id ? `tab_id=eq.${tab.id}` : undefined,
      event: '*' as const,
      handler: async (payload: any) => {
        console.log('💳 Real-time payment update:', payload);
        
        // Show token notification for successful payments
        if (payload.eventType === 'INSERT' && 
            payload.new?.status === 'success') {
          
          // Award tokens for order value
          const { data: { user } } = await supabase.auth.getUser();
          if (user && tab?.bar_id) {
            const orderValue = Math.round(parseFloat(payload.new.amount) * 100); // Convert to cents
            
            try {
              const result = await tokensService.awardOrderTokens(
                user.id,
                tab.bar_id,
                payload.new.id, // payment ID
                orderValue
              );
              
              if (result.success && result.tokensAwarded) {
                console.log('🎉 Tokens awarded successfully:', result.tokensAwarded);
                showNotification({
                  type: 'earned',
                  title: 'Tokens Earned!',
                  message: `🎉 +${result.tokensAwarded} tokens earned from your payment!`,
                  amount: result.tokensAwarded,
                  autoHide: 5000, // Auto-hide after 5 seconds
                  timestamp: new Date().toISOString()
                });
                
                // Refresh token balance immediately
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  const balance = await tokensService.getBalance(user.id);
                  setCurrentBalance(balance?.balance || 0);
                  console.log('🪙 Updated token balance:', balance?.balance || 0);
                }
              } else {
                console.log('❌ Token awarding failed:', result);
              }
            } catch (error) {
              console.error('Error awarding tokens for payment:', error);
            }
          }
        }
        
        // Refresh payments data
        const { data: paymentsData, error: paymentError } = await supabase
          .from('tab_payments')
          .select('*')
          .eq('tab_id', tab?.id || '')
          .order('created_at', { ascending: false });
        
        if (!paymentError && paymentsData) {
          setPayments(paymentsData);
        }
      }
    },
    {
      channelName: `tab-${tab?.id}`,
      table: 'tab_telegram_messages',
      filter: tab?.id ? `tab_id=eq.${tab.id}` : undefined,
      event: '*' as const,
      handler: async (payload: any) => {
        console.log('📩 Telegram message real-time update:', {
          event: payload.eventType,
          new: payload.new,
          old: payload.old
        });
        
        // Refresh messages
        const { data: messages, error } = await supabase
          .from('tab_telegram_messages')
          .select('*')
          .eq('tab_id', tab?.id || '')
          .order('created_at', { ascending: false });
        
        if (!error && messages) {
          setTelegramMessages(messages);
          
          // Calculate and update unread messages count
          const unreadCount = messages.filter((msg: any) => 
            msg.initiated_by === 'staff' && 
            msg.status === 'pending'
          ).length;
          setUnreadMessagesCount(unreadCount);
          
          // Show notification for new messages (when staff responds)
          if (payload.new?.initiated_by === 'staff' && 
              payload.eventType === 'INSERT') {
            
            // FIXED: Use the imported playCustomerNotification function
            playCustomerNotification(notificationPrefs.soundEnabled, notificationPrefs.vibrationEnabled);
            
            setNewMessageAlert({
              type: 'acknowledged',
              message: 'Staff responded to your message',
              timestamp: new Date().toISOString(),
              messageContent: payload.new.message
            });
            
            setTimeout(() => {
              setNewMessageAlert(null);
            }, 5000);
          }
          
          // Show notification for staff acknowledgments
          if (payload.new?.status === 'acknowledged' && 
              payload.old?.status === 'pending' &&
              payload.new?.staff_acknowledged_at) {
            
            buzz([200, 100, 200]);
            playAcceptanceSound();
            
            setNewMessageAlert({
              type: 'acknowledged',
              message: 'Staff has acknowledged your message',
              timestamp: new Date().toISOString()
            });
            
            setTimeout(() => {
              setNewMessageAlert(null);
            }, 5000);
          }
        }
      }
    }
  ];

  const { connectionStatus, retryCount, reconnect, isConnected } = useRealtimeSubscription(
    realtimeConfigs,
    [tab?.id, router, processedOrders],
    {
      maxRetries: 10,
      retryDelay: [1000, 2000, 5000, 10000, 30000, 60000],
      debounceMs: 300,
      onConnectionChange: (status) => {
        console.log('📡 Connection status changed:', status);
        // Show connection status indicator when not connected
        if (status === 'connected') {
          setShowConnectionStatus(false);
        } else {
          setShowConnectionStatus(true);
        }
      }
    }
  );

  // Image zoom handlers
  const handleImageZoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleImageZoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleImageFitWidth = () => {
    setImageScale(1);
  };

  // Toggle functions for FIVE EXCLUSIVE collapsible sections
  const toggleFoodMenu = () => {
    if (!foodMenuCollapsed) {
      // If already open, just close it
      setFoodMenuCollapsed(true);
    } else {
      // Open food menu, close others
      setFoodMenuCollapsed(false);
      setDrinksMenuCollapsed(true);
      setCartCollapsed(true);
      setPaymentCollapsed(true);
      setShowStaticMenu(false);
    }
  };

  const toggleDrinksMenu = () => {
    if (!drinksMenuCollapsed) {
      // If already open, just close it
      setDrinksMenuCollapsed(true);
    } else {
      // Open drinks menu, close others
      setDrinksMenuCollapsed(false);
      setFoodMenuCollapsed(true);
      setCartCollapsed(true);
      setPaymentCollapsed(true);
      setShowStaticMenu(false);
    }
  };

  // Toggle functions for remaining collapsible sections
  const toggleCart = () => {
    if (!cartCollapsed) {
      // If already open, just close it
      setCartCollapsed(true);
    } else {
      // Open cart, close others
      setCartCollapsed(false);
      setFoodMenuCollapsed(true);
      setDrinksMenuCollapsed(true);
      setPaymentCollapsed(true);
      setShowStaticMenu(false);
    }
  };

  const togglePayment = () => {
    if (!paymentCollapsed) {
      // If already open, just close it
      setPaymentCollapsed(true);
    } else {
      // Open payment, close others
      setPaymentCollapsed(false);
      setFoodMenuCollapsed(true);
      setDrinksMenuCollapsed(true);
      setCartCollapsed(true);
      setShowStaticMenu(false);
    }
  };

  const toggleStaticMenu = () => {
    if (!showStaticMenu) {
      // Opening static menu - close all collapsible sections
      setShowStaticMenu(true);
      setFoodMenuCollapsed(true);
      setDrinksMenuCollapsed(true);
      setCartCollapsed(true);
      setPaymentCollapsed(true);
    } else {
      // Closing static menu - just collapse it
      setShowStaticMenu(false);
    }
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
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - orderTime) / 1000);
    return {
      elapsed: elapsedSeconds,
      orderTime: orderTime,
      submissionTime: new Date(orderTime).toISOString()
    };
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

  // FIXED: Payment settings loading with correct column names
  const loadPaymentSettings = async (barId: string) => {
    try {
      console.log('💳 Loading payment settings for bar:', barId);
      // FIXED: Use correct column names from database
      const { data, error } = await supabase
        .from('bars')
        .select('payment_mpesa_enabled, payment_card_enabled, payment_cash_enabled')
        .eq('id', barId)
        .single();

      if (error) {
        console.error('Error loading payment settings:', error);
        // Use default settings if error
        setPaymentSettings({
          mpesa_enabled: false,
          card_enabled: false,
          cash_enabled: true
        });
      } else if (data) {
        console.log('✅ Payment settings loaded:', data);
        const paymentData = data as {
          payment_mpesa_enabled?: boolean;
          payment_card_enabled?: boolean;
          payment_cash_enabled?: boolean;
        };
        setPaymentSettings({
          mpesa_enabled: paymentData.payment_mpesa_enabled ?? false,
          card_enabled: paymentData.payment_card_enabled ?? false,
          cash_enabled: paymentData.payment_cash_enabled ?? true
        });

        // Set default payment method to first available one
        if (paymentData.payment_mpesa_enabled) {
          setActivePaymentMethod('mpesa');
        } else if (paymentData.payment_card_enabled) {
          setActivePaymentMethod('cards');
        } else if (paymentData.payment_cash_enabled) {
          setActivePaymentMethod('cash');
        }
      }
    } catch (error) {
      console.error('Error in loadPaymentSettings:', error);
      // Use default settings with only cash enabled
      setPaymentSettings({
        mpesa_enabled: false,
        card_enabled: false,
        cash_enabled: true
      });
    } finally {
      setLoadingPaymentSettings(false);
    }
  };

  const loadTabData = async () => {
    console.log('📋 Menu page: loadTabData called');
    const tabData = sessionStorage.getItem('currentTab');
    console.log('📦 Menu page: Retrieved tab data from sessionStorage:', tabData ? 'Found' : 'Not found');
    if (!tabData) {
      console.error('❌ Menu page: No tab data found in sessionStorage');
      console.log('📦 All sessionStorage keys:', Object.keys(sessionStorage));
      router.replace('/');
      return;
    }
    let currentTab;
    try {
      currentTab = JSON.parse(tabData);
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
      
      // Load payment settings for this bar
      if ((fullTab as any).bar?.id) {
        loadPaymentSettings((fullTab as any).bar.id);
      }
      
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
            .select('name')
            .order('name');
          if (categoriesError) {
            console.error('Error loading categories:', categoriesError);
            // Fallback: extract categories from bar_products
            const uniqueCategories = Array.from(new Set(
              barProducts.map(bp => bp.product?.category).filter(Boolean)
            )).sort().map(catName => ({ name: catName }));
            setCategories(uniqueCategories);
          } else {
            console.log('📊 Customer loaded categories:', categoriesData);
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
      
      // Load bar settings (menu type, static menu URL and type)
      if ((fullTab as any).bar?.id) {
        try {
          const { data: barData, error: barError } = await supabase
            .from('bars')
            .select('menu_type, static_menu_url, static_menu_type')
            .eq('id', (fullTab as any).bar.id)
            .single();

          if (!barError && barData) {
            setMenuType((barData as any).menu_type || 'interactive');
            setStaticMenuUrl((barData as any).static_menu_url);
            setStaticMenuType((barData as any).static_menu_type);
            
            // Auto-show static menu if menu_type is static and either a single URL exists OR it's a slideshow
            if ((barData as any).menu_type === 'static' && ((barData as any).static_menu_url || (barData as any).static_menu_type === 'slideshow')) {
              setShowStaticMenu(true);
            }

            // If this is a slideshow, fetch the slideshow images and settings
            if ((barData as any).static_menu_type === 'slideshow') {
              try {
                const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const apiUrl = `${baseUrl}/api/get-slideshow?barId=${(fullTab as any).bar.id}`;
                console.log('🔄 Calling slideshow API:', apiUrl);

                const resp = await fetch(apiUrl);
                console.log('📊 API Response status:', resp.status, resp.ok);

                if (resp.ok) {
                  const json = await resp.json();
                  console.log('✅ Slideshow API response:', json);
                  setSlideshowImages(json.images || []);
                  // Use settings from DB schema if present; do not assume a transition speed
                  setSlideshowSettings(json.settings ?? null);
                  setCurrentSlideIndex(0);
                  // Slideshow is manual only - no auto-play
                  setIsSlideshowPlaying(false);

                  // If slideshow exists, show static menu
                  if (json.images && json.images.length > 0) {
                    setShowStaticMenu(true);
                  }
                  return; // success
                }

                console.warn('Failed to fetch slideshow images', resp.status, await resp.text());

                // Fallback: try admin inspection endpoint
                try {
                  const altUrl = `${baseUrl}/api/admin/slideshow-status?barId=${(fullTab as any).bar.id}`;
                  console.log('🔁 Trying admin fallback:', altUrl);
                  const altResp = await fetch(altUrl);
                  console.log('📊 Admin fallback status:', altResp.status, altResp.ok);
                  if (altResp.ok) {
                    const altJson = await altResp.json();
                    if (altJson?.images) {
                      setSlideshowImages(altJson.images.map((img: any) => img.image_url));
                      setShowStaticMenu(true);
                    }
                  }
                } catch (altErr) {
                  console.warn('Alternative fetch also failed:', altErr);
                }
              } catch (err) {
                console.warn('Error fetching slideshow images', err);

                // Try admin endpoint as a last-ditch fallback
                try {
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  const altUrl = `${baseUrl}/api/admin/slideshow-status?barId=${(fullTab as any).bar.id}`;
                  console.log('🔁 Trying admin fallback (catch):', altUrl);
                  const altResp = await fetch(altUrl);
                  if (altResp.ok) {
                    const altJson = await altResp.json();
                    if (altJson?.images) {
                      setSlideshowImages(altJson.images.map((img: any) => img.image_url));
                      setShowStaticMenu(true);
                    }
                  }
                } catch (altErr) {
                  console.warn('Alternative fetch also failed:', altErr);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error loading bar settings:', error);
        }
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

      // Check if there's an outstanding balance
      const tabTotal = orders
        .filter(order => order.status === 'confirmed')
        .reduce((sum, order) => sum + parseFloat(order.total), 0);
      const paidTotal = payments
        .filter(payment => payment.status === 'success')
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const currentBalance = tabTotal - paidTotal;

      // PREVENT closing if there's an outstanding balance
      if (currentBalance > 0) {
        showToast({
          type: 'error',
          title: 'Cannot Close Tab',
          message: `You have ${formatCurrency(currentBalance)} outstanding balance. Please pay at the bar before closing your tab.`
        });
        return; // Stop here - don't close the tab
      }

      // Call the close tab API
      const response = await fetch('/api/tabs/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tabId: tab.id,
          writeOffAmount: 0 // Customer tabs should have 0 balance when closing
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to close tab');
      }

      sessionStorage.removeItem('currentTab');
      sessionStorage.removeItem('cart');
      sessionStorage.removeItem('oldestPendingCustomerOrderTime');

      // Show success toast
      showToast({
        type: 'success',
        title: 'Tab Closed',
        message: 'Tab closed successfully. Thank you!'
      });

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
        showToast({
          type: 'error',
          title: 'Failed to Approve Order',
          message: 'Please try again'
        });
        return;
      }
      
      // Success - show toast and reload data
      showToast({
        type: 'success',
        title: 'Order Approved!',
        message: 'Staff order has been approved'
      });
      
      // Reload tab data to reflect the change
      await loadTabData();
      
    } catch (error) {
      console.error('Error in handleApproveOrder:', error);
      showToast({
        type: 'error',
        title: 'Failed to Approve Order',
        message: 'An error occurred while approving the order'
      });
    } finally {
      setApprovingOrder(null);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    console.log('🚫 handleRejectOrder called with orderId:', orderId);
    console.log('🚫 Current showRejectModal state before:', showRejectModal);
    console.log('🚫 Current rejectingOrderId state before:', rejectingOrderId);
    
    setRejectingOrderId(orderId);
    setSelectedRejectionReason('');
    setShowRejectModal(true);
    
    // Force a re-render log
    setTimeout(() => {
      console.log('🚫 showRejectModal state after setTimeout should be true');
    }, 100);
  };

  const confirmRejectOrder = async () => {
    if (!rejectingOrderId || !selectedRejectionReason) {
      showToast({
        type: 'error',
        title: 'Missing Reason',
        message: 'Please select a reason for rejection'
      });
      return;
    }

    setApprovingOrder(rejectingOrderId);
    try {
      const { error } = await (supabase as any)
        .from('tab_orders')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString(),
          rejection_reason: selectedRejectionReason,
          cancelled_by: 'customer'
        } as any)
        .eq('id', rejectingOrderId);

      if (error) throw error;
    
      // Show success message
      showToast({
        type: 'success',
        title: 'Order Rejected',
        message: 'The staff order has been rejected'
      });
      
      // Close modal immediately
      setShowRejectModal(false);
      setRejectingOrderId(null);
      setSelectedRejectionReason('');
      
      // Mark this order as processed
      setProcessedOrders(prev => new Set([...prev, rejectingOrderId]));
      
      // Reload data
      await loadTabData();
      
    } catch (error) {
      console.error('Error in confirmRejectOrder:', error);
      showToast({
        type: 'error',
        title: 'Rejection Failed',
        message: 'An error occurred while rejecting order'
      });
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

  // Apply search filter
  if (searchQuery.trim()) {
    filteredProducts = filteredProducts.filter(bp =>
      bp.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Sort alphabetically by product name
  filteredProducts.sort((a, b) => {
    const nameA = a.product?.name || '';
    const nameB = b.product?.name || '';
    return nameA.localeCompare(nameB);
  });

  const addToCart = (barProduct: BarProduct) => {
    const product = barProduct.product;
    if (!product) return;
    
    // Always add as a new item (no grouping by product)
    const newItem = {
      bar_product_id: barProduct.id,
      product_id: barProduct.product_id,
      name: product.name,
      price: barProduct.sale_price,
      category: product.category,
      image_url: product.image_url,
      quantity: 1
    };
    
    const newCart = [...cart, newItem];
    setCart(newCart);
    sessionStorage.setItem('cart', JSON.stringify(newCart));
    
    // Auto-open cart when items are added
    setCartCollapsed(false);
    setFoodMenuCollapsed(true);
    setDrinksMenuCollapsed(true);
    
    // Show toast notification for cart addition
    showToast({
      type: 'success',
      title: 'Added to Cart! 🛒',
      message: `${product.name} has been added to your cart`
    });
  };

  const updateCartQuantity = (itemIndex: number, delta: number) => {
    const newCart = cart.map((item, idx) => {
      if (idx === itemIndex) {
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
      const orderItems = cart.map((item, index) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        category: item.category,
        ...(isDrinkItem(item) && notColdPreferences[`cart-item-${index}`] && { not_cold: true })
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(`Failed to create order: KSh ${error.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const processPayment = async () => {
    // DISABLED: Show coming soon message instead of processing payment
    alert('Digital payments coming soon! Please pay directly at the bar using cash, M-Pesa, Airtel Money, or credit/debit cards.');
    return;
  };

  const sendTelegramMessage = async () => {
    if (!messageInput.trim() || !tab) {
      console.error('❌ No message or tab');
      return;
    }
    
    setSendingMessage(true);
    
    try {
      console.log('📤 Sending telegram message:', {
        tabId: tab.id,
        message: messageInput.trim(),
        length: messageInput.trim().length
      });
      
      // Use the database function first
      const { data, error: functionError } = await (supabase as any).rpc(
        'create_telegram_message',
        {
          p_tab_id: tab.id,
          p_message: messageInput.trim(),
          p_initiated_by: 'customer',
          p_metadata: {
            type: 'general',
            urgency: 'normal',
            character_count: messageInput.trim().length,
            platform: 'customer-web'
          }
        }
      );
      
      // If function fails, try direct insert
      if (functionError) {
        console.warn('⚠️ Function failed, trying direct insert:', functionError);
        
        const { data: insertData, error: insertError } = await (supabase as any)
          .from('tab_telegram_messages')
          .insert({
            tab_id: tab.id,
            message: messageInput.trim(),
            order_type: 'telegram',
            status: 'pending',
            message_metadata: {
              type: 'general',
              urgency: 'normal',
              character_count: messageInput.trim().length,
              platform: 'customer-web'
            },
            customer_notified: true,
            customer_notified_at: new Date().toISOString(),
            initiated_by: 'customer'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Direct insert failed:', insertError);
          throw insertError;
        }
        
        console.log('✅ Message sent via direct insert:', insertData);
      } else {
        console.log('✅ Message sent via function:', data);
      }
      
      // Success - reset form and show confirmation
      setMessageInput('');
      setShowMessageModal(false);
      setMessageSentModal(true);
      
      // Vibrate for confirmation
      buzz([100]);
      
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => {
        setMessageSentModal(false);
      }, 3000);
      
      // Refresh messages immediately
      await loadTelegramMessages();
      
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      alert(`Failed to send message: KSh ${error.message || 'Please try again.'}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const loadTelegramMessages = async () => {
    if (!tab) return;
    
    try {
      const telegram = telegramMessageQueries(supabase);
      const { data, error } = await telegram.getTabMessages(tab.id);
      
      if (!error && data) {
        setTelegramMessages(data);
        
        // Calculate unread messages count
        const unreadCount = data.filter(msg => 
          msg.initiated_by === 'staff' && 
          msg.status === 'pending'
        ).length;
        setUnreadMessagesCount(unreadCount);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  useEffect(() => {
    if (tab?.id) {
      loadTelegramMessages();
    }
  }, [tab?.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const tabTotal = orders
    .filter(order => order.status === 'confirmed' && order.status !== 'cancelled')
    .reduce((sum, order) => sum + parseFloat(order.total), 0);
  const paidTotal = payments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const balance = tabTotal - paidTotal;
  const pendingStaffOrders = orders.filter(o => o.status === 'pending' && o.initiated_by === 'staff').length;

  // FIXED: Use currentTime state instead of new Date() for real-time updates
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((currentTime - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
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
  const lastOrder = orders.filter(order => order.status !== 'cancelled')[0]; // Most recent non-cancelled order
  const lastOrderTotal = lastOrder ? parseFloat(lastOrder.total).toFixed(0) : '0';
  const lastOrderTime = lastOrder ? timeAgo(lastOrder.created_at) : '';
  
  // Get pending order timer
  const pendingOrderTime = getPendingOrderTime();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white sticky top-0 z-20 shadow-lg">
        {/* Top Row: Restaurant Name & Tab Info */}
        <div className="px-4 py-3 border-b border-white border-opacity-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-xs text-white text-opacity-90">{barName}</p>
            </div>
            
            {/* Average Response Time Badge */}
            {averageResponseTime !== null && !responseTimeLoading && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                <Clock size={14} />
                ~{averageResponseTime}m response
              </div>
            )}
            {responseTimeLoading && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Loading...
              </div>
            )}
            
            {/* Connection Status Indicator */}
            {showConnectionStatus && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <ConnectionStatusIndicator 
                  status={connectionStatus} 
                  retryCount={retryCount}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Row: Quick Actions */}
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <button 
              onClick={() => foodMenuRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="flex-1 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              Food
            </button>
            <button 
              onClick={() => drinksMenuRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="flex-1 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              Drinks
            </button>
            <button 
              onClick={() => ordersRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="flex-1 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              Orders
            </button>
            <button 
              onClick={() => paymentRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="flex-1 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              Pay
            </button>
            <button 
              onClick={() => setShowMessagePanel(true)}
              className="flex-1 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 rounded-lg px-4 py-2 text-sm font-medium transition-all relative"
            >
              Messages
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-orange-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pending Order Timer */}
      {pendingOrderTime && (
        <div className="bg-gradient-to-r from-orange-600 to-red-700 text-white p-3 border-b border-orange-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-orange-200" />
              <div>
                <p className="text-sm font-medium">Order pending</p>
                <p className="text-xs text-orange-100">Waiting for staff confirmation</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{formatTime(pendingOrderTime.elapsed)}</p>
              <p className="text-xs text-orange-100">elapsed</p>
            </div>
          </div>
          
          {/* Circular Timer */}
          <div className="flex items-center justify-center mt-3">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                  fill="transparent"
                />
                {/* Progress circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#fdba74"
                  strokeWidth="4"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={226.08} // 2 * π * 36
                  strokeDashoffset={226.08 * (1 - Math.min(pendingOrderTime.elapsed * 0.5 / 100, 1))}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{formatTime(pendingOrderTime.elapsed)}</span>
              </div>
            </div>
          </div>
          
          {/* Linear progress bar (optional backup) */}
          <div className="w-full bg-orange-900 bg-opacity-30 rounded-full h-2 mt-3">
            <div 
              className="bg-orange-300 h-2 rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(pendingOrderTime.elapsed * 0.5, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Pending Staff Orders Alert */}
      {pendingStaffOrders > 0 && (
        <div className="bg-yellow-400 border-b-2 border-yellow-500 p-3 animate-pulse">
          <div className="flex items-center gap-2">
            <UserCog size={20} className="text-yellow-900" />
            <span className="text-yellow-900 font-medium">{pendingStaffOrders} staff order{pendingStaffOrders > 1 ? 's' : ''} pending</span>
          </div>
        </div>
      )}

      {/* Message Section */}
      <div className="p-4">
        {/* Section Header */}
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">MESSAGES</h2>
        </div>
        
        <div className="bg-white border border-gray-100 overflow-hidden rounded-lg">
          <div className="p-4">
            {/* Message Stats */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span className="text-gray-600">{telegramMessages.filter(m => m.status === 'pending').length} Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-gray-600">{telegramMessages.filter(m => m.status === 'acknowledged').length} Acknowledged</span>
                </div>
              </div>
            </div>
            
            {/* Recent Messages Preview */}
            {telegramMessages.slice(0, 2).map((msg) => (
              <div
                key={msg.id} 
                className={`p-3 rounded-lg mb-2 ${
                  msg.initiated_by === 'customer' 
                    ? 'bg-orange-100 border border-orange-200' 
                    : 'bg-blue-100 border border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.initiated_by === 'customer' ? 'text-orange-700' : 'text-blue-700'
                    }`}>
                      {timeAgo(msg.created_at)} • 
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        msg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        msg.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {msg.status}
                      </span>
                    </p>
                  </div>
                  {msg.status === 'pending' && (
                    <Clock size={16} className="text-yellow-500 flex-shrink-0" />
                  )}
                  {msg.status === 'acknowledged' && (
                    <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                  )}
                  {msg.status === 'completed' && (
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
            
            {/* "View All Messages" Button */}
            {telegramMessages.length > 0 && (
              <button
                onClick={() => setShowMessagePanel(true)}
                className="w-full text-center text-sm text-blue-600 py-3 hover:text-blue-700 font-medium flex items-center justify-center gap-2 border-t border-gray-100 mt-3"
              >
                <MessageCircle size={16} />
                View all {telegramMessages.length} messages
              </button>
            )}
            
            {/* New Message Button */}
            <button
              onClick={() => setShowMessagePanel(true)}
              className="w-full mt-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              Send New Message
            </button>
          </div>
        </div>
      </div>

      {/* FOOD Menu Section - COLLAPSIBLE */}
      <div className="bg-gray-50 px-4">
        <div className="bg-white border-b border-gray-100 overflow-hidden rounded-lg">
          <div className="p-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🍽️ FOOD</h2>
            </div>
            <button
              onClick={toggleFoodMenu}
              className="text-green-600 hover:text-green-700 p-2 transform transition-transform duration-200 hover:scale-110"
            >
              <ChevronDown 
                size={20} 
                className={`transform transition-transform duration-300 ease-in-out ${
                  foodMenuCollapsed ? 'rotate-0' : 'rotate-180'
                }`}
              />
            </button>
          </div>
          
          <div 
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              foodMenuCollapsed 
                ? 'max-h-0 opacity-0' 
                : 'max-h-[1000px] opacity-100'
            }`}
          >
            <div ref={foodMenuRef} className="relative overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {['All Food', ...new Set(
                    barProducts
                      .filter(bp => isFoodProduct(bp.product))
                      .map(bp => bp.product?.category)
                      .filter((cat): cat is string => cat !== undefined && cat !== null && cat.trim() !== '')
                  )].map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category === 'All Food' ? 'All' : category)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transform transition-all duration-200 hover:scale-105 ${
                        (selectedCategory === 'All' && category === 'All Food') || selectedCategory === category
                          ? 'bg-green-500 text-white scale-105 shadow-lg'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                {/* Search Field */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search food..."
                    className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="relative">
                <div className="overflow-x-auto scrollbar-hide px-4 pb-4">
                  <div className="flex gap-4 pb-4" style={{ paddingLeft: '16px' }}>
                    {barProducts
                      .filter(bp => isFoodProduct(bp.product))
                      .filter(bp => {
                        if (selectedCategory === 'All') return true;
                        return bp.product?.category === selectedCategory;
                      })
                      .filter(bp => {
                        if (!searchQuery.trim()) return true;
                        return bp.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
                      })
                      .sort((a, b) => {
                        const nameA = a.product?.name || '';
                        const nameB = b.product?.name || '';
                        return nameA.localeCompare(nameB);
                      })
                      .map((barProduct, index) => {
                      const product = barProduct.product;
                      if (!product) return null;
                      const displayImage = product ? getDisplayImage(product) : null;
                      return (
                        <div
                          key={barProduct.id}
                          className="flex-shrink-0 w-32 transform transition-all duration-300 hover:scale-105"
                          style={{ 
                            animationDelay: `${index * 50}ms`,
                            opacity: foodMenuCollapsed ? 0 : 1,
                            transform: `translateY(${foodMenuCollapsed ? '20px' : '0'})`
                          }}
                        >
                          <div
                            className="bg-white overflow-hidden border-2 border-green-400 cursor-pointer flex flex-col shadow-md hover:shadow-xl transition-all duration-300 h-80"
                            onClick={() => addToCart(barProduct)}
                          >
                            <div className="w-full h-48 relative bg-gray-100">
                              {displayImage ? (
                                <img
                                  src={displayImage}
                                  alt={product.name || 'Product'}
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      const Icon = getCategoryIcon(product.category || 'Uncategorized');
                                      parent.innerHTML = '';
                                      const iconContainer = document.createElement('div');
                                      parent.appendChild(iconContainer);
                                      ReactDOM.createRoot(iconContainer).render(<Icon size={48} className="text-4xl text-gray-400 font-semibold" />);
                                    }
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                                  {(() => {
                                    const Icon = getCategoryIcon(product.category || 'Uncategorized');
                                    return <Icon size={48} className="text-gray-400" />;
                                  })()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 p-4 flex flex-col justify-between">
                              <h3 className={`text-sm font-medium text-gray-900 text-left leading-tight ${product.name && product.name.length > 20 ? 'text-xs' : ''}`}>{product.name || 'Product'}</h3>
                              <p className="text-sm text-gray-600 mt-2 text-left">{tempFormatCurrency(barProduct.sale_price)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DRINKS Menu Section - COLLAPSIBLE */}
      <div className="bg-gray-50 px-4">
        <div className="bg-white border-b border-gray-100 overflow-hidden rounded-lg">
          <div className="p-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🍺 DRINKS</h2>
            </div>
            <button
              onClick={toggleDrinksMenu}
              className="text-blue-600 hover:text-blue-700 p-2 transform transition-transform duration-200 hover:scale-110"
            >
              <ChevronDown 
                size={20} 
                className={`transform transition-transform duration-300 ease-in-out ${
                  drinksMenuCollapsed ? 'rotate-0' : 'rotate-180'
                }`}
              />
            </button>
          </div>
          
          <div 
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              drinksMenuCollapsed 
                ? 'max-h-0 opacity-0' 
                : 'max-h-[1000px] opacity-100'
            }`}
          >
            <div ref={drinksMenuRef} className="relative overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {['All Drinks', ...new Set(
                    barProducts
                      .filter(bp => isDrinkProduct(bp.product))
                      .map(bp => bp.product?.category)
                      .filter((cat): cat is string => cat !== undefined && cat !== null && cat.trim() !== '')
                  )].map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category === 'All Drinks' ? 'All' : category)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transform transition-all duration-200 hover:scale-105 ${
                        (selectedCategory === 'All' && category === 'All Drinks') || selectedCategory === category
                          ? 'bg-blue-500 text-white scale-105 shadow-lg'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                {/* Search Field */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search drinks..."
                    className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="relative">
                <div className="overflow-x-auto scrollbar-hide px-4 pb-4">
                  <div className="flex gap-4 pb-4" style={{ paddingLeft: '16px' }}>
                    {barProducts
                      .filter(bp => isDrinkProduct(bp.product))
                      .filter(bp => {
                        if (selectedCategory === 'All') return true;
                        return bp.product?.category === selectedCategory;
                      })
                      .filter(bp => {
                        if (!searchQuery.trim()) return true;
                        return bp.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
                      })
                      .sort((a, b) => {
                        const nameA = a.product?.name || '';
                        const nameB = b.product?.name || '';
                        return nameA.localeCompare(nameB);
                      })
                      .map((barProduct, index) => {
                      const product = barProduct.product;
                      if (!product) return null;
                      const displayImage = product ? getDisplayImage(product) : null;
                      return (
                        <div
                          key={barProduct.id}
                          className="flex-shrink-0 w-32 transform transition-all duration-300 hover:scale-105"
                          style={{ 
                            animationDelay: `${index * 50}ms`,
                            opacity: drinksMenuCollapsed ? 0 : 1,
                            transform: `translateY(${drinksMenuCollapsed ? '20px' : '0'})`
                          }}
                        >
                          <div
                            className="bg-white overflow-hidden border-2 border-blue-400 cursor-pointer flex flex-col shadow-md hover:shadow-xl transition-all duration-300 h-40"
                            onClick={() => addToCart(barProduct)}
                          >
                            <div className="w-full h-24 relative bg-gray-100">
                              {displayImage ? (
                                <img
                                  src={displayImage}
                                  alt={product.name || 'Product'}
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      const Icon = getCategoryIcon(product.category || 'Uncategorized');
                                      parent.innerHTML = '';
                                      const iconContainer = document.createElement('div');
                                      parent.appendChild(iconContainer);
                                      ReactDOM.createRoot(iconContainer).render(<Icon size={32} className="text-2xl text-gray-400 font-semibold" />);
                                    }
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                                  {(() => {
                                    const Icon = getCategoryIcon(product.category || 'Uncategorized');
                                    return <Icon size={32} className="text-gray-400" />;
                                  })()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 p-3 flex flex-col justify-between">
                              <h3 className={`text-sm font-medium text-gray-900 text-left leading-tight ${product.name && product.name.length > 20 ? 'text-xs' : ''}`}>{product.name || 'Product'}</h3>
                              <p className="text-sm text-gray-600 mt-2 text-left">{tempFormatCurrency(barProduct.sale_price)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Section - Only show when cart has items */}
      {cart.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-t border-orange-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-orange-600 uppercase tracking-wide">YOUR CART</h2>
            <button
              onClick={toggleCart}
              className="text-orange-600 hover:text-orange-700 transition-colors"
            >
              {cartCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>

          {!cartCollapsed && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
              {/* Cart Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingCart size={20} />
                    <div>
                      <h3 className="font-bold text-lg">Cart Items</h3>
                      <p className="text-sm text-orange-100">{cartCount} items • {tempFormatCurrency(cartTotal)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCart([])}
                    className="p-2 bg-orange-700 bg-opacity-50 rounded-lg hover:bg-orange-800 transition-colors"
                    title="Clear cart"
                  >
                    <X size={18} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {cart.map((item, index) => (
                  <div key={`cart-item-${index}`} className="bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-orange-900">{item.name}</span>
                        </div>
                        <p className="text-sm text-orange-600">{tempFormatCurrency(item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-orange-100 border border-orange-300 rounded-lg">
                          <button
                            onClick={() => updateCartQuantity(index, -1)}
                            className="p-2 hover:bg-orange-200 transition-colors"
                          >
                            <Minus size={16} className="text-orange-700" />
                          </button>
                          <span className="font-bold w-8 text-center text-orange-900">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(index, 1)}
                            className="p-2 hover:bg-orange-200 transition-colors"
                          >
                            <Plus size={16} className="text-orange-700" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            const newCart = cart.filter((_, idx) => idx !== index);
                            setCart(newCart);
                            sessionStorage.setItem('cart', JSON.stringify(newCart));
                          }}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          title="Remove from cart"
                        >
                          <X size={18} className="text-white" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Not Cold Preference for Drinks */}
                    {isDrinkItem(item) && (
                      <div className="px-3 pb-3">
                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notColdPreferences[`cart-item-${index}`] || false}
                              onChange={() => toggleNotCold(`cart-item-${index}`)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="text-sm text-blue-700 font-medium">Not Cold</span>
                            <span className="text-xs text-blue-600">(serve at room temperature)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Cart Footer */}
              <div className="border-t border-orange-200 p-4 bg-orange-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-orange-600">Total</p>
                    <p className="text-2xl font-bold text-orange-900">{tempFormatCurrency(cartTotal)}</p>
                  </div>
                  <button
                    onClick={confirmOrder}
                    disabled={submittingOrder || cart.length === 0}
                    className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submittingOrder ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send Order
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={toggleCart}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:from-blue-700 hover:to-indigo-800 hover:scale-110 active:scale-95 transition-all duration-200 animate-bounce-once"
          style={{ 
            animation: 'bounceOnce 0.5s ease-out',
            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5), 0 10px 10px -5px rgba(79, 70, 229, 0.2)'
          }}
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-md">
              {cartCount}
            </span>
          </div>
        </button>
      )}

      {/* Menu Viewer - RENAMED from "Static Menu" */}
      {(staticMenuUrl || staticMenuType === 'slideshow') && (
        <div className="p-4">
          {/* Section Header - NEW */}
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PROMOS</h2>
          </div>
          
          <div className="bg-white border border-gray-100 overflow-hidden rounded-lg">
            {/* Menu Header - UPDATED text */}
            <div className="p-4 flex items-center justify-between bg-gradient-to-r from-orange-50 to-red-50">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Specials</h2>
              </div>
              <button
                onClick={toggleStaticMenu}
                className="text-orange-600 hover:text-orange-700 p-2 transform transition-transform duration-200 hover:scale-110"
              >
                <ChevronDown 
                  size={20} 
                  className={`transform transition-transform duration-300 ease-in-out ${
                    !showStaticMenu ? 'rotate-0' : 'rotate-180'
                  }`}
                />
              </button>
            </div>
            
            {/* Static Menu Content */}
            <div 
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                !showStaticMenu 
                  ? 'max-h-0 opacity-0' 
                  : 'max-h-[70vh] opacity-100'
              }`}
            >
              <div className="relative z-10 bg-gray-900 bg-opacity-95 flex flex-col h-[70vh] min-h-[400px]">
                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {/* PDF viewer temporarily disabled - only show images */}
                  {staticMenuType === 'pdf' ? (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <div className="text-center text-gray-600 p-8">
                        <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold mb-2">PDF Viewer Temporarily Disabled</h3>
                        <p className="text-sm">PDF menu viewing is currently unavailable. Please ask staff for assistance or use the interactive menu.</p>
                      </div>
                    </div>
                  ) : staticMenuType === 'slideshow' ? (
                    // Slideshow viewer - MANUAL ONLY (no auto-play)
                    <div className="w-full h-full bg-gray-100 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 relative">
                        {slideshowImages.length === 0 ? (
                          <div className="text-center text-gray-500">No slideshow images available</div>
                        ) : (
                          <>
                            <div className="aspect-[4/5] max-w-[900px] w-full rounded-lg overflow-hidden shadow-lg transition-all duration-300">
                              <img
                                src={slideshowImages[currentSlideIndex]}
                                alt={`Slide ${currentSlideIndex + 1}`}
                                className="w-full h-full object-cover"
                                style={{ transform: `scale(${imageScale})`, transformOrigin: 'center' }}
                              />
                            </div>

                            {slideshowImages.length > 1 && (
                              <>
                                <button
                                  onClick={() => setCurrentSlideIndex((idx) => (idx - 1 + slideshowImages.length) % slideshowImages.length)}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 shadow"
                                >
                                  ‹
                                </button>
                                <button
                                  onClick={() => setCurrentSlideIndex((idx) => (idx + 1) % slideshowImages.length)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 shadow"
                                >
                                  ›
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* Footer: indicators & controls */}
                      <div className="bg-white border-t border-gray-200 p-2 flex items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          {slideshowImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentSlideIndex(i)}
                              className={`w-2 h-2 rounded-full ${i === currentSlideIndex ? 'bg-orange-500' : 'bg-gray-300'}`}
                              title={`Go to slide ${i + 1}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Play/Pause button removed since slideshow is manual only */}
                          <button
                            onClick={handleImageFitWidth}
                            className="p-1 hover:bg-gray-100 rounded text-gray-600"
                            title="Fit to width"
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Image viewer with zoom
                    <div className="w-full h-full bg-gray-100 flex flex-col overflow-hidden">
                      {/* Image Content */}
                      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                        <img 
                          src={staticMenuUrl ?? undefined} 
                          alt="Menu" 
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-all duration-300"
                          style={{ 
                            transform: `scale(${imageScale})`, 
                            transformOrigin: 'center',
                            filter: showStaticMenu ? 'brightness(1)' : 'brightness(0.8)'
                          }}
                        />
                      </div>
                      
                      {/* Image Zoom Controls */}
                      <div className="bg-white border-t border-gray-200 p-2 flex items-center justify-center gap-2 shrink-0">
                        <button
                          onClick={handleImageZoomOut}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 transform transition-all duration-200 hover:scale-110"
                          title="Zoom out"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <span className="text-xs text-gray-600 min-w-[40px] text-center">
                          {Math.round(imageScale * 100)}%
                        </span>
                        <button
                          onClick={handleImageZoomIn}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 transform transition-all duration-200 hover:scale-110"
                          title="Zoom in"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          onClick={handleImageFitWidth}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 transform transition-all duration-200 hover:scale-110"
                          title="Fit to width"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={ordersRef} className="p-4">
        {/* Section Header - NEW */}
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ORDER HISTORY</h2>
        </div>
        
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
              <p className="text-xs text-transparent mt-1">-</p>
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

      {/* Payment Section - COLLAPSIBLE */}
      {balance > 0 && (
        <div ref={paymentRef} className="p-4">
          {/* Section Header - NEW */}
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PAYMENT</h2>
          </div>
          
          <div className="bg-white border-b border-gray-100 overflow-hidden rounded-lg">
            <div className="p-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50">
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</h2>
                <p className="text-sm text-gray-600 mt-1">Outstanding balance: {tempFormatCurrency(balance)}</p>
              </div>
              <button
                onClick={togglePayment}
                className="text-green-600 hover:text-green-700 p-2 transform transition-transform duration-200 hover:scale-110"
              >
                <ChevronDown 
                  size={20} 
                  className={`transform transition-transform duration-300 ease-in-out ${
                    paymentCollapsed ? 'rotate-0' : 'rotate-180'
                  }`}
                />
              </button>
            </div>
            
            <div 
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                paymentCollapsed 
                  ? 'max-h-0 opacity-0' 
                  : 'max-h-[800px] opacity-100'
              }`}
            >
              <div className="bg-white p-4">
                <div className="flex border-b border-gray-200 mb-4">
                  {paymentSettings.mpesa_enabled && (
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
                  )}
                  {paymentSettings.card_enabled && (
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
                  )}
                  {paymentSettings.cash_enabled && (
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
                  )}
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
                      disabled={true}
                      className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg text-sm font-medium cursor-not-allowed"
                    >
                      Digital Payments Coming Soon
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Please pay at the bar using
                      {(() => {
                        const methods = [];
                        if (paymentSettings.cash_enabled) methods.push('cash');
                        if (paymentSettings.mpesa_enabled) methods.push('M-Pesa');
                        if (paymentSettings.card_enabled) methods.push('cards');
                        if (paymentSettings.mpesa_enabled && (paymentSettings.card_enabled || paymentSettings.cash_enabled)) methods.push('Airtel Money');
                        return methods.join(', ');
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
              onClick={() => foodMenuRef.current?.scrollIntoView({ behavior: 'smooth' })} 
              className="w-full bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300"
            >
              Order More Food
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            💡 Tip: Close your tab when you're done to avoid confusion on your next visit
          </p>
        </div>
      )}
      
      {acceptanceModal.show && (
        <div className="fixed inset-x-0 bottom-0 bg-black bg-opacity-50 flex items-end justify-center z-[9999]">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto shadow-2xl transform animate-slideUp max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 p-6 text-center border-b">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Accepted! 🎉</h2>
              <p className="text-gray-600">{acceptanceModal.message}</p>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-orange-500">{formatCurrency(parseFloat(acceptanceModal.orderTotal))}</div>
              </div>
              
              {/* Order Items - Scrollable if needed */}
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Order Details</h3>
                {/* You can map through the actual order items here */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Order items will appear here when available</p>
                </div>
              </div>
            </div>
            
            {/* Footer - Fixed at bottom */}
            <div className="flex-shrink-0 p-6 border-t">
              <button 
                onClick={() => setAcceptanceModal({ show: false, orderTotal: '', message: '' })}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle size={24} className="text-blue-500" />
                <h2 className="text-xl font-bold text-gray-900">Message Staff</h2>
              </div>
              <button onClick={() => setShowMessageModal(false)}>
                <X size={24} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Send a message to the staff about special requests, questions, or anything else you need.
              </p>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setMessageInput('Can I get some extra napkins?')}
                  className="text-xs p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-left"
                >
                  Extra napkins
                </button>
                <button
                  onClick={() => setMessageInput('Can we have the bill split?')}
                  className="text-xs p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-left"
                >
                  Split bill
                </button>
                <button
                  onClick={() => setMessageInput('Table needs cleaning')}
                  className="text-xs p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-left"
                >
                  Clean table
                </button>
                <button
                  onClick={() => setMessageInput('Can I get a recommendation?')}
                  className="text-xs p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-left"
                >
                  Recommendations
                </button>
              </div>
              
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message here... (e.g., 'Can we get more water?', 'Special dietary request', etc.)"
                className="w-full h-32 p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                maxLength={500}
              />
              <div className="text-right mt-1">
                <span className={`text-xs ${messageInput.length > 450 ? 'text-red-500' : 'text-gray-400'}`}>
                  {messageInput.length}/500
                </span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={sendTelegramMessage}
                disabled={!messageInput.trim() || sendingMessage}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingMessage ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Message Sent Confirmation Modal */}
      {messageSentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-fadeIn">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
            <p className="text-gray-600 mb-4">
              Your message has been sent to staff. They will respond shortly.
            </p>
            <button
              onClick={() => setMessageSentModal(false)}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Reject Order</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Please select a reason for rejecting this staff order:
            </p>
            
            <div className="space-y-2 mb-6">
              {rejectionReasons.map((reason) => (
                <label
                  key={reason.value}
                  className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-colors"
                >
                  <input
                    type="radio"
                    name="rejectionReason"
                    value={reason.value}
                    checked={selectedRejectionReason === reason.value}
                    onChange={(e) => setSelectedRejectionReason(e.target.value)}
                    className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{reason.label}</span>
                </label>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectOrder}
                disabled={!selectedRejectionReason || approvingOrder === rejectingOrderId}
                className="flex-1 bg-red-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {approvingOrder === rejectingOrderId ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Rejecting...
                  </>
                ) : (
                  'Reject Order'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* New Message Alert */}
      {newMessageAlert && (
        <div className="fixed top-4 right-4 z-50 animate-slideIn">
          <div className={`rounded-xl shadow-lg p-4 max-w-sm ${
            newMessageAlert.type === 'acknowledged' ? 'bg-blue-500 text-white' :
            newMessageAlert.type === 'completed' ? 'bg-green-500 text-white' :
            'bg-yellow-500 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 rounded-full p-2">
                {newMessageAlert.type === 'acknowledged' ? (
                  <CheckCircle size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{newMessageAlert.message}</p>
                <p className="text-xs opacity-90">{timeAgo(newMessageAlert.timestamp)}</p>
              </div>
              <button
                onClick={() => setNewMessageAlert(null)}
                className="p-1 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Close Tab Section - Always Last */}
      <div className="bg-white p-4 border-t">
        <button
          onClick={() => {
            if (balance > 0) {
              // Show red toast immediately for outstanding balance
              showToast({
                type: 'error',
                title: 'Cannot Close Tab',
                message: 'You have outstanding balance. Please pay at the bar before closing your tab.'
              });
              return;
            }
            // Show confirmation for green tabs (no balance)
            setShowCloseConfirm(true);
          }}
          className={`w-full py-3 rounded-xl font-medium transition ${
            orders.filter(order => order.status === 'confirmed').length === 0 
              ? 'text-green-600 hover:bg-green-50' 
              : balance > 0 
                ? 'text-red-600 hover:bg-red-50'
                : 'text-green-600 hover:bg-green-50'
          }`}
        >
          Close Tab
        </button>
      </div>
      
      {/* Close Tab Confirmation Modal */}
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
                Close Tab
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Message Panel Slide-in */}
      <MessagePanel
        isOpen={showMessagePanel}
        onClose={() => setShowMessagePanel(false)}
        tabId={tab!.id}
        initialMessages={telegramMessages}
        onMessageSent={loadTelegramMessages}
      />
    </div>
  );
}