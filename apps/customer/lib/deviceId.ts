// lib/deviceId.ts - ENHANCED VERSION
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AnalyticsEngine } from './analytics-engine';

const STORAGE_KEYS = {
  DEVICE_ID: 'Tabeza_device_id',
  FINGERPRINT: 'Tabeza_fingerprint', 
  CREATED_AT: 'Tabeza_device_created',
  LAST_SYNCED: 'Tabeza_last_synced'
};

// PWA Installation Event Handling
let pwaInstallEventListenersAdded = false;

// Initialize PWA installation event handling
export function initializePWAInstallationHandling(supabase: SupabaseClient): void {
  if (typeof window === 'undefined' || pwaInstallEventListenersAdded) {
    return; // Skip on server-side or if already initialized
  }

  console.log('🔧 Initializing PWA installation event handling...');

  // Listen for beforeinstallprompt event
  const handleBeforeInstallPrompt = async (event: Event) => {
    console.log('📱 PWA: beforeinstallprompt event detected');
    
    try {
      const deviceId = await getDeviceId(supabase);
      await updateDeviceMetadata(supabase, deviceId, {
        pwa_install_prompt_shown: true,
        pwa_install_prompt_timestamp: new Date().toISOString(),
        last_install_prompt_ua: navigator.userAgent
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 PWA install prompt metadata updated for device:', deviceId.substring(0, 20) + '...');
      }
    } catch (error) {
      console.warn('⚠️ Failed to update PWA install prompt metadata:', error);
    }
  };

  // Listen for appinstalled event
  const handleAppInstalled = async (event: Event) => {
    console.log('✅ PWA: App installed successfully');
    
    try {
      const deviceId = await getDeviceId(supabase);
      
      // Increment install count and update metadata
      await Promise.all([
        incrementDeviceInstallCount(deviceId, supabase),
        updateDeviceMetadata(supabase, deviceId, {
          pwa_installed: true,
          pwa_install_timestamp: new Date().toISOString(),
          pwa_install_ua: navigator.userAgent,
          pwa_display_mode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
        })
      ]);
      
      console.log('✅ PWA installation recorded for device:', deviceId.substring(0, 20) + '...');
      
      // Store installation event in localStorage for debugging
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('Tabeza_pwa_install_debug', JSON.stringify({
          timestamp: new Date().toISOString(),
          deviceId: deviceId.substring(0, 20) + '...',
          userAgent: navigator.userAgent,
          displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
        }));
      }
    } catch (error) {
      console.error('❌ Failed to record PWA installation:', error);
    }
  };

  // Listen for display mode changes (PWA launch detection)
  const handleDisplayModeChange = async () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isStandalone) {
      console.log('📱 PWA: Launched in standalone mode');
      
      try {
        const deviceId = await getDeviceId(supabase);
        await updateDeviceMetadata(supabase, deviceId, {
          pwa_last_standalone_launch: new Date().toISOString(),
          pwa_standalone_launches: 'increment' // Special value to increment counter
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 PWA standalone launch recorded for device:', deviceId.substring(0, 20) + '...');
        }
      } catch (error) {
        console.warn('⚠️ Failed to record PWA standalone launch:', error);
      }
    }
  };

  // Add event listeners
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  
  // Check display mode on load and when it changes
  handleDisplayModeChange();
  window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);

  pwaInstallEventListenersAdded = true;
  console.log('✅ PWA installation event listeners added');
}

