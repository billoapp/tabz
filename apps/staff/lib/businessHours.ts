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

// Check if new tab can be created using unified SQL function
export const canCreateNewTab = async (barId: string): Promise<{
  canCreate: boolean;
  message: string;
  openTime?: string;
}> => {
  try {
    // Use the unified SQL function to check business hours
    const { data, error } = await (supabase as any)
      .rpc('is_within_business_hours_at_time', {
        p_bar_id: barId,
        p_check_time: new Date().toISOString()
      });
    
    if (error) throw error;
    
    const isOpen = data === true;
    
    // Get bar name for message
    const { data: bar } = await supabase
      .from('bars')
      .select('name, business_hours_simple')
      .eq('id', barId)
      .single() as { data: Bar | null, error: any };
    
    const barName = bar?.name || 'Bar';
    
    if (!isOpen) {
      const openTime = bar?.business_hours_simple?.openTime || 'tomorrow';
      return {
        canCreate: false,
        message: `${barName} is currently closed`,
        openTime
      };
    }
    
    return {
      canCreate: true,
      message: `${barName} is open` 
    };
  } catch (error) {
    console.error('Error checking if can create tab:', error);
    return {
      canCreate: true, // Default to allow on error
      message: 'Available'
    };
  }
};

// Check and update tab overdue status using unified SQL function
export const checkTabOverdueStatus = async (tabId: string): Promise<{
  isOverdue: boolean;
  balance: number;
  message: string;
}> => {
  try {
    // Use the unified SQL function to check if tab should be overdue
    const { data: shouldBeOverdue, error: overdueError } = await (supabase as any)
      .rpc('should_tab_be_overdue_unified', {
        p_tab_id: tabId
      });
    
    if (overdueError) {
      console.error('Error checking overdue status:', overdueError);
      throw overdueError;
    }

    // Get current balance using the SQL function
    const { data: balance, error: balanceError } = await (supabase as any)
      .rpc('get_tab_balance', {
        p_tab_id: tabId
      });
    
    if (balanceError) {
      console.error('Error getting tab balance:', balanceError);
      throw balanceError;
    }

    const currentBalance = typeof balance === 'number' ? balance : 0;
    const isOverdue = shouldBeOverdue === true;

    return {
      isOverdue,
      balance: currentBalance,
      message: isOverdue 
        ? `Tab is overdue - Outstanding balance after business hours`
        : currentBalance > 0 
          ? `Balance: KSh ${currentBalance.toFixed(2)}` 
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
    // Use the unified SQL function to update all overdue tabs at once
    const { data: result, error } = await (supabase as any)
      .rpc('update_overdue_tabs_unified');
    
    if (error) {
      console.error('Error updating overdue tabs:', error);
      throw error;
    }

    if (result && Array.isArray(result) && result.length > 0) {
      const { tabs_marked_overdue, tabs_kept_open } = result[0];
      console.log(`✅ Overdue update complete: ${tabs_marked_overdue} marked overdue, ${tabs_kept_open} kept open`);
    }
  } catch (error) {
    console.error('Error checking overdue tabs:', error);
  }
};
