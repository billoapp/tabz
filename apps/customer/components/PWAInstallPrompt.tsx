'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  useEffect(() => {
    // Run comprehensive diagnostics
    const runDiagnostics = async () => {
      const results = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        resources: {} as any
      };

      // Test all PWA-related resources
      const resources = [
        '/manifest.json',
        '/sw.js',
        '/logo-192.png',
        '/logo-512.png',
        '/favicon.ico',
        '/offline.html'
      ];

      for (const resource of resources) {
        try {
          const response = await fetch(resource);
          results.resources[resource] = {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText,
            contentType: response.headers.get('content-type')
          };
          
          if (resource === '/manifest.json' && response.ok) {
            try {
              const manifest = await response.json();
              results.resources[resource].content = manifest;
            } catch (e) {
              results.resources[resource].parseError = (e as Error).message;
            }
          }
        } catch (error) {
          results.resources[resource] = {
            error: (error as Error).message,
            failed: true
          };
        }
      }

      // Check service worker registration
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          results.serviceWorker = {
            supported: true,
            registrations: registrations.length,
            controller: !!navigator.serviceWorker.controller
          };
        } catch (error) {
          results.serviceWorker = {
            supported: true,
            error: (error as Error).message
          };
        }
      } else {
        results.serviceWorker = { supported: false };
      }

      // Check PWA support
      results.pwaSupport = {
        beforeinstallprompt: 'onbeforeinstallprompt' in window,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      };

      console.log('🔍 PWA Diagnostics:', results);
      setDiagnostics(results);

      // Check for specific 400 errors
      const failedResources = Object.entries(results.resources)
        .filter(([_, info]: [string, any]) => info.status === 400 || info.failed)
        .map(([resource, info]) => ({ resource, info }));

      if (failedResources.length > 0) {
        console.error('❌ Resources failing with 400 or errors:', failedResources);
      }
    };

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      return; // Already installed
    }

    // Run diagnostics
    runDiagnostics();

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ beforeinstallprompt fired - PWA is installable!');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      console.log('✅ App installed successfully');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  // Show diagnostics in development
  if (process.env.NODE_ENV === 'development' && diagnostics) {
    const failedResources = Object.entries(diagnostics.resources)
      .filter(([_, info]: [string, any]) => info.status === 400 || info.failed);

    if (failedResources.length > 0) {
      return (
        <div className="fixed top-4 left-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md text-sm z-50">
          <h3 className="font-semibold text-red-800 mb-2">PWA Resources Failing:</h3>
          {failedResources.map(([resource, info]: [string, any]) => (
            <div key={resource} className="mb-2">
              <div className="font-medium text-red-700">{resource}</div>
              <div className="text-red-600">
                {info.failed ? `Error: ${info.error}` : `HTTP ${info.status}: ${info.statusText}`}
              </div>
            </div>
          ))}
          <div className="mt-3 text-red-600">
            ❌ This is why PWA install isn't working. Fix these 400 errors first.
          </div>
        </div>
      );
    }
  }

  // Only show install button if we have a real install prompt
  if (!deferredPrompt) return null;

  return (
    <div className="fixed top-1/3 left-4 right-4 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <Download size={20} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Install Tabeza</h3>
            <p className="text-sm text-gray-600">Get quick access from your home screen</p>
          </div>
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}
