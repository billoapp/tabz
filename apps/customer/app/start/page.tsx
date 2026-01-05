// app/start/page.tsx - COMPLETE WITH DEVICE VALIDATION
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Bell, Store, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  getDeviceId, 
  getBarDeviceKey, 
  validateDeviceForNewTab, 
  storeActiveTab 
} from '@/lib/deviceId';
import { useToast } from '@/components/ui/Toast';
import { TokensService, TOKENS_CONFIG } from '../../../../packages/shared/tokens-service';
import { TokenNotifications, useTokenNotifications } from '../../components/TokenNotifications';

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
  const [validating, setValidating] = useState(false);
  
  // Bar data
  const [barSlug, setBarSlug] = useState<string | null>(null);
  const [barId, setBarId] = useState<string | null>(null);
  const [barName, setBarName] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Device validation
  const [deviceValidation, setDeviceValidation] = useState<{
    valid: boolean;
    reason?: string;
    existingTab?: any;
  } | null>(null);

  useEffect(() => {
    initializeConsent();
  }, []);

  const initializeConsent = async () => {
    try {
      // Get bar slug from URL or sessionStorage
      let slug = searchParams?.get('bar') || searchParams?.get('slug');
      
      if (!slug) {
        slug = sessionStorage.getItem('scanned_bar_slug');
      } else {
        sessionStorage.setItem('scanned_bar_slug', slug);
      }

      if (!slug) {
        console.log('❌ No bar slug found, redirecting to home');
        router.replace('/');
        return;
      }

      console.log('🔍 Initializing consent for bar:', slug);
      setBarSlug(slug);
      
      await loadBarInfo(slug);
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
      
      // IMPORTANT: Validate device before showing form
      await validateDevice(bar.id);

    } catch (error) {
      console.error('❌ Error loading bar:', error);
      setError('Error loading bar information. Please try again.');
      setLoading(false);
    }
  };

  const validateDevice = async (barId: string) => {
    try {
      setValidating(true);
      console.log('🔒 Validating device for bar:', barId);
      console.log('🆔 Device ID:', getDeviceId());
      
      const validation = await validateDeviceForNewTab(barId, supabase as any);
      
      console.log('✅ Device validation result:', validation);
      setDeviceValidation(validation);
      
      // If device has existing tab at this bar, redirect immediately
      if (!validation.valid && validation.reason === 'EXISTING_TAB_AT_BAR') {
        console.log('🔄 Existing tab found, redirecting to menu');
        
        const existingTab = validation.existingTab;
        
        // Parse display name
        let displayName = `Tab ${existingTab.tab_number}`;
        try {
          const notes = JSON.parse(existingTab.notes || '{}');
          displayName = notes.display_name || displayName;
        } catch (e) {
          console.warn('Failed to parse tab notes:', e);
        }

        // Store tab data
        storeActiveTab(barId, existingTab);
        sessionStorage.setItem('currentTab', JSON.stringify(existingTab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('barName', barName);
        
        showToast({
          type: 'success',
          title: 'Tab Found!',
          message: `Continuing to your ${displayName}`
        });

        // Redirect to menu
        setTimeout(() => {
          router.replace('/menu');
        }, 500);
        
        return; // Don't set loading to false, we're redirecting
      }
      
      // Device is valid, show consent form
      setLoading(false);
      setValidating(false);
      
    } catch (error) {
      console.error('❌ Error validating device:', error);
      // On validation error, still allow form to show
      setDeviceValidation({ valid: true });
      setLoading(false);
      setValidating(false);
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
      console.log('🆔 Device ID:', getDeviceId());
      console.log('🏪 Bar ID:', barId);
      console.log('👤 Nickname:', nickname || '(none)');
      
      const deviceId = getDeviceId();
      const barDeviceKey = getBarDeviceKey(barId);
      
      console.log('🔑 Bar Device Key:', barDeviceKey);
      
      // Re-validate device before creating tab (double-check)
      const validation = await validateDeviceForNewTab(barId, supabase as any);
      
      if (!validation.valid && validation.reason === 'EXISTING_TAB_AT_BAR') {
        console.log('🔄 Existing tab found during creation, reusing it');
        
        const existingTab = validation.existingTab;
        
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
        displayName = nickname.trim();
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
  if (loading || validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-medium">
            {validating ? 'Checking for existing tabs...' : 'Loading bar information...'}
          </p>
          {barSlug && <p className="text-sm mt-2 font-mono opacity-75">{barSlug}</p>}
          {validating && (
            <p className="text-xs mt-3 opacity-75">
              🔒 Validating device to prevent duplicate tabs
            </p>
          )}
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

        {/* Device Validation Success */}
        {deviceValidation?.valid && (
          <div className="mb-6 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">
              Device verified • No duplicate tabs detected
            </p>
          </div>
        )}

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
              Device: {getDeviceId().slice(0, 20)}...
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