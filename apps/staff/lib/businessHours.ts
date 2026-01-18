import { supabase } from './supabase';

// Type definitions - updated to match actual database schema
interface Bar {
  id: string;
  name: string;
  business_hours_mode: 'simple' | 'advanced' | '24hours' | null;
  business_hours_simple: {
    openTime: string;
    closeTime: string;
    closeNextDay: boolean;
  } | null;
  business_hours_advanced: any | null;
  business_24_hours: boolean | null;
}

interface Tab {
  id: string;
  status: string;
  bar_id: string;
  opened_at: string;
  bar: Bar & {
    business_hours_advanced?: {
      [key: string]: {
        open: string;
        close: string;
        closeNextDay?: boolean;
      };
    };
  };
}

interface Order {
  total: string;
}

interface Payment {
  amount: string;
}

// Business hours check for TypeScript - updated to work with actual database schema
export const isWithinBusinessHours = (bar: Bar): boolean => {
  try {
    // Handle 24 hours mode
    if (bar.business_24_hours === true) {
      return true;
    }
    
    // If no business hours configured, always open
    if (!bar.business_hours_mode) {
      return true;
    }
    
    // Handle 24hours mode
    if (bar.business_hours_mode === '24hours') {
      return true;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    // Get current day of week (0 = Sunday, 1 = Monday, etc.)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    
    if (bar.business_hours_mode === 'simple') {
      // Simple mode: same hours every day
      if (!bar.business_hours_simple) {
        return true;
      }
      
      // Parse open time (format: "HH:MM")
      const [openHour, openMinute] = bar.business_hours_simple.openTime.split(':').map(Number);
      const openTotalMinutes = openHour * 60 + openMinute;
      
      // Parse close time
      const [closeHour, closeMinute] = bar.business_hours_simple.closeTime.split(':').map(Number);
      const closeTotalMinutes = closeHour * 60 + closeMinute;
      
      // Handle overnight hours (e.g., 20:00 to 04:00)
      if (bar.business_hours_simple.closeNextDay || closeTotalMinutes < openTotalMinutes) {
        // Venue is open overnight: current time >= open OR current time <= close
        return currentTotalMinutes >= openTotalMinutes || currentTotalMinutes <= closeTotalMinutes;
      } else {
        // Normal hours: current time between open and close
        return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;
      }
      
    } else if (bar.business_hours_mode === 'advanced') {
      // Advanced mode: different hours per day
      if (!bar.business_hours_advanced || !bar.business_hours_advanced[currentDay]) {
        return true; // Default to open if no hours for this day
      }
      
      const dayHours = bar.business_hours_advanced[currentDay];
      if (!dayHours.open || !dayHours.close) {
        return true; // Default to open if missing open/close times
      }
      
      // Parse open time
      const [openHour, openMinute] = dayHours.open.split(':').map(Number);
      const openTotalMinutes = openHour * 60 + openMinute;
      
      // Parse close time
      const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
      const closeTotalMinutes = closeHour * 60 + closeMinute;
      
      // Handle overnight hours
      if (dayHours.closeNextDay || closeTotalMinutes < openTotalMinutes) {
        // Venue is open overnight: current time >= open OR current time <= close
        return currentTotalMinutes >= openTotalMinutes || currentTotalMinutes <= closeTotalMinutes;
      } else {
        // Normal hours: current time between open and close
        return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;
      }
    }
    
    // Default to open for any other mode
    return true;
  } catch (error) {
    console.error('Error checking business hours:', error);
    return true; // Default to open on error
  }
};

// Check if new tab can be created
export const canCreateNewTab = async (barId: string): Promise<{
  canCreate: boolean;
  message: string;
  openTime?: string;
}> => {
  try {
    const { data: bar, error } = await supabase
      .from('bars')
      .select('name, business_hours_mode, business_hours_simple, business_hours_advanced, business_24_hours')
      .eq('id', barId)
      .single() as { data: Bar | null, error: any };
    
    if (error) throw error;
    
    if (!bar) {
      return {
        canCreate: false,
        message: 'Bar not found'
      };
    }
    
    const isOpen = isWithinBusinessHours(bar);
    
    if (!isOpen) {
      const openTime = bar.business_hours_simple?.openTime || 'tomorrow';
      return {
        canCreate: false,
        message: `${bar.name} is currently closed`,
        openTime
      };
    }
    
    return {
      canCreate: true,
      message: `${bar.name} is open` 
    };
  } catch (error) {
    console.error('Error checking if can create tab:', error);
    return {
      canCreate: true, // Default to allow on error
      message: 'Available'
    };
  }
};

// Check and update tab overdue status
export const checkTabOverdueStatus = async (tabId: string): Promise<{
  isOverdue: boolean;
  balance: number;
  message: string;
}> => {
  try {
    // Get tab with bar info
    const { data: tab, error } = await supabase
      .from('tabs')
      .select(`
        *,
        bar:bars(*)
      `)
      .eq('id', tabId)
      .single() as { data: Tab | null, error: any };
    
    if (error) throw error;
    
    if (!tab) {
      return {
        isOverdue: false,
        balance: 0,
        message: 'Tab not found'
      };
    }
    
    // Get CONFIRMED orders only for balance calculation
    const { data: confirmedOrders } = await supabase
      .from('tab_orders')
      .select('total')
      .eq('tab_id', tabId)
      .eq('status', 'confirmed') as { data: Order[] | null, error: any };
    
    const { data: payments } = await supabase
      .from('tab_payments')
      .select('amount')
      .eq('tab_id', tabId)
      .eq('status', 'success') as { data: Payment[] | null, error: any };
    
    // Calculate confirmed balance (only confirmed orders count)
    const confirmedOrdersTotal = confirmedOrders?.reduce((sum, order) => sum + parseFloat(order.total), 0) || 0;
    const paymentsTotal = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) || 0;
    const confirmedBalance = confirmedOrdersTotal - paymentsTotal;
    
    // Check if tab should be closed based on when it was opened
    const tabOpenedDate = new Date(tab.opened_at);
    const now = new Date();
    const isCurrentlyOpen = isWithinBusinessHours(tab.bar);
    
    // Tab should be closed if:
    // 1. It was opened on a previous day, OR
    // 2. It was opened today but we're now past closing time
    const shouldBeClosed = tabOpenedDate.toDateString() !== now.toDateString() || !isCurrentlyOpen;
    
    // Check if should be overdue
    let isOverdue = false;
    let overdueReason = '';
    
    // Tab becomes overdue if: has outstanding CONFIRMED balance and should be closed
    if (confirmedBalance > 0 && shouldBeClosed) {
      isOverdue = true;
      if (tabOpenedDate.toDateString() !== now.toDateString()) {
        overdueReason = 'Outstanding confirmed balance from previous day';
      } else {
        overdueReason = 'Outstanding confirmed balance after business hours';
      }
    }
    
    return {
      isOverdue,
      balance: confirmedBalance,
      message: isOverdue 
        ? `Tab is overdue - ${overdueReason}`
        : confirmedBalance > 0 
          ? `Confirmed Balance: KSh ${confirmedBalance.toLocaleString()}` 
          : 'Tab is settled'
    };
  } catch (error) {
    console.error('Error checking tab overdue status:', error);
    return {
      isOverdue: false,
      balance: 0,
      message: 'Error checking status'
    };
  }
};

