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
 * UPDATED: Handle PWA device ID formats and Android PWA compatibility
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
    let matchStrategy = 'none';

    // Strategy 1: Exact prefix match (handles all formats: device_, pwa_, pwa_android_)
    const { data: exactMatch, error: exactError } = await supabase
      .from('tabs')
      .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
      .like('owner_identifier', `${deviceId}_%`)
      .in('status', ['open', 'overdue'])
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!exactError && exactMatch && exactMatch.length > 0) {
      tabs = exactMatch;
      matchStrategy = 'exact';
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
        matchStrategy = 'embedded';
        console.log('✅ Found tab using embedded device ID match');
      } else {
        // Strategy 3: Cross-format compatibility
        // Try to match different device ID formats
        const deviceIdParts = deviceId.split('_');
        let alternativeSearches: string[] = [];
        
        if (deviceIdParts.length >= 3) {
          const timestamp = deviceIdParts[deviceIdParts.length - 2]; // Second to last part is usually timestamp
          const random = deviceIdParts[deviceIdParts.length - 1]; // Last part is usually random
          
          // Try different format combinations
          alternativeSearches = [
            `device_${timestamp}_${random}`,     // Standard web format
            `pwa_${timestamp}_${random}`,        // PWA format
            `pwa_android_${timestamp}_${random}` // Android PWA format
          ];
        }
        
        // Also try legacy timestamp matching for old format compatibility
        if (deviceIdParts.length >= 2) {
          const timestamp = deviceIdParts[1];
          alternativeSearches.push(`%${timestamp}%`);
        }
        
        for (const searchPattern of alternativeSearches) {
          if (searchPattern === deviceId) continue; // Skip if same as original
          
          const { data: altMatch, error: altError } = await supabase
            .from('tabs')
            .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
            .like('owner_identifier', searchPattern.includes('%') ? searchPattern : `${searchPattern}_%`)
            .in('status', ['open', 'overdue'])
            .order('opened_at', { ascending: false })
            .limit(1);

          if (!altError && altMatch && altMatch.length > 0) {
            tabs = altMatch;
            matchStrategy = 'cross-format';
            console.log('✅ Found tab using cross-format compatibility:', searchPattern);
            break;
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
      matchStrategy: matchStrategy
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
 * UPDATED: Handle multiple device ID formats, storage locations, and PWA compatibility
 */
export function getDeviceId(): string | null {
  try {
    // Try multiple storage locations and formats
    const possibleKeys = [
      'Tabeza_device_id',         // Primary key (current)
      'tabeza_device_id_v2',      // Alternative format
      'device_id',                // Legacy format
    ];
    
    let deviceId = null;
    let foundInKey = null;
    
    // First try localStorage
    for (const key of possibleKeys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored && typeof stored === 'string' && stored.length >= 10) {
          deviceId = stored;
          foundInKey = key;
          console.log(`📱 Found device ID in localStorage[${key}]:`, deviceId.substring(0, 12) + '...');
          break;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to read from localStorage[${key}]:`, error);
      }
    }
    
    // If not found in localStorage, try sessionStorage (PWA fallback)
    if (!deviceId) {
      for (const key of possibleKeys) {
        try {
          const stored = sessionStorage.getItem(key);
          if (stored && typeof stored === 'string' && stored.length >= 10) {
            deviceId = stored;
            foundInKey = key;
            console.log(`📱 Found device ID in sessionStorage[${key}]:`, deviceId.substring(0, 12) + '...');
            
            // Try to migrate to localStorage if possible
            try {
              localStorage.setItem('Tabeza_device_id', deviceId);
              console.log('✅ Migrated device ID from sessionStorage to localStorage');
            } catch (migrateError) {
              console.warn('⚠️ Could not migrate device ID to localStorage:', migrateError);
            }
            break;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to read from sessionStorage[${key}]:`, error);
        }
      }
    }
    
    if (!deviceId) {
      console.log('❌ No device ID found in any storage location');
      return null;
    }
    
    // Validate device ID format
    const validFormats = [
      /^device_\d+_[a-z0-9]+$/,           // Standard: device_1234567890_abc123
      /^pwa_\d+_[a-z0-9]+$/,              // PWA: pwa_1234567890_abc123
      /^pwa_android_\d+_[a-z0-9]+$/,      // Android PWA: pwa_android_1234567890_abc123
      /^dev_\d+_[a-z0-9]+$/,              // Legacy: dev_1234567890_abc123
    ];
    
    const isValidFormat = validFormats.some(pattern => pattern.test(deviceId));
    
    if (!isValidFormat) {
      console.warn('⚠️ Device ID has unexpected format:', deviceId.substring(0, 20) + '...');
      // Don't reject it - might be a valid legacy format
    }
    
    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    return null;
  }
}

/**
 * Detect and repair corrupted tab data in session storage
 * This fixes the common issue where tab data exists but has undefined fields
 */
