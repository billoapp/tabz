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

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      return isStandalone || isIOSStandalone;
    };

    if (checkInstalled()) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt fired');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      console.log('PWA: App installed');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Fallback: Show prompt after delay if no beforeinstallprompt
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt && !checkInstalled()) {
        console.log('PWA: Showing fallback install prompt');
        setShowInstallPrompt(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Show manual instructions
      alert('To install: Tap Chrome menu (⋮) → Add to Home screen');
      return;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA: User accepted install');
      } else {
        console.log('PWA: User dismissed install');
        setShowInstallPrompt(false);
      }
    } catch (error) {
      console.error('PWA: Install failed', error);
      alert('Install failed. Try: Chrome menu → Add to Home screen');
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
