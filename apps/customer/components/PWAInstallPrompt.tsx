'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Download, Smartphone, AlertCircle, Loader2 } from 'lucide-react';

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
  console.log('🔧 PWAInstallPrompt component rendered');
  
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

    console.log('🔍 Installation status check:', {
      isStandalone,
      isIOSStandalone,
      isInstalled,
      platform,
      userAgent: userAgent.substring(0, 50) + '...'
    });

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
        console.log('🔔 Showing banner due to beforeinstallprompt event');
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
      url: window.location.href,
      isHTTPS: window.location.protocol === 'https:',
      isLocalhost: window.location.hostname === 'localhost',
    });

    // Show banner after a delay regardless of beforeinstallprompt
    setTimeout(() => {
      const { isInstalled } = detectInstallationStatus();
      if (!isInstalled && !dismissedSession) {
        console.log('⏰ Showing install banner after timeout');
        setShowInstallBanner(true);
        setState(prev => ({
          ...prev,
          canInstall: true, // Allow install attempt
        }));
      }
    }, 2000);

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
    console.log('🔘 Install button clicked', { 
      hasDeferredPrompt: !!state.deferredPrompt, 
      platform: state.platform,
      canInstall: state.canInstall 
    });

    setState(prev => ({ ...prev, isInstalling: true, error: null }));

    try {
      // Try native install first if available
      if (state.deferredPrompt) {
        console.log('🚀 Using native install prompt...');
        await state.deferredPrompt.prompt();
        
        const choiceResult = await state.deferredPrompt.userChoice;
        console.log('📊 PWA install choice result:', choiceResult);

        if (choiceResult.outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
          // The 'appinstalled' event will handle success state
          return;
        } else {
          console.log('❌ User dismissed the install prompt');
          setState(prev => ({
            ...prev,
            isInstalling: false,
            canInstall: false,
            deferredPrompt: null,
          }));
          setShowInstallBanner(false);
          return;
        }
      }

      // Fallback: Show platform-specific manual instructions
      console.log('⚠️ No native install available, showing manual instructions');
      
      let instructionMessage = '';
      if (state.platform === 'ios') {
        instructionMessage = 'Use Safari → Share → Add to Home Screen';
      } else if (state.platform === 'android') {
        instructionMessage = 'Tap Chrome menu (⋮) → Add to Home screen';
      } else {
        instructionMessage = 'Try: Browser menu → Install app';
      }
      
      setState(prev => ({ 
        ...prev, 
        isInstalling: false,
        error: instructionMessage 
      }));
      
      // Clear error after 5 seconds
      setTimeout(() => setState(prev => ({ ...prev, error: null })), 5000);
      
    } catch (error) {
      console.error('💥 PWA install error:', error);
      const installError = error instanceof Error ? error : new Error('Installation failed');
      
      setState(prev => ({
        ...prev,
        isInstalling: false,
        error: `Install failed: ${installError.message}`,
      }));
      
      onInstallError?.(installError);
      
      // Show error for longer, then hide banner
      setTimeout(() => {
        setShowInstallBanner(false);
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
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

  // Provide installation guidance for Android
  const getAndroidInstallInstructions = () => (
    <div className="text-sm text-blue-100 mt-2">
      <p>To install on Android:</p>
      <ol className="list-decimal list-inside mt-1 space-y-1">
        <li>Tap the menu (⋮) in Chrome</li>
        <li>Tap "Add to Home screen" or "Install app"</li>
        <li>Tap "Add" or "Install" to confirm</li>
      </ol>
    </div>
  );

  // Don't show if already installed
  if (state.isInstalled) {
    console.log('❌ PWA Install Prompt: Already installed, not showing banner');
    return null;
  }

  // Don't show if dismissed or no install capability
  if (!showInstallBanner) {
    console.log('❌ PWA Install Prompt: Banner not shown', { 
      showInstallBanner, 
      dismissedSession,
      canInstall: state.canInstall,
      deferredPrompt: !!state.deferredPrompt,
      isDevOrPreview: process.env.NODE_ENV === 'development' || 
                     window.location.hostname.includes('vercel.app') ||
                     window.location.hostname.includes('netlify.app') ||
                     window.location.hostname.includes('preview')
    });
    return null;
  }

  console.log('✅ PWA Install Prompt: Rendering banner', {
    showInstallBanner,
    canInstall: state.canInstall,
    platform: state.platform,
    isInstalled: state.isInstalled,
    dismissedSession
  });

  // Custom trigger mode
  if (customTrigger) {
    return (
      <div onClick={handleInstallClick} className={className}>
        {customTrigger}
      </div>
    );
  }

  return (
    <div className={`fixed top-1/3 left-4 right-4 z-50 p-2 ${className}`}>
      <div className="bg-white border border-gray-200 text-gray-800 rounded-lg shadow-lg p-3 max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-gray-600" />
            <div>
              <h3 className="font-medium text-sm">Install App</h3>
              <p className="text-xs text-gray-600">
                Add to home screen
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
            disabled={state.isInstalling}
          >
            <X size={16} />
          </button>
        </div>

        {/* Error display */}
        {state.error && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
            <AlertCircle size={14} />
            <span className="text-xs">{state.error}</span>
          </div>
        )}

        {/* Platform-specific instructions */}
        {state.platform === 'ios' && !state.canInstall && (
          <div className="text-xs text-gray-600 mb-2">
            <p>Safari → Share → Add to Home Screen</p>
          </div>
        )}
        {state.platform === 'android' && !state.canInstall && (
          <div className="text-xs text-gray-600 mb-2">
            <p>Chrome menu (⋮) → Add to Home screen</p>
          </div>
        )}
        
        <div className="flex gap-2">
          {/* Install button - show if we have native capability OR for manual instructions */}
          <button
            onClick={handleInstallClick}
            disabled={state.isInstalling}
            className="flex-1 bg-blue-600 text-white font-medium py-2 px-3 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.isInstalling ? (
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
            disabled={state.isInstalling}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm disabled:opacity-50"
          >
            Later
          </button>
        </div>

        {/* Platform info for debugging - only in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-500 opacity-75 space-y-1 border-t pt-2">
            <div>Platform: {state.platform} | Can Install: {state.canInstall ? 'Yes' : 'No'}</div>
            <div>URL: {typeof window !== 'undefined' ? window.location.hostname : 'unknown'}</div>
            <div>Deferred Prompt: {state.deferredPrompt ? 'Available' : 'Not Available'}</div>
            <div>Show Banner: {showInstallBanner ? 'Yes' : 'No'} | Dismissed: {dismissedSession ? 'Yes' : 'No'}</div>
            <div>Is Installed: {state.isInstalled ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
