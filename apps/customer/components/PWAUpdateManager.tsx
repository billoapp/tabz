'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, Wifi, WifiOff } from 'lucide-react';

export default function PWAUpdateManager() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Simplified service worker setup based on working pwa-updater branch
  const setupServiceWorker = useCallback(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('PWA Update Manager: Service workers not supported');
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('PWA Update Manager: Service worker registered');

        // Check for updates immediately
        registration.update();

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('PWA Update Manager: New service worker found');
          const installingWorker = registration.installing;

          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              console.log('PWA Update Manager: Worker state changed to', installingWorker.state);
              
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                setNewWorker(installingWorker);
                setShowUpdate(true);
                sessionStorage.removeItem('pwa-update-dismissed');
              }
            });
          }
        });

        // Listen for controlling service worker changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('PWA Update Manager: Controller changed, reloading page');
          window.location.reload();
        });
      })
      .catch(error => {
        console.error('PWA Update Manager: Service worker registration failed:', error);
      });
  }, []);

  const handleUpdate = async () => {
    if (!newWorker) return;

    setIsUpdating(true);

    try {
      // Send message to skip waiting
      newWorker.postMessage({ type: 'SKIP_WAITING' });

      // The controllerchange event will trigger a reload
      setTimeout(() => {
        if (isUpdating) {
          setIsUpdating(false);
        }
      }, 3000);
    } catch (error) {
      console.error('PWA Update Manager: Failed to update:', error);
      setIsUpdating(false);
      // Fallback: manual reload
      window.location.reload();
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
    };
    
    const handleOffline = () => {
      console.log('📵 Connection: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize PWA update management
    setupServiceWorker();

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
    };
  }, [setupServiceWorker]);

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
      </div>

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