// Update device metadata helper function
async function updateDeviceMetadata(
  supabase: SupabaseClient, 
  deviceId: string, 
  metadata: Record<string, any>
): Promise<void> {
  try {
    // Get current metadata
    const { data: device } = await supabase
      .from('devices')
      .select('metadata')
      .eq('device_id', deviceId)
      .maybeSingle();

    const currentMetadata = device?.metadata || {};
    
    // Handle special increment values
    const updatedMetadata = { ...currentMetadata };
    for (const [key, value] of Object.entries(metadata)) {
      if (value === 'increment') {
        updatedMetadata[key] = (updatedMetadata[key] || 0) + 1;
      } else {
        updatedMetadata[key] = value;
      }
    }

    // Update device metadata
    const { error } = await supabase
      .from('devices')
      .update({ 
        metadata: updatedMetadata,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', deviceId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('❌ Error updating device metadata:', error);
    throw error;
  }
}

// Get PWA installation debug information
export function getPWAInstallationDebugInfo(): any {
  if (typeof window === 'undefined') {
    return { error: 'Server-side environment' };
  }

  try {
    const debugInfo = {
      // PWA Support Detection
      serviceWorkerSupported: 'serviceWorker' in navigator,
      beforeInstallPromptSupported: 'onbeforeinstallprompt' in window,
      manifestSupported: 'manifest' in document.createElement('link'),
      
      // Current PWA State
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      navigatorStandalone: (navigator as any).standalone === true,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      
      // Installation History (from localStorage debug)
      installationHistory: null as any,
      
      // Environment Info
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: new Date().toISOString()
    };

    // Get installation history from debug storage
    try {
      const debugData = localStorage.getItem('Tabeza_pwa_install_debug');
      if (debugData) {
        debugInfo.installationHistory = JSON.parse(debugData);
      }
    } catch (e) {
      // Ignore localStorage errors
    }

    return debugInfo;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Generate browser fingerprint for additional validation
export function getBrowserFingerprint(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'server-side-fallback';
  }
  
  try {
    // Canvas fingerprinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasFingerprint = '';
    
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Tabeza fingerprint 🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Device identification', 4, 45);
      canvasFingerprint = canvas.toDataURL();
    }
    
    // WebGL fingerprinting
    let webglFingerprint = '';
    try {
      const webglCanvas = document.createElement('canvas');
      const gl = (webglCanvas.getContext('webgl') || webglCanvas.getContext('experimental-webgl')) as WebGLRenderingContext;
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          webglFingerprint = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) + '~' + 
                           gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch (e) {
      webglFingerprint = 'webgl-error';
    }
    
    // Audio context fingerprinting
    let audioFingerprint = '';
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(0);
      
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);
      
      audioFingerprint = Array.from(frequencyData.slice(0, 30)).join(',');
      
      oscillator.stop();
      audioContext.close();
    } catch (e) {
      audioFingerprint = 'audio-error';
    }
    
    // Collect comprehensive device characteristics
    const fingerprint = {
      // Core browser characteristics
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages ? navigator.languages.join(',') : '',
      platform: navigator.platform,
      
      // Hardware characteristics
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      
      // Screen characteristics
      screenResolution: `${screen.width}x${screen.height}`,
      screenColorDepth: screen.colorDepth,
      screenPixelDepth: screen.pixelDepth,
      availScreenSize: `${screen.availWidth}x${screen.availHeight}`,
      
      // Timezone and locale
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      
      // Browser features
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || 'unspecified',
      onLine: navigator.onLine,
      
      // Fingerprints
      canvasFingerprint: canvasFingerprint.substring(0, 100), // Truncate for storage
      webglFingerprint: webglFingerprint,
      audioFingerprint: audioFingerprint.substring(0, 50), // Truncate for storage
      
      // Additional characteristics
      plugins: Array.from(navigator.plugins || []).map(p => p.name).sort().join(','),
      mimeTypes: Array.from(navigator.mimeTypes || []).map(m => m.type).sort().join(','),
      
      // Window characteristics
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      documentSize: `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      
      // Performance characteristics
      performanceMemory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null,
      
      // Timestamp for freshness
      timestamp: Date.now()
    };
    
    // Create stable hash from fingerprint data
    const str = JSON.stringify(fingerprint);
    let hash = 0;
    
    // Use a more robust hashing algorithm
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to base36 and ensure consistent length
    const hashStr = Math.abs(hash).toString(36);
    const paddedHash = hashStr.padStart(8, '0');
    
    // Add a prefix and suffix for additional uniqueness
    const deviceType = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mob' : 'desk';
    const browserType = navigator.userAgent.includes('Chrome') ? 'chr' : 
                       navigator.userAgent.includes('Firefox') ? 'ffx' : 
                       navigator.userAgent.includes('Safari') ? 'saf' : 'unk';
    
    return `${deviceType}_${browserType}_${paddedHash}_${Date.now().toString(36).slice(-4)}`;
    
  } catch (error) {
    console.warn('Error generating browser fingerprint:', error);
    
    // Fallback fingerprint with basic characteristics
    const fallbackData = {
      userAgent: navigator.userAgent || 'unknown',
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      screenSize: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown',
      timestamp: Date.now()
    };
    
    const fallbackStr = JSON.stringify(fallbackData);
    let fallbackHash = 0;
    for (let i = 0; i < fallbackStr.length; i++) {
      fallbackHash = ((fallbackHash << 5) - fallbackHash) + fallbackStr.charCodeAt(i);
      fallbackHash = fallbackHash & fallbackHash;
    }
    
    return `fallback_${Math.abs(fallbackHash).toString(36)}_error`;
  }
}

export interface DeviceInfo {
  deviceId: string;
  fingerprint: string;
  createdAt: string;
  lastSeen: string;
}

export interface DeviceAnalytics {
  totalTabs: number;
  totalSpent: number;
  barsVisited: number;
  avgTabAmount: number;
  firstVisit: string;
  lastVisit: string;
  daysActive: number;
  venueHistory: VenueVisit[];
}

export interface VenueVisit {
  barId: string;
  barName?: string;
  visitCount: number;
  totalSpent: number;
  firstVisit: string;
  lastVisit: string;
  tabsCreated: number;
}

export interface TransactionRecord {
  deviceId: string;
  barId: string;
  amount: number;
  timestamp: string;
  tabId?: string;
  transactionType: 'tab_creation' | 'tab_payment' | 'tip' | 'other';
}

export async function getDeviceId(supabase: SupabaseClient): Promise<string> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'server-side-temp-id';
  }
  
  try {
    // Step 1: Try to get from localStorage (fastest)
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    const fingerprint = getBrowserFingerprint();
    
    // Step 2: Validate localStorage device ID against Supabase
    if (deviceId) {
      const isValid = await validateDeviceId(deviceId, fingerprint, supabase);
      
      if (isValid) {
        // Update last seen timestamp (with rate limiting)
        await updateDeviceLastSeen(deviceId, supabase);
        return deviceId;
      } else {
        console.warn('⚠️ Device ID in localStorage is invalid, regenerating...');
        clearLocalDeviceId();
        deviceId = null;
      }
    }
    
    // Step 3: Try to recover device ID from Supabase using fingerprint
    const recoveredDevice = await recoverDeviceFromFingerprint(fingerprint, supabase);
    
    if (recoveredDevice) {
      console.log('✅ Device recovered from fingerprint:', recoveredDevice.device_id);
      
      // Cache recovered device ID in localStorage
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, recoveredDevice.device_id);
      localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fingerprint);
      localStorage.setItem(STORAGE_KEYS.CREATED_AT, recoveredDevice.created_at);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
      
      // Increment install count for recovered device
      await incrementDeviceInstallCount(recoveredDevice.device_id, supabase);
      
      return recoveredDevice.device_id;
    }
    
    // Step 4: Create new device ID (first time or after recovery failed)
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Save to Supabase first (source of truth)
    await createDeviceInSupabase(deviceId, fingerprint, supabase);
    
    // Then cache in localStorage
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fingerprint);
    localStorage.setItem(STORAGE_KEYS.CREATED_AT, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
    
    console.log('✅ Created new device ID:', deviceId);
    return deviceId;
    
  } catch (error) {
    console.error('❌ Error in getDeviceId:', error);
    
    // Fallback: try to use localStorage device ID if available
    const fallbackId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (fallbackId) {
      console.warn('⚠️ Using localStorage fallback device ID:', fallbackId);
      return fallbackId;
    }
    
    // Last resort: generate temporary device ID
    const tempId = `device_temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.warn('⚠️ Using temporary device ID:', tempId);
    return tempId;
  }
}

// Helper functions for Supabase device management
async function createDeviceInSupabase(
  deviceId: string, 
  fingerprint: string, 
  supabase: SupabaseClient
): Promise<void> {
  try {
    const deviceData = {
      device_id: deviceId,
      fingerprint,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      platform: typeof navigator !== 'undefined' ? navigator.platform : null,
      screen_resolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : null,
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      is_active: true,
      suspicious_activity_count: 0,
      install_count: 1,
      last_install_at: new Date().toISOString(),
      total_tabs_created: 0,
      total_amount_spent: 0.00,
      is_suspicious: false,
      metadata: {}
    };

    const { error } = await supabase
      .from('devices')
      .insert(deviceData);
    
    if (error) {
      console.error('❌ Error creating device in Supabase:', error);
      throw error;
    }
    
    console.log('✅ Device created in Supabase:', deviceId);
  } catch (error) {
    console.error('❌ Error creating device in Supabase:', error);
    // Don't throw - continue with localStorage only
  }
}

async function validateDeviceId(
  deviceId: string,
  fingerprint: string,
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('device_id, fingerprint, is_active, is_suspicious')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error validating device ID:', error);
      return false;
    }
    
    if (!device) {
      console.warn('⚠️ Device not found in database:', deviceId);
      return false;
    }
    
    // Check if device is active and not suspicious
    if (!device.is_active || device.is_suspicious) {
      console.warn('⚠️ Device is inactive or suspicious:', deviceId);
      return false;
    }
    
    // Check if fingerprint matches (allow some flexibility for minor changes)
    const isFingerprintValid = device.fingerprint === fingerprint;
    
    if (!isFingerprintValid) {
      console.warn('⚠️ Fingerprint mismatch for device:', deviceId);
      // Don't invalidate device for fingerprint mismatch - just log it
      // Fingerprints can change due to browser updates, screen resolution changes, etc.
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error validating device ID:', error);
    return false;
  }
}

