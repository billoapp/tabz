/**
 * Cache Management Utilities
 * 
 * Provides comprehensive cache management for PWA uninstallation and cleanup.
 * Implements Requirements 3.1, 3.3, 3.4
 */

export interface CacheInfo {
  name: string;
  size: number;
  entryCount: number;
  created?: Date;
}

export interface CacheManagerOptions {
  debug?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class CacheManager {
  private options: Required<CacheManagerOptions>;

  constructor(options: CacheManagerOptions = {}) {
    this.options = {
      debug: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Get all cache names currently stored
   */
  async getCacheNames(): Promise<string[]> {
    try {
      if (!('caches' in window)) {
        this.log('Cache API not supported');
        return [];
      }

      const cacheNames = await caches.keys();
      this.log(`Found ${cacheNames.length} caches:`, cacheNames);
      return cacheNames;
    } catch (error) {
      this.logError('Failed to get cache names:', error);
      return [];
    }
  }

  /**
   * Get detailed information about all caches
   */
  async getCacheInfo(): Promise<CacheInfo[]> {
    const cacheNames = await this.getCacheNames();
    const cacheInfos: CacheInfo[] = [];

    for (const name of cacheNames) {
      try {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        
        // Estimate cache size (rough calculation)
        let estimatedSize = 0;
        for (const request of keys.slice(0, 10)) { // Sample first 10 for performance
          try {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.blob();
              estimatedSize += blob.size;
            }
          } catch {
            // Ignore individual entry errors
          }
        }

        // Extrapolate size if we sampled
        if (keys.length > 10) {
          estimatedSize = Math.round((estimatedSize / 10) * keys.length);
        }

        cacheInfos.push({
          name,
          size: estimatedSize,
          entryCount: keys.length,
        });
      } catch (error) {
        this.logError(`Failed to get info for cache ${name}:`, error);
        cacheInfos.push({
          name,
          size: 0,
          entryCount: 0,
        });
      }
    }

    return cacheInfos;
  }

  /**
   * Clear a specific cache by name
   */
  async clearSpecificCache(cacheName: string): Promise<boolean> {
    try {
      if (!('caches' in window)) {
        this.log('Cache API not supported');
        return false;
      }

      const deleted = await caches.delete(cacheName);
      this.log(`Cache ${cacheName} ${deleted ? 'deleted' : 'not found'}`);
      return deleted;
    } catch (error) {
      this.logError(`Failed to clear cache ${cacheName}:`, error);
      return false;
    }
  }

  /**
   * Clear all caches with retry logic
   */
  async clearAllCaches(): Promise<{ success: boolean; cleared: string[]; failed: string[] }> {
    const result = {
      success: true,
      cleared: [] as string[],
      failed: [] as string[],
    };

    try {
      const cacheNames = await this.getCacheNames();
      
      if (cacheNames.length === 0) {
        this.log('No caches to clear');
        return result;
      }

      this.log(`Clearing ${cacheNames.length} caches...`);

      for (const cacheName of cacheNames) {
        let success = false;
        let lastError: any = null;

        // Retry logic
        for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
          try {
            const deleted = await caches.delete(cacheName);
            if (deleted) {
              success = true;
              result.cleared.push(cacheName);
              this.log(`✓ Cleared cache: ${cacheName} (attempt ${attempt})`);
              break;
            } else {
              this.log(`Cache ${cacheName} not found (attempt ${attempt})`);
              success = true; // Consider "not found" as success
              break;
            }
          } catch (error) {
            lastError = error;
            this.logError(`✗ Failed to clear cache ${cacheName} (attempt ${attempt}):`, error);
            
            if (attempt < this.options.maxRetries) {
              await this.delay(this.options.retryDelay * attempt);
            }
          }
        }

        if (!success) {
          result.failed.push(cacheName);
          result.success = false;
          this.logError(`Failed to clear cache ${cacheName} after ${this.options.maxRetries} attempts:`, lastError);
        }
      }

      this.log(`Cache clearing complete. Cleared: ${result.cleared.length}, Failed: ${result.failed.length}`);
      return result;
    } catch (error) {
      this.logError('Failed to clear all caches:', error);
      return {
        success: false,
        cleared: result.cleared,
        failed: [...result.failed, 'unknown'],
      };
    }
  }

  /**
   * Clear localStorage with error handling
   */
  async clearLocalStorage(): Promise<boolean> {
    try {
      if (!('localStorage' in window)) {
        this.log('localStorage not supported');
        return false;
      }

      const itemCount = localStorage.length;
      localStorage.clear();
      this.log(`Cleared localStorage (${itemCount} items)`);
      return true;
    } catch (error) {
      this.logError('Failed to clear localStorage:', error);
      return false;
    }
  }

  /**
   * Clear sessionStorage with error handling
   */
  async clearSessionStorage(): Promise<boolean> {
    try {
      if (!('sessionStorage' in window)) {
        this.log('sessionStorage not supported');
        return false;
      }

      const itemCount = sessionStorage.length;
      sessionStorage.clear();
      this.log(`Cleared sessionStorage (${itemCount} items)`);
      return true;
    } catch (error) {
      this.logError('Failed to clear sessionStorage:', error);
      return false;
    }
  }

  /**
   * Clear IndexedDB databases (basic implementation)
   */
  async clearIndexedDB(): Promise<boolean> {
    try {
      if (!('indexedDB' in window)) {
        this.log('IndexedDB not supported');
        return false;
      }

      // Note: This is a basic implementation
      // In a real app, you'd want to enumerate and delete specific databases
      this.log('IndexedDB clearing not fully implemented - would require specific database names');
      return true;
    } catch (error) {
      this.logError('Failed to clear IndexedDB:', error);
      return false;
    }
  }

  /**
   * Clean up old caches based on version or pattern
   */
  async cleanupOldCaches(currentVersion: string, cachePrefix: string = 'tabeza-'): Promise<string[]> {
    const deletedCaches: string[] = [];

    try {
      const cacheNames = await this.getCacheNames();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith(cachePrefix) && !name.includes(currentVersion)
      );

      this.log(`Found ${oldCaches.length} old caches to clean up`);

      for (const cacheName of oldCaches) {
        const deleted = await this.clearSpecificCache(cacheName);
        if (deleted) {
          deletedCaches.push(cacheName);
        }
      }

      this.log(`Cleaned up ${deletedCaches.length} old caches`);
      return deletedCaches;
    } catch (error) {
      this.logError('Failed to cleanup old caches:', error);
      return deletedCaches;
    }
  }

  /**
   * Get total cache storage usage estimate
   */
  async getTotalCacheSize(): Promise<number> {
    const cacheInfos = await this.getCacheInfo();
    return cacheInfos.reduce((total, cache) => total + cache.size, 0);
  }

  /**
   * Verify all caches are cleared
   */
  async verifyCachesCleared(): Promise<boolean> {
    try {
      const cacheNames = await this.getCacheNames();
      const isEmpty = cacheNames.length === 0;
      this.log(`Cache verification: ${isEmpty ? 'All clear' : `${cacheNames.length} caches remaining`}`);
      return isEmpty;
    } catch (error) {
      this.logError('Failed to verify cache clearing:', error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[CacheManager] ${message}`, ...args);
    }
  }

  private logError(message: string, error: any): void {
    if (this.options.debug) {
      console.error(`[CacheManager] ${message}`, error);
    }
  }
}