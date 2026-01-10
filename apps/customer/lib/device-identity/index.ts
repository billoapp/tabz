// /lib/device-identity/index.ts
/**
 * Main export with clean API
 */
export { DeviceIdentity } from './generator';
export { DeviceStorage } from './storage';
export { DeviceFingerprint } from './fingerprint';
export type { 
  DeviceIdentityData, 
  DeviceIntegrity, 
  ValidationResult 
} from './generator';

// Legacy compatibility exports (must come before new functions to override)
export {
  getAllOpenTabs,
  hasOpenTabAtBar,
  validateDeviceForNewTab,
  clearDeviceId,
  storeActiveTab,
  getActiveTab,
  clearActiveTab,
  checkAnyOpenTabAtBar,
  isTabLinkedToDevice,
  validateDeviceIntegrity
} from './legacy-compat';

// Simplified main API (matching old interface but async)
export async function getDeviceId(): Promise<string> {
  const { DeviceIdentity } = await import('./generator');
  const device = await DeviceIdentity.initialize();
  return device.id;
}

export async function getDeviceInfo(): Promise<import('./generator').DeviceIdentityData> {
  const { DeviceIdentity } = await import('./generator');
  return DeviceIdentity.initialize();
}

export async function getBarDeviceKey(barId: string): Promise<string> {
  const { DeviceIdentity } = await import('./generator');
  const device = await DeviceIdentity.initialize();
  return `${device.id}_${barId}`;
}

// New validation function (different name to avoid conflict)
export async function validateDeviceForBar(
  barId: string
): Promise<{ valid: boolean; reason?: string; warnings?: string[]; existingTab?: any }> {
  const { DeviceIdentity } = await import('./generator');
  const device = await DeviceIdentity.initialize();
  
  if (device.integrity.score < 70) {
    return {
      valid: false,
      reason: 'LOW_INTEGRITY_SCORE',
      warnings: device.integrity.warnings
    };
  }
  
  return { valid: true };
}

// For backward compatibility with old sync code
export function getDeviceIdSync(): string {
  console.warn('⚠️ Using deprecated sync method - switch to async getDeviceId()');
  try {
    // Try to get from memory first
    const fromMemory = localStorage.getItem('tabeza_device_id_v2');
    if (fromMemory) return fromMemory;
    
    // Fall back to old storage key
    const fromOld = localStorage.getItem('Tabeza_device_id');
    if (fromOld) return fromOld;
    
    // Generate a temporary ID
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } catch (error) {
    return `temp_error_${Date.now()}`;
  }
}

// Export a clear function that matches old API
export const clearDeviceIdentity = async (): Promise<void> => {
  const { DeviceIdentity } = await import('./generator');
  await DeviceIdentity.clear();
};