async function recoverDeviceFromFingerprint(
  fingerprint: string,
  supabase: SupabaseClient
): Promise<{ device_id: string; created_at: string } | null> {
  try {
    // First, try exact fingerprint match
    const { data: exactMatches, error: exactError } = await supabase
      .from('devices')
      .select('device_id, created_at, fingerprint, is_active, is_suspicious, user_agent, platform, screen_resolution, timezone, last_seen, install_count')
      .eq('fingerprint', fingerprint)
      .eq('is_active', true)
      .eq('is_suspicious', false)
      .order('last_seen', { ascending: false })
      .limit(10); // Get more matches for better disambiguation
    
    if (exactError) {
      console.error('❌ Error recovering device from fingerprint:', exactError);
      return null;
    }
    
    if (!exactMatches || exactMatches.length === 0) {
      console.log('ℹ️ No exact fingerprint matches found, trying fuzzy matching...');
      return await attemptFuzzyFingerprintRecovery(fingerprint, supabase);
    }
    
    if (exactMatches.length === 1) {
      // Single exact match - return it
      console.log('✅ Single device found for exact fingerprint recovery');
      await updateFingerprintIfNeeded(exactMatches[0].device_id, fingerprint, supabase);
      return {
        device_id: exactMatches[0].device_id,
        created_at: exactMatches[0].created_at
      };
    }
    
    // Multiple exact matches - use advanced disambiguation
    console.warn(`⚠️ Multiple devices (${exactMatches.length}) found with same fingerprint, applying disambiguation`);
    const bestMatch = await disambiguateDeviceMatches(exactMatches, supabase);
    
    if (bestMatch) {
      await updateFingerprintIfNeeded(bestMatch.device_id, fingerprint, supabase);
      return {
        device_id: bestMatch.device_id,
        created_at: bestMatch.created_at
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error recovering device from fingerprint:', error);
    return null;
  }
}

/**
 * Attempt fuzzy fingerprint matching for devices with similar characteristics
 */
async function attemptFuzzyFingerprintRecovery(
  currentFingerprint: string,
  supabase: SupabaseClient
): Promise<{ device_id: string; created_at: string } | null> {
  try {
    // Get current device characteristics for comparison
    const currentCharacteristics = extractFingerprintCharacteristics();
    
    // Query devices with similar characteristics
    const { data: similarDevices, error } = await supabase
      .from('devices')
      .select('device_id, created_at, fingerprint, user_agent, platform, screen_resolution, timezone, last_seen')
      .eq('is_active', true)
      .eq('is_suspicious', false)
      .eq('platform', currentCharacteristics.platform)
      .eq('timezone', currentCharacteristics.timezone)
      .order('last_seen', { ascending: false })
      .limit(20);
    
    if (error || !similarDevices || similarDevices.length === 0) {
      console.log('ℹ️ No similar devices found for fuzzy matching');
      return null;
    }
    
    // Calculate similarity scores for each device
    const scoredDevices = similarDevices.map(device => ({
      ...device,
      similarityScore: calculateFingerprintSimilarity(currentFingerprint, device.fingerprint, currentCharacteristics, device)
    }));
    
    // Sort by similarity score (highest first)
    scoredDevices.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Only consider devices with high similarity (>= 0.8)
    const highSimilarityDevices = scoredDevices.filter(device => device.similarityScore >= 0.8);
    
    if (highSimilarityDevices.length === 0) {
      console.log('ℹ️ No devices with sufficient similarity found');
      return null;
    }
    
    if (highSimilarityDevices.length === 1) {
      console.log(`✅ Single high-similarity device found (score: ${highSimilarityDevices[0].similarityScore})`);
      const device = highSimilarityDevices[0];
      
      // Update the fingerprint to current one since characteristics may have changed
      await updateDeviceFingerprint(device.device_id, currentFingerprint, supabase);
      
      return {
        device_id: device.device_id,
        created_at: device.created_at
      };
    }
    
    // Multiple high-similarity devices - use additional disambiguation
    console.warn(`⚠️ Multiple high-similarity devices found (${highSimilarityDevices.length}), using most recent`);
    const bestMatch = highSimilarityDevices[0]; // Already sorted by last_seen desc
    
    await updateDeviceFingerprint(bestMatch.device_id, currentFingerprint, supabase);
    
    return {
      device_id: bestMatch.device_id,
      created_at: bestMatch.created_at
    };
    
  } catch (error) {
    console.error('❌ Error in fuzzy fingerprint recovery:', error);
    return null;
  }
}

/**
 * Extract current device characteristics for comparison
 */
function extractFingerprintCharacteristics() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'server-side',
      timezone: 'UTC',
      screenResolution: '0x0',
      userAgent: 'server-side'
    };
  }
  
  return {
    platform: navigator.platform,
    timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
    screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '0x0',
    userAgent: navigator.userAgent
  };
}