function detectAndRepairCorruptedTabData(deviceId: string): CustomerIdentifierFromDB | null {
  console.log('🔍 Checking for corrupted tab data...');
  
  try {
    const currentTabData = sessionStorage.getItem('currentTab');
    const currentBar = sessionStorage.getItem('Tabeza_current_bar');
    
    if (currentTabData && currentBar) {
      const currentTab = JSON.parse(currentTabData);
      
      // Check if tab data exists but has corrupted fields
      if (currentTab && currentTab.id && currentTab.tab_number) {
        const hasCorruptedBarId = !currentTab.bar_id || currentTab.bar_id === 'undefined';
        const hasCorruptedOwnerIdentifier = !currentTab.owner_identifier || currentTab.owner_identifier === 'undefined';
        
        if (hasCorruptedBarId || hasCorruptedOwnerIdentifier) {
          console.log('🔧 Detected corrupted tab data, attempting repair...');
          console.log(`   Corrupted bar_id: ${hasCorruptedBarId}`);
          console.log(`   Corrupted owner_identifier: ${hasCorruptedOwnerIdentifier}`);
          
          // Repair the corrupted data
          const repairedTab = {
            ...currentTab,
            bar_id: currentBar,
            owner_identifier: `${deviceId}_${currentBar}`
          };
          
          // Save the repaired data
          sessionStorage.setItem('currentTab', JSON.stringify(repairedTab));
          
          console.log('✅ Tab data repaired successfully');
          console.log(`   Fixed bar_id: ${repairedTab.bar_id}`);
          console.log(`   Fixed owner_identifier: ${repairedTab.owner_identifier.substring(0, 30)}...`);
          
          return {
            success: true,
            customerIdentifier: repairedTab.owner_identifier,
            barId: repairedTab.bar_id,
            tabNumber: repairedTab.tab_number,
            tabId: repairedTab.id
          };
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to check/repair corrupted tab data:', error);
  }
  
  return null;
}

/**
 * Complete customer identifier resolution - database first approach
 * This replaces all the complex fallback logic with a simple database query
 * UPDATED: Enhanced fallback strategies, corruption detection, and better error handling
 */
export async function resolveCustomerIdentifier(): Promise<CustomerIdentifierFromDB> {
  console.log('🔍 Starting customer identifier resolution...');
  
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

  console.log('📱 Device ID found:', deviceId.substring(0, 20) + '...');

  // Step 1.5: Check for and repair corrupted tab data BEFORE database query
  const repairedData = detectAndRepairCorruptedTabData(deviceId);
  if (repairedData) {
    console.log('✅ Customer identifier resolved from repaired session data');
    return repairedData;
  }

  // Step 2: Query database for customer identifier with enhanced search
  const result = await getCustomerIdentifierFromDatabase(deviceId);
  
  if (result.success && result.customerIdentifier && result.barId) {
    console.log('✅ Customer identifier resolved successfully');
    
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
    
    return result;
  }

  // Step 4: Enhanced fallback - try to find tab by partial device ID match
  if (!result.success) {
    console.log('⚠️ Primary resolution failed, trying enhanced fallback...');
    
    try {
      // Extract timestamp from device ID for partial matching
      const deviceIdParts = deviceId.split('_');
      if (deviceIdParts.length >= 2) {
        const timestamp = deviceIdParts[deviceIdParts.length - 2]; // Second to last part
        
        console.log('🔍 Trying partial match with timestamp:', timestamp);
        
        const { data: partialMatch, error: partialError } = await supabase
          .from('tabs')
          .select('id, bar_id, owner_identifier, tab_number, status, opened_at')
          .like('owner_identifier', `%${timestamp}%`)
          .in('status', ['open', 'overdue'])
          .order('opened_at', { ascending: false })
          .limit(1);

        if (!partialError && partialMatch && partialMatch.length > 0) {
          const tab = partialMatch[0];
          console.log('✅ Found tab using partial timestamp match');
          console.log(`   Tab #${tab.tab_number} - ${tab.owner_identifier?.substring(0, 30)}...`);
          
          // Update cache with found tab
          try {
            const tabData = {
              id: tab.id,
              bar_id: tab.bar_id,
              tab_number: tab.tab_number,
              owner_identifier: tab.owner_identifier
            };
            
            sessionStorage.setItem('currentTab', JSON.stringify(tabData));
            sessionStorage.setItem('Tabeza_current_bar', tab.bar_id);
          } catch (cacheError) {
            console.warn('⚠️ Failed to update cache:', cacheError);
          }
          
          return {
            success: true,
            customerIdentifier: tab.owner_identifier,
            barId: tab.bar_id,
            tabNumber: tab.tab_number,
            tabId: tab.id
          };
        }
      }
    } catch (error) {
      console.error('Enhanced fallback failed:', error);
    }
  }

  // Step 5: Final fallback - provide helpful error message
  console.log('❌ All resolution strategies failed');
  
  return {
    success: false,
    error: result.error || 'Unable to find your tab. Please scan the QR code again or refresh the page.'
  };
}