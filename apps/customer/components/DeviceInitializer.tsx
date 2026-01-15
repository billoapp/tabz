'use client';

import { useEffect, useState } from 'react';
import { getDeviceInfo } from '@/lib/deviceId';

interface DeviceInitializerProps {
  children: React.ReactNode;
  supabase: any; // Add supabase prop
}

export default function DeviceInitializer({ children, supabase }: DeviceInitializerProps) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDevice = async () => {
      try {
        console.log('🔧 Starting device initialization...');
        
        const device = await getDeviceInfo();
        
        console.log('✅ Device initialized:', {
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
        
        setInitialized(true);
      } catch (err) {
        console.error('❌ Failed to initialize device:', err);
        setError('Device initialization failed');
        
        // Still continue - device will work in degraded mode
        setInitialized(true);
      }
    };

    initializeDevice();
  }, []);

  // Show loading screen during initialization
  if (!initialized) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Initializing device...</p>
          <p className="text-sm text-gray-400 mt-2">Checking for existing tabs</p>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed (rare)
  if (error) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center max-w-md p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Device Setup Issue</h2>
          <p className="text-gray-600 mb-6">
            There was a problem setting up your device. You can continue with limited functionality.
          </p>
          <button
            onClick={() => setInitialized(true)}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
