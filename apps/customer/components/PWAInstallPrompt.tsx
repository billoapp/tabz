'use client';

import { useEffect, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<'accepted' | 'dismissed'>;
}

interface PWAInstallPromptProps {
  className?: string;
}

export default function PWAInstallPrompt({ className = '' }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔔 beforeinstallprompt event fired');
      
      // Check if we should show our custom prompt
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const shouldShowCustomPrompt = !isStandalone;
      
      if (shouldShowCustomPrompt) {
        // Only prevent default if we're going to show our custom prompt
        e.preventDefault();
        const promptEvent = e as unknown as BeforeInstallPromptEvent;
        setDeferredPrompt(promptEvent);
        setShowInstallBanner(true);
      } else {
        // Don't prevent default if we're not showing custom prompt
        console.log('🔔 PWA install prompt not prevented - already installed or letting browser handle it');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if PWA is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('📱 PWA is already installed in standalone mode');
    }

    // Debug browser support
    console.log('🔍 PWA support check:', {
      serviceWorker: 'serviceWorker' in navigator,
      beforeinstallprompt: 'onbeforeinstallprompt' in window,
      standalone: window.matchMedia('(display-mode: standalone)').matches
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user's choice
      const choice = await deferredPrompt.userChoice;
      
      // Close the modal regardless of choice
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      
      console.log('PWA install choice:', choice);
    } catch (error) {
      console.error('PWA install error:', error);
      // Still close the modal on error
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setDeferredPrompt(null);
  };

  if (!showInstallBanner) return null;

  return (
    <div className={`fixed top-4 left-4 right-4 z-50 p-4 ${className}`}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-xl p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Smartphone size={24} className="text-blue-100" />
            <div>
              <h3 className="font-bold text-lg">Install Tabeza App</h3>
              <p className="text-sm text-blue-100">Get instant access to your tabs</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={handleInstallClick}
            className="flex-1 bg-white text-blue-600 font-semibold py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={20} />
            <span>Install App</span>
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-blue-100 hover:text-white transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
