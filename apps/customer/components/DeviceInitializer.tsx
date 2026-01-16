'use client';

import { useEffect, useState } from 'react';
import { getDeviceInfo } from '@/lib/deviceId';

interface DeviceInitializerProps {
  children: React.ReactNode;
}

export default function DeviceInitializer({ children }: DeviceInitializerProps) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // CRITICAL FIX: Don't block app initialization for device ID
    // PWA install functionality must work independently of device management
    console.log('🔧 Starting non-blocking device initialization...');
    
    // Set initialized immediately - don't wait for device ID
    setInitialized(true);
    
    // Initialize device ID in background (non-blocking)
    const initializeDeviceAsync = async () => {
      try {
        const device = await getDeviceInfo();
        
        console.log('✅ Device initialized in background:', {
          id: device.deviceId,
          fingerprint: device.fingerprint.slice(0, 10) + '...',
          createdAt: device.createdAt,
          lastSeen: device.lastSeen
        });
        
        // Update last seen timestamp in legacy storage for compatibility
        try {
          localStorage.setItem('Tabeza_last_seen', new Date().toISOString());
        } catch {
          // Ignore storage errors
        }
      } catch (err) {
        console.error('❌ Device initialization failed (non-blocking):', err);
        // Don't set error state - app should continue working
      }
    };

    // Run device initialization in background without blocking
    initializeDeviceAsync();
  }, []);

  // App initializes immediately - no loading screen needed
  // Device ID works in background without blocking PWA functionality
  if (!initialized) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Remove error screen - app should work even if device ID fails
  // Device ID is an enhancement, not a requirement

  return <>{children}</>;
}
