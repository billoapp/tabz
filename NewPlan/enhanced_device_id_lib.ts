// lib/deviceId.ts - Enhanced with Supabase persistence
import { createClient } from '@supabase/supabase-js';

// Storage keys for localStorage
const STORAGE_KEYS = {
  DEVICE_ID: 'Tabeza_device_id',
  FINGERPRINT: 'Tabeza_fingerprint',
  CREATED_AT: 'Tabeza_device_created',
  LAST_SYNCED: 'Tabeza_last_synced',
  SYNC_FAILED: 'Tabeza_sync_failed'
} as const;

// Sync interval: only sync to DB every 5 minutes to reduce load
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Generate browser fingerprint for device validation
 * Creates a unique hash based on browser characteristics
 */
export function getBrowserFingerprint(): string {
  try {
    // Canvas fingerprinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasFingerprint = '';
    
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('fingerprint', 2, 2);
      canvasFingerprint = canvas.toDataURL();
    }
    
    // Collect browser characteristics
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages?.join(',') || '',
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      canvas: canvasFingerprint,
      touchSupport: 'ontouchstart' in window,
      cookieEnabled: navigator.cookieEnabled
    };
    
    // Simple hash function
    const str = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    // Fallback to timestamp-based fingerprint
    return `fallback_${Date.now().toString(36)}`;
  }
}

/**
 * Get device information for analytics
 */
export function getDeviceInfo(): Record<string, any> {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: (navigator as any).deviceMemory || null
  };
}

/**
 * Main function: Get or create device ID with Supabase persistence
 * Returns existing device ID or creates new one
 */
