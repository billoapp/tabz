'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();

  const handleScanQR = async () => {
    try {
      console.log('🔍 Fetching bar from Supabase...');
      
      // Get the bar
      const { data: bars, error: barError } = await supabase
        .from('bars')
        .select('id, name')
        .limit(1);

      console.log('📦 Raw response:', { bars, barError });

      if (barError) {
        console.error('❌ Bar fetch error:', barError);
        throw barError;
      }

      if (!bars || bars.length === 0) {
        console.error('❌ No bars found in database');
        
        // Let's try to see what's in the table
        const { data: allBars } = await supabase
          .from('bars')
          .select('*');
        
        console.log('🗄️ All bars in table:', allBars);
        
        alert('No bar found. Check console for details.');
        return;
      }

      const bar = bars[0];
      console.log('✅ Bar found:', bar);

      // Create tab
      const { data: tab, error: tabError } = await supabase
        .from('tabs')
        .insert({
          bar_id: bar.id,
          status: 'open',
          owner_identifier: `customer_${Date.now()}`
        })
        .select()
        .single();

      if (tabError) {
        console.error('❌ Tab create error:', tabError);
        throw tabError;
      }

      console.log('✅ Tab created:', tab);
      
      sessionStorage.setItem('currentTab', JSON.stringify(tab));
      router.push('/menu');
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert(`Error: ${error.message || 'Failed to create tab'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center justify-center p-6">
      <div className="text-white text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Kwik Oda</h1>
        <p className="text-orange-100">Fast. Simple. Your Tab.</p>
      </div>
      
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-48 h-48 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <div className="text-6xl">📱</div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Scan to Start</h2>
          <p className="text-gray-600 text-sm">Scan the QR code at your bar to open your tab</p>
        </div>
        
        <button
          onClick={handleScanQR}
          className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 transition"
        >
          Simulate QR Scan
        </button>
      </div>
    </div>
  );
}
