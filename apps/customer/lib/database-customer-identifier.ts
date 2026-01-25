/**
 * Database-first customer identifier resolution
 * The database IS the source of truth - local storage is just caching
 */

import { createClient } from '@supabase/supabase-js';

export interface CustomerIdentifierFromDB {
  success: boolean;
  customerIdentifier?: string;
  barId?: string;
  tabNumber?: number;
  tabId?: string;
  error?: string;
}

/**
 * Get customer identifier directly from database using device ID
 * This is the PROPER way - database has the customer identifier as owner_identifier
 */
export async function getCustomerIdentifierFromDatabase(deviceId: string): Promise<CustomerIdentifierFromDB> {
  try {
    if (!deviceId || typeof deviceId !== 'string') {
      return {
        success: false,
        error: 'Device ID is required'
      };
    }

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase configuration missing'
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Query database for open tabs with this device ID
    // The owner_identifier IS the customer identifier we need!
    const { data: tabs, error } = await supabase
      .from('tabs')
      .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
      .like('owner_identifier', `${deviceId}_%`)
      .in('status', ['open', 'overdue'])
      .order('opened_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Database query error:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }

    if (!tabs || tabs.length === 0) {
      return {
        success: false,
        error: 'No open tab found for this device'
      };
    }

    const tab = tabs[0];
    
    // The owner_identifier IS the customer identifier!
    const customerIdentifier = tab.owner_identifier;
    
    // Validate the format (should be device_id_bar_id)
    if (!customerIdentifier || !customerIdentifier.includes('_')) {
      return {
        success: false,
        error: 'Invalid customer identifier format in database'
      };
    }

    console.log('✅ Customer identifier retrieved from database:', {
      tabId: tab.id,
      tabNumber: tab.tab_number,
      barId: tab.bar_id,
      status: tab.status,
      identifierLength: customerIdentifier.length
    });

    return {
      success: true,
      customerIdentifier,
      barId: tab.bar_id,
      tabNumber: tab.tab_number,
      tabId: tab.id
    };

  } catch (error) {
    console.error('Failed to get customer identifier from database:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

/**
 * Get device ID from localStorage with validation
 */
export function getDeviceId(): string | null {
  try {
    // Try both storage locations
    const deviceId = localStorage.getItem('tabeza_device_id_v2') || localStorage.getItem('Tabeza_device_id');
    
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 10) {
      return null;
    }
    
    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    return null;
  }
}

/**
 * Complete customer identifier resolution - database first approach
 * This replaces all the complex fallback logic with a simple database query
 */
export async function resolveCustomerIdentifier(): Promise<CustomerIdentifierFromDB> {
  // Step 1: Get device ID
  const deviceId = getDeviceId();
  
  if (!deviceId) {
    return {
      success: false,
      error: 'Device ID not found. Please refresh the page to register your device.'
    };
  }

  // Step 2: Query database for customer identifier
  const result = await getCustomerIdentifierFromDatabase(deviceId);
  
  if (result.success && result.customerIdentifier && result.barId) {
    // Step 3: Update local cache for performance (optional)
    try {
      const tabData = {
        id: result.tabId,
        bar_id: result.barId,
        tab_number: result.tabNumber,
        owner_identifier: result.customerIdentifier
      };
      
      sessionStorage.setItem('currentTab', JSON.stringify(tabData));
      sessionStorage.setItem('Tabeza_current_bar', result.barId);
      
      console.log('✅ Updated local cache from database');
    } catch (cacheError) {
      // Cache update failure is not critical
      console.warn('⚠️ Failed to update cache, but payment can proceed:', cacheError);
    }
  }

  return result;
}