/**
 * Calculate similarity score between two fingerprints and device characteristics
 */
function calculateFingerprintSimilarity(
  fingerprint1: string,
  fingerprint2: string,
  characteristics1: any,
  device2: any
): number {
  let score = 0;
  let totalFactors = 0;
  
  // Platform match (high weight)
  totalFactors += 3;
  if (characteristics1.platform === device2.platform) {
    score += 3;
  }
  
  // Timezone match (high weight)
  totalFactors += 3;
  if (characteristics1.timezone === device2.timezone) {
    score += 3;
  }
  
  // Screen resolution match (medium weight)
  totalFactors += 2;
  if (characteristics1.screenResolution === device2.screen_resolution) {
    score += 2;
  }
  
  // User agent similarity (medium weight)
  totalFactors += 2;
  const userAgentSimilarity = calculateStringSimilarity(characteristics1.userAgent, device2.user_agent || '');
  score += userAgentSimilarity * 2;
  
  // Fingerprint similarity (low weight, since it might have changed)
  totalFactors += 1;
  const fingerprintSimilarity = calculateStringSimilarity(fingerprint1, fingerprint2);
  score += fingerprintSimilarity * 1;
  
  return score / totalFactors;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Disambiguate between multiple device matches using advanced criteria
 */
async function disambiguateDeviceMatches(
  devices: any[],
  supabase: SupabaseClient
): Promise<any | null> {
  try {
    // Score each device based on multiple factors
    const scoredDevices = devices.map(device => {
      let score = 0;
      
      // Most recently seen (higher weight)
      const daysSinceLastSeen = (Date.now() - new Date(device.last_seen).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysSinceLastSeen); // Up to 10 points for recent activity
      
      // Lower install count suggests more stable device (medium weight)
      score += Math.max(0, 5 - device.install_count); // Up to 5 points for fewer installs
      
      // Exact user agent match (if available)
      const currentUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      if (device.user_agent === currentUserAgent) {
        score += 3;
      }
      
      return { ...device, disambiguationScore: score };
    });
    
    // Sort by disambiguation score (highest first)
    scoredDevices.sort((a, b) => b.disambiguationScore - a.disambiguationScore);
    
    const bestMatch = scoredDevices[0];
    console.log(`✅ Best device match selected with score: ${bestMatch.disambiguationScore}`);
    
    // Log potential collision for security monitoring
    if (devices.length > 1) {
      await logFingerprintCollision(devices, bestMatch, supabase);
    }
    
    return bestMatch;
  } catch (error) {
    console.error('❌ Error in device disambiguation:', error);
    // Fallback to most recently seen device
    return devices.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())[0];
  }
}

/**
 * Log fingerprint collision for security monitoring
 */
async function logFingerprintCollision(
  devices: any[],
  selectedDevice: any,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const collisionData = {
      event_type: 'fingerprint_collision',
      fingerprint: selectedDevice.fingerprint,
      device_count: devices.length,
      selected_device_id: selectedDevice.device_id,
      all_device_ids: devices.map(d => d.device_id),
      timestamp: new Date().toISOString(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      metadata: {
        devices: devices.map(d => ({
          device_id: d.device_id,
          last_seen: d.last_seen,
          install_count: d.install_count,
          disambiguation_score: d.disambiguationScore
        }))
      }
    };
    
    // Log to security events table (if it exists) or devices metadata
    try {
      await updateDeviceMetadata(supabase, selectedDevice.device_id, { 
        last_collision: collisionData 
      });
      console.log('📝 Fingerprint collision logged for security monitoring');
    } catch (error) {
      console.warn('⚠️ Could not log fingerprint collision:', error);
    }
  } catch (error) {
    console.warn('⚠️ Error logging fingerprint collision:', error);
  }
}

/**
 * Update device fingerprint if it has changed
 */
async function updateFingerprintIfNeeded(
  deviceId: string,
  currentFingerprint: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    // Get current fingerprint from database
    const { data: device, error: fetchError } = await supabase
      .from('devices')
      .select('fingerprint')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (fetchError || !device) {
      console.warn('⚠️ Could not fetch device for fingerprint update');
      return;
    }
    
    if (device.fingerprint !== currentFingerprint) {
      console.log('🔄 Updating device fingerprint due to characteristic changes');
      await updateDeviceFingerprint(deviceId, currentFingerprint, supabase);
    }
  } catch (error) {
    console.warn('⚠️ Error checking fingerprint update need:', error);
  }
}

/**
 * Update device fingerprint and related characteristics
 */
