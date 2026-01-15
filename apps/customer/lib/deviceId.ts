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
  const storageKey = 'Tabeza_device_id';
  const fingerprintKey = 'Tabeza_fingerprint';
  const createdKey = 'Tabeza_device_created';
  
  let deviceId = localStorage.getItem(storageKey);
  let fingerprint = localStorage.getItem(fingerprintKey);
  const createdAt = localStorage.getItem(createdKey);
  
  // Generate new device ID if missing
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, deviceId);
    localStorage.setItem(createdKey, new Date().toISOString());
  }
  
  // Generate/validate fingerprint
  const currentFingerprint = getBrowserFingerprint();
  if (!fingerprint) {
    localStorage.setItem(fingerprintKey, currentFingerprint);
    fingerprint = currentFingerprint;
  } else if (fingerprint !== currentFingerprint) {
    console.warn('⚠️ Device fingerprint changed - possible device ID manipulation');
    // Don't immediately invalidate - fingerprints can change slightly
    // Instead, log for monitoring
  }
  
  // Update last seen
  localStorage.setItem('Tabeza_last_seen', new Date().toISOString());
  
  return deviceId;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    deviceId: getDeviceId(),
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
