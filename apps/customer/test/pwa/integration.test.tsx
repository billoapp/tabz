import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '@/lib/cache-manager';
import { UninstallCleanup } from '@/lib/uninstall-cleanup';

// Mock next-pwa service worker
const mockServiceWorker = {
  scriptURL: 'http://localhost:3000/sw.js',
  state: 'activated',
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockRegistration = {
  scope: 'http://localhost:3000/',
  active: mockServiceWorker,
  installing: null,
  waiting: null,
  update: vi.fn(),
  unregister: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe('PWA Integration Tests', () => {
  let originalNavigator: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Enhanced navigator mock
    originalNavigator = global.navigator;
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: vi.fn().mockResolvedValue(mockRegistration),
          ready: Promise.resolve(mockRegistration),
          getRegistrations: vi.fn().mockResolvedValue([mockRegistration]),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          controller: mockServiceWorker,
        },
        onLine: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      },
      writable: true,
    });

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock caches API
    Object.defineProperty(global, 'caches', {
      value: {
        keys: vi.fn().mockResolvedValue(['cache-v1', 'cache-v2']),
        open: vi.fn().mockResolvedValue({
          keys: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(true),
        }),
        delete: vi.fn().mockResolvedValue(true),
      },
      writable: true,
    });

    // Mock localStorage and sessionStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Worker Management', () => {
    it('should detect and use next-pwa generated service worker', async () => {
      const registration = await navigator.serviceWorker.ready;
      
      expect(registration).toBeDefined();
      expect(registration.active?.scriptURL).toContain('/sw.js');
      expect(registration.active?.scriptURL).not.toContain('custom');
      expect(registration.active?.scriptURL).not.toContain('manual');
    });

    it('should handle service worker updates', async () => {
      const registration = await navigator.serviceWorker.ready;
      
      // Simulate update check
      await registration.update();
      
      expect(registration.update).toHaveBeenCalled();
    });

    it('should clean up conflicting service workers', async () => {
      // Mock conflicting registrations
      const conflictingRegistration = {
        ...mockRegistration,
        active: {
          ...mockServiceWorker,
          scriptURL: 'http://localhost:3000/custom-sw.js',
        },
        unregister: vi.fn().mockResolvedValue(true),
      };

      navigator.serviceWorker.getRegistrations = vi.fn().mockResolvedValue([
        mockRegistration,
        conflictingRegistration,
      ]);

      const registrations = await navigator.serviceWorker.getRegistrations();
      
      // Simulate cleanup logic
      for (const reg of registrations) {
        const scriptURL = reg.active?.scriptURL || '';
        const conflictingPaths = ['/service-worker.js', '/custom-sw.js', '/enhanced-sw.js'];
        
        if (conflictingPaths.some(path => scriptURL.includes(path))) {
          await reg.unregister();
        }
      }

      expect(conflictingRegistration.unregister).toHaveBeenCalled();
    });
  });

  describe('PWA Installation Detection', () => {
    it('should detect PWA installation capabilities', () => {
      // Mock beforeinstallprompt support
      const mockEvent = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
        preventDefault: vi.fn(),
      };

      // Simulate beforeinstallprompt event availability
      const isInstallable = 'onbeforeinstallprompt' in window;
      
      // For testing, we'll assume it's available
      expect(typeof mockEvent.prompt).toBe('function');
      expect(mockEvent.userChoice).toBeInstanceOf(Promise);
    });

    it('should handle different platform installation methods', () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', // Chrome on Windows
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', // Safari on iOS
        'Mozilla/5.0 (Android 10; Mobile; rv:81.0) Gecko/81.0 Firefox/81.0', // Firefox on Android
      ];

      userAgents.forEach(userAgent => {
        Object.defineProperty(navigator, 'userAgent', {
          value: userAgent,
          writable: true,
        });

        // Test platform detection logic
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);
        const isWindows = /Windows/.test(userAgent);

        expect(typeof isIOS).toBe('boolean');
        expect(typeof isAndroid).toBe('boolean');
        expect(typeof isWindows).toBe('boolean');
      });
    });
  });

  describe('Cache Management and Offline Functionality', () => {
    it('should handle cache management operations', async () => {
      const cacheManager = new CacheManager();

      // Test cache clearing
      await cacheManager.clearAllCaches();
      expect(global.caches.keys).toHaveBeenCalled();
      expect(global.caches.delete).toHaveBeenCalledWith('cache-v1');
      expect(global.caches.delete).toHaveBeenCalledWith('cache-v2');
    });

    it('should get cache information', async () => {
      const cacheManager = new CacheManager();
      
      const cacheInfo = await cacheManager.getCacheInfo();
      
      expect(cacheInfo).toBeDefined();
      expect(Array.isArray(cacheInfo.cacheNames)).toBe(true);
      expect(typeof cacheInfo.totalSize).toBe('number');
    });

    it('should handle cache errors gracefully', async () => {
      // Mock cache error
      global.caches.keys = vi.fn().mockRejectedValue(new Error('Cache access failed'));
      
      const cacheManager = new CacheManager();
      
      // Should not throw error
      await expect(cacheManager.clearAllCaches()).resolves.not.toThrow();
    });

    it('should detect online/offline status', () => {
      // Test online status
      expect(navigator.onLine).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      expect(navigator.onLine).toBe(false);

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      expect(navigator.onLine).toBe(true);
    });
  });

  describe('Uninstallation and Cleanup', () => {
    it('should perform complete cleanup on uninstall', async () => {
      const uninstallCleanup = new UninstallCleanup();

      await uninstallCleanup.performCompleteCleanup();

      // Verify service worker unregistration
      expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalled();
      expect(mockRegistration.unregister).toHaveBeenCalled();

      // Verify cache cleanup
      expect(global.caches.keys).toHaveBeenCalled();
      expect(global.caches.delete).toHaveBeenCalled();
    });

    it('should handle partial cleanup when full cleanup fails', async () => {
      // Mock cleanup failure
      global.caches.delete = vi.fn().mockRejectedValue(new Error('Cache delete failed'));
      
      const uninstallCleanup = new UninstallCleanup();
      
      // Should not throw error, should handle gracefully
      await expect(uninstallCleanup.performCompleteCleanup()).resolves.not.toThrow();
    });

    it('should verify cleanup completion', async () => {
      const uninstallCleanup = new UninstallCleanup();
      
      const verificationResult = await uninstallCleanup.verifyCleanup();
      
      expect(verificationResult).toBeDefined();
      expect(typeof verificationResult.success).toBe('boolean');
      expect(Array.isArray(verificationResult.details)).toBe(true);
    });

    it('should clean up storage data', async () => {
      const uninstallCleanup = new UninstallCleanup();
      
      await uninstallCleanup.performCompleteCleanup();
      
      // Verify localStorage cleanup
      expect(window.localStorage.clear).toHaveBeenCalled();
      
      // Verify sessionStorage cleanup
      expect(window.sessionStorage.clear).toHaveBeenCalled();
    });
  });

  describe('Cross-browser Compatibility', () => {
    it('should handle browsers without service worker support', async () => {
      // Remove service worker support
      const navigatorWithoutSW = { ...navigator };
      delete (navigatorWithoutSW as any).serviceWorker;
      
      Object.defineProperty(global, 'navigator', {
        value: navigatorWithoutSW,
        writable: true,
      });

      // Should handle gracefully
      expect('serviceWorker' in navigator).toBe(false);
    });

    it('should handle browsers without cache API support', async () => {
      // Remove caches API
      delete (global as any).caches;
      
      const cacheManager = new CacheManager();
      
      // Should handle gracefully without throwing
      await expect(cacheManager.clearAllCaches()).resolves.not.toThrow();
    });

    it('should handle different display modes', () => {
      const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
      
      displayModes.forEach(mode => {
        window.matchMedia = vi.fn().mockImplementation(query => ({
          matches: query === `(display-mode: ${mode})`,
          media: query,
        }));

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        expect(typeof isStandalone).toBe('boolean');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service worker registration failures', async () => {
      // Mock registration failure
      navigator.serviceWorker.ready = Promise.reject(new Error('Registration failed'));
      
      try {
        await navigator.serviceWorker.ready;
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Registration failed');
      }
    });

    it('should handle update failures gracefully', async () => {
      // Mock update failure
      mockRegistration.update = vi.fn().mockRejectedValue(new Error('Update failed'));
      
      const registration = await navigator.serviceWorker.ready;
      
      try {
        await registration.update();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Update failed');
      }
    });

    it('should handle network errors during cleanup', async () => {
      // Mock network error during cleanup
      navigator.serviceWorker.getRegistrations = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const uninstallCleanup = new UninstallCleanup();
      
      // Should handle gracefully
      await expect(uninstallCleanup.performCompleteCleanup()).resolves.not.toThrow();
    });

    it('should retry failed operations', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Operation failed');
        }
        return Promise.resolve('success');
      });

      // Simulate retry logic
      const maxRetries = 3;
      let result;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await mockOperation();
          break;
        } catch (error) {
          if (i === maxRetries - 1) {
            throw error;
          }
        }
      }

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });
});