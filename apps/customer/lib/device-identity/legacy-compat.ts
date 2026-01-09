// /lib/device-identity/legacy-compat.ts
/**
 * Compatibility layer for migration from old deviceId.ts
 */
import { createClient } from '@supabase/supabase-js';
import { getDeviceId } from './index';

// Recreate functions from old deviceId.ts for backward compatibility
export async function getAllOpenTabs(
  supabase: ReturnType<typeof createClient>
): Promise<any[]> {
  try {
    const deviceId = await getDeviceId();
    
    const { data: tabs, error } = await supabase
      .from('tabs')
      .select('*, bars!inner(name, location)')
      .like('owner_identifier', `${deviceId}_%`)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });
    
    return tabs || [];
  } catch (error) {
    console.error('Error fetching open tabs:', error);
    return [];
  }
}

export async function hasOpenTabAtBar(
  barId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ hasTab: boolean; tab?: any }> {
  try {
    const deviceId = await getDeviceId();
    const barDeviceKey = `${deviceId}_${barId}`;
    
    const { data: tab, error } = await supabase
      .from('tabs')
      .select('*')
      .eq('bar_id', barId)
      .eq('owner_identifier', barDeviceKey)
      .eq('status', 'open')
      .maybeSingle();
    
    return { hasTab: !!tab, tab: tab || undefined };
  } catch (error) {
    return { hasTab: false };
  }
}

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

// Clear function matching old API
export function clearDeviceId(): void {
  // Clear all storage layers
  localStorage.removeItem('tabeza_device_id_v2');
  localStorage.removeItem('Tabeza_device_id');
  localStorage.removeItem('Tabeza_fingerprint');
  localStorage.removeItem('Tabeza_device_created');
  localStorage.removeItem('Tabeza_last_seen');
  
  sessionStorage.clear();
  
  // Clear IndexedDB
  if ('indexedDB' in window) {
    indexedDB.deleteDatabase('DeviceStorage');
  }
  
  // Clear cookie
  document.cookie = 'tabeza_device_id_v2=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  
  console.log('🗑️ Device ID cleared (all layers)');
}

// Store active tab (same as before)
export function storeActiveTab(barId: string, tabData: any): void {
  const key = `Tabeza_active_tab_${barId}`;
  sessionStorage.setItem(key, JSON.stringify(tabData));
  sessionStorage.setItem('Tabeza_current_bar', barId);
}

export function getActiveTab(barId?: string): any | null {
  const currentBarId = barId || sessionStorage.getItem('Tabeza_current_bar');
  if (!currentBarId) return null;
  
  const key = `Tabeza_active_tab_${currentBarId}`;
  const data = sessionStorage.getItem(key);
  
  try {
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearActiveTab(barId: string): void {
  const key = `Tabeza_active_tab_${barId}`;
  sessionStorage.removeItem(key);
  sessionStorage.removeItem('Tabeza_current_bar');
}

// Export old interface for compatibility
export interface DeviceInfo {
  deviceId: string;
  fingerprint: string;
  createdAt: string;
  lastSeen: string;
}

export function getDeviceInfo(): DeviceInfo {
  // This is now async, but for compatibility we'll return a sync version
  console.warn('⚠️ Using deprecated sync getDeviceInfo - switch to async version');
  return {
    deviceId: localStorage.getItem('tabeza_device_id_v2') || localStorage.getItem('Tabeza_device_id') || 'unknown',
    fingerprint: localStorage.getItem('Tabeza_fingerprint') || '',
    createdAt: localStorage.getItem('Tabeza_device_created') || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
}

export function getBarDeviceKey(barId: string): string {
  const deviceId = localStorage.getItem('tabeza_device_id_v2') || localStorage.getItem('Tabeza_device_id') || 'unknown';
  return `${deviceId}_${barId}`;
}
