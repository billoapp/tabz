'use client';

import React, { useState, useEffect } from 'react';
import { Phone, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';
import MpesaPayment from './MpesaPayment';
import { 
  validateMpesaPhoneNumber, 
  formatPhoneNumberInput, 
  getPhoneNumberGuidance,
  getNetworkProvider
} from '@tabeza/shared';

interface MpesaPaymentTabProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  balance: number;
  onPaymentSuccess: (receiptNumber: string) => void;
  onPaymentError: (error: string) => void;
  // Enhanced state management props
  phoneNumber?: string;
  onPhoneNumberChange?: (phoneNumber: string) => void;
  showMpesaPayment?: boolean;
  onShowMpesaPaymentChange?: (show: boolean) => void;
}

export default function MpesaPaymentTab({ 
  amount, 
  onAmountChange, 
  balance, 
  onPaymentSuccess,
  onPaymentError,
  // Enhanced state management props with defaults
  phoneNumber: externalPhoneNumber,
  onPhoneNumberChange,
  showMpesaPayment: externalShowMpesaPayment,
  onShowMpesaPaymentChange
}: MpesaPaymentTabProps) {
  // Use external state if provided, otherwise use internal state
  const [internalPhoneNumber, setInternalPhoneNumber] = useState('');
  const [internalShowMpesaPayment, setInternalShowMpesaPayment] = useState(false);
  
  const phoneNumber = externalPhoneNumber !== undefined ? externalPhoneNumber : internalPhoneNumber;
  const showMpesaPayment = externalShowMpesaPayment !== undefined ? externalShowMpesaPayment : internalShowMpesaPayment;
  
  const setPhoneNumber = onPhoneNumberChange || setInternalPhoneNumber;
  const setShowMpesaPayment = onShowMpesaPaymentChange || setInternalShowMpesaPayment;
  
  const [previousPhoneNumber, setPreviousPhoneNumber] = useState('');
  const [phoneValidation, setPhoneValidation] = useState<any>(null);

  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= balance;

  // Validate phone number whenever it changes
  useEffect(() => {
    if (phoneNumber.trim()) {
      const validation = validateMpesaPhoneNumber(phoneNumber);
      setPhoneValidation(validation);
    } else {
      setPhoneValidation(null);
    }
  }, [phoneNumber]);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const formatted = formatPhoneNumberInput(newValue, previousPhoneNumber);
    
    setPreviousPhoneNumber(phoneNumber);
    setPhoneNumber(formatted);
  };

  const handleSendPayment = () => {
    if (phoneValidation?.isValid && isValidAmount) {
      setShowMpesaPayment(true);
    }
  };

  const getValidationDisplay = () => {
    if (!phoneNumber.trim()) {
      return (
        <div className="text-xs text-gray-500 mt-1">
          <p>Enter your M-PESA number</p>
          <p className="text-blue-600 font-medium">Supported formats: 0712345678 or 254712345678</p>
        </div>
      );
    }

    if (phoneValidation) {
      if (phoneValidation.isValid) {
        const provider = getNetworkProvider(phoneNumber);
        return (
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-xs text-green-600">
              {provider ? `${provider} number` : 'Valid phone number'} • Format: {phoneValidation.formatted}
            </span>
          </div>
        );
      } else {
        return (
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-xs text-red-500">{phoneValidation.error}</span>
            </div>
            {phoneValidation.suggestions && phoneValidation.suggestions.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs font-medium text-red-700 mb-1">Suggestions:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-red-600">
                  {phoneValidation.suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
    }

    const guidance = getPhoneNumberGuidance(phoneNumber);
    return (
      <div className="flex items-center gap-2 mt-1">
        <Info size={14} className="text-blue-500" />
        <div className="text-xs text-blue-600">
          <p>{guidance[0]}</p>
          {guidance[1] && <p className="text-gray-500">{guidance[1]}</p>}
        </div>
      </div>
    );
  };

  // If M-Pesa payment is active, show the MpesaPayment component
  if (showMpesaPayment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Complete M-PESA Payment</h3>
          <button
            onClick={() => setShowMpesaPayment(false)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Back to form
          </button>
        </div>
        <MpesaPayment
          amount={parseFloat(amount) || balance}
          maxAmount={balance}
          onPaymentSuccess={onPaymentSuccess}
          onPaymentError={(error) => {
            onPaymentError(error);
            setShowMpesaPayment(false);
          }}
        />
      </div>
    );
  }

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
            className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-xl font-bold text-lg focus:border-green-500 focus:outline-none"
            placeholder="0"
            min="1"
            max={balance}
          />
        </div>
        

      </div>

      {/* Phone Number Input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          M-PESA Phone Number
        </label>
        <div className="relative">
          <Phone size={20} className="absolute left-3 top-4 text-gray-400" />
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:outline-none transition-colors ${
              phoneValidation?.isValid === false 
                ? 'border-red-300 focus:border-red-500' 
                : phoneValidation?.isValid === true
                ? 'border-green-300 focus:border-green-500'
                : 'border-gray-200 focus:border-green-500'
            }`}
            placeholder="0712 345 678"
            maxLength={13} // Formatted 10-digit length: "0712 345 678"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        {getValidationDisplay()}
      </div>

      {/* Amount Summary */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Amount to pay via M-PESA:</span>
            <span className="text-xl font-bold text-green-600">{formatCurrency(parseFloat(amount))}</span>
          </div>
          {parseFloat(amount) < balance && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-300">
              <span className="text-sm text-gray-600">Remaining balance:</span>
              <span className="text-sm font-medium text-orange-600">
                {formatCurrency(balance - parseFloat(amount))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSendPayment}
        disabled={!phoneValidation?.isValid || !isValidAmount}
        className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Phone size={20} />
        Send M-PESA Request
      </button>

      {/* M-PESA Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 mb-2">How M-PESA Payment Works:</h4>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Enter your M-PESA phone number above</li>
          <li>2. Click "Send M-PESA Request" to initiate payment</li>
          <li>3. Check your phone for the M-PESA prompt</li>
          <li>4. Enter your M-PESA PIN to complete payment</li>
          <li>5. You'll receive a confirmation once payment is successful</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-600 mb-2">
            <strong>Supported phone number formats:</strong>
          </p>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>• <strong>0712345678</strong> - Standard Kenyan format (10 digits)</li>
            <li>• <strong>254712345678</strong> - International format (12 digits)</li>
            <li>• <strong>712345678</strong> - Without country/area code (9 digits)</li>
          </ul>
          <p className="text-xs text-blue-500 mt-2">
            All formats are automatically converted for M-PESA processing.
          </p>
        </div>
      </div>
    </div>
  );
}