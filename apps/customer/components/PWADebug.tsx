'use client';

import { useEffect, useState } from 'react';

export default function PWADebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const checkPWARequirements = async () => {
      const info = {
        // Basic PWA requirements
        serviceWorker: 'serviceWorker' in navigator,
        https: location.protocol === 'https:' || location.hostname === 'localhost',
        manifest: !!document.querySelector('link[rel="manifest"]'),
        
        // Install prompt support
        beforeInstallPrompt: 'onbeforeinstallprompt' in window,
        
        // Display mode
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        standaloneWebapp: (navigator as any).standalone === true,
        
        // Service worker registration
        registration: null as any,
        
        // Manifest details
        manifestUrl: '',
        manifestContent: null as any,
      };

      // Check manifest
      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (manifestLink) {
        info.manifestUrl = manifestLink.href;
        try {
          const response = await fetch(info.manifestUrl);
          info.manifestContent = await response.json();
        } catch (error) {
          console.error('Failed to fetch manifest:', error);
        }
      }

      // Check service worker registration
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          info.registration = {
            scope: registration.scope,
            active: !!registration.active,
            installing: !!registration.installing,
            waiting: !!registration.waiting,
            scriptURL: registration.active?.scriptURL,
          };
        } catch (error: any) {
          console.error('Service worker registration failed:', error);
          info.registration = { error: error.message };
        }
      }

      // Check if PWA is installable
      (info as any).installable = info.serviceWorker && info.https && info.manifest && info.beforeInstallPrompt;

      setDebugInfo(info);
      console.log('🔍 PWA Debug Info:', info);
    };

    checkPWARequirements();

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('✅ beforeinstallprompt event detected!', e);
      setDebugInfo((prev: any) => ({ ...prev, installPromptEvent: e }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">PWA Debug Info</h3>
      <div className="space-y-1">
        <div>Service Worker: {debugInfo.serviceWorker ? '✅' : '❌'}</div>
        <div>HTTPS: {debugInfo.https ? '✅' : '❌'}</div>
        <div>Manifest: {debugInfo.manifest ? '✅' : '❌'}</div>
        <div>Install Prompt: {debugInfo.beforeInstallPrompt ? '✅' : '❌'}</div>
        <div>Installable: {debugInfo.installable ? '✅' : '❌'}</div>
        <div>Standalone: {debugInfo.standalone ? '✅' : '❌'}</div>
        
        {debugInfo.installPromptEvent && (
          <div className="mt-2 text-green-400">Install prompt detected!</div>
        )}
        
        {debugInfo.registration?.error && (
          <div className="mt-2 text-red-400">SW Error: {debugInfo.registration.error}</div>
        )}
      </div>
    </div>
  );
}
