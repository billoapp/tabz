// app/start/page.tsx - FIXED: Better bar_id handling
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Bell, Store, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Create a separate component that uses useSearchParams
function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    console.log('🔍 Start page loaded');
    
    // Try to get bar slug from multiple sources
    let slug = searchParams?.get('bar') || searchParams?.get('slug');
    
    // Fallback to sessionStorage if not in URL
    if (!slug) {
      slug = sessionStorage.getItem('scanned_bar_slug');
      console.log('📦 Retrieved bar slug from sessionStorage:', slug);
    } else {
      console.log('🔗 Retrieved bar slug from URL:', slug);
      // Store it for later use
      sessionStorage.setItem('scanned_bar_slug', slug);
    }

    if (!slug) {
      setError('No bar specified. Please scan a valid QR code.');
      setLoading(false);
      return;
    }

    setBarSlug(slug);
    loadBarInfo(slug);
  }, [searchParams]);

  const loadBarInfo = async (slug: string) => {
    try {
      console.log('🔍 Loading bar info for slug:', slug);
      
      // Get bar info by slug from QR code
      const { data: bar, error: barError } = await supabase
        .from('bars')
        .select('id, name, active, location, slug')
        .eq('slug', slug)
        .maybeSingle();

      console.log('📊 Bar query result:', { bar, barError });

      if (barError) {
        console.error('❌ Supabase error:', barError);
        setError(`Database error: ${barError.message}`);
        setLoading(false);
        return;
      }

      if (!bar) {
        setError(`Bar not found with slug: "${slug}". Please scan a valid QR code.`);
        setLoading(false);
        return;
      }

      // Check if bar is active
      const isActive = bar.active !== false;
      
      if (!isActive) {
        setError('This bar is currently unavailable. Please contact staff.');
        setLoading(false);
        return;
      }

      // ✅ CRITICAL FIX: Set the bar ID here!
      setBarId(bar.id);
      setBarName(bar.name || 'Bar');
      console.log('✅ Bar loaded successfully:', bar.name, 'ID:', bar.id);
      
      // Check for existing open tab at this bar
      const tabData = sessionStorage.getItem('currentTab');
      if (tabData) {
        try {
          const existingTab = JSON.parse(tabData);
          if (existingTab.bar_id === bar.id && existingTab.status === 'open') {
            // User already has an open tab at this bar
            if (confirm(`You already have an open tab at ${bar.name}. Continue to your tab?`)) {
              router.push('/menu');
              return;
            }
          }
        } catch (e) {
          console.log('No valid existing tab found');
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
      alert('Please accept the Terms of Use and Privacy Policy to continue');
      return;
    }

    if (!barId) {
      alert('Bar information not found. Please scan QR code again.');
      return;
    }

    setCreating(true);

    try {
      // Determine display name and tab_number
      let displayName: string;
      let tabNumber: number | null;
      
      if (nickname.trim()) {
        // User provided nickname
        displayName = nickname.trim();
        tabNumber = null;
      } else {
        // Auto-generate Tab number
        const { data: existingTabs } = await supabase
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

      console.log('🔍 Creating tab for bar:', barId, 'display:', displayName);

      // Create tab with consent data
      const { data: tab, error: tabError } = await supabase
        .from('tabs')
        .insert({
          bar_id: barId,
          tab_number: tabNumber,
          status: 'open',
          owner_identifier: `anon_${Date.now()}`,
          notes: JSON.stringify({
            display_name: displayName,
            has_nickname: !!nickname.trim(),
            notifications_enabled: notificationsEnabled,
            terms_accepted: termsAccepted,
            accepted_at: new Date().toISOString(),
            bar_name: barName
          })
        })
        .select()
        .single();

      if (tabError) {
        console.error('❌ Tab creation error:', tabError);
        throw tabError;
      }

      console.log('✅ Tab created successfully:', tab);

      // Store in session
      sessionStorage.setItem('currentTab', JSON.stringify(tab));
      sessionStorage.setItem('displayName', displayName);
      sessionStorage.setItem('barName', barName);
      sessionStorage.setItem('notificationsEnabled', String(notificationsEnabled));

      // Navigate to menu
      router.push('/menu');

    } catch (error: any) {
      console.error('❌ Error creating tab:', error);
      alert(`Error creating tab: ${error.message || 'Please try again'}`);
    } finally {
      setCreating(false);
    }
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
            
            <div className="bg-gray-50 p-3 rounded-lg text-left mb-4">
              <p className="text-sm font-mono text-gray-600 break-all">
                <strong>Debug Info:</strong><br/>
                Bar Slug from QR: {barSlug || 'None found'}<br/>
                SessionStorage: {sessionStorage.getItem('scanned_bar_slug') || 'None'}<br/>
                URL Param: {searchParams?.get('bar') || searchParams?.get('slug') || 'None'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              sessionStorage.clear();
              router.push('/');
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
        {/* Bar Information - Prominently Displayed */}
        <div className="text-center mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Store size={20} className="text-orange-600" />
            <p className="text-sm font-medium text-orange-700">You're at</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{barName}</h2>
          <p className="text-sm text-gray-600">Ready to start your tab</p>
          {barId && (
            <p className="text-xs text-gray-400 mt-2 font-mono">
              Bar ID: {barId.substring(0, 8)}...
            </p>
          )}
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
          <p className="text-sm text-gray-500 mt-2">
            This tab exists only for this visit at {barName}.
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
          
          <p className="text-xs text-gray-500 mt-2">
            Sounds and on-screen alerts only. No phone number required.
          </p>
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
              <p className="text-xs text-gray-500 mt-1">
                We don't sell or store personal data.
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
          <p className="text-xs text-gray-400 mt-1">
            Your tab is only accessible at this location
          </p>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
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