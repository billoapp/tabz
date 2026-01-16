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
    console.log('PWA Install: Component mounted');
    
    // Test manifest loading
    fetch('/manifest.json')
      .then(response => {
        console.log('PWA Install: Manifest response', response.status, response.ok);
        return response.json();
      })
      .then(manifest => {
        console.log('PWA Install: Manifest loaded', manifest);
      })
      .catch(error => {
        console.error('PWA Install: Manifest failed to load', error);
      });
    
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    
    console.log('PWA Install: Standalone check', { isStandalone, isIOSStandalone });
    
    if (isStandalone || isIOSStandalone) {
      console.log('PWA Install: Already installed, not showing button');
      return; // Already installed
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA Install: beforeinstallprompt fired!');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowInstallButton(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      console.log('PWA Install: App installed');
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Force show button after 3 seconds for testing (remove this in production)
    const testTimer = setTimeout(() => {
      console.log('PWA Install: Test timer - forcing button display');
      if (!deferredPrompt) {
        console.log('PWA Install: No beforeinstallprompt event, showing fallback button');
        setShowInstallButton(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(testTimer);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    console.log('PWA Install: Button clicked', { hasDeferredPrompt: !!deferredPrompt });
    
    if (deferredPrompt) {
      // Native install for Chrome, Edge, Samsung Internet, Opera
      setIsInstalling(true);
      try {
        console.log('PWA Install: Triggering native prompt');
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        
        console.log('PWA Install: User choice', choiceResult);
        
        if (choiceResult.outcome === 'accepted') {
          setShowInstallButton(false);
        }
      } catch (error) {
        console.error('PWA Install: Failed', error);
      } finally {
        setIsInstalling(false);
        setDeferredPrompt(null);
      }
    } else {
      // Fallback for browsers without beforeinstallprompt
      console.log('PWA Install: No native prompt available, showing instructions');
      const userAgent = navigator.userAgent.toLowerCase();
      
      if (userAgent.includes('chrome')) {
        alert('To install: Look for the install icon in your address bar, or go to Chrome menu → "Install Tabeza"');
      } else if (userAgent.includes('safari')) {
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
          alert('To install: Tap the Share button, then "Add to Home Screen"');
        } else {
          alert('To install: Click File menu → "Add to Dock"');
        }
      } else {
        alert('To install: Look for the install option in your browser menu');
      }
    }
  };

  console.log('PWA Install: Render', { showInstallButton, isInstalling });

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
