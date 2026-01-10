// app/page.tsx - IMPROVED VERSION WITH COMPLEX FIX
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, DollarSign, Bell, Shield, AlertCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { 
  getDeviceId, 
  getBarDeviceKey, 
  hasOpenTabAtBar,
  validateDeviceForNewTab, 
  getAllOpenTabs,
  storeActiveTab,
  checkAnyOpenTabAtBar,
  isTabLinkedToDevice,
  validateDeviceIntegrity
} from '@/lib/device-identity';
import { useToast } from '@/components/ui/Toast';
import PushNotificationManager from '@/lib/pushNotifications';

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [manualCode, setManualCode] = useState('');
  const [checkingTab, setCheckingTab] = useState(false);
  const [existingTabs, setExistingTabs] = useState<any[]>([]);
  const [showExistingTabsModal, setShowExistingTabsModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const pushManager = new PushNotificationManager();

  useEffect(() => {
    initializeLanding();
  }, [searchParams]);

  const [debugDeviceId, setDebugDeviceId] = useState<string>('');
  
  useEffect(() => {
    // Get device ID for debug display
    getDeviceId().then(id => setDebugDeviceId(id.slice(0, 20)));
  }, []);
  
  const initializeLanding = async () => {
    try {
      setIsInitializing(true);
      // Check if there's a slug in URL (from QR code scan)
      const slug = searchParams.get('bar') || searchParams.get('slug');
      
      console.log('🔍 Landing page initialized');
      console.log('📍 URL slug:', slug);
      console.log('🆔 Device ID:', await getDeviceId());
      
      if (slug) {
        // Store slug for later use
        sessionStorage.setItem('scanned_bar_slug', slug);
        console.log('✅ Stored bar slug:', slug);
        
        // Get bar info
        const { data: bar, error: barError } = await (supabase as any)
          .from('bars')
          .select('id, name, active, slug')
          .eq('slug', slug)
          .maybeSingle();

        if (barError || !bar) {
          console.log('❌ Bar not found:', barError?.message || 'Bar not found');
          showToast({
            type: 'error',
            title: 'Invalid Bar Code',
            message: `Bar "${slug}" not found. Please scan a valid QR code.`
          });
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
          setIsInitializing(false);
          return;
        }

        console.log('✅ Bar found:', bar.name);

        // FIRST: Check for existing tab BEFORE validating device
        setCheckingTab(true);
        const { hasTab, tab } = await hasOpenTabAtBar(bar.id, supabase as any);
        setCheckingTab(false);

        if (hasTab && tab) {
          console.log('✅ EXISTING TAB FOUND!');
          console.log('📋 Tab details:', {
            tab_number: tab.tab_number,
            status: tab.status,
            opened_at: tab.opened_at
          });
          
          // Parse display name from notes
          let displayName = `Tab ${tab.tab_number}`;
          try {
            const notes = JSON.parse(tab.notes || '{}');
            displayName = notes.display_name || displayName;
          } catch (e) {
            console.warn('Failed to parse tab notes:', e);
          }

          // Store tab data in session
          storeActiveTab(bar.id, tab);
          sessionStorage.setItem('currentTab', JSON.stringify(tab));
          sessionStorage.setItem('displayName', displayName);
          sessionStorage.setItem('barName', bar.name);
          
          // Clear the "just created" flag since we're continuing existing tab
          sessionStorage.removeItem('just_created_tab');
          
          showToast({
            type: 'success',
            title: 'Welcome Back!',
            message: `Continuing to your ${displayName} at ${bar.name}`
          });

          // Navigate directly to menu (bypass consent)
          console.log('🚀 Navigating to menu (bypassing consent)');
          setTimeout(() => {
            router.replace('/menu');
          }, 800); // Give user time to see the toast
          
          return; // STOP HERE - user goes to menu
        }

        console.log('ℹ️ No existing tab found');
        
        // Only validate device if creating NEW tab
        console.log('🔒 Validating device for new tab...');
        const validation = await validateDeviceIntegrity(bar.id, supabase as any);
        
        if (!validation.valid) {
          console.log('❌ Device validation failed:', validation.reason);
          showToast({
            type: validation.reason === 'LOW_INTEGRITY_SCORE' ? 'warning' : 'error',
            title: validation.reason === 'LOW_INTEGRITY_SCORE' ? 'Device Check' : 'Tab Issue',
            message: validation.reason === 'LOW_INTEGRITY_SCORE' 
              ? 'Please refresh the page and try again'
              : 'There seems to be an issue with your tab. Please contact staff.'
          });
          
          // Don't redirect - let user see the landing page
          setIsInitializing(false);
          return;
        }
        
        console.log('✅ Device validated - showing consent page');
        showToast({
          type: 'info',
          title: 'Ready to Start',
          message: `No existing tab found at ${bar.name}. Let's create one!`
        });
        
        // No existing tab - go to consent page after brief delay
        setTimeout(() => {
          router.push(`/start?bar=${slug}`);
        }, 800); // Give user time to see the toast
        
      } else {
        // No slug - check if we just came from creating a tab
        const justCreatedTab = sessionStorage.getItem('just_created_tab');
        const currentTab = sessionStorage.getItem('currentTab');
        
        // Only show existing tabs modal if:
        // 1. User hasn't just created a tab, AND
        // 2. They don't already have an active tab
        if (!justCreatedTab && !currentTab) {
          await loadAllOpenTabs();
        } else {
          // Clear the flag if set
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
      
      // Get bar info
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
        return;
      }

      console.log('✅ Bar found:', bar.name);

      // Check for existing open tab using device ID
      const { hasTab, tab } = await hasOpenTabAtBar(bar.id, supabase as any);

      if (hasTab && tab) {
        console.log('✅ EXISTING TAB FOUND!');
        console.log('📋 Tab details:', {
          tab_number: tab.tab_number,
          status: tab.status,
          opened_at: tab.opened_at
        });
        
        // Parse display name from notes
        let displayName = `Tab ${tab.tab_number}`;
        try {
          const notes = JSON.parse(tab.notes || '{}');
          displayName = notes.display_name || displayName;
        } catch (e) {
          console.warn('Failed to parse tab notes:', e);
        }

        // Store tab data in session
        storeActiveTab(bar.id, tab);
        sessionStorage.setItem('currentTab', JSON.stringify(tab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('barName', bar.name);
        
        // Clear the "just created" flag since we're continuing existing tab
        sessionStorage.removeItem('just_created_tab');
        
        showToast({
          type: 'success',
          title: 'Welcome Back!',
          message: `Continuing to your ${displayName} at ${bar.name}`
        });

        // Navigate directly to menu (bypass consent)
        console.log('🚀 Navigating to menu (bypassing consent)');
        setTimeout(() => {
          router.replace('/menu');
        }, 800); // Give user time to see the toast
        
        return;
      }

      console.log('ℹ️ No existing tab found');
      
      // Validate device before creating new tab
      console.log('🔒 Validating device for new tab...');
      const validation = await validateDeviceIntegrity(bar.id, supabase as any);
      
      if (!validation.valid) {
        console.log('❌ Device validation failed:', validation.reason);
        showToast({
          type: validation.reason === 'LOW_INTEGRITY_SCORE' ? 'warning' : 'error',
          title: validation.reason === 'LOW_INTEGRITY_SCORE' ? 'Device Check' : 'Tab Issue',
          message: validation.reason === 'LOW_INTEGRITY_SCORE' 
            ? 'Please refresh the page and try again'
            : 'There seems to be an issue with your tab. Please contact staff.'
        });
        setCheckingTab(false);
        return;
      }
      
      console.log('✅ Device validated - showing consent page');
      showToast({
        type: 'info',
        title: 'Ready to Start',
        message: `No existing tab found at ${bar.name}. Let's create one!`
      });
      
      // No existing tab - go to consent page after brief delay
      setTimeout(() => {
        router.push(`/start?bar=${barSlug}`);
      }, 800); // Give user time to see the toast

    } catch (error) {
      console.error('❌ Error checking existing tab:', error);
      showToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to check for existing tabs. Please try again.'
      });
      // On error, still show consent page
      setTimeout(() => {
        router.push(`/start?bar=${barSlug}`);
      }, 1000);
    } finally {
      setCheckingTab(false);
    }
  };

  const handleManualSubmit = async () => {
    const slug = manualCode.trim();
    
    if (!slug) {
      showToast({
        type: 'warning',
        title: 'Invalid Code',
        message: 'Please enter a bar code'
      });
      return;
    }

    console.log('📝 Manual code entered:', slug);
    sessionStorage.setItem('scanned_bar_slug', slug);
    
    // Immediately check for existing tab
    await checkExistingTabBySlug(slug);
  };

  const handleStart = async () => {
    const slug = 
      searchParams.get('bar') || 
      searchParams.get('slug') || 
      sessionStorage.getItem('scanned_bar_slug') || 
      manualCode.trim();
    
    console.log('🚀 Start clicked, bar slug:', slug);
    
    if (!slug) {
      showToast({
        type: 'error',
        title: 'No Bar Code',
        message: 'Please scan a QR code or enter a bar code'
      });
      return;
    }

    // Check for existing tab before proceeding
    await checkExistingTabBySlug(slug);
  };

  const handleContinueToExistingTab = (tab: any) => {
    const bar = tab.bars;
    
    // Store tab data
    storeActiveTab(tab.bar_id, tab);
    sessionStorage.setItem('currentTab', JSON.stringify(tab));
    sessionStorage.setItem('barName', bar.name);
    
    let displayName = `Tab ${tab.tab_number}`;
    try {
      const notes = JSON.parse(tab.notes || '{}');
      displayName = notes.display_name || displayName;
    } catch (e) {}
    sessionStorage.setItem('displayName', displayName);
    
    // Clear the "just created" flag since we're continuing existing tab
    sessionStorage.removeItem('just_created_tab');
    
    showToast({
      type: 'success',
      title: 'Welcome Back!',
      message: `Opening ${displayName} at ${bar.name}`
    });

    router.replace('/menu');
  };

  const handleStartNewTab = () => {
    // Clear existing tab data
    sessionStorage.removeItem('currentTab');
    sessionStorage.removeItem('displayName');
    sessionStorage.removeItem('barName');
    sessionStorage.removeItem('Tabeza_current_bar');
    
    // Set flag to prevent modal from showing again
    sessionStorage.setItem('just_created_tab', 'true');
    
    setShowExistingTabsModal(false);
    // User will scan new QR code or enter manual code
  };

  const handleScanNewCode = () => {
    // Clear the flag when user explicitly wants to scan new code
    sessionStorage.removeItem('just_created_tab');
    setShowExistingTabsModal(false);
    handleStart();
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

  // Show loading state while initializing
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
      {/* Logo */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <Logo size="lg" className="text-white" />
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full flex-1 flex flex-col">
        {/* Welcome Message */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Tabēza</h1>
          <p className="text-gray-600">Scan a bar's QR code to start</p>
        </div>

        {/* Benefits Grid */}
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
        
        {/* Manual Code Entry */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter bar code:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
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
        
        {/* CTA */}
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

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-3">
          🔒 No signup • 100% anonymous
        </p>
        
        {/* Device ID Debug (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-400 text-center mt-2 font-mono">
            Device: {debugDeviceId}...
          </p>
        )}
      </div>

      {/* Existing Tabs Modal */}
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
                      ${tab.balance || '0.00'}
                    </div>
                  </div>
                  {/* Overdue Status Indicator */}
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