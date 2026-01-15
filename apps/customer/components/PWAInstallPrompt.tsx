'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Download, Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallPromptProps {
  className?: string;
  onInstallSuccess?: () => void;
  onInstallError?: (error: Error) => void;
  customTrigger?: React.ReactNode;
}

interface InstallationState {
  canInstall: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  error: string | null;
  deferredPrompt: BeforeInstallPromptEvent | null;
  platform: string | null;
}

export default function PWAInstallPrompt({ 
  className = '', 
  onInstallSuccess,
  onInstallError,
  customTrigger 
}: PWAInstallPromptProps) {
  const [state, setState] = useState<InstallationState>({
    canInstall: false,
    isInstalled: false,
    isInstalling: false,
    error: null,
    deferredPrompt: null,
    platform: null,
  });

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissedSession, setDismissedSession] = useState(false);

  // Cross-platform installation detection
  const detectInstallationStatus = useCallback(() => {
    // Check if PWA is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isInstalled = isStandalone || isIOSStandalone;

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    let platform = 'unknown';
    
    if (userAgent.includes('android')) {
      platform = 'android';
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      platform = 'ios';
    } else if (userAgent.includes('windows')) {
      platform = 'windows';
    } else if (userAgent.includes('mac')) {
      platform = 'macos';
    }

    setState(prev => ({
      ...prev,
      isInstalled,
      platform,
    }));

    return { isInstalled, platform };
  }, []);

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔔 beforeinstallprompt event fired');
      e.preventDefault();
      
      const promptEvent = e as BeforeInstallPromptEvent;
      
      setState(prev => ({
        ...prev,
        canInstall: true,
        deferredPrompt: promptEvent,
        error: null,
      }));

      // Show banner if not dismissed in this session and not already installed
      const { isInstalled } = detectInstallationStatus();
      if (!isInstalled && !dismissedSession) {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      console.log('📱 PWA was installed');
      setState(prev => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
        isInstalling: false,
        deferredPrompt: null,
      }));
      setShowInstallBanner(false);
      onInstallSuccess?.();
    };

    // Feature detection
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasBeforeInstallPrompt = 'onbeforeinstallprompt' in window;
    
    console.log('🔍 PWA Installation Support:', {
      serviceWorker: hasServiceWorker,
      beforeinstallprompt: hasBeforeInstallPrompt,
      userAgent: navigator.userAgent,
    });

    // Initial installation status check
    detectInstallationStatus();

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [detectInstallationStatus, dismissedSession, onInstallSuccess]);

  // Handle installation process
  const handleInstallClick = async () => {
    if (!state.deferredPrompt || state.isInstalling) return;

    setState(prev => ({ ...prev, isInstalling: true, error: null }));

    try {
      // Show the install prompt
      await state.deferredPrompt.prompt();
      
      // Wait for the user's choice
      const choiceResult = await state.deferredPrompt.userChoice;
      
      console.log('PWA install choice:', choiceResult);

      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        // The 'appinstalled' event will handle success state
      } else {
        console.log('User dismissed the install prompt');
        setState(prev => ({
          ...prev,
          isInstalling: false,
          canInstall: false,
          deferredPrompt: null,
        }));
        setShowInstallBanner(false);
      }
    } catch (error) {
      console.error('PWA install error:', error);
      const installError = error instanceof Error ? error : new Error('Installation failed');
      
      setState(prev => ({
        ...prev,
        isInstalling: false,
        error: installError.message,
      }));
      
      onInstallError?.(installError);
      
      // Show error for a few seconds then hide banner
      setTimeout(() => {
        setShowInstallBanner(false);
        setState(prev => ({ ...prev, error: null }));
      }, 3000);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setDismissedSession(true);
    setState(prev => ({
      ...prev,
      deferredPrompt: null,
      canInstall: false,
    }));
  };

  // Provide installation guidance for iOS
  const getIOSInstallInstructions = () => (
    <div className="text-sm text-blue-100 mt-2">
      <p>To install on iOS:</p>
      <ol className="list-decimal list-inside mt-1 space-y-1">
        <li>Tap the Share button in Safari</li>
        <li>Scroll down and tap "Add to Home Screen"</li>
        <li>Tap "Add" to install</li>
      </ol>
    </div>
  );

  // Don't show if already installed
  if (state.isInstalled) return null;

  // Don't show if dismissed or no install capability
  if (!showInstallBanner) return null;

  // Custom trigger mode
  if (customTrigger) {
    return (
      <div onClick={handleInstallClick} className={className}>
        {customTrigger}
      </div>
    );
  }

  return (
    <div className={`fixed top-4 left-4 right-4 z-50 p-4 ${className}`}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-xl p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Smartphone size={24} className="text-blue-100" />
            <div>
              <h3 className="font-bold text-lg">Install Tabeza App</h3>
              <p className="text-sm text-blue-100">
                {state.platform === 'ios' 
                  ? 'Add to your home screen for quick access'
                  : 'Get instant access to your tabs'
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded-full transition-colors"
            disabled={state.isInstalling}
          >
            <X size={20} />
          </button>
        </div>

        {/* Error display */}
        {state.error && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-red-500 bg-opacity-20 rounded">
            <AlertCircle size={16} />
            <span className="text-sm">{state.error}</span>
          </div>
        )}

        {/* iOS specific instructions */}
        {state.platform === 'ios' && !state.canInstall && getIOSInstallInstructions()}
        
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {/* Install button - only show if browser supports it */}
          {state.canInstall && (
            <button
              onClick={handleInstallClick}
              disabled={state.isInstalling}
              className="flex-1 bg-white text-blue-600 font-semibold py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isInstalling ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download size={20} />
                  <span>Install App</span>
                </>
              )}
            </button>
          )}
          
          <button
            onClick={handleDismiss}
            disabled={state.isInstalling}
            className="px-4 py-3 text-blue-100 hover:text-white transition-colors disabled:opacity-50"
          >
            Maybe Later
          </button>
        </div>

        {/* Platform info for debugging */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-blue-200 opacity-75">
            Platform: {state.platform} | Can Install: {state.canInstall ? 'Yes' : 'No'}
          </div>
        )}
      </div>
    </div>
  );
}
