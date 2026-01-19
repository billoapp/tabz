'use client';

import { useEffect, useState } from 'react';
import { X, Download, Monitor, Smartphone, CheckCircle, Zap, Shield, Wifi } from 'lucide-react';

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
  const [isStandalone, setIsStandalone] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔔 PWA install prompt available');
      // Only prevent default if we're going to show our custom prompt
      e.preventDefault();
      const promptEvent = e as unknown as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Show banner after a short delay to avoid interrupting user flow
      setTimeout(() => {
        if (!isStandalone) {
          setShowInstallBanner(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Debug browser support
    console.log('🔍 PWA support check:', {
      serviceWorker: 'serviceWorker' in navigator,
      beforeinstallprompt: 'onbeforeinstallprompt' in window,
      standalone: isStandalone,
      userAgent: navigator.userAgent
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user's choice
      const choice = await deferredPrompt.userChoice;
      
      console.log('PWA install choice:', choice);
      
      if ((choice as any).outcome === 'accepted') {
        console.log('✅ PWA installation accepted');
      } else {
        console.log('❌ PWA installation dismissed');
      }
      
      // Close the modal regardless of choice
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      
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
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleShowFeatures = () => {
    setShowFeatures(true);
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showInstallBanner || sessionStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {!showFeatures ? (
          // Main install prompt
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <Monitor size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900">Install Tabeza Staff</h3>
                  <p className="text-sm text-gray-600">Professional tab management</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Get the full Tabeza experience with our professional staff dashboard app.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap size={16} className="text-orange-500" />
                  <span>Lightning fast</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Wifi size={16} className="text-orange-500" />
                  <span>Works offline</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield size={16} className="text-orange-500" />
                  <span>Secure & reliable</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle size={16} className="text-orange-500" />
                  <span>Always updated</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <Download size={20} />
                <span>Install App</span>
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={handleShowFeatures}
                  className="flex-1 text-orange-600 font-medium py-2 px-4 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  Learn More
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 text-gray-500 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Features detail view
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl text-gray-900">Why Install Tabeza Staff?</h3>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={16} className="text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Lightning Fast Performance</h4>
                  <p className="text-sm text-gray-600">Instant loading, smooth animations, and responsive interface optimized for busy venues.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Wifi size={16} className="text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Works Offline</h4>
                  <p className="text-sm text-gray-600">Continue managing tabs even when internet is slow or unavailable. Data syncs automatically.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield size={16} className="text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Enterprise Security</h4>
                  <p className="text-sm text-gray-600">Bank-level encryption, secure authentication, and automatic data backup for peace of mind.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Smartphone size={16} className="text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Mobile Optimized</h4>
                  <p className="text-sm text-gray-600">Perfect for tablets and phones. Manage your venue from anywhere with full functionality.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle size={16} className="text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Always Updated</h4>
                  <p className="text-sm text-gray-600">Automatic updates with new features, security patches, and performance improvements.</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <Download size={20} />
                <span>Install Tabeza Staff</span>
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFeatures(false)}
                  className="flex-1 text-orange-600 font-medium py-2 px-4 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 text-gray-500 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}