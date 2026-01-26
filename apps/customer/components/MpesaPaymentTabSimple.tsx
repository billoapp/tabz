'use client';

import React, { useState } from 'react';
import { Phone } from 'lucide-react';

interface MpesaPaymentTabSimpleProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  balance: number;
  onPaymentSuccess: (receiptNumber: string) => void;
  onPaymentError: (error: string) => void;
}

export default function MpesaPaymentTabSimple({ 
  amount, 
  onAmountChange, 
  balance, 
  onPaymentSuccess,
  onPaymentError
}: MpesaPaymentTabSimpleProps) {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSendPayment = () => {
    console.log('🔘 Simple M-Pesa button clicked!', {
      phoneNumber,
      amount,
      balance
    });
    
    alert(`M-Pesa button clicked!\nPhone: ${phoneNumber}\nAmount: ${amount}`);
    
    // Simple validation
    if (!phoneNumber.trim()) {
      alert('Please enter a phone number');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    // For testing, just show success
    alert('Payment would be initiated here');
  };

  return (
    <div className="space-y-6 p-4 border border-gray-300 rounded-lg">
      <h3 className="text-lg font-bold">Simple M-Pesa Test</h3>
      
      {/* Amount Input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Amount to Pay
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded"
          placeholder="Enter amount"
        />
      </div>

      {/* Phone Number Input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded"
          placeholder="0712345678"
        />
      </div>

      {/* Simple Send Button */}
      <button
        onClick={handleSendPayment}
        className="w-full bg-green-600 text-white py-3 rounded font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
      >
        <Phone size={20} />
        Send M-PESA Request (Simple Test)
      </button>
      
      <div className="text-xs text-gray-500">
        This is a simplified test component to check if the button click works.
      </div>
    </div>
  );
}