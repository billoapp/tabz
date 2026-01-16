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
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      return; // Already installed
    }

    // Listen for beforeinstallprompt (Chrome, Edge, Samsung Internet, Opera)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowInstallButton(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For Safari iOS 16.4+ and other browsers that support PWA but don't fire beforeinstallprompt
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
    const isFirefox = userAgent.includes('firefox');
    
    // Show install button for Safari and Firefox after a delay (only if not launched from PWA)
    const isPWALaunch = window.location.search.includes('pwa=true');
    
    if ((isSafari || isFirefox) && !isPWALaunch) {
      const timer = setTimeout(() => {
        if (!deferredPrompt) {
          setShowInstallButton(true);
        }
      }, 2000);
      
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        clearTimeout(timer);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Native install for Chrome, Edge, Samsung Internet, Opera
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
          setShowInstallButton(false);
        }
      } catch (error) {
        console.error('Install failed:', error);
      } finally {
        setIsInstalling(false);
        setDeferredPrompt(null);
      }
    } else {
      // For Safari, Firefox, and other browsers
      const userAgent = navigator.userAgent.toLowerCase();
      
      if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        // iOS Safari
        alert('To install: Tap the Share button, then "Add to Home Screen"');
      } else if (userAgent.includes('safari')) {
        // macOS Safari
        alert('To install: Click File menu → "Add to Dock"');
      } else {
        // Firefox and others
        alert('To install: Look for the install option in your browser menu');
      }
    }
  };

  if (!showInstallButton) return null;

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
