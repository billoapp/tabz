// app/start/page.tsx - COMPLETE WITH FLAG SUPPORT
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Bell, Store, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  getDeviceId, 
  getBarDeviceKey, 
  storeActiveTab
} from '@/lib/device-identity';
import { useToast } from '@/components/ui/Toast';
import { TokensService, TOKENS_CONFIG } from '../../../../packages/shared/tokens-service';
import { TokenNotifications, useTokenNotifications } from '../../components/TokenNotifications';
import QrScanner from 'qr-scanner';

function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  
  // Token service and notifications
  const tokensService = new TokensService(supabase);
  const { showNotification } = useTokenNotifications();
  
  // Form states
  const [nickname, setNickname] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Loading states
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // QR Scanner states
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Bar data
  const [barSlug, setBarSlug] = useState<string | null>(null);
  const [barId, setBarId] = useState<string | null>(null);
  const [barName, setBarName] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [debugDeviceId, setDebugDeviceId] = useState<string>('');

  // QR Scanner functions
  const startQRScanner = async () => {
    if (!videoRef.current) return;
    
    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('QR Code detected:', result.data);
          handleQRCodeDetected(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      
      setQrScanner(scanner);
      await scanner.start();
      
      showToast({
        type: 'success',
        title: 'Scanner Active',
        message: 'Point camera at QR code'
      });
      
    } catch (error) {
      console.error('Camera access error:', error);
      showToast({
        type: 'error',
        title: 'Camera Error',
        message: 'Unable to access camera. Please use manual code entry.'
      });
    }
  };
  
  const stopScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }
  };
  
  const handleQRCodeDetected = (code: string) => {
    stopScanner();
    setScannedCode(code);
    setBarSlug(code);
    setIsScannerMode(false);
    
    showToast({
      type: 'success',
      title: 'QR Code Scanned',
      message: `Code: ${code}`
    });
    
    // Load bar info for the scanned code
    loadBarInfo(code);
  };

  useEffect(() => {
    // Get device ID for debug display
    getDeviceId().then(id => setDebugDeviceId(id.slice(0, 20)));
  }, []);

  useEffect(() => {
    initializeConsent();
  }, []);

  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  useEffect(() => {
    if (isScannerMode && videoRef.current && !qrScanner) {
      startQRScanner();
    }
  }, [isScannerMode]);

  const initializeConsent = async () => {
    try {
      // Check if we're coming from QR scanner
      const isScannerMode = searchParams?.get('scanner') === 'true';
      
      // Get bar slug from URL or sessionStorage
      let slug = searchParams?.get('bar') || searchParams?.get('slug');
      
      if (!slug) {
        slug = sessionStorage.getItem('scanned_bar_slug');
      } else {
        sessionStorage.setItem('scanned_bar_slug', slug);
      }

      if (!slug && !isScannerMode) {
        console.log('❌ No bar slug found, redirecting to home');
        router.replace('/');
        return;
      }

      console.log('🔍 Initializing consent for bar:', slug);
      setBarSlug(slug);
      setIsScannerMode(isScannerMode);
      
      if (isScannerMode) {
        console.log('📷 Scanner mode activated');
        setLoading(false);
        return;
      }
      
      if (slug) {
        await loadBarInfo(slug);
      } else {
        console.log('❌ No bar slug found, redirecting to home');
        router.replace('/');
        return;
      }
    } catch (error) {
      console.error('❌ Error initializing consent:', error);
      setError('Failed to load bar information. Please try again.');
      setLoading(false);
    }
  };

  const loadBarInfo = async (slug: string) => {
    try {
      console.log('📡 Loading bar info for:', slug);
      
      const { data: bar, error: barError } = await (supabase as any)
        .from('bars')
        .select('id, name, active, location, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (barError) {
        console.error('❌ Database error:', barError);
        setError(`Database error: ${barError.message}`);
        setLoading(false);
        return;
      }

      if (!bar) {
        console.log('❌ Bar not found with slug:', slug);
        setError(`Bar not found with slug: "${slug}". Please scan a valid QR code.`);
        setLoading(false);
        return;
      }

      const isActive = bar.active !== false;
      
      if (!isActive) {
        console.log('❌ Bar is inactive:', bar.name);
        setError('This bar is currently unavailable. Please contact staff.');
        setLoading(false);
        return;
      }

      console.log('✅ Bar loaded:', bar.name);
      setBarId(bar.id);
      setBarName(bar.name || 'Bar');
      
      setLoading(false);

    } catch (error) {
      console.error('❌ Error loading bar:', error);
      setError('Error loading bar information. Please try again.');
      setLoading(false);
    }
  };

  const handleStartTab = async () => {
    if (!termsAccepted) {
      showToast({
        type: 'warning',
        title: 'Terms Required',
        message: 'Please accept the Terms of Use and Privacy Policy to continue'
      });
      return;
    }

    if (!barId) {
      showToast({
        type: 'error',
        title: 'Bar Information Missing',
        message: 'Bar information not found. Please scan QR code again.'
      });
      return;
    }

    setCreating(true);

    try {
      console.log('🚀 Starting tab creation process');
      
      const deviceId = await getDeviceId();
      const barDeviceKey = await getBarDeviceKey(barId);
      
      console.log('🆔 Device ID:', deviceId);
      console.log('🏪 Bar ID:', barId);
      console.log('👤 Nickname:', nickname || '(none)');
      console.log('🔑 Bar Device Key:', barDeviceKey);
      
      // Check for existing tab one more time (safety check)
      const { data: existingTab } = await (supabase as any)
        .from('tabs')
        .select('*')
        .eq('bar_id', barId)
        .eq('owner_identifier', barDeviceKey)
        .eq('status', 'open')
        .maybeSingle();

      if (existingTab) {
        console.log('🔄 Existing tab found during creation, reusing it');
        
        // Update nickname if provided
        if (nickname.trim()) {
          console.log('📝 Updating existing tab with new nickname');
          const notes = JSON.parse(existingTab.notes || '{}');
          notes.display_name = nickname.trim();
          
          await (supabase as any)
            .from('tabs')
            .update({ notes: JSON.stringify(notes) })
            .eq('id', existingTab.id);
        }

        const displayName = nickname.trim() || (() => {
          try {
            const notes = JSON.parse(existingTab.notes || '{}');
            return notes.display_name || `Tab ${existingTab.tab_number}`;
          } catch {
            return `Tab ${existingTab.tab_number}`;
          }
        })();

        // Store tab data
        storeActiveTab(barId, existingTab);
        sessionStorage.setItem('currentTab', JSON.stringify(existingTab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('barName', barName);
        
        // Clear the "just created" flag since we're continuing existing tab
        sessionStorage.removeItem('just_created_tab');
        
        showToast({
          type: 'success',
          title: 'Welcome Back!',
          message: `Continuing to your ${displayName}`
        });
        
        // Navigate to menu
        setTimeout(() => {
          router.replace('/menu');
        }, 300);
        
        return;
      }

      // No existing tab - create new one
      console.log('✨ Creating new tab');
      
      let displayName: string;
      let tabNumber: number | null;
      
      if (nickname.trim()) {
        // Check for existing nicknames and show suggestions if conflict
        const { data: existingNicknames } = await (supabase as any)
          .from('tabs')
          .select('notes')
          .eq('bar_id', barId)
          .eq('status', 'open')
          .not('notes', 'is', null);

        let finalNickname = nickname.trim();
        
        if (existingNicknames && existingNicknames.length > 0) {
          const openNicknames = existingNicknames
            .map((tab: any) => {
              try {
                const notes = JSON.parse(tab.notes || '{}');
                return notes.display_name;
              } catch {
                return null;
              }
            })
            .filter((name: any) => name && name.toLowerCase() === nickname.trim().toLowerCase());

          if (openNicknames.length > 0) {
            // Generate suggestions and show alert
            const suggestions = [
              `${nickname.trim()} ${Math.floor(Math.random() * 999) + 1}`,
              `${nickname.trim()}_${Math.floor(Math.random() * 999) + 1}`,
              `${nickname.trim()}-${Math.floor(Math.random() * 999) + 1}`,
              `${nickname.trim()}#${Math.floor(Math.random() * 999) + 1}`
            ];

            const suggestionList = suggestions.map((suggestion, index) => 
              `${index + 1}. ${suggestion}`
            ).join('\n');

            const userChoice = prompt(
              `The nickname "${nickname.trim()}" is already in use at this bar.\n\n` +
              `Choose one of these suggestions:\n${suggestionList}\n\n` +
              `Enter the number (1-4) to choose, or type your own:`,
              suggestions[0]
            );

            if (userChoice) {
              const choiceNum = parseInt(userChoice);
              if (choiceNum >= 1 && choiceNum <= 4) {
                finalNickname = suggestions[choiceNum - 1];
              } else {
                finalNickname = userChoice.trim();
              }
              console.log('🔀 User chose nickname:', finalNickname);
            } else {
              // User cancelled, don't create tab
              setCreating(false);
              return;
            }
          }
        }
        
        displayName = finalNickname;
        tabNumber = null; // Named tabs don't need numbers
        console.log('👤 Creating named tab:', displayName);
      } else {
        // Get next tab number
        const { data: existingTabs } = await (supabase as any)
          .from('tabs')
          .select('tab_number')
          .eq('bar_id', barId)
          .not('tab_number', 'is', null)
          .order('tab_number', { ascending: false })
          .limit(1);

        const nextNumber = existingTabs && existingTabs.length > 0 
          ? existingTabs[0].tab_number + 1 
          : 1;
        
        displayName = `Tab ${nextNumber}`;
        tabNumber = nextNumber;
        console.log('🔢 Creating numbered tab:', displayName);
      }

      // Create tab in database
      const { data: tab, error: tabError } = await (supabase as any)
        .from('tabs')
        .insert({
          bar_id: barId,
          tab_number: tabNumber,
          status: 'open',
          owner_identifier: barDeviceKey,
          notes: JSON.stringify({
            display_name: displayName,
            has_nickname: !!nickname.trim(),
            device_id: deviceId,
            notifications_enabled: notificationsEnabled,
            terms_accepted: termsAccepted,
            accepted_at: new Date().toISOString(),
            bar_name: barName,
            created_via: 'consent_page'
          })
        })
        .select()
        .single();

      if (tabError) {
        console.error('❌ Error creating tab:', tabError);
        throw new Error(tabError.message || 'Failed to create tab');
      }

      console.log('✅ Tab created successfully:', tab.id);
      console.log('📋 Tab details:', {
        id: tab.id,
        tab_number: tab.tab_number,
        status: tab.status
      });

      // Set flag to prevent showing existing tabs modal on return to landing page
      sessionStorage.setItem('just_created_tab', 'true');
      
      // Store tab data in session
      storeActiveTab(barId, tab);
      sessionStorage.setItem('currentTab', JSON.stringify(tab));
      sessionStorage.setItem('displayName', displayName);
      sessionStorage.setItem('barName', barName);
      
      // Award first connection tokens for NEW tab only
      try {
        console.log('🎯 Attempting to award first connection tokens...');
        const { data: { user } } = await supabase.auth.getUser();
        if (user && barId) {
          console.log('👤 User found:', user.id);
          console.log('🏪 Bar ID:', barId);
          
          const result = await tokensService.awardFirstConnectionTokens(user.id, barId);
          console.log('🎉 First connection token result:', result);
          
          if (result) {
            console.log('✅ First connection tokens awarded successfully!');
            showNotification({
              type: 'bonus',
              title: '🎉 Welcome Bonus!',
              message: `🎉 +${TOKENS_CONFIG.FIRST_CONNECT_TOKENS} tokens earned for connecting to ${barName}!`,
              amount: TOKENS_CONFIG.FIRST_CONNECT_TOKENS,
              autoHide: 5000, // Auto-hide after 5 seconds
              timestamp: new Date().toISOString()
            });
          } else {
            console.log('❌ First connection tokens not awarded (user may have connected before)');
          }
        } else {
          console.log('❌ No user or bar_id found for token awarding');
        }
      } catch (error) {
        console.error('Error awarding first connection tokens:', error);
      }
      
      showToast({
        type: 'success',
        title: 'Tab Created!',
        message: `Welcome to ${barName}, ${displayName}!`
      });
      
      setTimeout(() => {
        router.replace('/menu');
      }, 300);

    } catch (error: any) {
      console.error('❌ Error creating tab:', error);
      showToast({
        type: 'error',
        title: 'Tab Creation Failed',
        message: error.message || 'Please try again or contact staff'
      });
      setCreating(false);
    }
    // Don't set creating to false on success - navigation will happen
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">
            Loading bar information...
          </p>
          {barSlug && <p className="text-sm mt-2 font-mono opacity-75">{barSlug}</p>}
        </div>
      </div>
    );
  }

  // Scanner mode
  if (isScannerMode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        {/* Close button */}
        <button
          onClick={() => {
            stopScanner();
            router.push('/');
          }}
          className="absolute top-4 right-4 z-10 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition"
        >
          <X size={24} />
        </button>
        
        {/* Camera View */}
        <div className="w-full h-full relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          
          {/* Scanner overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white rounded-lg">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg"></div>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <p className="text-white text-lg font-medium mb-2">Point camera at QR code</p>
            <p className="text-white/80 text-sm">The scanner will detect the code automatically</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">QR Code Error</h1>
            <p className="text-gray-700 mb-4">{error}</p>
          </div>
          
          <button
            onClick={() => {
              sessionStorage.clear();
              router.replace('/');
            }}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition"
          >
            Go Back Home
          </button>
          
          <p className="text-xs text-gray-400 text-center mt-4">
            Please scan a valid QR code or contact staff
          </p>
        </div>
      </div>
    );
  }

  // Main consent form
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        {/* Bar Information */}
        <div className="text-center mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Store size={20} className="text-orange-600" />
            <p className="text-sm font-medium text-orange-700">You're at</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{barName}</h2>
          <p className="text-sm text-gray-600">Ready to start your tab</p>
        </div>

        {/* Trust Statement */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Anonymous Tab</h1>
          <p className="text-gray-700 leading-relaxed">
            You're anonymous here. We don't collect names, phone numbers, or emails.
          </p>
        </div>

        {/* Optional Nickname */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nickname <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Mary or John"
            maxLength={20}
            disabled={creating}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition"
          />
          <p className="text-xs text-gray-500 mt-1">
            If left blank, we'll assign you a tab number
          </p>
        </div>

        {/* Notifications */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Notifications</span>
          </div>
          
          <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              disabled={creating}
              className="mt-0.5 w-5 h-5 text-orange-500 rounded focus:ring-orange-500 disabled:cursor-not-allowed"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Allow message notifications
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Order updates from {barName}</li>
                <li>• Staff messages</li>
                <li>• Bill ready alerts</li>
              </ul>
            </div>
          </label>
        </div>

        {/* Terms Consent */}
        <div className="mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              disabled={creating}
              className="mt-0.5 w-5 h-5 text-orange-500 rounded focus:ring-orange-500 disabled:cursor-not-allowed"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                I agree to the{' '}
                <button 
                  onClick={() => window.open('/terms', '_blank')}
                  className="text-orange-600 underline hover:text-orange-700"
                  type="button"
                >
                  Terms of Use
                </button>
                {' '}and{' '}
                <button 
                  onClick={() => window.open('/privacy', '_blank')}
                  className="text-orange-600 underline hover:text-orange-700"
                  type="button"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </label>
        </div>

        {/* CTA */}
        <button
          onClick={handleStartTab}
          disabled={!termsAccepted || creating}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-lg"
        >
          {creating ? (
            <>
              <span className="animate-spin inline-block mr-2">⟳</span>
              Creating Your Tab...
            </>
          ) : (
            `Start My Tab at ${barName}`
          )}
        </button>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            🔒 Your privacy is protected
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-400 mt-2 font-mono">
              Device: {debugDeviceId}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <ConsentContent />
      <TokenNotifications />
    </Suspense>
  );
}