'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Trash2, Info } from 'lucide-react';

interface PWADebugInfoProps {
  className?: string;
}

interface DebugInfo {
  serviceWorker: {
    supported: boolean;
    registered: boolean;
    controller: boolean;
    registrations: number;
  };
  manifest: {
    supported: boolean;
    loaded: boolean;
    installable: boolean;
  };
  cache: {
    supported: boolean;
    names: string[];
    totalSize: number;
  };
  network: {
    online: boolean;
    connection: string;
  };
  platform: {
    userAgent: string;
    standalone: boolean;
    displayMode: string;
  };
}

export default function PWADebugInfo({ className = '' }: PWADebugInfoProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const collectDebugInfo = async (): Promise<DebugInfo> => {
    const info: DebugInfo = {
      serviceWorker: {
        supported: 'serviceWorker' in navigator,
        registered: false,
        controller: false,
        registrations: 0,
      },
      manifest: {
        supported: 'serviceWorker' in navigator,
        loaded: false,
        installable: false,
      },
      cache: {
        supported: 'caches' in window,
        names: [],
        totalSize: 0,
      },
      network: {
        online: navigator.onLine,
        connection: (navigator as any).connection?.effectiveType || 'unknown',
      },
      platform: {
        userAgent: navigator.userAgent,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      },
    };

    // Service Worker info
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        info.serviceWorker.registrations = registrations.length;
        info.serviceWorker.registered = registrations.length > 0;
        info.serviceWorker.controller = !!navigator.serviceWorker.controller;
      } catch (error) {
        console.error('Error getting service worker info:', error);
      }
    }

    // Cache info
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        info.cache.names = cacheNames;
        
        // Estimate total cache size (rough calculation)
        let totalSize = 0;
        for (const name of cacheNames.slice(0, 5)) { // Limit to first 5 for performance
          try {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            totalSize += keys.length * 1024; // Rough estimate: 1KB per entry
          } catch (error) {
            console.error(`Error calculating size for cache ${name}:`, error);
          }
        }
        info.cache.totalSize = totalSize;
      } catch (error) {
        console.error('Error getting cache info:', error);
      }
    }

    // Manifest info
    try {
      const response = await fetch('/manifest.json');
      info.manifest.loaded = response.ok;
      info.manifest.installable = 'onbeforeinstallprompt' in window;
    } catch (error) {
      console.error('Error checking manifest:', error);
    }

    return info;
  };

  const refreshDebugInfo = async () => {
    setLoading(true);
    try {
      const info = await collectDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      console.error('Error collecting debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllCaches = async () => {
    if (!('caches' in window)) return;
    
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('All caches cleared');
      await refreshDebugInfo();
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  };

  const unregisterServiceWorkers = async () => {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('All service workers unregistered');
      await refreshDebugInfo();
    } catch (error) {
      console.error('Error unregistering service workers:', error);
    }
  };

  useEffect(() => {
    if (isVisible && !debugInfo) {
      refreshDebugInfo();
    }
  }, [isVisible, debugInfo]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="PWA Debug Info"
      >
        {isVisible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>

      {/* Debug Panel */}
      {isVisible && (
        <div className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Info size={16} />
              PWA Debug Info
            </h3>
            <div className="flex gap-2">
              <button
                onClick={refreshDebugInfo}
                disabled={loading}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
                title="Close"
              >
                <EyeOff size={16} />
              </button>
            </div>
          </div>

          {debugInfo && (
            <div className="space-y-4 text-sm">
              {/* Service Worker */}
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Service Worker</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Supported:</span>
                    <span className={debugInfo.serviceWorker.supported ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.serviceWorker.supported ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Registered:</span>
                    <span className={debugInfo.serviceWorker.registered ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.serviceWorker.registered ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Controller:</span>
                    <span className={debugInfo.serviceWorker.controller ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.serviceWorker.controller ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Count:</span>
                    <span>{debugInfo.serviceWorker.registrations}</span>
                  </div>
                </div>
              </div>

              {/* Manifest */}
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Manifest</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Loaded:</span>
                    <span className={debugInfo.manifest.loaded ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.manifest.loaded ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Installable:</span>
                    <span className={debugInfo.manifest.installable ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.manifest.installable ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cache */}
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Cache Storage</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Supported:</span>
                    <span className={debugInfo.cache.supported ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.cache.supported ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Caches:</span>
                    <span>{debugInfo.cache.names.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Size:</span>
                    <span>{formatBytes(debugInfo.cache.totalSize)}</span>
                  </div>
                  {debugInfo.cache.names.length > 0 && (
                    <div className="mt-1">
                      <div className="text-gray-600 mb-1">Cache Names:</div>
                      {debugInfo.cache.names.map(name => (
                        <div key={name} className="text-xs text-gray-500 truncate">
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Network */}
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Network</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Online:</span>
                    <span className={debugInfo.network.online ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.network.online ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection:</span>
                    <span>{debugInfo.network.connection}</span>
                  </div>
                </div>
              </div>

              {/* Platform */}
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Platform</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Standalone:</span>
                    <span className={debugInfo.platform.standalone ? 'text-green-600' : 'text-red-600'}>
                      {debugInfo.platform.standalone ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Display:</span>
                    <span>{debugInfo.platform.displayMode}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-2">Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={clearAllCaches}
                    className="w-full bg-red-100 text-red-700 px-3 py-2 rounded text-xs hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    Clear All Caches
                  </button>
                  <button
                    onClick={unregisterServiceWorkers}
                    className="w-full bg-orange-100 text-orange-700 px-3 py-2 rounded text-xs hover:bg-orange-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    Unregister Service Workers
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={20} className="animate-spin text-blue-600" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}