/**
 * Enhanced Device ID Generation with Android PWA Support
 * Fixes "Unable to generate customer identifier" error
 */

const STORAGE_KEYS = {
  DEVICE_ID_V2: 'tabeza_device_id_v2',
  DEVICE_ID_LEGACY: 'Tabeza_device_id',
  FINGERPRINT: 'Tabeza_fingerprint',
  CREATED_AT: 'Tabeza_device_created',
  LAST_SYNCED: 'Tabeza_last_synced'
};

/**
 * Enhanced device ID generation with multiple fallbacks
 * Specifically designed to work on Android PWA
 */
export function generateDeviceIdEnhanced(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  
  // Try to get additional entropy for uniqueness
  let entropy = '';
  try {
    // Use various browser APIs for additional entropy
    entropy += navigator.userAgent.length.toString(36);
    entropy += screen.width.toString(36);
    entropy += screen.height.toString(36);
    entropy += (navigator.hardwareConcurrency || 4).toString(36);
    entropy += new Date().getTimezoneOffset().toString(36);
  } catch (error) {
    // Fallback if any API fails
    entropy = Math.random().toString(36).substring(2, 7);
  }
  
  return `device_${timestamp}_${random}_${entropy}`;
}

/**
 * Get device ID with enhanced error handling and recovery
 */
export function getDeviceIdEnhanced(): string {
  try {
    // Try to get existing device ID (check both storage keys)
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID_V2) || 
                   localStorage.getItem(STORAGE_KEYS.DEVICE_ID_LEGACY);
    
    // Validate existing device ID
    if (deviceId && typeof deviceId === 'string' && deviceId.length > 10) {
      // Update last seen
      try {
        localStorage.setItem('Tabeza_last_seen', new Date().toISOString());
      } catch (storageError) {
        console.warn('Failed to update last seen timestamp:', storageError);
      }
      
      return deviceId;
    }
    
    // Generate new device ID if none exists or invalid
    console.log('Generating new device ID...');
    deviceId = generateDeviceIdEnhanced();
    
    // Store in both locations for compatibility
    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID_V2, deviceId);
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID_LEGACY, deviceId);
      localStorage.setItem(STORAGE_KEYS.CREATED_AT, new Date().toISOString());
      localStorage.setItem('Tabeza_last_seen', new Date().toISOString());
      
      console.log('✅ Device ID generated and stored:', deviceId.substring(0, 20) + '...');
    } catch (storageError) {
      console.error('❌ Failed to store device ID:', storageError);
      // Return the generated ID even if storage fails
    }
    
    return deviceId;
    
  } catch (error) {
    console.error('❌ Device ID generation failed:', error);
    
    // Last resort fallback
    const fallbackId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.warn('Using fallback device ID:', fallbackId.substring(0, 20) + '...');
    
    return fallbackId;
  }
}

/**
 * Test device ID functionality
 */
export function testDeviceIdFunctionality(): {
  success: boolean;
  deviceId?: string;
  storageWorking: boolean;
  error?: string;
} {
  try {
    const deviceId = getDeviceIdEnhanced();
    
    // Test storage functionality
    let storageWorking = false;
    try {
      localStorage.setItem('test_key', 'test_value');
      const testValue = localStorage.getItem('test_key');
      storageWorking = testValue === 'test_value';
      localStorage.removeItem('test_key');
    } catch (storageError) {
      storageWorking = false;
    }
    
    return {
      success: true,
      deviceId,
      storageWorking
    };
    
  } catch (error) {
    return {
      success: false,
      storageWorking: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}