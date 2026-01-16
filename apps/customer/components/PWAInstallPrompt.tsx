'use client';

import { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    console.log('🔧 PWAInstallPrompt component mounted');

    // Enhanced installation status check
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      const isInstalled = isStandalone || isIOSStandalone;
      
      console.log('🔍 Installation status check:', {
        isStandalone,
        isIOSStandalone,
        isInstalled,
        userAgent: navigator.userAgent,
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
      });
      
      return isInstalled;
    };

    // Enhanced PWA support detection
    const checkPWASupport = () => {
      const support = {
        serviceWorker: 'serviceWorker' in navigator,
        beforeinstallprompt: 'onbeforeinstallprompt' in window,
        userAgent: navigator.userAgent,
        url: window.location.href,
        isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
        platform: navigator.platform,
        standalone: window.matchMedia('(display-mode: standalone)').matches
      };
      
      console.log('🔍 PWA Installation Support:', support);
      setDebugInfo(support);
      return support;
    };

    if (checkInstalled()) {
      console.log('❌ PWA Install Prompt: Already installed, not showing banner');
      setIsInstalled(true);
      return;
    }

    checkPWASupport();

    // Listen for beforeinstallprompt with enhanced logging
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ PWA: beforeinstallprompt event fired!');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowInstallPrompt(true);
      console.log('✅ PWA: Install banner will be shown');
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      console.log('✅ PWA: App successfully installed');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    // Enhanced service worker check
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          console.log('🔍 Service Worker registrations:', registrations.length);
          
          if (registrations.length === 0) {
            console.log('⚠️ No service worker registered - this may prevent PWA installation');
          } else {
            console.log('✅ Service worker is registered');
          }
        } catch (error) {
          console.error('❌ Error checking service worker:', error);
        }
      }
    };

    // Enhanced manifest check
    const checkManifest = async () => {
      try {
        const response = await fetch('/manifest.json');
        if (response.ok) {
          const manifest = await response.json();
          console.log('✅ Manifest loaded successfully:', manifest);
        } else {
          console.error('❌ Failed to load manifest.json:', response.status);
        }
      } catch (error) {
        console.error('❌ Error loading manifest:', error);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Run checks
    checkServiceWorker();
    checkManifest();

    // Enhanced fallback logic with better detection
    const fallbackTimer = setTimeout(() => {
      const currentState = {
        deferredPrompt: !!deferredPrompt,
        isInstalled: checkInstalled(),
        showInstallPrompt,
        url: window.location.href,
        isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      };
      
      console.log('🔍 After timeout check:', currentState);
      
      if (!deferredPrompt && !checkInstalled()) {
        // Check if we're in a development/preview environment
        const isDev = process.env.NODE_ENV === 'development';
        const isPreview = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('netlify.app');
        
        if (isDev || isPreview) {
          console.log('🧪 Development/Preview mode detected - showing install prompt for testing');
          setShowInstallPrompt(true);
        } else {
          console.log('❌ Production mode: beforeinstallprompt not fired, PWA may not meet installability criteria');
        }
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    console.log('🔧 Install button clicked', { deferredPrompt: !!deferredPrompt });
    
    if (!deferredPrompt) {
      // Enhanced manual instructions based on platform
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = userAgent.includes('android');
      const isIOS = userAgent.includes('iphone') || userAgent.includes('ipad');
      const isChrome = userAgent.includes('chrome');
      const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
      
      let instructions = '';
      
      if (isAndroid && isChrome) {
        instructions = 'Tap Chrome menu (⋮) → "Add to Home screen"';
      } else if (isIOS && isSafari) {
        instructions = 'Tap Share button → "Add to Home Screen"';
      } else if (isChrome) {
        instructions = 'Click Chrome menu (⋮) → "Install Tabeza"';
      } else {
        instructions = 'Use Chrome or Safari to install this app';
      }
      
      console.log('📱 Showing manual install instructions:', instructions);
      alert(`To install this app:\n\n${instructions}`);
      return;
    }

    setIsInstalling(true);
    console.log('🚀 Attempting PWA installation...');

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      console.log('✅ PWA Install choice:', choiceResult);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('✅ User accepted PWA installation');
        setShowInstallPrompt(false);
      } else {
        console.log('❌ User dismissed PWA installation');
        setShowInstallPrompt(false);
      }
    } catch (error) {
      console.error('❌ PWA Install failed:', error);
      alert('Installation failed. Please try using Chrome menu → Add to Home screen');
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  // Don't show if installed
  if (isInstalled) return null;

  // Don't show if dismissed
  if (!showInstallPrompt) return null;

  return (
    <div className="fixed top-1/3 left-4 right-4 z-50 p-2">
      <div className="bg-white border border-gray-200 text-gray-800 rounded-lg shadow-lg p-3 max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-gray-600" />
            <div>
              <h3 className="font-medium text-sm">Install App</h3>
              <p className="text-xs text-gray-600">Add to home screen</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
            disabled={isInstalling}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex-1 bg-blue-600 text-white font-medium py-2 px-3 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {isInstalling ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Installing...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Install</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleDismiss}
            disabled={isInstalling}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
