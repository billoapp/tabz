'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Zap, DollarSign, Bell, Shield } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import Logo from '@/components/Logo';
import { getAllOpenTabs, hasOpenTabAtBar, validateDeviceForNewTab, storeActiveTab } from '@/lib/deviceId';

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <LandingContent />
    </Suspense>
  );
}

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [checkingTab, setCheckingTab] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showExistingTabsModal, setShowExistingTabsModal] = useState(false);
  const [existingTabs, setExistingTabs] = useState<any[]>([]);
  const [debugDeviceId, setDebugDeviceId] = useState('');

  useEffect(() => {
    initializeLanding();
  }, []);

  const initializeLanding = async () => {
    try {
      const slug = searchParams.get('bar') || searchParams.get('slug') || '';
      
      if (slug) {
        console.log('🚀 URL parameters found, checking existing tab');
        await checkExistingTabBySlug(slug);
      } else {
        const justCreatedTab = sessionStorage.getItem('just_created_tab');
        const currentTab = sessionStorage.getItem('currentTab');
        
        if (!justCreatedTab && !currentTab) {
          await loadAllOpenTabs();
        } else {
          sessionStorage.removeItem('just_created_tab');
        }
        
        setIsInitializing(false);
      }
    } catch (error) {
      console.error('❌ Error in initializeLanding:', error);
      showToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to initialize. Please try again.'
      });
      setIsInitializing(false);
    }
  };

  const loadAllOpenTabs = async () => {
    try {
      const supabase = getSupabaseClient();
      const tabs = await getAllOpenTabs(supabase as any);
      
      if (tabs.length > 0) {
        console.log(`📊 Found ${tabs.length} open tab(s) across bars:`, tabs);
        setExistingTabs(tabs);
        setShowExistingTabsModal(true);
      }
    } catch (error) {
      console.error('❌ Error loading open tabs:', error);
    }
  };

  const checkExistingTabBySlug = async (barSlug: string) => {
    try {
      setCheckingTab(true);
      console.log('🔍 Checking for existing tab at:', barSlug);
      
      const supabase = getSupabaseClient();
      const { data: bar, error: barError } = await (supabase as any)
        .from('bars')
        .select('id, name, active, slug')
        .eq('slug', barSlug)
        .maybeSingle();

      if (barError || !bar) {
        console.log('❌ Bar not found:', barError?.message || 'Bar not found');
        showToast({
          type: 'error',
          title: 'Invalid Bar Code',
          message: `Bar "${barSlug}" not found. Please scan a valid QR code.`
        });
        setCheckingTab(false);
        setIsInitializing(false);
        return;
      }

      if (!bar.active) {
        console.log('❌ Bar inactive:', bar.name);
        showToast({
          type: 'warning',
          title: 'Bar Unavailable',
          message: `${bar.name} is currently unavailable.`
        });
        setCheckingTab(false);
        setIsInitializing(false);
        return;
      }

      console.log('✅ Bar found:', bar.name);
      const { hasTab, tab } = await hasOpenTabAtBar(bar.id, supabase as any);

      if (hasTab && tab) {
        console.log('✅ EXISTING TAB FOUND!');
        let displayName = `Tab ${tab.tab_number}`;
        try {
          const notes = JSON.parse(tab.notes || '{}');
          displayName = notes.display_name || displayName;
        } catch (e) {
          console.warn('Failed to parse tab notes:', e);
        }

        storeActiveTab(bar.id, tab);
        sessionStorage.setItem('currentTab', JSON.stringify(tab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('barName', bar.name);
        sessionStorage.removeItem('just_created_tab');
        
        showToast({
          type: 'success',
          title: 'Welcome Back!',
          message: `Continuing to your ${displayName} at ${bar.name}`
        });

        setTimeout(() => {
          router.replace('/menu');
        }, 800);
        
        return;
      }

      console.log('ℹ️ No existing tab found');
      console.log('📱 Phone QR scan detected - redirecting DIRECTLY to consent page');
      
      // Store bar slug for consent page
      sessionStorage.setItem('scanned_bar_slug', barSlug);
      
      // DIRECT redirect to consent page - skip landing page
      showToast({
        type: 'info',
        title: 'Welcome!',
        message: `Loading ${bar.name}...`
      });
      
      setTimeout(() => {
        router.replace(`/start?bar=${barSlug}`);
      }, 300);

    } catch (error) {
      console.error('❌ Error checking existing tab:', error);
      showToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to check for existing tabs. Please try again.'
      });
      setCheckingTab(false);
      setIsInitializing(false);
    }
  };

  const handleManualSubmit = async () => {
    const slug = manualCode.trim().toLowerCase();
    
    if (!slug) {
      showToast({
        type: 'warning',
        title: 'Invalid Code',
        message: 'Please enter a bar code'
      });
      return;
    }

    console.log('🔍 Manual code entered:', slug);
    await checkExistingTabBySlug(slug);
  };

  const handleStart = async () => {
    const slug = 
      searchParams.get('bar') || 
      searchParams.get('slug') || 
      manualCode.trim().toLowerCase();
    
    console.log('🚀 Start clicked, bar slug:', slug);
    
    if (slug) {
      console.log('✅ Code provided, checking tab');
      await checkExistingTabBySlug(slug);
    } else {
      console.log('📷 No code provided, opening scanner');
      handleScanNewCode();
    }
  };

  const handleStartNewTab = () => {
    sessionStorage.removeItem('currentTab');
    sessionStorage.removeItem('displayName');
    sessionStorage.removeItem('barName');
    sessionStorage.removeItem('Tabeza_current_bar');
    sessionStorage.setItem('just_created_tab', 'true');
    setShowExistingTabsModal(false);
  };

  const handleScanNewCode = async () => {
    sessionStorage.removeItem('just_created_tab');
    setShowExistingTabsModal(false);
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        stream.getTracks().forEach(track => track.stop());
        
        showToast({
          type: 'success',
          title: 'Camera Access Granted',
          message: 'Redirecting to QR scanner...'
        });
        
        setTimeout(() => {
          router.push('/start?scanner=true');
        }, 1000);
        
      } catch (error) {
        console.log('Camera access denied or not available:', error);
        
        showToast({
          type: 'warning',
          title: 'Camera Access Required',
          message: 'Please enable camera access or use manual code entry'
        });
        
        setTimeout(() => {
          router.push('/start');
        }, 2000);
      }
    } else {
      showToast({
        type: 'info',
        title: 'Desktop Detected',
        message: 'Please use your mobile device to scan QR codes or enter a bar code manually'
      });
      
      setTimeout(() => {
        router.push('/start');
      }, 2000);
    }
  };

  const handleContinueToExistingTab = (tab: any) => {
    const bar = tab.bars;
    
    storeActiveTab(bar.id, tab);
    sessionStorage.setItem('currentTab', JSON.stringify(tab));
    sessionStorage.setItem('barName', bar.name);
    
    let displayName = `Tab ${tab.tab_number}`;
    try {
      const notes = JSON.parse(tab.notes || '{}');
      displayName = notes.display_name || displayName;
    } catch (e) {}
    sessionStorage.setItem('displayName', displayName);
    
    sessionStorage.removeItem('just_created_tab');
    
    showToast({
      type: 'success',
      title: 'Welcome Back!',
      message: `Opening ${displayName} at ${bar.name}`
    });

    router.replace('/menu');
  };

  const benefits = [
    {
      icon: Zap,
      title: 'Order Instantly',
      description: 'Order drinks directly from your table.'
    },
    {
      icon: DollarSign,
      title: 'Track Expenses',
      description: 'No surprises at checkout.'
    },
    {
      icon: Bell,
      title: 'Get Updates',
      description: 'Stay in the loop.'
    },
    {
      icon: Shield,
      title: 'Stay Anonymous',
      description: 'Your privacy is protected.'
    }
  ];

  const slug = searchParams.get('bar') || searchParams.get('slug') || '';

  if (isInitializing && slug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">Checking for your tab...</p>
          <p className="text-sm mt-2 opacity-75">at {slug}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <Logo size="lg" className="text-white" />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full flex-1 flex flex-col">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Tabeza</h1>
          <p className="text-gray-600">Scan a bar's QR code to start</p>
        </div>

        <div className="space-y-4 mb-8">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <benefit.icon size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter bar code:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toLowerCase())}
              placeholder="e.g., sunset-lounge"
              className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
              disabled={checkingTab}
            />
            <button
              onClick={handleManualSubmit}
              disabled={checkingTab || !manualCode.trim()}
              className="px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {checkingTab ? '...' : 'Go'}
            </button>
          </div>
        </div>
        
        <button
          onClick={handleStart}
          disabled={checkingTab}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-lg mt-auto"
        >
          {checkingTab ? (
            <>
              <span className="animate-spin inline-block mr-2">⟳</span>
              Checking for your tab...
            </>
          ) : slug ? (
            'Continue'
          ) : (
            'Scan QR or Enter Code'
          )}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3">
          🔒 No signup • 100% anonymous
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-400 text-center mt-2 font-mono">
            Device: {debugDeviceId}...
          </p>
        )}
      </div>

      {showExistingTabsModal && existingTabs.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-orange-500" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Existing Tabs Found</h2>
            </div>
            <p className="text-gray-600 mb-6">
              You have open tabs at the following bars:
            </p>
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {existingTabs.map((tab, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleContinueToExistingTab(tab)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {tab.bars?.name || 'Unknown Bar'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Tab {tab.tab_number} • {new Date(tab.opened_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                      Ksh {tab.balance || '0.00'}
                    </div>
                  </div>
                  {tab.status === 'overdue' && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle size={16} />
                        <span className="font-medium">OVERDUE</span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        Outstanding balance requires payment
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleStartNewTab}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition"
              >
                Start New Tab
              </button>
              <button
                onClick={handleScanNewCode}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition"
              >
                Scan New Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}