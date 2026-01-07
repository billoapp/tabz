// app/page.tsx - IMPROVED VERSION
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
  getAllOpenTabs,
  storeActiveTab 
} from '@/lib/deviceId';
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
  const pushManager = new PushNotificationManager();

  useEffect(() => {
    initializeLanding();
  }, [searchParams]);

  const initializeLanding = async () => {
    // Check if there's a slug in URL (from QR code scan)
    const slug = searchParams.get('bar') || searchParams.get('slug');
    
    console.log('🔍 Landing page initialized');
    console.log('📍 URL slug:', slug);
    console.log('🆔 Device ID:', getDeviceId());
    
    if (slug) {
      // Store slug for later use
      sessionStorage.setItem('scanned_bar_slug', slug);
      console.log('✅ Stored bar slug:', slug);
      
      // Automatically check for existing tab
      await checkExistingTabBySlug(slug);
    } else {
      // No slug - show all open tabs if any
      await loadAllOpenTabs();
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
        
        showToast({
          type: 'success',
          title: 'Welcome Back!',
          message: `Continuing to your ${displayName} at ${bar.name}`
        });

        // Navigate directly to menu (bypass consent)
        console.log('🚀 Navigating to menu (bypassing consent)');
        setTimeout(() => {
          router.replace('/menu');
        }, 500); // Brief delay to show toast
        
        return;
      }

      console.log('ℹ️ No existing tab found - will show consent page');
      
      // No existing tab - go to consent page after a brief delay
      setTimeout(() => {
        router.push(`/start?bar=${barSlug}`);
      }, 300);

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

  const slug = searchParams.get('bar') || searchParams.get('slug');

  return (
    <div className="h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center p-4">
      {/* Existing Tabs Modal */}
      {showExistingTabsModal && existingTabs.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={24} className="text-orange-600" />
              <h2 className="text-xl font-bold">Open Tabs Found</h2>
            </div>
            
            <p className="text-gray-600 mb-4">
              You have {existingTabs.length} open tab{existingTabs.length > 1 ? 's' : ''} at:
            </p>
            
            <div className="space-y-3">
              {existingTabs.map((tab) => {
                const bar = tab.bars;
                let displayName = `Tab ${tab.tab_number}`;
                try {
                  const notes = JSON.parse(tab.notes || '{}');
                  displayName = notes.display_name || displayName;
                } catch (e) {}
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleContinueToExistingTab(tab)}
                    className="w-full text-left p-4 bg-gray-50 rounded-xl hover:bg-orange-50 transition border border-gray-200"
                  >
                    <div className="font-semibold text-gray-800">{bar.name}</div>
                    <div className="text-sm text-gray-600">{displayName}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Opened: {new Date(tab.opened_at).toLocaleTimeString()}
                    </div>
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setShowExistingTabsModal(false)}
              className="w-full mt-4 py-3 text-gray-600 hover:text-gray-800 font-medium"
            >
              Start New Tab Instead
            </button>
          </div>
        </div>
      )}

      {/* Header with Logo */}
      <div className="text-white text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <Logo size="lg" variant="white" />
        </div>
        <h1 className="text-4xl font-bold mb-2">Tabeza</h1>
        <p className="text-lg text-orange-100">Order smarter, not harder</p>
      </div>
      
      {/* Main Card */}
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full flex-1 flex flex-col">
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
              Go
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
            Device: {getDeviceId().slice(0, 20)}...
          </p>
        )}
      </div>
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