'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface UpdateError {
  message: string;
  code: string;
  timestamp: number;
}

export default function PWAUpdateManager() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateError, setUpdateError] = useState<UpdateError | null>(null);
  const [configurationChanged, setConfigurationChanged] = useState(false);

  // Enhanced cleanup function to unregister conflicting service workers
  const cleanupConflictingServiceWorkers = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const conflictingPaths = [
        '/service-worker.js', 
        '/custom-sw.js', 
        '/enhanced-sw.js',
        '/manual-sw.js'
      ];
      
      let cleanedCount = 0;
      for (const registration of registrations) {
        const scriptURL = registration.active?.scriptURL || '';
        const scope = registration.scope;
        
        // Check if this is a conflicting registration (not next-pwa generated)
        const isConflicting = conflictingPaths.some(path => 
          scriptURL.includes(path) || scope.includes(path)
        );
        
        // Also check if it's not the expected next-pwa service worker
        const isNextPWA = scriptURL.includes('/sw.js') && !conflictingPaths.some(path => scriptURL.includes(path));
        
        if (isConflicting && !isNextPWA) {
          console.log('PWA Update Manager: Cleaning up conflicting service worker:', { scriptURL, scope });
          await registration.unregister();
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`PWA Update Manager: Cleaned up ${cleanedCount} conflicting service worker(s)`);
        setConfigurationChanged(true);
      }
    } catch (error) {
      console.error('PWA Update Manager: Error cleaning up conflicting service workers:', error);
      setUpdateError({
        message: 'Failed to clean up conflicting service workers',
        code: 'CLEANUP_ERROR',
        timestamp: Date.now()
      });
    }
  }, []);

  // Enhanced service worker update detection using next-pwa
  const setupServiceWorkerUpdateDetection = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('PWA Update Manager: Service workers not supported');
      return;
    }

    try {
      // Wait for next-pwa generated service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      console.log('PWA Update Manager: Next-PWA service worker ready');

      // Verify this is the expected next-pwa service worker
      const scriptURL = registration.active?.scriptURL || '';
      if (!scriptURL.includes('/sw.js') || scriptURL.includes('custom') || scriptURL.includes('manual')) {
        console.warn('PWA Update Manager: Unexpected service worker detected:', scriptURL);
        setUpdateError({
          message: 'Unexpected service worker configuration detected',
          code: 'CONFIG_MISMATCH',
          timestamp: Date.now()
        });
        return;
      }

      // Check for updates immediately
      await registration.update();

      // Enhanced update detection
      const handleUpdateFound = () => {
        console.log('PWA Update Manager: Update found via next-pwa');
        const installingWorker = registration.installing;
        
        if (installingWorker) {
          const handleStateChange = () => {
            console.log('PWA Update Manager: Worker state changed to', installingWorker.state);
            
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available via next-pwa
              setNewWorker(installingWorker);
              setShowUpdate(true);
              setUpdateError(null); // Clear any previous errors
              
              // Clear dismissal flag for new updates
              sessionStorage.removeItem('pwa-update-dismissed');
            } else if (installingWorker.state === 'redundant') {
              console.log('PWA Update Manager: Update failed - worker became redundant');
              setUpdateError({
                message: 'Update failed - service worker became redundant',
                code: 'UPDATE_REDUNDANT',
                timestamp: Date.now()
              });
            }
          };
          
          installingWorker.addEventListener('statechange', handleStateChange);
          
          // Cleanup listener when component unmounts
          return () => {
            installingWorker.removeEventListener('statechange', handleStateChange);
          };
        }
      };

      registration.addEventListener('updatefound', handleUpdateFound);

      // Enhanced controller change handling
      const handleControllerChange = () => {
        console.log('PWA Update Manager: Controller changed via next-pwa, reloading page');
        
        // Add a small delay to ensure the new service worker is fully active
        setTimeout(() => {
          window.location.reload();
        }, 100);
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      // Configuration change detection
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'CONFIG_CHANGED') {
          console.log('PWA Update Manager: Configuration change detected');
          setConfigurationChanged(true);
          // Force update check
          registration.update();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        registration.removeEventListener('updatefound', handleUpdateFound);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };

    } catch (error) {
      console.error('PWA Update Manager: Failed to setup service worker update detection:', error);
      setUpdateError({
        message: 'Failed to setup update detection',
        code: 'SETUP_ERROR',
        timestamp: Date.now()
      });
    }
  }, []);

  const handleUpdate = async () => {
    if (!newWorker) {
      setUpdateError({
        message: 'No service worker available for update',
        code: 'NO_WORKER',
        timestamp: Date.now()
      });
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);
    
    try {
      // Send message to skip waiting
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Set a timeout for the update process
      const updateTimeout = setTimeout(() => {
        if (isUpdating) {
          console.warn('PWA Update Manager: Update taking longer than expected, forcing reload');
          window.location.reload();
        }
      }, 5000);

      // The controllerchange event will trigger a reload
      setTimeout(() => {
        clearTimeout(updateTimeout);
        if (isUpdating) {
          setIsUpdating(false);
        }
      }, 3000);
      
    } catch (error) {
      console.error('PWA Update Manager: Failed to update:', error);
      setIsUpdating(false);
      setUpdateError({
        message: 'Failed to apply update',
        code: 'UPDATE_FAILED',
        timestamp: Date.now()
      });
      
      // Fallback: manual reload after a delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    // Store dismissal in sessionStorage to avoid showing again for this session
    sessionStorage.setItem('pwa-update-dismissed', 'true');
  };

  // Don't show if dismissed in current session
  useEffect(() => {
    if (sessionStorage.getItem('pwa-update-dismissed') === 'true') {
      setShowUpdate(false);
    }
  }, []);

  // Main effect to initialize PWA update management
  useEffect(() => {
    // Handle online/offline events
    const handleOnline = () => {
      console.log('🌐 Connection: Online');
      setIsOnline(true);
      setUpdateError(null); // Clear network-related errors when back online
    };
    
    const handleOffline = () => {
      console.log('📵 Connection: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize PWA update management
    const initializePWAUpdates = async () => {
      // Clean up conflicting service workers first
      await cleanupConflictingServiceWorkers();
      
      // Setup next-pwa service worker update detection
      const cleanup = await setupServiceWorkerUpdateDetection();
      
      return cleanup;
    };

    let cleanupFunctions: (() => void)[] = [];
    
    initializePWAUpdates().then(cleanup => {
      if (cleanup) {
        cleanupFunctions.push(cleanup);
      }
    });

    // Periodic update check (every 5 minutes) - only when online
    const updateInterval = setInterval(() => {
      if (navigator.onLine && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then(registration => {
            console.log('PWA Update Manager: Periodic update check');
            return registration.update();
          })
          .catch(error => {
            console.error('PWA Update Manager: Periodic update check failed:', error);
          });
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(updateInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [cleanupConflictingServiceWorkers, setupServiceWorkerUpdateDetection]);

  // Clear errors after 10 seconds
  useEffect(() => {
    if (updateError) {
      const timer = setTimeout(() => {
        setUpdateError(null);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [updateError]);

  // Always show connection status for debugging
  return (
    <>
      {/* Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-lg shadow-lg flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi size={16} className="text-green-400" />
            <span className="text-xs">Online</span>
          </>
        ) : (
          <>
            <WifiOff size={16} className="text-red-400" />
            <span className="text-xs">Offline</span>
          </>
        )}
        {configurationChanged && (
          <div className="ml-2 w-2 h-2 bg-yellow-400 rounded-full" title="Configuration changed" />
        )}
      </div>

      {/* Error Notification */}
      {updateError && (
        <div className="fixed top-20 right-4 z-50 bg-red-600 text-white p-3 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-200 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">PWA Update Error</h4>
              <p className="text-xs text-red-100 mt-1">{updateError.message}</p>
              <p className="text-xs text-red-200 mt-1">Code: {updateError.code}</p>
            </div>
            <button 
              onClick={() => setUpdateError(null)}
              className="text-red-100 hover:text-white transition-colors ml-auto"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Configuration Change Notification */}
      {configurationChanged && !updateError && (
        <div className="fixed top-20 right-4 z-50 bg-yellow-600 text-white p-3 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start gap-2">
            <RefreshCw size={16} className="text-yellow-200 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Configuration Updated</h4>
              <p className="text-xs text-yellow-100 mt-1">
                PWA configuration has been updated. Refresh to apply changes.
              </p>
            </div>
            <button 
              onClick={() => setConfigurationChanged(false)}
              className="text-yellow-100 hover:text-white transition-colors ml-auto"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Update Notification */}
      {showUpdate && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white p-4 rounded-lg shadow-lg max-w-sm animate-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold flex items-center gap-2">
            <RefreshCw size={18} className={isUpdating ? 'animate-spin' : ''} />
            Tabeza Update Available
          </h4>
          <p className="text-sm text-green-100 mt-1">
            A new Tabeza version is ready to install.
          </p>
        </div>
        <button 
          onClick={handleDismiss}
          className="text-green-100 hover:text-white transition-colors"
          disabled={isUpdating}
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="flex gap-3">
        <button 
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex-1 bg-white text-green-600 px-4 py-2 rounded font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isUpdating ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Update Now
            </>
          )}
        </button>
        <button 
          onClick={handleDismiss}
          disabled={isUpdating}
          className="px-4 py-2 text-green-100 hover:text-white transition-colors disabled:opacity-50"
        >
          Later
        </button>
      </div>
    </div>
      )}
    </>
  );
}
