'use client';

import React from 'react';
import { Banknote, Clock, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';

interface CashPaymentTabProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  balance: number;
  onPayment: () => void;
  isProcessing?: boolean;
}

export default function CashPaymentTab({ 
  amount, 
  onAmountChange, 
  balance, 
  onPayment,
  isProcessing = false
}: CashPaymentTabProps) {
  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= balance;

  return (
    <div className="space-y-6">
      {/* Amount Input Section */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Amount to Pay
        </label>
        <div className="relative">
          <span className="absolute left-4 top-4 text-gray-500 font-semibold">KSh</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            disabled={isProcessing}
            className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-xl font-bold text-lg focus:border-orange-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="0"
            min="1"
            max={balance}
          />
        </div>
        

      </div>

      {/* Payment Instructions */}
      <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <Clock size={20} className="text-orange-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">How to Pay with Cash</h3>
        </div>
        
        <div className="space-y-3">
          <p className="text-gray-600 leading-relaxed">
            Please pay directly at the bar using your preferred payment method:
          </p>
          
          <div className="bg-white rounded-lg p-3 border border-orange-200">
            <p className="text-sm font-medium text-orange-800 mb-2">Accepted at the bar:</p>
            <ul className="space-y-1 text-sm text-orange-700">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600" />
                Cash (KES)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600" />
                M-Pesa (direct to staff)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600" />
                Airtel Money
              </li>
            </ul>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Staff will mark your payment as received and update your tab automatically.
          </p>
        </div>
      </div>

      {/* Amount Summary */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Amount to pay at bar:</span>
            <span className="text-xl font-bold text-gray-800">{formatCurrency(parseFloat(amount))}</span>
          </div>
          {parseFloat(amount) < balance && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-300">
              <span className="text-sm text-gray-600">Remaining balance:</span>
              <span className="text-sm font-medium text-orange-600">
                {formatCurrency(balance - parseFloat(amount))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confirm Button */}
      <button
        onClick={onPayment}
        disabled={!isValidAmount || isProcessing}
        className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Banknote size={20} />
        {isProcessing ? 'Processing...' : 'Confirm Cash Payment'}
      </button>
    </div>
  );
}