async function updateDeviceFingerprint(
  deviceId: string,
  newFingerprint: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const currentCharacteristics = extractFingerprintCharacteristics();
    
    // Get current fingerprint for metadata
    const { data: currentDevice } = await supabase
      .from('devices')
      .select('fingerprint, metadata')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    const currentMetadata = currentDevice?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      fingerprint_updated_at: new Date().toISOString(),
      previous_fingerprint: currentDevice?.fingerprint || 'unknown'
    };
    
    const updateData = {
      fingerprint: newFingerprint,
      user_agent: currentCharacteristics.userAgent,
      platform: currentCharacteristics.platform,
      screen_resolution: currentCharacteristics.screenResolution,
      timezone: currentCharacteristics.timezone,
      last_seen: new Date().toISOString(),
      metadata: updatedMetadata
    };
    
    const { error } = await supabase
      .from('devices')
      .update(updateData)
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('❌ Error updating device fingerprint:', error);
      return;
    }
    
    // Update localStorage with new fingerprint
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.FINGERPRINT, newFingerprint);
    }
    
    console.log('✅ Device fingerprint updated successfully');
  } catch (error) {
    console.error('❌ Error updating device fingerprint:', error);
  }
}

// Rate limiting state
const rateLimitState = new Map<string, number>();
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function updateDeviceLastSeen(
  deviceId: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    // Check rate limiting
    const lastSyncTime = rateLimitState.get(deviceId) || 0;
    const now = Date.now();
    
    if (now - lastSyncTime < SYNC_INTERVAL) {
      // Skip update due to rate limiting
      return;
    }
    
    const { error } = await supabase
      .from('devices')
      .update({ 
        last_seen: new Date().toISOString(),
        fingerprint: getBrowserFingerprint() // Update fingerprint in case it changed
      })
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('❌ Error updating device last seen:', error);
      return;
    }
    
    // Update rate limiting state
    rateLimitState.set(deviceId, now);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, new Date().toISOString());
    
    console.log('✅ Device last seen updated');
  } catch (error) {
    console.error('❌ Error updating device last seen:', error);
  }
}

async function incrementDeviceInstallCount(
  deviceId: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    // First get current install count
    const { data: device } = await supabase
      .from('devices')
      .select('install_count')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    const currentCount = device?.install_count || 0;
    
    // Update with incremented count
    const { error } = await supabase
      .from('devices')
      .update({
        install_count: currentCount + 1,
        last_install_at: new Date().toISOString()
      })
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('❌ Error incrementing device install count:', error);
      return;
    }
    
    console.log('✅ Device install count incremented to:', currentCount + 1);
  } catch (error) {
    console.error('❌ Error incrementing device install count:', error);
  }
}

function clearLocalDeviceId(): void {
  localStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
  localStorage.removeItem(STORAGE_KEYS.FINGERPRINT);
  localStorage.removeItem(STORAGE_KEYS.CREATED_AT);
  localStorage.removeItem(STORAGE_KEYS.LAST_SYNCED);
}

export async function getDeviceInfo(supabase: SupabaseClient): Promise<DeviceInfo> {
  const deviceId = await getDeviceId(supabase);
  
  try {
    // Get device info from Supabase
    const { data: device, error } = await supabase
      .from('devices')
      .select('device_id, fingerprint, created_at, last_seen')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error fetching device info:', error);
      // Fallback to localStorage data
      return {
        deviceId: deviceId,
        fingerprint: localStorage.getItem(STORAGE_KEYS.FINGERPRINT) || getBrowserFingerprint(),
        createdAt: localStorage.getItem(STORAGE_KEYS.CREATED_AT) || new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
    }
    
    if (device) {
      return {
        deviceId: device.device_id,
        fingerprint: device.fingerprint,
        createdAt: device.created_at,
        lastSeen: device.last_seen
      };
    }
  } catch (error) {
    console.error('❌ Error in getDeviceInfo:', error);
  }
  
  // Fallback to localStorage data
  return {
    deviceId: deviceId,
    fingerprint: localStorage.getItem(STORAGE_KEYS.FINGERPRINT) || getBrowserFingerprint(),
    createdAt: localStorage.getItem(STORAGE_KEYS.CREATED_AT) || new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
}

export async function getBarDeviceKey(barId: string, supabase: SupabaseClient): Promise<string> {
  const deviceId = await getDeviceId(supabase);
  return `${deviceId}_${barId}`;
}

/**
 * Check if device has an open tab at a specific bar
 */
export async function hasOpenTabAtBar(
  barId: string,
  supabase: SupabaseClient
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
  supabase: SupabaseClient
): Promise<any[]> {
  try {
    const deviceId = await getDeviceId(supabase);
    
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
  supabase: SupabaseClient
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
 * Get device ID synchronously from localStorage (for debugging/fallback only)
 * Use getDeviceId(supabase) for production code
 */
export function getDeviceIdSync(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'server-side-temp-id';
  }
  
  const deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (deviceId) {
    return deviceId;
  }
  
  // Generate temporary ID if none exists
  const tempId = `device_temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  return tempId;
}
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

// ============================================================================
// ANALYTICS ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Record a venue visit for analytics tracking
 * Requirements: 3.1 - Track venue visits with timestamp and venue information
 */
export async function recordVenueVisit(
  barId: string,
  supabase: SupabaseClient,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const deviceId = await getDeviceId(supabase);
    
    // Get current device data for incrementing
    const { data: currentDevice } = await supabase
      .from('devices')
      .select('total_tabs_created, metadata')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    const currentTabsCreated = currentDevice?.total_tabs_created || 0;
    const currentMetadata = currentDevice?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      last_venue_visit: {
        bar_id: barId,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
    
    // Update device's last bar visited and increment total tabs created
    const { error: deviceUpdateError } = await supabase
      .from('devices')
      .update({
        last_bar_id: barId,
        last_seen: new Date().toISOString(),
        total_tabs_created: currentTabsCreated + 1,
        metadata: updatedMetadata
      })
      .eq('device_id', deviceId);
    
    if (deviceUpdateError) {
      console.error('❌ Error updating device venue visit:', deviceUpdateError);
    } else {
      console.log('✅ Venue visit recorded for device:', deviceId, 'at bar:', barId);
    }
    
    // Store visit in localStorage for offline support
    const visitKey = `Tabeza_venue_visits`;
    const existingVisits = JSON.parse(localStorage.getItem(visitKey) || '[]');
    
    const newVisit = {
      deviceId,
      barId,
      timestamp: new Date().toISOString(),
      synced: !deviceUpdateError,
      metadata
    };
    
    existingVisits.push(newVisit);
    
    // Keep only last 50 visits to prevent localStorage bloat
    if (existingVisits.length > 50) {
      existingVisits.splice(0, existingVisits.length - 50);
    }
    
    localStorage.setItem(visitKey, JSON.stringify(existingVisits));
    
  } catch (error) {
    console.error('❌ Error recording venue visit:', error);
    
    // Fallback: store in localStorage for later sync
    const visitKey = `Tabeza_venue_visits`;
    const existingVisits = JSON.parse(localStorage.getItem(visitKey) || '[]');
    
    existingVisits.push({
      deviceId: await getDeviceId(supabase).catch(() => 'unknown'),
      barId,
      timestamp: new Date().toISOString(),
      synced: false,
      metadata
    });
    
    localStorage.setItem(visitKey, JSON.stringify(existingVisits));
  }
}

/**
 * Record a transaction amount for analytics tracking
 * Requirements: 3.2 - Track spending amount and venue details
 */
export async function recordTransaction(
  barId: string,
  amount: number,
  supabase: SupabaseClient,
  transactionType: TransactionRecord['transactionType'] = 'tab_payment',
  tabId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const deviceId = await getDeviceId(supabase);
    
    // Validate amount
    if (typeof amount !== 'number' || amount < 0) {
      console.error('❌ Invalid transaction amount:', amount);
      return;
    }
    
    // Get current device data for incrementing
    const { data: currentDevice } = await supabase
      .from('devices')
      .select('total_amount_spent, metadata')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    const currentAmountSpent = currentDevice?.total_amount_spent || 0;
    const currentMetadata = currentDevice?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      last_transaction: {
        bar_id: barId,
        amount,
        transaction_type: transactionType,
        tab_id: tabId,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
    
    // Update device's total amount spent
    const { error: deviceUpdateError } = await supabase
      .from('devices')
      .update({
        total_amount_spent: currentAmountSpent + amount,
        last_seen: new Date().toISOString(),
        metadata: updatedMetadata
      })
      .eq('device_id', deviceId);
    
    if (deviceUpdateError) {
      console.error('❌ Error updating device transaction:', deviceUpdateError);
    } else {
      console.log('✅ Transaction recorded for device:', deviceId, 'amount:', amount, 'at bar:', barId);
    }
    
    // Store transaction in localStorage for offline support and detailed tracking
    const transactionKey = `Tabeza_transactions`;
    const existingTransactions = JSON.parse(localStorage.getItem(transactionKey) || '[]');
    
    const newTransaction: TransactionRecord = {
      deviceId,
      barId,
      amount,
      timestamp: new Date().toISOString(),
      tabId,
      transactionType
    };
    
    existingTransactions.push(newTransaction);
    
    // Keep only last 100 transactions to prevent localStorage bloat
    if (existingTransactions.length > 100) {
      existingTransactions.splice(0, existingTransactions.length - 100);
    }
    
    localStorage.setItem(transactionKey, JSON.stringify(existingTransactions));
    
  } catch (error) {
    console.error('❌ Error recording transaction:', error);
    
    // Fallback: store in localStorage for later sync
    const transactionKey = `Tabeza_transactions`;
    const existingTransactions = JSON.parse(localStorage.getItem(transactionKey) || '[]');
    
    existingTransactions.push({
      deviceId: await getDeviceId(supabase).catch(() => 'unknown'),
      barId,
      amount,
      timestamp: new Date().toISOString(),
      tabId,
      transactionType
    });
    
    localStorage.setItem(transactionKey, JSON.stringify(existingTransactions));
  }
}

/**
 * Track tab payment when payment is processed by staff
 * This function should be called when a payment is recorded in tab_payments table
 * Requirements: 3.2 - Add spending tracking when tabs are closed
 */
export async function trackTabPayment(
  tabId: string,
  amount: number,
  paymentMethod: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    // Get tab information to find the device and bar
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('bar_id, owner_identifier, notes')
      .eq('id', tabId)
      .maybeSingle();
    
    if (tabError || !tab) {
      console.error('❌ Error fetching tab for payment tracking:', tabError);
      return;
    }
    
    // Extract device ID from owner_identifier (format: deviceId_barId)
    const deviceId = tab.owner_identifier?.split('_')[0];
    if (!deviceId) {
      console.warn('⚠️ Could not extract device ID from tab owner_identifier:', tab.owner_identifier);
      return;
    }
    
    // Record the transaction for analytics
    await recordTransaction(
      tab.bar_id,
      amount,
      supabase,
      'tab_payment',
      tabId,
      {
        payment_method: paymentMethod,
        processed_by: 'staff',
        tab_notes: tab.notes
      }
    );
    
    console.log('✅ Tab payment tracked for analytics:', {
      tabId,
      deviceId: deviceId.substring(0, 20) + '...',
      amount,
      paymentMethod
    });
    
  } catch (error) {
    console.error('❌ Error tracking tab payment:', error);
  }
}

/**
 * Track tab closure when a tab is closed/completed
 * This function should be called when a tab status changes to 'closed'
 * Requirements: 3.2 - Add spending tracking when tabs are closed
 */
export async function trackTabClosure(
  tabId: string,
  supabase: SupabaseClient,
  closureMetadata?: Record<string, any>
): Promise<void> {
  try {
    // Get tab information including all payments
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('bar_id, owner_identifier, notes, opened_at, closed_at')
      .eq('id', tabId)
      .maybeSingle();
    
    if (tabError || !tab) {
      console.error('❌ Error fetching tab for closure tracking:', tabError);
      return;
    }
    
    // Get all payments for this tab
    const { data: payments, error: paymentsError } = await supabase
      .from('tab_payments')
      .select('amount, payment_method, created_at')
      .eq('tab_id', tabId)
      .eq('status', 'success');
    
    if (paymentsError) {
      console.error('❌ Error fetching payments for tab closure:', paymentsError);
      return;
    }
    
    // Extract device ID from owner_identifier
    const deviceId = tab.owner_identifier?.split('_')[0];
    if (!deviceId) {
      console.warn('⚠️ Could not extract device ID from tab owner_identifier:', tab.owner_identifier);
      return;
    }
    
    // Calculate session duration
    const sessionDuration = tab.opened_at && tab.closed_at 
      ? Math.floor((new Date(tab.closed_at).getTime() - new Date(tab.opened_at).getTime()) / 1000)
      : undefined;
    
    // Update device metadata with tab closure information
    const { data: currentDevice } = await supabase
      .from('devices')
      .select('metadata')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    const currentMetadata = currentDevice?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      last_tab_closure: {
        tab_id: tabId,
        bar_id: tab.bar_id,
        closed_at: tab.closed_at || new Date().toISOString(),
        session_duration: sessionDuration,
        total_payments: payments?.length || 0,
        total_amount: payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0,
        payment_methods: payments?.map(p => p.payment_method) || [],
        ...closureMetadata
      }
    };
    
    // Update device metadata
    const { error: updateError } = await supabase
      .from('devices')
      .update({
        metadata: updatedMetadata,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', deviceId);
    
    if (updateError) {
      console.error('❌ Error updating device metadata for tab closure:', updateError);
    } else {
      console.log('✅ Tab closure tracked for analytics:', {
        tabId,
        deviceId: deviceId.substring(0, 20) + '...',
        sessionDuration,
        totalPayments: payments?.length || 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error tracking tab closure:', error);
  }
}

/**
 * Get comprehensive device activity analytics
 * Requirements: 3.3, 3.4 - Track total spending per device and venue history
 */
export async function getDeviceAnalytics(supabase: SupabaseClient): Promise<DeviceAnalytics> {
  try {
    const deviceId = await getDeviceId(supabase);
    
    // Get device summary data from Supabase
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('total_tabs_created, total_amount_spent, created_at, last_seen, last_bar_id')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (deviceError) {
      console.error('❌ Error fetching device analytics:', deviceError);
      return getFallbackAnalytics(deviceId);
    }
    
    if (!device) {
      console.warn('⚠️ Device not found for analytics:', deviceId);
      return getFallbackAnalytics(deviceId);
    }
    
    // Get detailed venue history from localStorage (more detailed than what's in DB)
    const venueHistory = await getVenueHistory(deviceId, supabase);
    
    // Calculate derived metrics
    const totalTabs = device.total_tabs_created || 0;
    const totalSpent = parseFloat(device.total_amount_spent?.toString() || '0');
    const barsVisited = venueHistory.length;
    const avgTabAmount = totalTabs > 0 ? totalSpent / totalTabs : 0;
    
    // Calculate days active
    const firstVisit = device.created_at;
    const lastVisit = device.last_seen;
    const daysActive = Math.ceil(
      (new Date(lastVisit).getTime() - new Date(firstVisit).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return {
      totalTabs,
      totalSpent,
      barsVisited,
      avgTabAmount,
      firstVisit,
      lastVisit,
      daysActive: Math.max(1, daysActive), // At least 1 day
      venueHistory
    };
    
  } catch (error) {
    console.error('❌ Error getting device analytics:', error);
    const deviceId = await getDeviceId(supabase).catch(() => 'unknown');
    return getFallbackAnalytics(deviceId);
  }
}

/**
 * Get venue-specific visit history for a device
 * Requirements: 3.4 - Maintain history of all venues visited by each device
 */
export async function getVenueHistory(
  deviceId: string,
  supabase: SupabaseClient
): Promise<VenueVisit[]> {
  try {
    // Get venue data from localStorage (more detailed tracking)
    const visitKey = `Tabeza_venue_visits`;
    const transactionKey = `Tabeza_transactions`;
    
    const visits = JSON.parse(localStorage.getItem(visitKey) || '[]');
    const transactions = JSON.parse(localStorage.getItem(transactionKey) || '[]');
    
    // Group visits and transactions by bar
    const venueMap = new Map<string, VenueVisit>();
    
    // Process visits
    visits
      .filter((visit: any) => visit.deviceId === deviceId)
      .forEach((visit: any) => {
        const barId = visit.barId;
        
        if (!venueMap.has(barId)) {
          venueMap.set(barId, {
            barId,
            visitCount: 0,
            totalSpent: 0,
            firstVisit: visit.timestamp,
            lastVisit: visit.timestamp,
            tabsCreated: 0
          });
        }
        
        const venue = venueMap.get(barId)!;
        venue.visitCount++;
        venue.tabsCreated++;
        
        // Update first/last visit times
        if (new Date(visit.timestamp) < new Date(venue.firstVisit)) {
          venue.firstVisit = visit.timestamp;
        }
        if (new Date(visit.timestamp) > new Date(venue.lastVisit)) {
          venue.lastVisit = visit.timestamp;
        }
      });
    
    // Process transactions to add spending data
    transactions
      .filter((transaction: TransactionRecord) => transaction.deviceId === deviceId)
      .forEach((transaction: TransactionRecord) => {
        const barId = transaction.barId;
        
        if (!venueMap.has(barId)) {
          // Create venue entry if it doesn't exist (transaction without recorded visit)
          venueMap.set(barId, {
            barId,
            visitCount: 1,
            totalSpent: 0,
            firstVisit: transaction.timestamp,
            lastVisit: transaction.timestamp,
            tabsCreated: 0
          });
        }
        
        const venue = venueMap.get(barId)!;
        venue.totalSpent += transaction.amount;
      });
    
    // Try to get bar names from Supabase
    const barIds = Array.from(venueMap.keys());
    if (barIds.length > 0) {
      try {
        const { data: bars, error } = await supabase
          .from('bars')
          .select('id, name')
          .in('id', barIds);
        
        if (!error && bars) {
          bars.forEach(bar => {
            const venue = venueMap.get(bar.id);
            if (venue) {
              venue.barName = bar.name;
            }
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch bar names for venue history:', error);
      }
    }
    
    // Convert to array and sort by last visit (most recent first)
    return Array.from(venueMap.values())
      .sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
    
  } catch (error) {
    console.error('❌ Error getting venue history:', error);
    return [];
  }
}

/**
 * Get analytics summary for a specific venue
 * Requirements: 3.5 - Provide aggregated statistics while respecting privacy
 */
export async function getVenueAnalytics(
  barId: string,
  supabase: SupabaseClient
): Promise<{
  totalDevices: number;
  totalTabs: number;
  totalRevenue: number;
  avgTabAmount: number;
  activeDevices: number;
  returningDevices: number;
}> {
  try {
    // Get aggregated data from devices table (privacy-preserving)
    const { data: deviceStats, error } = await supabase
      .from('devices')
      .select('total_tabs_created, total_amount_spent, last_seen')
      .eq('last_bar_id', barId)
      .not('total_tabs_created', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching venue analytics:', error);
      return {
        totalDevices: 0,
        totalTabs: 0,
        totalRevenue: 0,
        avgTabAmount: 0,
        activeDevices: 0,
        returningDevices: 0
      };
    }
    
    if (!deviceStats || deviceStats.length === 0) {
      return {
        totalDevices: 0,
        totalTabs: 0,
        totalRevenue: 0,
        avgTabAmount: 0,
        activeDevices: 0,
        returningDevices: 0
      };
    }
    
    // Calculate aggregated metrics (privacy-preserving)
    const totalDevices = deviceStats.length;
    const totalTabs = deviceStats.reduce((sum, device) => sum + (device.total_tabs_created || 0), 0);
    const totalRevenue = deviceStats.reduce((sum, device) => sum + parseFloat(device.total_amount_spent?.toString() || '0'), 0);
    const avgTabAmount = totalTabs > 0 ? totalRevenue / totalTabs : 0;
    
    // Calculate active devices (visited in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeDevices = deviceStats.filter(device => 
      new Date(device.last_seen) > thirtyDaysAgo
    ).length;
    
    // Calculate returning devices (more than 1 tab created)
    const returningDevices = deviceStats.filter(device => 
      (device.total_tabs_created || 0) > 1
    ).length;
    
    return {
      totalDevices,
      totalTabs,
      totalRevenue,
      avgTabAmount,
      activeDevices,
      returningDevices
    };
    
  } catch (error) {
    console.error('❌ Error getting venue analytics:', error);
    return {
      totalDevices: 0,
      totalTabs: 0,
      totalRevenue: 0,
      avgTabAmount: 0,
      activeDevices: 0,
      returningDevices: 0
    };
  }
}

/**
 * Sync pending analytics data when coming back online
 * Requirements: 6.4 - Queue analytics data for later synchronization
 */
export async function syncPendingAnalytics(supabase: SupabaseClient): Promise<void> {
  try {
    const deviceId = await getDeviceId(supabase);
    
    // Sync pending venue visits
    const visitKey = `Tabeza_venue_visits`;
    const visits = JSON.parse(localStorage.getItem(visitKey) || '[]');
    const unsyncedVisits = visits.filter((visit: any) => !visit.synced && visit.deviceId === deviceId);
    
    for (const visit of unsyncedVisits) {
      try {
        await recordVenueVisit(visit.barId, supabase, visit.metadata);
        visit.synced = true;
      } catch (error) {
        console.warn('⚠️ Failed to sync venue visit:', visit, error);
      }
    }
    
    // Update localStorage with sync status
    if (unsyncedVisits.length > 0) {
      localStorage.setItem(visitKey, JSON.stringify(visits));
      console.log(`✅ Synced ${unsyncedVisits.length} pending venue visits`);
    }
    
    // Note: Transactions are already handled by recordTransaction function
    // which updates the database directly, so no additional sync needed
    
  } catch (error) {
    console.error('❌ Error syncing pending analytics:', error);
  }
}

/**
 * Fallback analytics when Supabase is unavailable
 */
function getFallbackAnalytics(deviceId: string): DeviceAnalytics {
  try {
    // Get data from localStorage
    const transactionKey = `Tabeza_transactions`;
    const transactions = JSON.parse(localStorage.getItem(transactionKey) || '[]')
      .filter((t: TransactionRecord) => t.deviceId === deviceId);
    
    const visitKey = `Tabeza_venue_visits`;
    const visits = JSON.parse(localStorage.getItem(visitKey) || '[]')
      .filter((v: any) => v.deviceId === deviceId);
    
    // Calculate basic metrics from localStorage
    const totalSpent = transactions.reduce((sum: number, t: TransactionRecord) => sum + t.amount, 0);
    const totalTabs = visits.length;
    const uniqueBars = new Set(visits.map((v: any) => v.barId));
    const barsVisited = uniqueBars.size;
    const avgTabAmount = totalTabs > 0 ? totalSpent / totalTabs : 0;
    
    // Get first and last visit times
    const sortedVisits = visits.sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const firstVisit = sortedVisits.length > 0 ? sortedVisits[0].timestamp : new Date().toISOString();
    const lastVisit = sortedVisits.length > 0 ? sortedVisits[sortedVisits.length - 1].timestamp : new Date().toISOString();
    
    const daysActive = Math.max(1, Math.ceil(
      (new Date(lastVisit).getTime() - new Date(firstVisit).getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    return {
      totalTabs,
      totalSpent,
      barsVisited,
      avgTabAmount,
      firstVisit,
      lastVisit,
      daysActive,
      venueHistory: [] // Would need more complex localStorage parsing
    };
    
  } catch (error) {
    console.error('❌ Error getting fallback analytics:', error);
    
    // Absolute fallback
    return {
      totalTabs: 0,
      totalSpent: 0,
      barsVisited: 0,
      avgTabAmount: 0,
      firstVisit: new Date().toISOString(),
      lastVisit: new Date().toISOString(),
      daysActive: 1,
      venueHistory: []
    };
  }
}