export async function getDeviceId(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  try {
    // Step 1: Try to get from localStorage (fastest)
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    const fingerprint = getBrowserFingerprint();
    
    // Step 2: If device ID exists in localStorage, validate it
    if (deviceId) {
      console.log('📱 Device ID found in localStorage:', deviceId.slice(0, 20) + '...');
      
      // Check if we need to sync with Supabase
      const shouldSync = await shouldSyncWithSupabase();
      
      if (shouldSync) {
        const isValid = await validateDeviceId(deviceId, fingerprint, supabase);
        
        if (isValid) {
          // Valid device, update last seen
          await updateDeviceLastSeen(deviceId, supabase);
          return deviceId;
        } else {
          console.warn('⚠️ Device ID invalid, attempting recovery...');
          clearLocalDeviceId();
          deviceId = null;
        }
      } else {
        // Skip validation, return cached device ID
        return deviceId;
      }
    }
    
    // Step 3: Try to recover device ID from Supabase using fingerprint
    if (!deviceId) {
      console.log('🔍 Attempting to recover device from fingerprint...');
      const recoveredDevice = await recoverDeviceFromFingerprint(fingerprint, supabase);
      
      if (recoveredDevice) {
        console.log('✅ Device recovered from Supabase:', recoveredDevice.device_id.slice(0, 20) + '...');
        
        // Restore to localStorage
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, recoveredDevice.device_id);
        localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fingerprint);
        localStorage.setItem(STORAGE_KEYS.CREATED_AT, recoveredDevice.created_at);
        localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
        
        // Update install count
        await incrementInstallCount(recoveredDevice.device_id, supabase);
        
        return recoveredDevice.device_id;
      }
    }
    
    // Step 4: Create new device ID (first time or recovery failed)
    console.log('🆕 Creating new device ID...');
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save to Supabase first (source of truth)
    const created = await createDeviceInSupabase(deviceId, fingerprint, supabase);
    
    if (!created) {
      console.error('❌ Failed to create device in Supabase');
      // Continue with localStorage-only fallback
      localStorage.setItem(STORAGE_KEYS.SYNC_FAILED, 'true');
    }
    
    // Cache in localStorage
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fingerprint);
    localStorage.setItem(STORAGE_KEYS.CREATED_AT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
    
    console.log('✅ New device ID created:', deviceId.slice(0, 20) + '...');
    return deviceId;
    
  } catch (error) {
    console.error('❌ Error in getDeviceId:', error);
    
    // Fallback: try localStorage or generate temporary ID
    const fallbackId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID) || 
                      `device_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.warn('⚠️ Using fallback device ID:', fallbackId.slice(0, 20) + '...');
    return fallbackId;
  }
}

/**
 * Check if we should sync with Supabase (to reduce API calls)
 */
async function shouldSyncWithSupabase(): Promise<boolean> {
  try {
    const lastSynced = localStorage.getItem(STORAGE_KEYS.LAST_SYNCED);
    
    if (!lastSynced) {
      return true; // Never synced before
    }
    
    const timeSinceSync = Date.now() - new Date(lastSynced).getTime();
    return timeSinceSync >= SYNC_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Create new device record in Supabase
 */
async function createDeviceInSupabase(
  deviceId: string,
  fingerprint: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const deviceInfo = getDeviceInfo();
    
    const { error } = await supabase
      .from('devices')
      .insert({
        device_id: deviceId,
        fingerprint: fingerprint,
        user_id: user?.id || null,
        user_agent: deviceInfo.userAgent,
        platform: deviceInfo.platform,
        screen_resolution: deviceInfo.screenResolution,
        timezone: deviceInfo.timezone,
        language: deviceInfo.language,
        hardware_concurrency: deviceInfo.hardwareConcurrency,
        device_memory: deviceInfo.deviceMemory,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        pwa_installed: window.matchMedia('(display-mode: standalone)').matches
      });
    
    if (error) {
      console.error('Error creating device in Supabase:', error);
      return false;
    }
    
    console.log('✅ Device saved to Supabase');
    return true;
  } catch (error) {
    console.error('Exception creating device in Supabase:', error);
    return false;
  }
}

/**
 * Validate device ID against Supabase
 */
async function validateDeviceId(
  deviceId: string,
  fingerprint: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error || !device) {
      console.warn('❌ Device ID not found in Supabase');
      return false;
    }
    
    // Check if device is active
    if (!device.is_active) {
      console.warn('❌ Device has been deactivated');
      return false;
    }
    
    // Check fingerprint match (with tolerance for minor changes)
    if (device.fingerprint !== fingerprint) {
      console.warn('⚠️ Fingerprint mismatch - device characteristics may have changed');
      // Don't immediately invalidate - fingerprints can change slightly
      // Update fingerprint in background
      supabase
        .from('devices')
        .update({ fingerprint: fingerprint })
        .eq('device_id', deviceId)
        .then(() => console.log('🔄 Fingerprint updated'));
    }
    
    return true;
  } catch (error) {
    console.error('Error validating device ID:', error);
    return false;
  }
}

/**
 * Recover device from Supabase using fingerprint
 */
async function recoverDeviceFromFingerprint(
  fingerprint: string,
  supabase: ReturnType<typeof createClient>
): Promise<any | null> {
  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('*')
      .eq('fingerprint', fingerprint)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('last_seen', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error || !device) {
      console.log('🔍 No device found with matching fingerprint');
      return null;
    }
    
    console.log('✅ Device recovered from fingerprint');
    return device;
  } catch (error) {
    console.error('Error recovering device:', error);
    return null;
  }
}

/**
 * Update device last seen timestamp
 */
async function updateDeviceLastSeen(
  deviceId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Check if we should skip sync (rate limiting)
    const shouldSync = await shouldSyncWithSupabase();
    if (!shouldSync) {
      return;
    }
    
    await supabase
      .from('devices')
      .update({ 
        last_seen: new Date().toISOString()
      })
      .eq('device_id', deviceId);
    
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
  } catch (error) {
    console.error('Error updating last seen:', error);
    // Non-critical, don't throw
  }
}

/**
 * Increment install count when device is recovered after reinstall
 */
async function incrementInstallCount(
  deviceId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    await supabase.rpc('increment_device_installs', { device_id_param: deviceId });
  } catch (error) {
    console.error('Error incrementing install count:', error);
  }
}

/**
 * Clear local device ID (for testing/debugging)
 */
export function clearLocalDeviceId(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('🗑️ Local device ID cleared');
}

/**
 * Get bar-specific device key
 */
export async function getBarDeviceKey(
  barId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const deviceId = await getDeviceId(supabase);
  return `${deviceId}_${barId}`;
}

/**
 * Check if device has an open tab at specific bar
 */
export async function hasOpenTabAtBar(
  barId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ hasTab: boolean; tab?: any }> {
  try {
    const barDeviceKey = await getBarDeviceKey(barId, supabase);
    
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
    const deviceId = await getDeviceId(supabase);
    
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
 * Store tab in session storage for quick access
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
 * Clear tab from session storage when closed
 */
export function clearActiveTab(barId: string): void {
  const key = `Tabeza_active_tab_${barId}`;
  sessionStorage.removeItem(key);
}