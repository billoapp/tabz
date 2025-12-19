// app/page.tsx
'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, DollarSign, Bell, Shield } from 'lucide-react';

// Create a separate component that uses useSearchParams
function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check if there's a bar_id in the URL
    const barId = searchParams.get('bar_id');
    
    if (barId) {
      // If bar_id exists, redirect to start page with the bar_id
      router.push(`/start?bar_id=${barId}`);
    }
  }, [searchParams, router]);

  const benefits = [
    {
      icon: Zap,
      title: 'Order Instantly',
      description: 'Skip the wait. Order drinks directly from your table.'
    },
    {
      icon: DollarSign,
      title: 'Track Expenses',
      description: 'See your tab in real-time. No surprises at checkout.'
    },
    {
      icon: Bell,
      title: 'Get Updates',
      description: 'Know when your order is ready. Stay in the loop.'
    },
    {
      icon: Shield,
      title: 'Stay Anonymous',
      description: 'No signup required. Your privacy is protected.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-white text-center mb-12">
        <h1 className="text-5xl font-bold mb-3">Kwikoda</h1>
        <p className="text-xl text-orange-100">Order smarter, not harder</p>
      </div>
      
      {/* Main Card */}
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full">
        {/* Benefits Grid */}
        <div className="space-y-4 mb-8">
          {benefits.map((benefit, index) => (
            <div 
              key={index}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <benefit.icon size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* CTA */}
        <button
          onClick={() => router.push('/start')}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-700 transition shadow-lg"
        >
          Start
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-4">
          🔒 No signup • No personal data • 100% anonymous
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