// app/page.tsx
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, DollarSign, Bell, Shield } from 'lucide-react';
import Logo from '@/components/Logo';

// Create a separate component that uses useSearchParams
function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [manualCode, setManualCode] = useState('');
  
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
    }
  }, [searchParams]);

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
      // Navigate to consent/start page WITH slug parameter
      router.push(`/start?bar=${slug}`);
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
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
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
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-700 transition shadow-lg mt-auto"
        >
          Start
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