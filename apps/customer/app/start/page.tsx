'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ConsentPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleStartTab = async () => {
    if (!termsAccepted) {
        alert('Please accept the Terms of Use and Privacy Policy to continue');
        return;
    }

    setCreating(true);

    try {
        // Get bar info
        const { data: bars, error: barError } = await supabase
        .from('bars')
        .select('id, name')
        .limit(1);

        if (barError) throw barError;

        if (!bars || bars.length === 0) {
        alert('No bar found. Please contact support.');
        return;
        }

        const bar = bars[0];

        // Determine display name and tab_number
        let displayName: string;
        let tabNumber: number | null;
        
        if (nickname.trim()) {
        // User provided nickname
        displayName = `Tab ${nickname.trim()}`;
        tabNumber = null; // ✅ Enforce null when nickname exists
        } else {
        // Auto-generate Tab number
        const { data: existingTabs } = await supabase
            .from('tabs')
            .select('tab_number')
            .eq('bar_id', bar.id)
            .order('tab_number', { ascending: false })
            .limit(1);

        const nextNumber = existingTabs && existingTabs.length > 0 
            ? existingTabs[0].tab_number + 1 
            : 1;
        
        displayName = `Tab ${nextNumber}`;
        tabNumber = nextNumber; // ✅ Use sequential number
        }

        // Create tab with consent data
        const { data: tab, error: tabError } = await supabase
        .from('tabs')
        .insert({
            bar_id: bar.id,
            tab_number: tabNumber, // ✅ null if nickname, number if auto-generated
            status: 'open',
            owner_identifier: `anon_${Date.now()}`,
            notes: JSON.stringify({
            display_name: displayName,
            has_nickname: !!nickname.trim(), // Track if user provided nickname
            notifications_enabled: notificationsEnabled,
            terms_accepted: termsAccepted,
            accepted_at: new Date().toISOString()
            })
        })
        .select()
        .single();

        if (tabError) throw tabError;

        console.log('✅ Tab created:', tab);

        // Store in session
        sessionStorage.setItem('currentTab', JSON.stringify(tab));
        sessionStorage.setItem('displayName', displayName);
        sessionStorage.setItem('notificationsEnabled', String(notificationsEnabled));

        // Navigate to menu
        router.push('/menu');

    } catch (error: any) {
        console.error('❌ Error:', error);
        alert(`Error creating tab: ${error.message || 'Please try again'}`);
    } finally {
        setCreating(false);
    }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
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
            This tab exists only for this visit.
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
            placeholder="Table 4 or John"
            maxLength={20}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to use Tab 1, Tab 2, etc.
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
                <li>• Order updates</li>
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
          {creating ? 'Creating Tab...' : 'Start My Tab'}
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-4">
          🔒 Your privacy is protected
        </p>
      </div>
    </div>
  );
}