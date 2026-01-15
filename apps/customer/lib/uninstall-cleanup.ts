/**
 * Uninstallation Cleanup Service
 * 
 * Provides comprehensive cleanup when PWA is uninstalled.
 * Implements Requirements 3.2, 3.4, 3.5
 */

import { CacheManager } from './cache-manager';

export interface CleanupResult {
  success: boolean;
  operations: {
    caches: { success: boolean; cleared: string[]; failed: string[] };
    localStorage: { success: boolean };
    sessionStorage: { success: boolean };
    indexedDB: { success: boolean };
    serviceWorkers: { success: boolean; unregistered: string[]; failed: string[] };
  };
  errors: string[];
  partialCleanup: boolean;
}

export interface UninstallCleanupOptions {
  debug?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  skipServiceWorkers?: boolean;
  skipStorage?: boolean;
}

export class UninstallCleanup {
  private cacheManager: CacheManager;
  private options: Required<UninstallCleanupOptions>;

  constructor(options: UninstallCleanupOptions = {}) {
    this.options = {
      debug: false,
      maxRetries: 3,
      retryDelay: 1000,
      skipServiceWorkers: false,
      skipStorage: false,
      ...options,
    };

    this.cacheManager = new CacheManager({
      debug: this.options.debug,
      maxRetries: this.options.maxRetries,
      retryDelay: this.options.retryDelay,
    });
  }

  /**
   * Perform complete uninstallation cleanup
   */
  async performCompleteCleanup(): Promise<CleanupResult> {
    this.log('Starting complete PWA uninstallation cleanup...');

    const result: CleanupResult = {
      success: true,
      operations: {
        caches: { success: false, cleared: [], failed: [] },
        localStorage: { success: false },
        sessionStorage: { success: false },
        indexedDB: { success: false },
        serviceWorkers: { success: false, unregistered: [], failed: [] },
      },
      errors: [],
      partialCleanup: false,
    };

    try {
      // 1. Clear all caches
      this.log('Step 1: Clearing caches...');
      result.operations.caches = await this.cacheManager.clearAllCaches();
      if (!result.operations.caches.success) {
        result.errors.push('Failed to clear all caches');
        result.success = false;
      }

      // 2. Clear storage (if not skipped)
      if (!this.options.skipStorage) {
        this.log('Step 2: Clearing storage...');
        
        // Clear localStorage
        result.operations.localStorage.success = await this.cacheManager.clearLocalStorage();
        if (!result.operations.localStorage.success) {
          result.errors.push('Failed to clear localStorage');
          result.success = false;
        }

        // Clear sessionStorage
        result.operations.sessionStorage.success = await this.cacheManager.clearSessionStorage();
        if (!result.operations.sessionStorage.success) {
          result.errors.push('Failed to clear sessionStorage');
          result.success = false;
        }

        // Clear IndexedDB
        result.operations.indexedDB.success = await this.cacheManager.clearIndexedDB();
        if (!result.operations.indexedDB.success) {
          result.errors.push('Failed to clear IndexedDB');
          result.success = false;
        }
      } else {
        this.log('Step 2: Skipping storage cleanup');
        result.operations.localStorage.success = true;
        result.operations.sessionStorage.success = true;
        result.operations.indexedDB.success = true;
      }

      // 3. Unregister service workers (if not skipped)
      if (!this.options.skipServiceWorkers) {
        this.log('Step 3: Unregistering service workers...');
        result.operations.serviceWorkers = await this.unregisterServiceWorkers();
        if (!result.operations.serviceWorkers.success) {
          result.errors.push('Failed to unregister all service workers');
          result.success = false;
        }
      } else {
        this.log('Step 3: Skipping service worker cleanup');
        result.operations.serviceWorkers.success = true;
      }

      // 4. Verify cleanup
      this.log('Step 4: Verifying cleanup...');
      const verificationResult = await this.verifyCleanup();
      if (!verificationResult.complete) {
        result.partialCleanup = true;
        result.errors.push('Cleanup verification failed - some data may remain');
        if (verificationResult.remainingCaches > 0) {
          result.errors.push(`${verificationResult.remainingCaches} caches still present`);
        }
        if (verificationResult.remainingServiceWorkers > 0) {
          result.errors.push(`${verificationResult.remainingServiceWorkers} service workers still registered`);
        }
      }

      this.log(`Cleanup completed. Success: ${result.success}, Partial: ${result.partialCleanup}`);
      return result;

    } catch (error) {
      this.logError('Critical error during cleanup:', error);
      result.success = false;
      result.errors.push(`Critical cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Attempt partial cleanup fallback
      return this.performPartialCleanup(result);
    }
  }

  /**
   * Perform partial cleanup when full cleanup fails
   */
  async performPartialCleanup(existingResult?: Partial<CleanupResult>): Promise<CleanupResult> {
    this.log('Attempting partial cleanup fallback...');

    const result: CleanupResult = existingResult ? {
      ...existingResult,
      partialCleanup: true,
    } as CleanupResult : {
      success: false,
      operations: {
        caches: { success: false, cleared: [], failed: [] },
        localStorage: { success: false },
        sessionStorage: { success: false },
        indexedDB: { success: false },
        serviceWorkers: { success: false, unregistered: [], failed: [] },
      },
      errors: [],
      partialCleanup: true,
    };

    try {
      // Try to clear at least the most important caches
      if (!result.operations.caches.success) {
        const criticalCaches = await this.getCriticalCacheNames();
        for (const cacheName of criticalCaches) {
          try {
            const cleared = await this.cacheManager.clearSpecificCache(cacheName);
            if (cleared) {
              result.operations.caches.cleared.push(cacheName);
            }
          } catch (error) {
            this.logError(`Failed to clear critical cache ${cacheName}:`, error);
          }
        }
        result.operations.caches.success = result.operations.caches.cleared.length > 0;
      }

      // Try basic storage clearing
      if (!result.operations.localStorage.success) {
        try {
          localStorage.removeItem('pwa-install-dismissed');
          localStorage.removeItem('pwa-update-dismissed');
          result.operations.localStorage.success = true;
        } catch (error) {
          this.logError('Failed partial localStorage cleanup:', error);
        }
      }

      this.log('Partial cleanup completed');
      return result;

    } catch (error) {
      this.logError('Partial cleanup also failed:', error);
      result.errors.push(`Partial cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Unregister all service workers
   */
  async unregisterServiceWorkers(): Promise<{ success: boolean; unregistered: string[]; failed: string[] }> {
    const result = {
      success: true,
      unregistered: [] as string[],
      failed: [] as string[],
    };

    try {
      if (!('serviceWorker' in navigator)) {
        this.log('Service Worker API not supported');
        return result;
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      this.log(`Found ${registrations.length} service worker registrations`);

      if (registrations.length === 0) {
        return result;
      }

      for (const registration of registrations) {
        try {
          const scope = registration.scope;
          const unregistered = await registration.unregister();
          
          if (unregistered) {
            result.unregistered.push(scope);
            this.log(`✓ Unregistered service worker: ${scope}`);
          } else {
            result.failed.push(scope);
            this.log(`✗ Failed to unregister service worker: ${scope}`);
          }
        } catch (error) {
          const scope = registration.scope || 'unknown';
          result.failed.push(scope);
          this.logError(`Error unregistering service worker ${scope}:`, error);
        }
      }

      result.success = result.failed.length === 0;
      this.log(`Service worker cleanup: ${result.unregistered.length} unregistered, ${result.failed.length} failed`);
      
      return result;

    } catch (error) {
      this.logError('Failed to unregister service workers:', error);
      result.success = false;
      result.failed.push('unknown');
      return result;
    }
  }

  /**
   * Verify cleanup was successful
   */
  async verifyCleanup(): Promise<{ complete: boolean; remainingCaches: number; remainingServiceWorkers: number }> {
    try {
      // Check remaining caches
      const remainingCaches = (await this.cacheManager.getCacheNames()).length;
      
      // Check remaining service workers
      let remainingServiceWorkers = 0;
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        remainingServiceWorkers = registrations.length;
      }

      const complete = remainingCaches === 0 && remainingServiceWorkers === 0;
      
      this.log(`Cleanup verification: ${complete ? 'Complete' : 'Incomplete'} (Caches: ${remainingCaches}, SW: ${remainingServiceWorkers})`);
      
      return {
        complete,
        remainingCaches,
        remainingServiceWorkers,
      };

    } catch (error) {
      this.logError('Failed to verify cleanup:', error);
      return {
        complete: false,
        remainingCaches: -1,
        remainingServiceWorkers: -1,
      };
    }
  }

  /**
   * Get critical cache names that should be prioritized for cleanup
   */
  private async getCriticalCacheNames(): Promise<string[]> {
    try {
      const allCaches = await this.cacheManager.getCacheNames();
      return allCaches.filter(name => 
        name.includes('tabeza') || 
        name.includes('workbox') || 
        name.includes('precache') ||
        name.includes('runtime')
      );
    } catch (error) {
      this.logError('Failed to get critical cache names:', error);
      return [];
    }
  }

  private log(message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[UninstallCleanup] ${message}`, ...args);
    }
  }

  private logError(message: string, error: any): void {
    if (this.options.debug) {
      console.error(`[UninstallCleanup] ${message}`, error);
    }
  }
}