// Check and update multiple overdue tabs
export const checkAndUpdateOverdueTabs = async (tabsData: any[]): Promise<void> => {
  try {
    for (const tab of tabsData) {
      // Skip if already overdue or closed
      if (tab.status !== 'open') continue;
      
      // Get tab with bar info
      const { data: fullTab, error } = await supabase
        .from('tabs')
        .select(`
          *,
          bar:bars(*)
        `)
        .eq('id', tab.id)
        .single() as { data: Tab | null, error: any };
      
      if (error || !fullTab) continue;
      
      // Get CONFIRMED orders only for balance calculation
      const { data: confirmedOrders } = await supabase
        .from('tab_orders')
        .select('total')
        .eq('tab_id', tab.id)
        .eq('status', 'confirmed') as { data: Order[] | null, error: any };
      
      const { data: payments } = await supabase
        .from('tab_payments')
        .select('amount')
        .eq('tab_id', tab.id)
        .eq('status', 'success') as { data: Payment[] | null, error: any };
      
      // Calculate confirmed balance (only confirmed orders count)
      const confirmedOrdersTotal = confirmedOrders?.reduce((sum, order) => sum + parseFloat(order.total), 0) || 0;
      const paymentsTotal = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) || 0;
      const confirmedBalance = confirmedOrdersTotal - paymentsTotal;
      
      // Check for pending orders
      const { data: pendingOrders } = await supabase
        .from('tab_orders')
        .select('id')
        .eq('tab_id', tab.id)
        .eq('status', 'pending');
      
      const hasPendingOrders = pendingOrders && pendingOrders.length > 0;
      
      // Check if tab should be closed based on when it was opened
      const tabOpenedDate = new Date(fullTab.opened_at);
      const now = new Date();
      const isCurrentlyOpen = isWithinBusinessHours(fullTab.bar);
      
      // Tab should be closed if:
      // 1. It was opened on a previous day, OR
      // 2. It was opened today but we're now past closing time
      const shouldBeClosed = tabOpenedDate.toDateString() !== now.toDateString() || !isCurrentlyOpen;
      
      // Auto-delete tabs if:
      // 1. Confirmed balance is 0 or negative AND no pending orders
      // 2. Tab should be closed (opened yesterday or past closing time today)
      // 3. Not a 24-hour establishment
      if (confirmedBalance <= 0 && !hasPendingOrders && fullTab.status === 'open' && shouldBeClosed && 
          fullTab.bar.business_hours_mode !== '24hours' && !fullTab.bar.business_24_hours) {
        
        const { error } = await supabase
          .from('tabs')
          .delete()
          .eq('id', tab.id);
          
        if (error) {
          console.error('Error deleting tab:', error);
        } else {
          console.log(`✅ Tab ${tab.id} auto-deleted (zero confirmed balance, opened ${tabOpenedDate.toDateString()}, should be closed: ${shouldBeClosed})`);
        }
      }
      
      // Mark as overdue if has outstanding CONFIRMED balance and should be closed
      else if (confirmedBalance > 0 && fullTab.status === 'open' && shouldBeClosed) {
        const { error } = await (supabase as any)
          .from('tabs')
          .update({ status: 'overdue' })
          .eq('id', tab.id);
          
        if (error) {
          console.error('Error marking tab as overdue:', error);
        } else {
          console.log(`🔴 Tab ${tab.id} marked as overdue (confirmed balance: ${confirmedBalance})`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking overdue tabs:', error);
  }
};
