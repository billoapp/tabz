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

  useEffect(() => {
    // Debug browser support
    console.log('🔍 PWA support check:', {
      serviceWorker: 'serviceWorker' in navigator,
      beforeinstallprompt: 'onbeforeinstallprompt' in window,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      userAgent: navigator.userAgent
    });

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      console.log('📱 PWA is already installed in standalone mode');
      return; // Already installed
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ PWA: beforeinstallprompt fired - showing install button');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      console.log('✅ PWA: App installed successfully');
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
