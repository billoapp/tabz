/**
 * Device ID generation and management
 */
import { DeviceStorage } from './storage';
import { DeviceFingerprint } from './fingerprint';

export class DeviceIdentity {
  static readonly VERSION = '2.0';
  
  static async initialize(): Promise<DeviceIdentityData> {
    console.log('🔧 Initializing device identity v' + this.VERSION);
    
    // 1. Try to load existing ID
    let deviceId = await DeviceStorage.get();
    
    // 2. Generate new ID if needed
    if (!deviceId) {
      deviceId = await this.generateNewId();
      await DeviceStorage.save(deviceId);
      console.log('✨ Generated new device ID:', deviceId);
    } else {
      console.log('🔄 Loaded existing device ID:', deviceId);
    }
    
    // 3. Get fingerprint
    const fingerprint = await DeviceFingerprint.getStableIdentifier();
    
    // 4. Create device data
    const deviceData: DeviceIdentityData = {
      id: deviceId,
      fingerprint: fingerprint,
      version: this.VERSION,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      source: 'local',
      integrity: await this.checkIntegrity(deviceId, fingerprint)
    };
    
    // 5. Register with server (async, non-blocking)
    this.registerWithServer(deviceData).catch(error => {
      console.warn('⚠️ Failed to register device with server:', error);
    });
    
    return deviceData;
  }
  
  private static async generateNewId(): Promise<string> {
    // UUID v4 with timestamp prefix for uniqueness
    const timestamp = Date.now().toString(36);
    const randomBytes = new Uint8Array(8);
    
    try {
      crypto.getRandomValues(randomBytes);
    } catch {
      // Fallback to Math.random if crypto unavailable
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    
    const randomHex = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return `dev_${timestamp}_${randomHex}`;
  }
  
  private static async checkIntegrity(
    deviceId: string, 
    fingerprint: string
  ): Promise<DeviceIntegrity> {
    const integrity: DeviceIntegrity = {
      score: 100,
      warnings: [],
      checks: {
        storagePersistent: await this.testStoragePersistence(),
        fingerprintStable: await this.testFingerprintStability(fingerprint),
        privateMode: this.isPrivateMode(),
        crossSession: await this.testCrossSession(),
        cryptoAvailable: this.testCryptoAvailability()
      }
    };
    
    // Calculate score based on checks
    if (integrity.checks.privateMode) {
      integrity.score -= 30;
      integrity.warnings.push('Private browsing mode detected - IDs may not persist');
    }
    
    if (!integrity.checks.storagePersistent) {
      integrity.score -= 20;
      integrity.warnings.push('Storage may not be persistent');
    }
    
    if (!integrity.checks.fingerprintStable) {
      integrity.score -= 10;
      integrity.warnings.push('Fingerprint may change across sessions');
    }
    
    if (!integrity.checks.cryptoAvailable) {
      integrity.score -= 5;
      integrity.warnings.push('Weak random number generation');
    }
    
    // Ensure score doesn't go below 0
    integrity.score = Math.max(0, integrity.score);
    
    return integrity;
  }
  
  private static async testStoragePersistence(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        return await navigator.storage.persisted();
      }
      return false;
    } catch {
      return false;
    }
  }
  
  private static async testFingerprintStability(fingerprint: string): Promise<boolean> {
    try {
      // Store current fingerprint and check on next load
      const previous = sessionStorage.getItem('previous_fingerprint');
      sessionStorage.setItem('previous_fingerprint', fingerprint);
      
      return !previous || previous === fingerprint;
    } catch {
      return false;
    }
  }
  
  private static isPrivateMode(): boolean {
    try {
      const testKey = 'private_mode_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return false;
    } catch (error) {
      return true;
    }
  }
  
  private static async testCrossSession(): Promise<boolean> {
    try {
      // Test if we can maintain state across page reload
      const testId = 'cross_session_test_' + Date.now();
      sessionStorage.setItem('cross_session_test', testId);
      
      return sessionStorage.getItem('cross_session_test') === testId;
    } catch {
      return false;
    }
  }
  
  private static testCryptoAvailability(): boolean {
    try {
      // Test if crypto API is available
      const array = new Uint8Array(1);
      crypto.getRandomValues(array);
      return true;
    } catch {
      return false;
    }
  }
  
  private static async registerWithServer(
    data: DeviceIdentityData
  ): Promise<void> {
    try {
      // Collect additional device information
      const deviceInfo = {
        deviceId: data.id,
        fingerprint: data.fingerprint,
        version: data.version,
        integrity: data.integrity,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        hardwareConcurrency: (navigator as any).hardwareConcurrency || null,
        deviceMemory: (navigator as any).deviceMemory || null,
        pwaInstalled: window.matchMedia('(display-mode: standalone)').matches,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceInfo)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Device registered with server:', result.serverId);
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Server registration failed:', response.status, errorText);
      }
    } catch (error) {
      console.warn('⚠️ Failed to register device with server:', error);
    }
  }
  
  static async getBarSpecificId(barId: string): Promise<string> {
    const device = await this.initialize();
    return `${device.id}_${barId}_${device.fingerprint.slice(0, 8)}`;
  }
  
  static async validateForTab(barId: string): Promise<ValidationResult> {
    const device = await this.initialize();
    
    return {
      valid: device.integrity.score >= 70,
      deviceId: device.id,
      fingerprint: device.fingerprint,
      warnings: device.integrity.warnings,
      integrityScore: device.integrity.score,
      barDeviceKey: await this.getBarSpecificId(barId)
    };
  }
  
  static async clear(): Promise<void> {
    await DeviceStorage.clear();
  }
}

// Type Definitions
export interface DeviceIdentityData {
  id: string;
  fingerprint: string;
  version: string;
  createdAt: string;
  lastSeen: string;
  source: 'local' | 'server' | 'restored';
  integrity: DeviceIntegrity;
}

export interface DeviceIntegrity {
  score: number;
  warnings: string[];
  checks: {
    storagePersistent: boolean;
    fingerprintStable: boolean;
    privateMode: boolean;
    crossSession: boolean;
    cryptoAvailable: boolean;
  };
}

export interface ValidationResult {
  valid: boolean;
  deviceId: string;
  fingerprint: string;
  warnings: string[];
  integrityScore: number;
  barDeviceKey: string;
}