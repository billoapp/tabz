'use client';

import { useEffect, useState } from 'react';

interface PWAChecks {
  timestamp: string;
  environment: {
    userAgent: string;
    platform: string;
    url: string;
    protocol: string;
    hostname: string;
    isHTTPS: boolean;
    isLocalhost: boolean;
    isVercel: boolean;
  };
  pwaSupport: {
    serviceWorker: boolean;
    beforeInstallPrompt: boolean;
    standalone: boolean;
    navigatorStandalone: boolean;
  };
  manifest: {
    linkExists: boolean;
    linkHref: string | null;
    loaded: boolean;
    data: any;
    validation: {
      hasName: boolean;
      hasShortName: boolean;
      hasStartUrl: boolean;
      hasDisplay: boolean;
      hasIcons: boolean;
      has192Icon: boolean;
      has512Icon: boolean;
      isValid: boolean;
    } | null;
    error: string | null;
  };
  serviceWorkerStatus: {
    supported: boolean;
    registrations: number;
    controller: boolean;
  };
  installability: {
    alreadyInstalled: boolean;
    canInstall: boolean;
    reason: string;
  };
}

/**
 * PWA Install Checker - Comprehensive PWA installability diagnostics
 * This component runs detailed checks to determine why PWA installation might not work
 */
export default function PWAInstallChecker() {
  const [checks, setChecks] = useState<PWAChecks | null>(null);

  useEffect(() => {
    const runChecks = async () => {
      const results: PWAChecks = {
        timestamp: new Date().toISOString(),
        environment: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          url: window.location.href,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
          isLocalhost: window.location.hostname === 'localhost',
          isVercel: window.location.hostname.includes('vercel.app'),
        },
        pwaSupport: {
          serviceWorker: 'serviceWorker' in navigator,
          beforeInstallPrompt: 'onbeforeinstallprompt' in window,
          standalone: window.matchMedia('(display-mode: standalone)').matches,
          navigatorStandalone: (navigator as any).standalone === true,
        },
        manifest: {
          linkExists: !!document.querySelector('link[rel="manifest"]'),
          linkHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || null,
          loaded: false,
          data: null,
          validation: null,
          error: null,
        },
        serviceWorkerStatus: {
          supported: 'serviceWorker' in navigator,
          registrations: 0,
          controller: !!navigator.serviceWorker?.controller,
        },
        installability: {
          alreadyInstalled: false,
          canInstall: false,
          reason: '',
        }
      };

      // Check service worker registrations
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          results.serviceWorkerStatus.registrations = registrations.length;
        } catch (error) {
          console.error('Error checking service worker:', error);
        }
      }

      // Check if already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      results.installability.alreadyInstalled = isStandalone || isIOSStandalone;

      // Check manifest
      try {
        const response = await fetch('/manifest.json');
        if (response.ok) {
          const manifest = await response.json();
          results.manifest.loaded = true;
          results.manifest.data = manifest;
          
          // Validate manifest requirements
          const hasName = !!manifest.name;
          const hasShortName = !!manifest.short_name;
          const hasStartUrl = !!manifest.start_url;
          const hasDisplay = !!manifest.display;
          const hasIcons = manifest.icons && manifest.icons.length > 0;
          const has192Icon = manifest.icons?.some((icon: any) => icon.sizes?.includes('192x192'));
          const has512Icon = manifest.icons?.some((icon: any) => icon.sizes?.includes('512x512'));
          
          results.manifest.validation = {
            hasName,
            hasShortName,
            hasStartUrl,
            hasDisplay,
            hasIcons,
            has192Icon,
            has512Icon,
            isValid: hasName && hasShortName && hasStartUrl && hasDisplay && hasIcons && has192Icon && has512Icon
          };
        } else {
          results.manifest.loaded = false;
          results.manifest.error = `HTTP ${response.status}`;
        }
      } catch (error) {
        results.manifest.loaded = false;
        results.manifest.error = (error as Error).message;
      }

      // Determine installability
      if (results.installability.alreadyInstalled) {
        results.installability.reason = 'Already installed';
      } else if (!results.environment.isHTTPS) {
        results.installability.reason = 'HTTPS required (current: ' + results.environment.protocol + ')';
      } else if (!results.pwaSupport.serviceWorker) {
        results.installability.reason = 'Service Worker not supported';
      } else if (!results.serviceWorkerStatus.registrations) {
        results.installability.reason = 'No Service Worker registered (check console for errors)';
      } else if (!results.manifest.loaded) {
        results.installability.reason = 'Manifest not loaded (error: ' + (results.manifest.error || 'unknown') + ')';
      } else if (!results.manifest.validation?.isValid) {
        results.installability.reason = 'Invalid manifest (missing: ' + 
          Object.entries(results.manifest.validation || {})
            .filter(([key, value]) => key !== 'isValid' && !value)
            .map(([key]) => key)
            .join(', ') + ')';
      } else if (!results.pwaSupport.beforeInstallPrompt) {
        results.installability.reason = 'Browser does not support beforeinstallprompt (try Chrome/Edge)';
      } else {
        results.installability.canInstall = true;
        results.installability.reason = 'Should be installable - check for beforeinstallprompt event';
      }

      console.log('🔍 PWA Install Checker Results:', results);
      setChecks(results);
    };

    runChecks();
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!checks) {
    return (
      <div className="fixed top-4 left-4 bg-blue-100 text-blue-800 p-2 rounded text-xs">
        Running PWA checks...
      </div>
    );
  }

  const getStatusColor = (status: boolean) => status ? 'text-green-600' : 'text-red-600';
  const getStatusIcon = (status: boolean) => status ? '✅' : '❌';

  return (
    <div className="fixed top-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-md text-xs z-50">
      <h3 className="font-semibold mb-2">PWA Install Checker</h3>
      
      <div className="space-y-2">
        <div>
          <strong>Environment:</strong>
          <div className={getStatusColor(checks.environment.isHTTPS)}>
            {getStatusIcon(checks.environment.isHTTPS)} HTTPS: {checks.environment.protocol}
          </div>
        </div>

        <div>
          <strong>PWA Support:</strong>
          <div className={getStatusColor(checks.pwaSupport.serviceWorker)}>
            {getStatusIcon(checks.pwaSupport.serviceWorker)} Service Worker
          </div>
          <div className={getStatusColor(checks.pwaSupport.beforeInstallPrompt)}>
            {getStatusIcon(checks.pwaSupport.beforeInstallPrompt)} beforeinstallprompt
          </div>
        </div>

        <div>
          <strong>Service Worker:</strong>
          <div className={getStatusColor(checks.serviceWorkerStatus.registrations > 0)}>
            {getStatusIcon(checks.serviceWorkerStatus.registrations > 0)} Registered ({checks.serviceWorkerStatus.registrations})
          </div>
        </div>

        <div>
          <strong>Manifest:</strong>
          <div className={getStatusColor(checks.manifest.loaded)}>
            {getStatusIcon(checks.manifest.loaded)} Loaded
          </div>
          {checks.manifest.validation && (
            <div className={getStatusColor(checks.manifest.validation.isValid)}>
              {getStatusIcon(checks.manifest.validation.isValid)} Valid
            </div>
          )}
        </div>

        <div>
          <strong>Installability:</strong>
          <div className={getStatusColor(checks.installability.canInstall)}>
            {checks.installability.reason}
          </div>
        </div>
      </div>

      <button
        onClick={() => setChecks(null)}
        className="mt-2 text-gray-500 hover:text-gray-700 text-xs"
      >
        Close
      </button>
    </div>
  );
}