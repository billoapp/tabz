'use client';

import { useEffect } from 'react';
import { getDeviceId } from '@/lib/deviceId';

interface DeviceInitializerProps {
  children: React.ReactNode;
}

export default function DeviceInitializer({ children }: DeviceInitializerProps) {
  useEffect(() => {
    // Initialize device ID at the earliest possible moment
    const deviceId = getDeviceId();
    console.log('🆔 Device ID initialized at app startup:', deviceId);
    
    // Update last seen timestamp
    localStorage.setItem('Tabeza_last_seen', new Date().toISOString());
  }, []);

  return <>{children}</>;
}
