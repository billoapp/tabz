// lib/deviceId.ts - ENHANCED VERSION
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  DEVICE_ID: 'Tabeza_device_id',
  FINGERPRINT: 'Tabeza_fingerprint', 
  CREATED_AT: 'Tabeza_device_created',
  LAST_SYNCED: 'Tabeza_last_synced'
};

// Generate browser fingerprint for additional validation
function getBrowserFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasFingerprint: canvas.toDataURL(),
  };
  
  const str = JSON.stringify(fingerprint);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export interface DeviceInfo {
  deviceId: string;
  fingerprint: string;
  createdAt: string;
  lastSeen: string;
}

export function getDeviceId(): string {
  try {
    // Step 1: Try to get from localStorage (fastest)
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    const fingerprint = getBrowserFingerprint();
    
    // Step 2: Validate localStorage device ID against Supabase
    if (deviceId) {
      // Skip validation for now since we don't have Supabase table
      const isValid = true;
      
      if (isValid) {
        // Skip update for now since we don't have Supabase table
        return deviceId;
      } else {
        console.warn('⚠️ Device ID in localStorage is invalid, regenerating...');
        clearLocalDeviceId();
        deviceId = null;
      }
    }
    
    // Step 3: Try to recover device ID from Supabase using fingerprint
    // Skip recovery for now since we don't have Supabase table
    const recoveredDevice = null;
    
    if (recoveredDevice) {
      // Skip recovery logic since we don't have Supabase table
      console.log('✅ Skipping device recovery - no Supabase table');
    }
    
    // Step 4: Create new device ID (first time or after recovery failed)
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save to Supabase first (source of truth)
    // Skip for now since we don't have Supabase table
    console.warn('⚠️ Devices table not found, skipping Supabase registration');
    
    // Then cache in localStorage
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fingerprint);
    localStorage.setItem(STORAGE_KEYS.CREATED_AT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
    
    console.log('✅ Created new device ID:', deviceId);
    return deviceId;
    
  } catch (error) {
    console.error('❌ Error in getDeviceId:', error);
    
    // Fallback: generate temporary device ID
    const fallbackId = `device_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.warn('⚠️ Using temporary device ID:', fallbackId);
    return fallbackId;
  }
}

// Helper functions for Supabase device management
async function createDeviceInSupabase(
  deviceId: string, 
  fingerprint: string, 
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // TODO: Uncomment when devices table is created
    // Check if devices table exists first
    // const { error: tableCheckError } = await supabase
    //   .from('devices')
    //   .select('device_id')
    //   .limit(1);
    
    // if (tableCheckError) {
    //   console.warn('⚠️ Devices table not found, skipping Supabase registration');
    //   return;
    // }
    
    // await supabase
    //   .from('devices')
    //   .insert({
    //     device_id: deviceId,
    //     fingerprint,
    //     user_agent: navigator.userAgent,
    //     platform: navigator.platform,
    //     screen_resolution: `${screen.width}x${screen.height}`,
    //     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    //     created_at: new Date().toISOString(),
    //     last_seen: new Date().toISOString(),
    //     is_active: true,
    //     suspicious_activity_count: 0
    //   });
    
    console.warn('⚠️ Devices table not implemented yet, skipping Supabase registration');
  } catch (error) {
    console.error('❌ Error creating device in Supabase:', error);
    // Don't throw - continue with localStorage only
  }
}

async function validateDeviceId(
  deviceId: string,
  fingerprint: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    // TODO: Uncomment when devices table is created
    // Check if devices table exists first
    // Skip validation for now since we don't have Supabase table
    // const tableCheckError = { message: 'Table not found' };
    
    // if (tableCheckError) {
    //   console.warn('⚠️ Devices table not found, skipping validation');
    //   return true; // Allow device if table doesn't exist
    // }
    
    // Skip database query for now since we don't have Supabase table
    // const device = null;
    
    // if (!device) {
    //   return false;
    // }
    
    // Check if fingerprint matches (allow some flexibility)
    // Skip fingerprint check for now since we don't have device from database
    // const isFingerprintValid = true;
    
    // if (!isFingerprintValid) {
    //   console.warn('⚠️ Fingerprint mismatch for device:', deviceId);
    // }
    
    console.warn('⚠️ Devices table not implemented yet, skipping validation');
    return true; // Allow all devices until table is implemented
  } catch (error) {
    console.error('❌ Error validating device ID:', error);
    return false;
  }
}

async function recoverDeviceFromFingerprint(
  fingerprint: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ device_id: string; created_at: string } | null> {
  try {
    // TODO: Uncomment when devices table is created
    // Skip database query for now since we don't have Supabase table
    console.warn('⚠️ Devices table not implemented yet, skipping recovery');
    return null;
  } catch (error) {
    console.error('❌ Error recovering device from fingerprint:', error);
    return null;
  }
}

async function updateDeviceLastSeen(
  deviceId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // TODO: Uncomment when devices table is created
    // Skip database query for now since we don't have Supabase table
    console.warn('⚠️ Devices table not implemented yet, skipping update');
    return;
  } catch (error) {
    console.error('❌ Error updating device last seen:', error);
  }
}

function clearLocalDeviceId(): void {
  localStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
  localStorage.removeItem(STORAGE_KEYS.FINGERPRINT);
  localStorage.removeItem(STORAGE_KEYS.CREATED_AT);
  localStorage.removeItem(STORAGE_KEYS.LAST_SYNCED);
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = getDeviceId();
  
  // TODO: Add async Supabase operations here when devices table is ready
  // - Validate device ID against database
  // - Update last seen timestamp
  // - Sync device fingerprint
  
  return {
    deviceId: deviceId,
    fingerprint: localStorage.getItem(STORAGE_KEYS.FINGERPRINT) || '',
    createdAt: localStorage.getItem(STORAGE_KEYS.CREATED_AT) || new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
}

export function getBarDeviceKey(barId: string): string {
  const deviceId = getDeviceId();
  return `${deviceId}_${barId}`;
}

/**
 * Check if device has an open tab at a specific bar
 */
export async function hasOpenTabAtBar(
  barId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ hasTab: boolean; tab?: any }> {
  try {
    const barDeviceKey = getBarDeviceKey(barId);
    
    const { data: tab, error } = await supabase
      .from('tabs')
      .select('*')
      .eq('bar_id', barId)
      .eq('owner_identifier', barDeviceKey)
      .eq('status', 'open')
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking for open tab:', error);
      return { hasTab: false };
    }
    
    return { 
      hasTab: !!tab,
      tab: tab || undefined
    };
  } catch (error) {
    console.error('Exception checking for open tab:', error);
    return { hasTab: false };
  }
}

/**
 * Get all open tabs for this device (across all bars)
 */
export async function getAllOpenTabs(
  supabase: ReturnType<typeof createClient>
): Promise<any[]> {
  try {
    const deviceId = getDeviceId();
    
    // Query tabs where owner_identifier starts with this device ID
    const { data: tabs, error } = await supabase
      .from('tabs')
      .select('*, bars!inner(name, location)')
      .like('owner_identifier', `${deviceId}_%`)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching open tabs:', error);
      return [];
    }
    
    return tabs || [];
  } catch (error) {
    console.error('Exception fetching open tabs:', error);
    return [];
  }
}

/**
 * Validate device integrity before creating new tab
 */
export async function validateDeviceForNewTab(
  barId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ valid: boolean; reason?: string; existingTab?: any }> {
  // Check for existing open tab at this bar
  const { hasTab, tab } = await hasOpenTabAtBar(barId, supabase);
  
  if (hasTab) {
    return {
      valid: false,
      reason: 'EXISTING_TAB_AT_BAR',
      existingTab: tab
    };
  }
  
  // Check device history for suspicious patterns
  const allTabs = await getAllOpenTabs(supabase);
  
  // Allow tabs at different bars (multi-bar support)
  // But warn if too many tabs are open across different bars
  if (allTabs.length >= 5) {
    console.warn(`⚠️ Device has ${allTabs.length} open tabs across multiple bars`);
    // Don't block, but log for analytics
  }
  
  return { valid: true };
}

/**
 * Clear device ID (for testing/debugging only)
 */
export function clearDeviceId(): void {
  localStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
  localStorage.removeItem(STORAGE_KEYS.FINGERPRINT);
  localStorage.removeItem(STORAGE_KEYS.CREATED_AT);
  localStorage.removeItem(STORAGE_KEYS.LAST_SYNCED);
  console.log('🗑️ Device ID cleared');
}

/**
 * Store tab in local memory for quick access
 */
export function storeActiveTab(barId: string, tabData: any): void {
  const key = `Tabeza_active_tab_${barId}`;
  sessionStorage.setItem(key, JSON.stringify(tabData));
  sessionStorage.setItem('Tabeza_current_bar', barId);
}

/**
 * Get active tab for current bar
 */
export function getActiveTab(barId?: string): any | null {
  const currentBarId = barId || sessionStorage.getItem('Tabeza_current_bar');
  if (!currentBarId) return null;
  
  const key = `Tabeza_active_tab_${currentBarId}`;
  const data = sessionStorage.getItem(key);
  
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Clear tab from local memory when closed
 */
export function clearActiveTab(barId: string): void {
  const key = `Tabeza_active_tab_${barId}`;
  sessionStorage.removeItem(key);
}
