// app/page.tsx
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, DollarSign, Bell, Shield } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { getDeviceId, getBarDeviceKey } from '@/lib/deviceId';

// Create a separate component that uses useSearchParams
function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [manualCode, setManualCode] = useState('');
  const [checkingTab, setCheckingTab] = useState(false);
  
  useEffect(() => {
    // Check if there's a slug in URL (from QR code scan)
    const slug = searchParams.get('bar') || searchParams.get('slug');
    
    console.log('🔍 Landing page - Full URL:', window.location.href);
    console.log('🔍 Landing page - Search params:', window.location.search);
    console.log('🔍 Landing page - bar slug from URL:', slug);
    
    if (slug) {
      // Store slug in sessionStorage for persistence
      sessionStorage.setItem('scanned_bar_slug', slug);
      console.log('✅ Stored bar slug in sessionStorage:', slug);
      
      // Check for existing tab with this device ID
      checkExistingTab(slug);
    }
  }, [searchParams]);

  const checkExistingTab = async (barSlug: string) => {
    try {
      setCheckingTab(true);
      console.log('🔍 Checking for existing tab on landing page...');
      
      // Get bar info first
      const { data: bar, error: barError } = await (supabase as any)
        .from('bars')
        .select('id, name, active')
        .eq('slug', barSlug)
        .maybeSingle();

      if (barError || !bar || !bar.active) {
        console.log('❌ Bar not found or inactive:', barError?.message || 'Bar not found');
        setCheckingTab(false);
        return;
      }

      console.log('✅ Bar found:', bar.name);

      // Check for existing open tab with this device
      const deviceId = getDeviceId();
      const barDeviceKey = getBarDeviceKey(bar.id);
      
      console.log('🔍 Device ID:', deviceId);
      console.log('🔑 Bar device key:', barDeviceKey);

      const { data: existingTab, error: checkError } = await (supabase as any)
        .from('tabs')
        .select('*')
        .eq('bar_id', bar.id)
        .eq('owner_identifier', barDeviceKey)
        .eq('status', 'open')
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing tab:', checkError);
        setCheckingTab(false);
        return;
      }

      if (existingTab) {
        console.log('✅ Found existing open tab, navigating directly to menu:', existingTab.tab_number);
        console.log('📱 Device ID enforcement working - bypassing consent page');
        
        // Store tab data
        const displayName = (() => {
          try {
            const notes = JSON.parse(existingTab.notes || '{}');
            return notes.display_name || `Tab ${existingTab.tab_number}`;
          } catch {
            return `Tab ${existingTab.tab_number}`;
          }
        })();

        sessionStorage.setItem('currentTab', JSON.stringify(existingTab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('barName', bar.name);
        
        // Navigate directly to menu, bypassing consent page
        router.replace('/menu');
        return;
      } else {
        console.log('📝 No existing tab found, showing consent page');
        // No existing tab - go to consent page
        router.push(`/start?bar=${barSlug}`);
      }

    } catch (error) {
      console.error('❌ Error checking existing tab:', error);
      // On error, still go to consent page
      router.push(`/start?bar=${barSlug}`);
    } finally {
      setCheckingTab(false);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      sessionStorage.setItem('scanned_bar_slug', manualCode.trim());
      console.log('✅ Manual bar slug stored:', manualCode.trim());
    } else {
      alert('Please enter a valid bar slug');
    }
  };

  const handleStart = () => {
    const slug = searchParams.get('bar') || searchParams.get('slug') || sessionStorage.getItem('scanned_bar_slug') || manualCode.trim();
    
    console.log('🚀 Start button clicked, bar slug:', slug);
    
    if (slug) {
      // Check for existing tab first, then navigate accordingly
      checkExistingTab(slug);
    } else {
      // No slug - show error
      alert('Please scan a QR code or enter a valid bar slug');
    }
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
            Or enter bar slug:
          </label>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g., sunset-lounge"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
          />
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
              Checking...
            </>
          ) : (
            'Start'
          )}
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-3">
          🔒 No signup • 100% anonymous
        </p>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
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