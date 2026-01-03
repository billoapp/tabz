// app/start/page.tsx - FIXED Navigation
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Bell, Store, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDeviceId, getBarDeviceKey } from '@/lib/deviceId';
import { useToast } from '@/components/ui/Toast';

function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [nickname, setNickname] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [barSlug, setBarSlug] = useState<string | null>(null);
  const [barId, setBarId] = useState<string | null>(null);
  const [barName, setBarName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    
    // Try to get bar slug from URL first, then sessionStorage
    let slug = searchParams?.get('bar') || searchParams?.get('slug');
    
    if (!slug) {
      slug = sessionStorage.getItem('scanned_bar_slug');
    } else {
      sessionStorage.setItem('scanned_bar_slug', slug);
    }

    if (!slug) {
      router.replace('/');
      return;
    }

    setBarSlug(slug);
    loadBarInfo(slug);
  }, []); // Remove searchParams from dependencies to prevent re-runs

  const loadBarInfo = async (slug: string) => {
    try {
      
      const { data: bar, error: barError } = await (supabase as any)
        .from('bars')
        .select('id, name, active, location, slug')
        .eq('slug', slug)
        .maybeSingle();


      if (barError) {
        setError(`Database error: ${barError.message}`);
        setLoading(false);
        return;
      }

      if (!bar) {
        setError(`Bar not found with slug: "${slug}". Please scan a valid QR code.`);
        setLoading(false);
        return;
      }

      const isActive = bar.active !== false;
      
      if (!isActive) {
        setError('This bar is currently unavailable. Please contact staff.');
        setLoading(false);
        return;
      }

      setBarId(bar.id);
      setBarName(bar.name || 'Bar');
      
      // Check for existing open tab at this bar
      const tabData = sessionStorage.getItem('currentTab');
      if (tabData) {
        try {
          const existingTab = JSON.parse(tabData);
          if (existingTab.bar_id === bar.id && existingTab.status === 'open') {
            if (confirm(`You already have an open tab at ${bar.name}. Continue to your tab?`)) {
              router.replace('/menu'); // Use replace instead of push
              return;
            }
          }
        } catch (e) {
        }
      }

    } catch (error) {
      console.error('❌ Error loading bar:', error);
      setError('Error loading bar information. Please try again.');
    } finally {
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
      const deviceId = getDeviceId();
      const barDeviceKey = getBarDeviceKey(barId);
      
      // Check for existing open tabs with the same device at the same bar (fraud prevention)
      const deviceId = getDeviceId();
      const { data: existingDeviceTabs, error: deviceCheckError } = await (supabase as any)
        .from('tabs')
        .select('id, status, created_at, tab_number')
        .eq('bar_id', barId)
        .eq('status', 'open')
        .contains('notes', `"device_id":"${deviceId}"`);

      if (deviceCheckError && deviceCheckError.code !== 'PGRST116') {
        console.error('Error checking device tabs:', deviceCheckError);
      }

      if (existingDeviceTabs && existingDeviceTabs.length > 0) {
        const existingTab = existingDeviceTabs[0];
        throw new Error(`This device already has an open tab (Tab ${existingTab.tab_number}) at this location. Please close your existing tab first or contact staff for assistance.`);
      }

      // Check for existing open tab with this device
      const { data: existingTab, error: checkError } = await (supabase as any)
        .from('tabs')
        .select('*')
        .eq('bar_id', barId)
        .eq('owner_identifier', barDeviceKey)
        .eq('status', 'open')
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // If tab exists, reuse it
      if (existingTab) {
        if (nickname.trim()) {
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

        // Store tab data before navigation
        sessionStorage.setItem('currentTab', JSON.stringify(existingTab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('barName', barName);
        
        
        // Reset creating state before navigation
        setCreating(false);
        
        // Use replace to prevent back button issues
        router.replace('/menu');
        return;
      }

      const { data: allDeviceTabs } = await (supabase as any)
        .from('tabs')
        .select('tab_number, status, opened_at')
        .eq('bar_id', barId)
        .eq('owner_identifier', barDeviceKey)
        .order('opened_at', { ascending: false });


      // If we found any closed tabs from this device, warn user
      if (allDeviceTabs && allDeviceTabs.length > 0) {
        const openTabs = allDeviceTabs.filter((tab: { status: string }) => tab.status === 'open');
        if (openTabs.length > 0) {
          throw new Error('Multiple tabs detected. Please contact support.');
        }
      }

      // Create new tab
      let displayName: string;
      let tabNumber: number | null;
      
      if (nickname.trim()) {
        displayName = nickname.trim();
        tabNumber = null;
      } else {
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
      }


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
            device_id: getDeviceId(),
            notifications_enabled: notificationsEnabled,
            terms_accepted: termsAccepted,
            accepted_at: new Date().toISOString(),
            bar_name: barName
          })
        })
        .select()
        .single();

      if (tabError) {
        console.error('Error creating tab:', tabError);
        throw tabError;
      }


      // Store tab data before navigation
      sessionStorage.setItem('currentTab', JSON.stringify(tab));
      sessionStorage.setItem('displayName', displayName);
      sessionStorage.setItem('barName', barName);
      
      
      // Reset creating state before navigation
      setCreating(false);
      
      // Use replace to prevent back button issues
      router.replace('/menu');

    } catch (error: any) {
      console.error('❌ Error creating/loading tab:', error);
      showToast({
        type: 'error',
        title: 'Tab Creation Failed',
        message: error.message || 'Please try again'
      });
      setCreating(false); // Only reset creating state on error
    }
    // Don't set creating to false on success - let navigation happen
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading bar information...</p>
          {barSlug && <p className="text-sm mt-2 font-mono">{barSlug}</p>}
        </div>
      </div>
    );
  }

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
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600"
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
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
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
              className="mt-0.5 w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
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
              className="mt-0.5 w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                I agree to the{' '}
                <button 
                  onClick={() => window.open('/terms', '_blank')}
                  className="text-orange-600 underline hover:text-orange-700"
                >
                  Terms of Use
                </button>
                {' '}and{' '}
                <button 
                  onClick={() => window.open('/privacy', '_blank')}
                  className="text-orange-600 underline hover:text-orange-700"
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
    </Suspense>
  );
}