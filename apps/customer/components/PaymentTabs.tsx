'use client';

import React from 'react';
import { Phone, Banknote } from 'lucide-react';

interface PaymentTabsProps {
  activeTab: 'cash' | 'mpesa';
  onTabChange: (tab: 'cash' | 'mpesa') => void;
  mpesaAvailable: boolean;
  children: React.ReactNode;
}

export default function PaymentTabs({ 
  activeTab, 
  onTabChange, 
  mpesaAvailable, 
  children 
}: PaymentTabsProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200">
        {/* Cash Payment Tab */}
        <button
          onClick={() => onTabChange('cash')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 font-semibold transition-colors ${
            activeTab === 'cash'
              ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Banknote size={20} />
          <span>Cash Payment</span>
        </button>

        {/* M-Pesa Payment Tab - Only show if available */}
        {mpesaAvailable && (
          <button
            onClick={() => onTabChange('mpesa')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 font-semibold transition-colors ${
              activeTab === 'mpesa'
                ? 'bg-green-50 text-green-600 border-b-2 border-green-500'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Phone size={20} />
            <span>M-Pesa Payment</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}