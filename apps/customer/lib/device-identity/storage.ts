/**
 * Multi-layer storage system with graceful degradation
 * Priority: Memory → IndexedDB → localStorage → Cookies → Session
 */

export class DeviceStorage {
  private static readonly STORAGE_KEY = 'tabeza_device_id_v2';
  private static readonly INDEXED_DB_NAME = 'DeviceStorage';
  private static readonly INDEXED_DB_VERSION = 1;
  
  // Memory cache for immediate access
  private static memoryCache = new Map<string, string>();
  
  /**
   * Get device ID from any available storage layer
   */
  static async get(): Promise<string | null> {
    console.log('🔍 Checking storage layers for device ID...');
    
    // 1. Memory (fastest)
    const memoryId = this.getFromMemory();
    if (memoryId) {
      console.log('✅ Found in memory cache');
      return memoryId;
    }
    
    // 2. IndexedDB (persistent, works in private mode)
    try {
      const indexedDBId = await this.getFromIndexedDB();
      if (indexedDBId) {
        console.log('✅ Found in IndexedDB');
        this.saveToMemory(indexedDBId);
        return indexedDBId;
      }
    } catch (error) {
      console.warn('⚠️ IndexedDB access failed:', error);
    }
    
    // 3. localStorage (if available)
    try {
      const localId = this.getFromLocalStorage();
      if (localId) {
        console.log('✅ Found in localStorage');
        await this.saveToIndexedDB(localId);
        this.saveToMemory(localId);
        return localId;
      }
    } catch (error) {
      console.warn('⚠️ localStorage access failed:', error);
    }
    
    // 4. Cookies (legacy support)
    try {
      const cookieId = this.getFromCookies();
      if (cookieId) {
        console.log('✅ Found in cookies');
        await this.saveToIndexedDB(cookieId);
        this.saveToMemory(cookieId);
        return cookieId;
      }
    } catch (error) {
      console.warn('⚠️ Cookie access failed:', error);
    }
    
    console.log('❌ No device ID found in any storage layer');
    return null;
  }
  
  /**
   * Save device ID to all available storage layers
   */
  static async save(deviceId: string): Promise<void> {
    console.log('💾 Saving device ID to storage layers...');
    
    // Save to all available layers
    this.saveToMemory(deviceId);
    
    try {
      await this.saveToIndexedDB(deviceId);
      console.log('✅ Saved to IndexedDB');
    } catch (error) {
      console.warn('⚠️ Failed to save to IndexedDB:', error);
    }
    
    try {
      this.saveToLocalStorage(deviceId);
      console.log('✅ Saved to localStorage');
    } catch (error) {
      console.warn('⚠️ Failed to save to localStorage:', error);
    }
    
    try {
      this.saveToCookies(deviceId);
      console.log('✅ Saved to cookies');
    } catch (error) {
      console.warn('⚠️ Failed to save to cookies:', error);
    }
    
    // Async server sync (don't block)
    this.syncToServer(deviceId).catch(error => {
      console.warn('⚠️ Failed to sync with server:', error);
    });
  }
  
  /**
   * Clear device ID from all storage layers
   */
  static async clear(): Promise<void> {
    console.log('🗑️ Clearing device ID from all storage layers...');
    
    // Clear memory
    this.memoryCache.delete(this.STORAGE_KEY);
    
    // Clear localStorage
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {}
    
    // Clear IndexedDB
    try {
      if ('indexedDB' in window) {
        const request = indexedDB.deleteDatabase(this.INDEXED_DB_NAME);
        request.onsuccess = () => console.log('✅ Cleared IndexedDB');
        request.onerror = () => console.warn('⚠️ Failed to clear IndexedDB');
      }
    } catch {}
    
    // Clear cookie
    try {
      document.cookie = `${this.STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    } catch {}
    
    console.log('✅ Device ID cleared from all storage layers');
  }
  
  // Private helper methods
  
  private static getFromMemory(): string | null {
    return this.memoryCache.get(this.STORAGE_KEY) || null;
  }
  
  private static saveToMemory(id: string): void {
    this.memoryCache.set(this.STORAGE_KEY, id);
  }
  
  private static async getFromIndexedDB(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!('indexedDB' in window)) {
        return resolve(null);
      }
      
      const request = indexedDB.open(this.INDEXED_DB_NAME, this.INDEXED_DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('devices')) {
          db.createObjectStore('devices');
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['devices'], 'readonly');
        const store = transaction.objectStore('devices');
        const getRequest = store.get(this.STORAGE_KEY);
        
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      };
      
      request.onerror = () => resolve(null);
    });
  }
  
  private static async saveToIndexedDB(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        return reject(new Error('IndexedDB not supported'));
      }
      
      const request = indexedDB.open(this.INDEXED_DB_NAME, this.INDEXED_DB_VERSION);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['devices'], 'readwrite');
        const store = transaction.objectStore('devices');
        store.put(id, this.STORAGE_KEY);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (error) => reject(error);
      };
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
  }
  
  private static getFromLocalStorage(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }
  
  private static saveToLocalStorage(id: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, id);
    } catch (error) {
      // localStorage may be unavailable in private mode
    }
  }
  
  private static getFromCookies(): string | null {
    try {
      const match = document.cookie.match(
        new RegExp('(^| )' + this.STORAGE_KEY + '=([^;]+)')
      );
      return match ? decodeURIComponent(match[2]) : null;
    } catch (error) {
      return null;
    }
  }
  
  private static saveToCookies(id: string): void {
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // 1 year
      document.cookie = `${this.STORAGE_KEY}=${encodeURIComponent(id)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
    } catch (error) {
      // Cookies may be disabled
    }
  }
  
  private static async syncToServer(id: string): Promise<void> {
    // Optional: Implement server-side sync for cross-device persistence
    try {
      await fetch('/api/device/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: id })
      });
    } catch (error) {
      // Non-critical failure - device still works offline
    }
  }
}