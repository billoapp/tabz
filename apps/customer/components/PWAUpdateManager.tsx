'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X, Wifi, WifiOff, Sparkles, Shield, Zap } from 'lucide-react';

export default function PWAUpdateManager() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);

  useEffect(() => {
    // Handle online/offline events
    const handleOnline = () => {
      console.log('🌐 Connection: Online');
      setIsOnline(true);
      setShowConnectionStatus(false);
    };
    
    const handleOffline = () => {
      console.log('📵 Connection: Offline');
      setIsOnline(false);
      setShowConnectionStatus(true);
      // Hide connection status after 5 seconds
      setTimeout(() => setShowConnectionStatus(false), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ PWA Update Manager: Service worker registered');

          // Check for updates immediately
          registration.update();

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            console.log('🔄 PWA Update Manager: New service worker found');
            const installingWorker = registration.installing;
            
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                console.log('📊 PWA Update Manager: Worker state changed to', installingWorker.state);
                
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                  setNewWorker(installingWorker);
                  // Show update notification after a brief delay
                  setTimeout(() => {
                    setShowUpdate(true);
                  }, 2000);
                }
              });
            }
          });

          // Listen for controlling service worker changes
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 PWA Update Manager: Controller changed, reloading page');
            window.location.reload();
          });
        })
        .catch(error => {
          console.error('❌ PWA Update Manager: Service worker registration failed:', error);
        });

      // Periodic update check (every 10 minutes)
      const updateInterval = setInterval(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            console.log('🔄 PWA Update Manager: Checking for updates...');
            registration.update();
          });
        }
      }, 10 * 60 * 1000);

      // Also check for updates when the app becomes visible
      const handleVisibilityChange = () => {
        if (!document.hidden && 'serviceWorker' in navigator) {
          console.log('🔄 PWA Update Manager: App became visible, checking for updates...');
          navigator.serviceWorker.ready.then(registration => {
            registration.update();
          });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(updateInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleUpdate = async () => {
    if (!newWorker) return;

    setIsUpdating(true);
    
    try {
      console.log('🔄 PWA Update Manager: Starting update process...');
      
      // Clear all caches first
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('🗑️ PWA Update Manager: Clearing caches:', cacheNames);
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Send message to skip waiting
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // The controllerchange event will trigger a reload
      setTimeout(() => {
        if (isUpdating) {
          console.log('🔄 PWA Update Manager: Force reloading...');
          window.location.reload();
        }
      }, 3000);
    } catch (error) {
      console.error('❌ PWA Update Manager: Failed to update:', error);
      setIsUpdating(false);
      // Fallback: manual reload with cache busting
      window.location.href = window.location.href + '?v=' + Date.now();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    // Store dismissal with timestamp to show again after some time
    const dismissalData = {
      timestamp: Date.now(),
      version: 'latest'
    };
    sessionStorage.setItem('pwa-update-dismissed', JSON.stringify(dismissalData));
  };

  // Check if update was recently dismissed (within 1 hour)
  useEffect(() => {
    const dismissalData = sessionStorage.getItem('pwa-update-dismissed');
    if (dismissalData) {
      try {
        const { timestamp } = JSON.parse(dismissalData);
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - timestamp < oneHour) {
          setShowUpdate(false);
        }
      } catch {
        // Invalid data, clear it
        sessionStorage.removeItem('pwa-update-dismissed');
      }
    }
  }, []);

  return (
    <>
      {/* Connection Status Indicator - Only show when offline or briefly when coming online */}
      {showConnectionStatus && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4">
          {isOnline ? (
            <>
              <Wifi size={16} className="text-green-400" />
              <span className="text-sm font-medium">Back Online</span>
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-red-400" />
              <span className="text-sm font-medium">Working Offline</span>
            </>
          )}
        </div>
      )}

      {/* Update Notification */}
      {showUpdate && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl max-w-sm w-full animate-in slide-in-from-bottom-4">
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">
                    Tabeza Update Ready
                  </h4>
                  <p className="text-sm text-gray-600">
                    New improvements available
                  </p>
                </div>
              </div>
              <button 
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
                disabled={isUpdating}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Zap size={14} className="text-green-500" />
                <span>Faster ordering & payments</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Shield size={14} className="text-green-500" />
                <span>Enhanced security & reliability</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <RefreshCw size={14} className="text-green-500" />
                <span>Improved offline experience</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Later
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-3 text-center">
              Quick update • Your tab stays safe
            </p>
            
            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                SW State: {newWorker?.state || 'unknown'} | Online: {isOnline ? 'Yes' : 'No'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
