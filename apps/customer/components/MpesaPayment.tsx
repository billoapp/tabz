'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Loader2, CheckCircle, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';
import { useToast } from './ui/Toast';
import { 
  validateMpesaPhoneNumber, 
  formatPhoneNumberInput, 
  getPhoneNumberGuidance,
  getNetworkProvider,
  sanitizePhoneNumber,
  convertToInternationalFormat
} from '@tabeza/shared';
import { validatePaymentContext, logPaymentDebugInfo } from '@/lib/payment-debug';

interface MpesaPaymentProps {
  amount: number;
  onPaymentSuccess: (receiptNumber: string) => void;
  onPaymentError: (error: string) => void;
  maxAmount?: number; // Optional maximum amount (outstanding balance)
}

interface PaymentStatus {
  transactionId: string;
  status: 'pending' | 'sent' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  amount: number;
  phoneNumber: string;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function MpesaPayment({ 
  amount, 
  onPaymentSuccess, 
  onPaymentError,
  maxAmount
}: MpesaPaymentProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [previousPhoneNumber, setPreviousPhoneNumber] = useState('');
  const [phoneValidation, setPhoneValidation] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const { showToast } = useToast();

  // Validate payment amount
  const isValidAmount = amount > 0 && (!maxAmount || amount <= maxAmount);

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

  const initiatePayment = async () => {
    console.log('🚀 Initiating M-Pesa payment', { phoneNumber, amount });
    
    // First, validate payment context and log debug info
    const contextValidation = validatePaymentContext();
    if (!contextValidation.isValid) {
      console.error('❌ Payment context validation failed:', contextValidation.error);
      logPaymentDebugInfo();
      
      showToast({
        type: 'error',
        title: 'Payment Setup Error',
        message: contextValidation.error || 'Unable to initialize payment. Please refresh and try again.'
      });
      return;
    }

    const validation = validateMpesaPhoneNumber(phoneNumber);
    if (!validation.isValid) {
      showToast({
        type: 'error',
        title: 'Invalid Phone Number',
        message: validation.error || 'Please enter a valid phone number'
      });
      return;
    }

    // Validate payment amount
    if (!isValidAmount) {
      const errorMessage = amount <= 0 
        ? 'Payment amount must be greater than zero'
        : `Payment amount cannot exceed ${formatCurrency(maxAmount || 0)}`;
      
      showToast({
        type: 'error',
        title: 'Invalid Amount',
        message: errorMessage
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const internationalPhone = convertToInternationalFormat(phoneNumber);
      
      // Database-first approach: Get customer identifier from source of truth
      const { resolveCustomerIdentifier } = await import('../lib/database-customer-identifier');
      const identifierResult = await resolveCustomerIdentifier();
      
      if (!identifierResult.success) {
        console.error('Failed to resolve customer identifier:', identifierResult.error);
        logPaymentDebugInfo();
        throw new Error(identifierResult.error || 'Unable to find your active tab. Please refresh and try again.');
      }
      
      const { customerIdentifier, barId } = identifierResult;
      
      // Validate all required fields before sending
      const paymentData = {
        barId,
        customerIdentifier,
        phoneNumber: internationalPhone,
        amount
      };
      
      // Final validation of all required fields
      if (!paymentData.barId || !paymentData.customerIdentifier || !paymentData.phoneNumber || !paymentData.amount) {
        console.error('Missing required payment fields:', paymentData);
        logPaymentDebugInfo();
        throw new Error('Payment data incomplete. Please check all fields and try again.');
      }
      
      console.log('Payment context (from database):', { 
        barId, 
        customerIdentifier, 
        phoneNumber: internationalPhone,
        amount,
        tabId: identifierResult.tabId,
        tabNumber: identifierResult.tabNumber
      });
      
      const response = await fetch('/api/payments/mpesa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tabId: identifierResult.tabId,
          phoneNumber: internationalPhone,
          amount
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse API response:', jsonError);
        console.error('Response status:', response.status);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        throw new Error('Invalid response from payment service. Please try again.');
      }

      if (!response.ok) {
        console.error('Payment API error:', {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          details: result.details,
          paymentData
        });
        
        // Log debug info for API errors
        if (response.status === 400 && result.error?.includes('Missing required fields')) {
          logPaymentDebugInfo();
        }
        
        throw new Error(result.error || `Payment failed with status ${response.status}`);
      }

      if (result.success) {
        setCurrentTransaction(result.checkoutRequestId);
        
        // Show success message for STK Push initiation
        showToast({
          type: 'success',
          title: 'Payment Request Sent',
          message: 'Check your phone for the M-PESA prompt and enter your PIN to complete payment.',
          duration: 10000
        });
        
        // Set status to 'sent' since STK Push was successful
        setPaymentStatus({
          transactionId: result.checkoutRequestId,
          status: 'sent',
          amount,
          phoneNumber: internationalPhone,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        console.error('Payment initiation failed:', result);
        throw new Error(result.error || 'Payment initiation failed');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      showToast({
        type: 'error',
        title: 'Payment Failed',
        message: error instanceof Error ? error.message : 'Failed to initiate payment'
      });
      onPaymentError(error instanceof Error ? error.message : 'Payment initiation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkPaymentStatus = async (checkoutRequestId: string) => {
    try {
      const response = await fetch(`/api/payments/mpesa/status/${checkoutRequestId}`);
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Status check failed:', result);
        return null;
      }
      
      return {
        status: result.status,
        message: result.message,
        merchantRequestId: result.merchantRequestId,
        rawResponse: result.rawResponse
      };
    } catch (error) {
      console.error('Status check error:', error);
      return null;
    }
  };

  // Auto-refresh when tab regains focus (user returns from M-Pesa app)
  useEffect(() => {
    const handleFocus = () => {
      if (currentTransaction && paymentStatus?.status === 'sent') {
        console.log('Tab regained focus, refreshing page to check payment status...');
        window.location.reload();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentTransaction, paymentStatus?.status]);

  const retryPayment = () => {
    setCurrentTransaction(null);
    setPaymentStatus(null);
    initiatePayment();
  };

  const handleStatusCheck = async () => {
    if (!currentTransaction) return;
    
    setIsProcessing(true);
    
    try {
      const statusResult = await checkPaymentStatus(currentTransaction);
      
      if (statusResult) {
        // Update payment status based on result
        setPaymentStatus(prev => prev ? {
          ...prev,
          status: statusResult.status as any,
          mpesaReceiptNumber: statusResult.merchantRequestId,
          transactionDate: new Date(),
          failureReason: statusResult.status !== 'completed' ? statusResult.message : undefined,
          updatedAt: new Date()
        } : null);
        
        // Handle successful payment
        if (statusResult.status === 'completed') {
          showToast({
            type: 'success',
            title: 'Payment Confirmed!',
            message: `Payment of ${formatCurrency(amount)} has been confirmed.`,
            duration: 8000
          });
          
          // Call success callback
          onPaymentSuccess(statusResult.merchantRequestId || currentTransaction);
        } else if (statusResult.status === 'failed' || statusResult.status === 'cancelled') {
          showToast({
            type: 'error',
            title: 'Payment Failed',
            message: statusResult.message || 'Payment was not completed',
            duration: 8000
          });
        } else {
          showToast({
            type: 'info',
            title: 'Payment Pending',
            message: 'Payment is still being processed. Please wait or try again.',
            duration: 5000
          });
        }
      } else {
        showToast({
          type: 'error',
          title: 'Status Check Failed',
          message: 'Unable to check payment status. Please try again.',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      showToast({
        type: 'error',
        title: 'Status Check Error',
        message: 'Failed to check payment status. Please try again.',
        duration: 5000
      });
    } finally {
      setIsProcessing(false);
    }
  };yPayment = () => {
    setCurrentTransaction(null);
    setPaymentStatus(null);
    initiatePayment();
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

  const getStatusDisplay = () => {
    if (!paymentStatus) return null;

    const statusConfig = {
      pending: { 
        icon: Loader2, 
        color: 'text-blue-600', 
        bg: 'bg-blue-50', 
        border: 'border-blue-200',
        message: 'Initializing payment...',
        description: 'Setting up your M-PESA payment request'
      },
      sent: { 
        icon: Phone, 
        color: 'text-orange-600', 
        bg: 'bg-orange-50', 
        border: 'border-orange-200',
        message: 'Check your phone for M-PESA prompt',
        description: 'A payment request has been sent to your phone'
      },
      completed: { 
        icon: CheckCircle, 
        color: 'text-green-600', 
        bg: 'bg-green-50', 
        border: 'border-green-200',
        message: 'Payment completed successfully!',
        description: 'Your payment has been processed and confirmed'
      },
      failed: { 
        icon: AlertCircle, 
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        border: 'border-red-200',
        message: 'Payment failed',
        description: 'The payment could not be completed'
      },
      cancelled: { 
        icon: AlertCircle, 
        color: 'text-yellow-600', 
        bg: 'bg-yellow-50', 
        border: 'border-yellow-200',
        message: 'Payment was cancelled',
        description: 'You cancelled the payment on your phone'
      },
      timeout: { 
        icon: AlertCircle, 
        color: 'text-gray-600', 
        bg: 'bg-gray-50', 
        border: 'border-gray-200',
        message: 'Payment timed out',
        description: 'No response received within the time limit'
      }
    };

    const config = statusConfig[paymentStatus.status];
    const Icon = config.icon;
    const isAnimated = paymentStatus.status === 'pending' || paymentStatus.status === 'sent';

    return (
      <div className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Icon 
              size={20} 
              className={`${config.color} ${isAnimated ? 'animate-spin' : ''}`} 
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium ${config.color}`}>{config.message}</h4>
            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
            
            {/* Additional status information */}
            <div className="mt-2 space-y-1">
              {paymentStatus.mpesaReceiptNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Receipt:</span>
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded border">
                    {paymentStatus.mpesaReceiptNumber}
                  </span>
                </div>
              )}
              
              {paymentStatus.transactionDate && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Time:</span>
                  <span className="text-xs text-gray-600">
                    {new Date(paymentStatus.transactionDate).toLocaleString()}
                  </span>
                </div>
              )}
              
              {paymentStatus.failureReason && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <span className="text-xs font-medium text-red-600">Error Details:</span>
                  <p className="text-xs text-red-700 mt-1">{paymentStatus.failureReason}</p>
                </div>
              )}
            </div>

            {/* Progress indicator for pending/sent status */}
            {isAnimated && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span>Waiting for response...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
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
            disabled={isProcessing || currentTransaction !== null}
            className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors ${
              phoneValidation?.isValid === false 
                ? 'border-red-300 focus:border-red-500' 
                : phoneValidation?.isValid === true
                ? 'border-green-300 focus:border-green-500'
                : 'border-gray-200 focus:border-blue-500'
            }`}
            placeholder="0712 345 678"
            maxLength={13} // Formatted 10-digit length: "0712 345 678"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        {getValidationDisplay()}
      </div>

      {/* Amount Display */}
      <div className={`border rounded-xl p-4 ${
        isValidAmount 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
        <p className={`text-2xl font-bold ${
          isValidAmount ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(amount)}
        </p>
        {!isValidAmount && (
          <div className="mt-2 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-600">
              {amount <= 0 
                ? 'Amount must be greater than zero'
                : `Amount cannot exceed ${formatCurrency(maxAmount || 0)}`
              }
            </p>
          </div>
        )}
        {maxAmount && amount < maxAmount && isValidAmount && (
          <div className="mt-2 text-sm text-gray-600">
            <p>Remaining balance: {formatCurrency(maxAmount - amount)}</p>
          </div>
        )}
      </div>

      {/* Payment Status */}
      {getStatusDisplay()}

      {/* Action Buttons */}
      <div className="space-y-2">
        {!currentTransaction ? (
          <button
            onClick={initiatePayment}
            disabled={isProcessing || !phoneValidation?.isValid || !isValidAmount}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Initiating Payment...
              </>
            ) : (
              <>
                <Phone size={20} />
                Pay with M-PESA
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            {/* Refresh button for pending/sent payments */}
            {paymentStatus && (paymentStatus.status === 'pending' || paymentStatus.status === 'sent') && (
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={20} />
                Refresh Page
              </button>
            )}
            
            {/* Retry button for failed/cancelled/timeout */}
            {paymentStatus && (paymentStatus.status === 'failed' || paymentStatus.status === 'cancelled' || paymentStatus.status === 'timeout') && (
              <button
                onClick={retryPayment}
                className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={20} />
                Try Again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      {currentTransaction && paymentStatus?.status === 'sent' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-medium text-blue-800 mb-2">Next Steps:</h4>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Check your phone for the M-PESA prompt</li>
            <li>2. Enter your M-PESA PIN to complete payment</li>
            <li>3. Return to this page - it will refresh automatically</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              <strong>Tip:</strong> The page will refresh automatically when you return, or click "Refresh Page" above.
            </p>
          </div>
        </div>
      )}

      {/* Troubleshooting for timeout/failed payments */}
      {paymentStatus && (paymentStatus.status === 'timeout' || paymentStatus.status === 'failed') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Payment Issues?</h4>
          <div className="text-sm text-yellow-700 space-y-2">
            <p><strong>Common solutions:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check if you have sufficient M-PESA balance</li>
              <li>Ensure your phone has network coverage</li>
              <li>Try using a different phone number</li>
              <li>Contact your mobile network provider</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-yellow-200">
              <p className="text-xs">
                If the problem persists, please pay directly at the bar or contact staff for assistance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success confirmation - prominent display when payment just completed */}
      {(paymentStatus?.status === 'completed' || showSuccessMessage) && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h4 className="font-bold text-green-800 mb-3 text-center text-xl">Payment Received!</h4>
          <div className="text-sm text-green-700 space-y-3">
            <p className="text-center font-medium">Your M-PESA payment has been processed successfully.</p>
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium text-gray-600">Amount:</span>
                  <p className="font-bold text-green-700">{formatCurrency(paymentStatus?.amount || amount)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Receipt:</span>
                  <p className="font-mono text-sm">{paymentStatus?.mpesaReceiptNumber || 'Processing...'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Method:</span>
                  <p>M-PESA Mobile Payment</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Date:</span>
                  <p>{paymentStatus?.transactionDate ? new Date(paymentStatus.transactionDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-full">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-xs font-medium text-green-700">Your tab balance has been updated</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}