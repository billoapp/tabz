/**
 * Database-first customer identifier resolution
 * The database IS the source of truth - local storage is just caching
 */

import { supabase } from './supabase';

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
 * UPDATED: Handle both old and new device ID formats
 */
export async function getCustomerIdentifierFromDatabase(deviceId: string): Promise<CustomerIdentifierFromDB> {
  try {
    if (!deviceId || typeof deviceId !== 'string') {
      return {
        success: false,
        error: 'Device ID is required'
      };
    }

    console.log('🔍 Searching for tabs with device ID:', deviceId.substring(0, 12) + '...');

    // Try multiple search strategies to handle different formats
    let tabs = null;
    let error = null;

    // Strategy 1: Exact prefix match (new format)
    const { data: exactMatch, error: exactError } = await supabase
      .from('tabs')
      .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
      .like('owner_identifier', `${deviceId}%`)
      .in('status', ['open', 'overdue'])
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!exactError && exactMatch && exactMatch.length > 0) {
      tabs = exactMatch;
      console.log('✅ Found tab using exact prefix match');
    } else {
      // Strategy 2: Try to find by device ID embedded in owner_identifier
      // Handle cases where owner_identifier contains the device ID but not as prefix
      const { data: embeddedMatch, error: embeddedError } = await supabase
        .from('tabs')
        .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
        .like('owner_identifier', `%${deviceId}%`)
        .in('status', ['open', 'overdue'])
        .order('opened_at', { ascending: false })
        .limit(1);

      if (!embeddedError && embeddedMatch && embeddedMatch.length > 0) {
        tabs = embeddedMatch;
        console.log('✅ Found tab using embedded device ID match');
      } else {
        // Strategy 3: Try old format compatibility
        // Extract timestamp from new format device ID and search old format
        const deviceIdParts = deviceId.split('_');
        if (deviceIdParts.length >= 2 && deviceIdParts[0] === 'dev') {
          const timestamp = deviceIdParts[1];
          
          const { data: legacyMatch, error: legacyError } = await supabase
            .from('tabs')
            .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
            .like('owner_identifier', `%${timestamp}%`)
            .in('status', ['open', 'overdue'])
            .order('opened_at', { ascending: false })
            .limit(1);

          if (!legacyError && legacyMatch && legacyMatch.length > 0) {
            tabs = legacyMatch;
            console.log('✅ Found tab using legacy timestamp match');
          }
        }

        // Strategy 4: If still no match, try to find ANY open tab for this user
        // This is a fallback for cases where device ID format changed
        if (!tabs || tabs.length === 0) {
          console.log('⚠️ No direct matches found, trying fallback strategies...');
          
          // Get the most recent open tab (this might be the user's tab)
          const { data: fallbackMatch, error: fallbackError } = await supabase
            .from('tabs')
            .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
            .in('status', ['open', 'overdue'])
            .order('opened_at', { ascending: false })
            .limit(5); // Get a few recent tabs

          if (!fallbackError && fallbackMatch && fallbackMatch.length > 0) {
            // For now, just log this - don't automatically assign
            console.log(`ℹ️ Found ${fallbackMatch.length} recent open tabs as potential matches`);
            fallbackMatch.forEach((tab, index) => {
              console.log(`   ${index + 1}. Tab #${tab.tab_number} - ${tab.owner_identifier?.substring(0, 20)}...`);
            });
          }
        }
      }
    }

    if (!tabs || tabs.length === 0) {
      console.log('❌ No matching tabs found for device ID:', deviceId.substring(0, 12) + '...');
      return {
        success: false,
        error: 'No open tab found for this device'
      };
    }

    const tab = tabs[0];
    
    // The owner_identifier IS the customer identifier!
    const customerIdentifier = tab.owner_identifier;
    
    // Validate that we have a customer identifier
    if (!customerIdentifier) {
      return {
        success: false,
        error: 'Tab found but missing customer identifier'
      };
    }

    console.log('✅ Customer identifier retrieved from database:', {
      tabId: tab.id,
      tabNumber: tab.tab_number,
      barId: tab.bar_id,
      status: tab.status,
      identifierLength: customerIdentifier.length,
      matchStrategy: tabs === exactMatch ? 'exact' : 
                    tabs === embeddedMatch ? 'embedded' : 'legacy'
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
 * UPDATED: Handle multiple device ID formats and storage locations
 */
export function getDeviceId(): string | null {
  try {
    // Try multiple storage locations and formats
    const possibleKeys = [
      'tabeza_device_id_v2',  // New format
      'Tabeza_device_id',     // Legacy format
      'device_id',            // Alternative format
    ];
    
    let deviceId = null;
    
    for (const key of possibleKeys) {
      const stored = localStorage.getItem(key);
      if (stored && typeof stored === 'string' && stored.length >= 10) {
        deviceId = stored;
        console.log(`📱 Found device ID in ${key}:`, deviceId.substring(0, 12) + '...');
        break;
      }
    }
    
    if (!deviceId) {
      console.log('❌ No device ID found in any storage location');
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
 * UPDATED: Added fallback strategies for when device ID resolution fails
 */
export async function resolveCustomerIdentifier(): Promise<CustomerIdentifierFromDB> {
  // Step 1: Get device ID
  const deviceId = getDeviceId();
  
  if (!deviceId) {
    console.log('⚠️ No device ID found, trying fallback strategies...');
    
    // Fallback 1: Try to use current tab from session storage
    try {
      const currentTabData = sessionStorage.getItem('currentTab');
      if (currentTabData) {
        const currentTab = JSON.parse(currentTabData);
        if (currentTab && currentTab.id && currentTab.bar_id && currentTab.owner_identifier) {
          console.log('✅ Using current tab from session storage as fallback');
          return {
            success: true,
            customerIdentifier: currentTab.owner_identifier,
            barId: currentTab.bar_id,
            tabNumber: currentTab.tab_number,
            tabId: currentTab.id
          };
        }
      }
    } catch (error) {
      console.warn('Failed to parse current tab from session storage:', error);
    }
    
    // Fallback 2: Try to find any recent open tab (last resort)
    try {
      console.log('🔍 Trying to find any recent open tab as last resort...');
      const { data: recentTabs, error } = await supabase
        .from('tabs')
        .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
        .in('status', ['open', 'overdue'])
        .order('opened_at', { ascending: false })
        .limit(1);
      
      if (!error && recentTabs && recentTabs.length > 0) {
        const tab = recentTabs[0];
        console.log('⚠️ Using most recent open tab as fallback - this may not be the correct user!');
        console.log(`   Tab #${tab.tab_number} opened at ${tab.opened_at}`);
        
        return {
          success: true,
          customerIdentifier: tab.owner_identifier,
          barId: tab.bar_id,
          tabNumber: tab.tab_number,
          tabId: tab.id
        };
      }
    } catch (error) {
      console.error('Fallback tab search failed:', error);
    }
    
    return {
      success: false,
      error: 'Device ID not found and no fallback tab available. Please refresh the page to register your device.'
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