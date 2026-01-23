'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';
import PaymentTabs from '@/components/PaymentTabs';
import CashPaymentTab from '@/components/CashPaymentTab';
import MpesaPaymentTab from '@/components/MpesaPaymentTab';
import { useToast } from '@/components/ui/Toast';

export default function PaymentPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<any>(null);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const { showToast } = useToast();

  // Tab-based state structure with enhanced isolation
  const [activeTab, setActiveTab] = useState<'cash' | 'mpesa'>('cash');
  const [cashPaymentState, setCashPaymentState] = useState({
    amount: '',
    isProcessing: false,
    hasUserInput: false // Track if user has made changes
  });
  const [mpesaPaymentState, setMpesaPaymentState] = useState({
    amount: '',
    phoneNumber: '',
    showMpesaPayment: false,
    hasUserInput: false, // Track if user has made changes
    phoneValidation: null as any
  });

  useEffect(() => {
    const ordersData = sessionStorage.getItem('orders');
    if (ordersData) {
      setOrders(JSON.parse(ordersData));
    }

    const paymentsData = sessionStorage.getItem('payments');
    if (paymentsData) {
      setPayments(JSON.parse(paymentsData));
    }

    const tabData = sessionStorage.getItem('currentTab');
    if (tabData) {
      const tab = JSON.parse(tabData);
      setCurrentTab(tab);
      
      // Fetch payment settings for this bar
      fetchPaymentSettings(tab.bar_id);
    } else {
      // Redirect to home if no tab found
      router.push('/');
    }
  }, [router]);

  const fetchPaymentSettings = async (barId: string) => {
    try {
      setLoadingSettings(true);
      const response = await fetch(`/api/payment-settings?barId=${barId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment settings');
      }
      
      const data = await response.json();
      setPaymentSettings(data);
      
      // Set default payment method based on availability
      if (data.paymentMethods?.mpesa?.available) {
        setActiveTab('mpesa');
      } else {
        setActiveTab('cash');
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
      showToast({
        type: 'error',
        title: 'Settings Error',
        message: 'Unable to load payment options. Please try again.'
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  const tabTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = tabTotal - paidTotal;

  // Initialize payment amounts when balance changes
  useEffect(() => {
    const balanceString = balance.toString();
    
    // Only set default amounts if user hasn't made changes
    setCashPaymentState(prev => ({ 
      ...prev, 
      amount: prev.hasUserInput ? prev.amount : balanceString 
    }));
    setMpesaPaymentState(prev => ({ 
      ...prev, 
      amount: prev.hasUserInput ? prev.amount : balanceString 
    }));
  }, [balance]);

  // Handle tab switching with comprehensive state isolation
  const handleTabChange = (tab: 'cash' | 'mpesa') => {
    // Don't switch if already on the same tab
    if (tab === activeTab) return;
    
    setActiveTab(tab);
    
    // Clear inactive tab state completely when switching
    if (tab === 'cash') {
      // Switching to cash - clear M-Pesa state completely
      setMpesaPaymentState({
        amount: balance.toString(),
        phoneNumber: '',
        showMpesaPayment: false,
        hasUserInput: false,
        phoneValidation: null
      });
    } else {
      // Switching to M-Pesa - clear cash state completely
      setCashPaymentState({
        amount: balance.toString(),
        isProcessing: false,
        hasUserInput: false
      });
    }
  };

  // Cash payment handlers with state preservation
  const handleCashAmountChange = (amount: string) => {
    setCashPaymentState(prev => ({ 
      ...prev, 
      amount,
      hasUserInput: true // Mark that user has made changes
    }));
  };

  const handleCashPayment = () => {
    setCashPaymentState(prev => ({ ...prev, isProcessing: true }));
    
    // Show success message for cash payment
    showToast({
      type: 'success',
      title: 'Payment Confirmed',
      message: `Please pay ${formatCurrency(parseFloat(cashPaymentState.amount))} at the bar. Staff will update your tab.`,
      duration: 8000
    });
    
    // Reset processing state after a delay
    setTimeout(() => {
      setCashPaymentState(prev => ({ ...prev, isProcessing: false }));
      router.push('/tab');
    }, 2000);
  };

  // M-Pesa payment handlers with state preservation
  const handleMpesaAmountChange = (amount: string) => {
    setMpesaPaymentState(prev => ({ 
      ...prev, 
      amount,
      hasUserInput: true // Mark that user has made changes
    }));
  };

  const handleMpesaPaymentSuccess = (receiptNumber: string) => {
    showToast({
      type: 'success',
      title: 'Payment Successful!',
      message: `Your payment has been processed. Receipt: ${receiptNumber}`,
      duration: 10000
    });
    
    // Reset M-Pesa state completely and redirect
    setMpesaPaymentState({
      amount: balance.toString(),
      phoneNumber: '',
      showMpesaPayment: false,
      hasUserInput: false,
      phoneValidation: null
    });
    
    setTimeout(() => {
      router.push('/tab');
    }, 2000);
  };

  const handleMpesaPaymentError = (error: string) => {
    showToast({
      type: 'error',
      title: 'Payment Failed',
      message: error
    });
    // Only reset the payment interface, preserve other state
    setMpesaPaymentState(prev => ({ ...prev, showMpesaPayment: false }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center gap-3">
        <button onClick={() => router.push('/tab')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Make Payment</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance Info */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
          <p className="text-3xl font-bold text-orange-600">{formatCurrency(balance)}</p>
        </div>

        {/* Loading State */}
        {loadingSettings ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Loading payment options...</span>
            </div>
          </div>
        ) : (
          /* Payment Tabs Interface */
          <PaymentTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            mpesaAvailable={paymentSettings?.paymentMethods?.mpesa?.available || false}
          >
            {activeTab === 'cash' ? (
              <CashPaymentTab
                amount={cashPaymentState.amount}
                onAmountChange={handleCashAmountChange}
                balance={balance}
                onPayment={handleCashPayment}
                isProcessing={cashPaymentState.isProcessing}
              />
            ) : (
              <MpesaPaymentTab
                amount={mpesaPaymentState.amount}
                onAmountChange={handleMpesaAmountChange}
                balance={balance}
                onPaymentSuccess={handleMpesaPaymentSuccess}
                onPaymentError={handleMpesaPaymentError}
                phoneNumber={mpesaPaymentState.phoneNumber}
                onPhoneNumberChange={(phoneNumber) => 
                  setMpesaPaymentState(prev => ({ ...prev, phoneNumber, hasUserInput: true }))
                }
                showMpesaPayment={mpesaPaymentState.showMpesaPayment}
                onShowMpesaPaymentChange={(show) => 
                  setMpesaPaymentState(prev => ({ ...prev, showMpesaPayment: show }))
                }
              />
            )}
          </PaymentTabs>
        )}
      </div>
    </div>
  );
}