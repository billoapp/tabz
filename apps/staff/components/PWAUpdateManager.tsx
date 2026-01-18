'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles, Shield, Zap } from 'lucide-react';

export default function PWAUpdateManager() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateDetails, setUpdateDetails] = useState<{
    version?: string;
    features?: string[];
    improvements?: string[];
  }>({});

  useEffect(() => {
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
                  
                  // Set professional update details
                  setUpdateDetails({
                    version: 'Latest',
                    features: [
                      'Enhanced performance and reliability',
                      'Improved security and data protection',
                      'New features and user experience improvements'
                    ],
                    improvements: [
                      'Faster loading times',
                      'Better offline functionality',
                      'Bug fixes and stability improvements'
                    ]
                  });
                  
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

      // Periodic update check (every 10 minutes for less intrusion)
      const updateInterval = setInterval(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.update();
          });
        }
      }, 10 * 60 * 1000);

      return () => clearInterval(updateInterval);
    }
  }, []);

  const handleUpdate = async () => {
    if (!newWorker) return;

    setIsUpdating(true);
    
    try {
      // Send message to skip waiting
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Show updating feedback
      console.log('🔄 Applying Tabeza update...');
      
      // The controllerchange event will trigger a reload
      setTimeout(() => {
        if (isUpdating) {
          console.log('🔄 Reloading to complete update...');
          window.location.reload();
        }
      }, 3000);
    } catch (error) {
      console.error('❌ PWA Update Manager: Failed to update:', error);
      setIsUpdating(false);
      // Fallback: manual reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    // Store dismissal with timestamp to show again after some time
    const dismissalData = {
      timestamp: Date.now(),
      version: updateDetails.version || 'unknown'
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

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl max-w-sm w-full animate-in slide-in-from-bottom-4">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
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
            <Zap size={14} className="text-orange-500" />
            <span>Enhanced performance & speed</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Shield size={14} className="text-orange-500" />
            <span>Security improvements & bug fixes</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <RefreshCw size={14} className="text-orange-500" />
            <span>Better offline functionality</span>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
          Update takes just a few seconds • No data loss
        </p>
      </div>
    </div>
  );
}
