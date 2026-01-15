'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface NetworkStatusProps {
  className?: string;
  showOfflineMessage?: boolean;
  onStatusChange?: (isOnline: boolean) => void;
  compact?: boolean;
}

export default function NetworkStatus({ 
  className = '', 
  showOfflineMessage = true,
  onStatusChange,
  compact = false
}: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  useEffect(() => {
    // Initial status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log('🌐 Network: Back online');
      setIsOnline(true);
      setShowOfflineBanner(false);
      onStatusChange?.(true);
    };

    const handleOffline = () => {
      console.log('📵 Network: Gone offline');
      setIsOnline(false);
      if (showOfflineMessage) {
        setShowOfflineBanner(true);
      }
      onStatusChange?.(false);
    };

    // Listen for network events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Enhanced connectivity check (navigator.onLine can be unreliable)
    const checkConnectivity = async () => {
      try {
        const response = await fetch('/', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        
        const actuallyOnline = response.ok;
        if (actuallyOnline !== isOnline) {
          if (actuallyOnline) {
            handleOnline();
          } else {
            handleOffline();
          }
        }
      } catch {
        // If fetch fails and we think we're online, we're probably offline
        if (isOnline) {
          handleOffline();
        }
      }
    };

    // Periodic connectivity check
    const connectivityInterval = setInterval(checkConnectivity, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectivityInterval);
    };
  }, [isOnline, showOfflineMessage, onStatusChange]);

  const dismissOfflineBanner = () => {
    setShowOfflineBanner(false);
  };

  // Compact version (similar to existing ConnectionStatusIndicator)
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-lg">{isOnline ? '🟢' : '🔴'}</span>
        <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Network Status Indicator */}
      <div className={`flex items-center gap-2 ${className}`}>
        {isOnline ? (
          <>
            <Wifi size={16} className="text-green-500" />
            <span className="text-sm text-green-600">Online</span>
          </>
        ) : (
          <>
            <WifiOff size={16} className="text-red-500" />
            <span className="text-sm text-red-600">Offline</span>
          </>
        )}
      </div>

      {/* Offline Banner */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-3 shadow-lg">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <div>
                <p className="font-semibold text-sm">You're offline</p>
                <p className="text-xs opacity-90">Some features may not work</p>
              </div>
            </div>
            <button
              onClick={dismissOfflineBanner}
              className="text-white hover:bg-red-700 p-1 rounded transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}