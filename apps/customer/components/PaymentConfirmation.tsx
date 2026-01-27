'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, X, CreditCard, Smartphone, Wallet, RotateCcw, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';

export interface PaymentConfirmationProps {
  payment: {
    id: string;
    amount: number;
    method: 'mpesa' | 'cash' | 'card';
    status: 'success' | 'failed' | 'pending' | 'cancelled' | 'timeout';
    reference?: string;
    mpesaReceiptNumber?: string;
    failureReason?: string;
    timestamp: string;
    transactionDate?: string;
  };
  tab: {
    id: string;
    tabNumber?: number;
    displayName?: string;
    status?: 'open' | 'overdue' | 'closed';
  };
  updatedBalance?: number;
  type: 'success' | 'failed' | 'processing' | 'cancelled' | 'timeout';
  onDismiss?: () => void;
  onRetry?: () => void;
  onRefresh?: () => void;
  autoCloseDetected?: boolean;
  showProgressIndicator?: boolean;
  progressMessage?: string;
}

const PaymentConfirmation: React.FC<PaymentConfirmationProps> = ({
  payment,
  tab,
  updatedBalance,
  type,
  onDismiss,
  onRetry,
  onRefresh,
  autoCloseDetected = false,
  showProgressIndicator = false,
  progressMessage
}) => {
  const [copied, setCopied] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Timer for processing payments (Requirement 2.5)
  useEffect(() => {
    if (type === 'processing') {
      const startTime = Date.now();
      const timer = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [type]);

  // Auto-dismiss successful payments after delay
  useEffect(() => {
    if (type === 'success' && onDismiss && !autoCloseDetected) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 8000); // Auto-dismiss after 8 seconds

      return () => clearTimeout(timer);
    }
  }, [type, onDismiss, autoCloseDetected]);
  // Format currency consistently
  const formatCurrency = (amount: number): string => {
    return `KSh ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  };

  // Copy receipt number to clipboard
  const copyReceiptNumber = async () => {
    if (payment.mpesaReceiptNumber) {
      try {
        await navigator.clipboard.writeText(payment.mpesaReceiptNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy receipt number:', error);
      }
    }
  };

  // Format processing time
  const formatProcessingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get payment method info
  const getPaymentMethodInfo = () => {
    switch (payment.method) {
      case 'mpesa':
        return {
          icon: <Smartphone className="w-4 h-4" />,
          label: 'M-Pesa',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-200'
        };
      case 'cash':
        return {
          icon: <Wallet className="w-4 h-4" />,
          label: 'Cash',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200'
        };
      case 'card':
        return {
          icon: <CreditCard className="w-4 h-4" />,
          label: 'Card',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-700',
          borderColor: 'border-purple-200'
        };
      default:
        return {
          icon: <Wallet className="w-4 h-4" />,
          label: 'Payment',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status info with enhanced states
  const getStatusInfo = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          title: autoCloseDetected ? 'Payment Confirmed - Tab Closing!' : 'Payment Confirmed!',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          accentColor: 'text-green-600'
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-500" />,
          title: 'Payment Failed',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          accentColor: 'text-red-600'
        };
      case 'processing':
        return {
          icon: <Clock className="w-5 h-5 text-blue-500 animate-pulse" />,
          title: timeElapsed > 30 ? 'Payment Taking Longer Than Expected' : 'Payment Processing',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          accentColor: 'text-blue-600'
        };
      case 'cancelled':
        return {
          icon: <X className="w-5 h-5 text-yellow-500" />,
          title: 'Payment Cancelled',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          accentColor: 'text-yellow-600'
        };
      case 'timeout':
        return {
          icon: <Clock className="w-5 h-5 text-gray-500" />,
          title: 'Payment Timed Out',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          accentColor: 'text-gray-600'
        };
      default:
        return {
          icon: <Clock className="w-5 h-5 text-gray-500" />,
          title: 'Payment Update',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          accentColor: 'text-gray-600'
        };
    }
  };

  // Get tab display name
  const getTabDisplayName = (): string => {
    if (tab.displayName) {
      return tab.displayName;
    }
    return tab.tabNumber ? `Tab ${tab.tabNumber}` : 'Your Tab';
  };

  // Get reference display
  const getReferenceDisplay = (): string | null => {
    if (payment.method === 'mpesa' && payment.mpesaReceiptNumber) {
      return `Receipt: ${payment.mpesaReceiptNumber}`;
    }
    if (payment.reference) {
      return `Ref: ${payment.reference}`;
    }
    return null;
  };

  const methodInfo = getPaymentMethodInfo();
  const statusInfo = getStatusInfo();
  const referenceDisplay = getReferenceDisplay();

  return (
    <div
      className={`
        max-w-sm w-full rounded-lg border p-4 shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-2
        ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.textColor}
        ${autoCloseDetected ? 'ring-2 ring-green-400 ring-opacity-50' : ''}
      `}
      role="alert"
      aria-live="polite"
      aria-labelledby="payment-status-title"
    >
      {/* Auto-close indicator */}
      {autoCloseDetected && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
          Auto-closing
        </div>
      )}
      
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {statusInfo.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 id="payment-status-title" className="text-sm font-semibold mb-2">
            {statusInfo.title}
          </h4>
          
          {/* Payment Method Badge */}
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-2 ${methodInfo.bgColor} ${methodInfo.textColor} border ${methodInfo.borderColor}`}>
            {methodInfo.icon}
            <span>{methodInfo.label}</span>
          </div>
          
          {/* Tab Name */}
          <div className="text-sm font-medium mb-1">
            {getTabDisplayName()}
          </div>
          
          {/* Amount */}
          <div className="text-lg font-bold mb-2">
            {formatCurrency(payment.amount)}
          </div>
          
          {/* Enhanced Updated Balance Section (Requirement 2.2) */}
          {type === 'success' && updatedBalance !== undefined && (
            <div className="text-sm mb-3 p-2 rounded-lg bg-white border">
              {updatedBalance > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Remaining balance:</span>
                    <span className="font-bold text-lg">{formatCurrency(updatedBalance)}</span>
                  </div>
                  {tab.status === 'overdue' && (
                    <div className="text-xs text-orange-600 font-medium">
                      ⚠️ Tab is overdue - please pay remaining balance
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-green-600 font-bold text-lg mb-1">✅ Tab Fully Paid!</div>
                  {autoCloseDetected && (
                    <div className="text-xs text-green-600">
                      Your tab will be closed automatically
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Enhanced Failure Reason Section (Requirement 2.3) */}
          {type === 'failed' && payment.failureReason && (
            <div className="text-sm mb-3 p-2 rounded-lg bg-red-100 border border-red-200">
              <div className="font-medium text-red-800 mb-1">Why did this fail?</div>
              <div className="text-red-700">{payment.failureReason}</div>
              <div className="text-xs text-red-600 mt-2">
                💡 Try checking your M-Pesa balance or network connection
              </div>
            </div>
          )}
          
          {/* Enhanced Processing Section (Requirement 2.5) */}
          {type === 'processing' && (
            <div className="text-sm mb-3 p-2 rounded-lg bg-blue-100 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-800 font-medium">Processing payment...</span>
                <span className="text-xs text-blue-600">{formatProcessingTime(timeElapsed)}</span>
              </div>
              
              {progressMessage && (
                <div className="text-blue-700 mb-2">{progressMessage}</div>
              )}
              
              {showProgressIndicator && (
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((timeElapsed / 60) * 100, 90)}%` }}
                  ></div>
                </div>
              )}
              
              {timeElapsed > 30 && (
                <div className="text-xs text-blue-600">
                  ⏰ This is taking longer than usual. You can refresh or wait a bit more.
                </div>
              )}
            </div>
          )}
          
          {/* Cancelled/Timeout Messages */}
          {type === 'cancelled' && (
            <div className="text-sm mb-2 p-2 rounded-lg bg-yellow-100 border border-yellow-200">
              <div className="text-yellow-800">
                You cancelled the payment on your phone. No charges were made.
              </div>
            </div>
          )}
          
          {type === 'timeout' && (
            <div className="text-sm mb-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
              <div className="text-gray-800">
                Payment request timed out. No charges were made.
              </div>
            </div>
          )}
          
          {/* Enhanced Reference Section with Copy Feature */}
          {referenceDisplay && (
            <div className="text-xs mb-2 p-2 rounded bg-gray-100 border">
              <div className="flex items-center justify-between">
                <span className="opacity-75">{referenceDisplay}</span>
                {payment.mpesaReceiptNumber && (
                  <button
                    onClick={copyReceiptNumber}
                    className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
                    title="Copy receipt number"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-500" />
                    )}
                  </button>
                )}
              </div>
              {copied && (
                <div className="text-green-600 text-xs mt-1">Receipt number copied!</div>
              )}
            </div>
          )}
          
          {/* Transaction Date (for M-Pesa) */}
          {payment.transactionDate && (
            <div className="text-xs opacity-75 mb-2">
              Transaction: {formatTimestamp(payment.transactionDate)}
            </div>
          )}
          
          {/* Timestamp */}
          <div className="text-xs opacity-75">
            {formatTimestamp(payment.timestamp)}
          </div>
        </div>
        
        {/* Enhanced Action Buttons Section */}
        <div className="flex-shrink-0 ml-2 flex flex-col gap-1">
          {/* Dismiss Button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {/* Retry Button (for failed payments) - Requirement 2.3 */}
          {(type === 'failed' || type === 'cancelled' || type === 'timeout') && onRetry && (
            <button
              onClick={onRetry}
              className="text-red-500 hover:text-red-700 transition-colors p-1 rounded"
              title="Retry payment"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          
          {/* Refresh Button (for processing payments) - Requirement 2.5 */}
          {type === 'processing' && onRefresh && timeElapsed > 15 && (
            <button
              onClick={onRefresh}
              className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded"
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          
          {/* External Link for M-Pesa Support (for failed M-Pesa payments) */}
          {type === 'failed' && payment.method === 'mpesa' && (
            <button
              onClick={() => window.open('https://www.safaricom.co.ke/personal/m-pesa/getting-started/m-pesa-rates-tariffs', '_blank')}
              className="text-green-500 hover:text-green-700 transition-colors p-1 rounded"
              title="M-Pesa Help"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmation;