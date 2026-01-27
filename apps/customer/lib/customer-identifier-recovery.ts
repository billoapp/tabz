/**
 * Customer Identifier Recovery Utilities
 * Provides robust fallback mechanisms for generating customer identifiers
 * when primary storage methods fail (especially on Android PWA)
 */

import { supabase } from './supabase';

export interface TabRecoveryResult {
  success: boolean;
  tab?: any;
  barId?: string;
  source: 'currentTab' | 'alternativeStorage' | 'database' | 'none';
  error?: string;
}

export interface CustomerIdentifierResult {
  success: boolean;
  customerIdentifier?: string;
  deviceId?: string;
  barId?: string;
  error?: string;
  recoveryUsed?: boolean;
}

/**
 * Get device ID with fallback generation
 */
export function getDeviceIdWithFallback(): string {
  // Try primary storage locations
  let deviceId = localStorage.getItem('tabeza_device_id_v2') || localStorage.getItem('Tabeza_device_id');
  
  if (!deviceId || typeof deviceId !== 'string') {
    console.warn('⚠️ Device ID missing, generating new one...');
    
    // Generate new device ID as fallback
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Store in both locations for compatibility
      localStorage.setItem('tabeza_device_id_v2', deviceId);
      localStorage.setItem('Tabeza_device_id', deviceId);
      localStorage.setItem('Tabeza_device_created', new Date().toISOString());
      
      console.log('✅ Generated new device ID:', deviceId.substring(0, 20) + '...');
    } catch (error) {
      console.error('❌ Failed to store device ID:', error);
      // Continue with generated ID even if storage fails
    }
  }
  
  return deviceId;
}

/**
 * Recover tab data using multiple fallback methods
 */
export async function recoverTabData(): Promise<TabRecoveryResult> {
  // Method 1: Check primary currentTab storage
  try {
    const currentTabData = sessionStorage.getItem('currentTab');
    if (currentTabData) {
      const currentTab = JSON.parse(currentTabData);
      if (currentTab && typeof currentTab === 'object' && currentTab.bar_id) {
        return {
          success: true,
          tab: currentTab,
          barId: currentTab.bar_id,
          source: 'currentTab'
        };
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to parse currentTab:', error);
  }
  
  // Method 2: Check alternative storage pattern
  try {
    const currentBarId = sessionStorage.getItem('Tabeza_current_bar');
    if (currentBarId) {
      const alternativeTabData = sessionStorage.getItem(`Tabeza_active_tab_${currentBarId}`);
      if (alternativeTabData) {
        const alternativeTab = JSON.parse(alternativeTabData);
        if (alternativeTab && typeof alternativeTab === 'object') {
          // Restore to primary storage for consistency
          sessionStorage.setItem('currentTab', JSON.stringify(alternativeTab));
          
          return {
            success: true,
            tab: alternativeTab,
            barId: alternativeTab.bar_id || currentBarId,
            source: 'alternativeStorage'
          };
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to parse alternative tab data:', error);
  }
  
  // Method 3: Query database using device ID
  try {
    const deviceId = getDeviceIdWithFallback();
    
    if (deviceId && typeof window !== 'undefined' && window.location) {
      // Query for open tabs with this device ID using singleton client
      const { data: tabs, error } = await supabase
        .from('tabs')
        .select('*, bars!inner(id, name)')
        .like('owner_identifier', `${deviceId}_%`)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);
        
      if (!error && tabs && tabs.length > 0) {
        const recoveredTab = tabs[0];
        const tabData = {
          id: recoveredTab.id,
          bar_id: recoveredTab.bar_id,
          tab_number: recoveredTab.tab_number,
          status: recoveredTab.status,
          owner_identifier: recoveredTab.owner_identifier,
          opened_at: recoveredTab.opened_at
        };
        
        // Store recovered data in both storage methods
        sessionStorage.setItem('currentTab', JSON.stringify(tabData));
        sessionStorage.setItem('Tabeza_current_bar', recoveredTab.bar_id);
        sessionStorage.setItem(`Tabeza_active_tab_${recoveredTab.bar_id}`, JSON.stringify(tabData));
        
        if (recoveredTab.bars) {
          sessionStorage.setItem('barName', recoveredTab.bars.name);
        }
        
        console.log('✅ Recovered tab data from database');
        
        return {
          success: true,
          tab: tabData,
          barId: recoveredTab.bar_id,
          source: 'database'
        };
      }
    }
  } catch (error) {
    console.warn('⚠️ Database recovery failed:', error);
  }
  
  return {
    success: false,
    source: 'none',
    error: 'No tab data found in any storage method'
  };
}

/**
 * Generate customer identifier with comprehensive fallback logic
 */
export async function generateCustomerIdentifierWithFallback(): Promise<CustomerIdentifierResult> {
  try {
    // Step 1: Get device ID with fallback
    const deviceId = getDeviceIdWithFallback();
    
    if (!deviceId) {
      return {
        success: false,
        error: 'Unable to generate or retrieve device ID'
      };
    }
    
    // Step 2: Recover tab data with fallbacks
    const tabRecovery = await recoverTabData();
    
    if (!tabRecovery.success || !tabRecovery.barId) {
      return {
        success: false,
        error: 'Unable to recover tab data or bar ID',
        deviceId
      };
    }
    
    // Step 3: Generate customer identifier
    const customerIdentifier = `${deviceId}_${tabRecovery.barId}`;
    
    // Step 4: Validate customer identifier
    if (!customerIdentifier || customerIdentifier.length < 3 || !customerIdentifier.includes('_')) {
      return {
        success: false,
        error: 'Generated customer identifier is invalid',
        deviceId,
        barId: tabRecovery.barId
      };
    }
    
    console.log('✅ Customer identifier generated successfully:', {
      source: tabRecovery.source,
      recoveryUsed: tabRecovery.source !== 'currentTab',
      identifierLength: customerIdentifier.length
    });
    
    return {
      success: true,
      customerIdentifier,
      deviceId,
      barId: tabRecovery.barId,
      recoveryUsed: tabRecovery.source !== 'currentTab'
    };
    
  } catch (error) {
    console.error('❌ Customer identifier generation failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Validate and repair storage consistency
 */
export function validateAndRepairStorage(): boolean {
  try {
    const currentTabData = sessionStorage.getItem('currentTab');
    const currentBarId = sessionStorage.getItem('Tabeza_current_bar');
    
    // If currentTab is missing but we have alternative storage
    if (!currentTabData && currentBarId) {
      const alternativeTabData = sessionStorage.getItem(`Tabeza_active_tab_${currentBarId}`);
      if (alternativeTabData) {
        sessionStorage.setItem('currentTab', alternativeTabData);
        console.log('✅ Repaired currentTab from alternative storage');
        return true;
      }
    }
    
    // If alternative storage is missing but we have currentTab
    if (currentTabData && !currentBarId) {
      try {
        const currentTab = JSON.parse(currentTabData);
        if (currentTab && currentTab.bar_id) {
          sessionStorage.setItem('Tabeza_current_bar', currentTab.bar_id);
          sessionStorage.setItem(`Tabeza_active_tab_${currentTab.bar_id}`, currentTabData);
          console.log('✅ Repaired alternative storage from currentTab');
          return true;
        }
      } catch (error) {
        console.warn('⚠️ Failed to repair alternative storage:', error);
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Storage repair failed:', error);
    return false;
  }
}