'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, CreditCard, Sparkles, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/formatUtils';
import MpesaPayment from '@/components/MpesaPayment';
import { useToast } from '@/components/ui/Toast';

export default function PaymentPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [currentTab, setCurrentTab] = useState<any>(null);
  const [showMpesaPayment, setShowMpesaPayment] = useState(false);
  const { showToast } = useToast();

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
      setCurrentTab(JSON.parse(tabData));
    } else {
      // Redirect to home if no tab found
      router.push('/');
    }
  }, [router]);

  const tabTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = tabTotal - paidTotal;

  useEffect(() => {
    setPaymentAmount(balance.toString());
  }, [balance]);

  const processPayment = () => {
    if (paymentMethod === 'mpesa') {
      setShowMpesaPayment(true);
    } else {
      // Show coming soon message for other payment methods
      showToast({
        type: 'info',
        title: 'Coming Soon',
        message: 'This payment method will be available soon!'
      });
    }
  };

  const handleMpesaPaymentSuccess = (receiptNumber: string) => {
    showToast({
      type: 'success',
      title: 'Payment Successful!',
      message: `Your payment has been processed. Receipt: ${receiptNumber}`,
      duration: 10000
    });
    
    // Refresh the page data or redirect to tab
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
    setShowMpesaPayment(false);
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

        {/* Coming Soon Notice */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Digital Payments Coming Soon!</h2>
              <p className="text-purple-100">Exciting things are in the works</p>
            </div>
          </div>
          
          <p className="text-white text-sm leading-relaxed mb-4">
            We're working hard to bring you seamless digital payment options directly in the app. 
            Soon you'll be able to pay instantly using M-Pesa, Airtel Money, and Credit Cards.
          </p>
        </div>

        {/* Current Payment Instructions */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock size={20} className="text-orange-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">How to Pay Now</h3>
          </div>
          
          <div className="space-y-3">
            <p className="text-gray-600 leading-relaxed">
              For now, please pay directly at the bar using your preferred payment method:
            </p>
            
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <p className="text-sm font-medium text-orange-800 mb-2">Accepted at the bar:</p>
              <ul className="space-y-1 text-sm text-orange-700">
                <li>• Cash (KES)</li>
                <li>• M-Pesa (direct to staff)</li>
                <li>• Credit/Debit Cards</li>
                <li>• Airtel Money</li>
              </ul>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              Staff will mark your payment as received and update your tab automatically.
            </p>
          </div>
        </div>

        {/* Payment Method Section */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
          <div className="space-y-2">
            <button
              onClick={() => setPaymentMethod('mpesa')}
              className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                paymentMethod === 'mpesa' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <Phone size={24} className="text-green-600" />
              <div className="text-left">
                <p className="font-semibold">M-Pesa</p>
                <p className="text-sm text-gray-600">Pay with M-Pesa mobile money</p>
              </div>
            </button>
            
            <button
              onClick={() => setPaymentMethod('card')}
              disabled
              className="w-full p-4 rounded-xl border-2 flex items-center gap-3 cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            >
              <CreditCard size={24} className="text-blue-600" />
              <div className="text-left">
                <p className="font-semibold">Credit/Debit Card</p>
                <p className="text-sm text-gray-600">Pay with Card (Coming Soon)</p>
              </div>
            </button>
            
            <button
              onClick={() => setPaymentMethod('airtel')}
              disabled
              className="w-full p-4 rounded-xl border-2 flex items-center gap-3 cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            >
              <Phone size={24} className="text-blue-500" />
              <div className="text-left">
                <p className="font-semibold">Airtel Money</p>
                <p className="text-sm text-gray-600">Pay with Airtel Money (Coming Soon)</p>
              </div>
            </button>
          </div>
        </div>

        {/* Amount Section */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Amount to Pay</label>
          <div className="relative">
            <span className="absolute left-4 top-4 text-gray-500 font-semibold">KSh</span>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-xl font-bold text-lg focus:border-orange-500 focus:outline-none"
              placeholder="0"
              min="1"
              max={balance}
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setPaymentAmount((balance / 2).toString())}
              className="flex-1 py-2 bg-orange-100 hover:bg-orange-200 rounded-lg text-sm font-medium transition-colors"
            >
              Half
            </button>
            <button
              onClick={() => setPaymentAmount(balance.toString())}
              className="flex-1 py-2 bg-orange-100 hover:bg-orange-200 rounded-lg text-sm font-medium transition-colors"
            >
              Full
            </button>
          </div>
        </div>

        {/* M-PESA Payment Interface */}
        {showMpesaPayment && paymentMethod === 'mpesa' && currentTab && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Complete M-PESA Payment</h3>
            <MpesaPayment
              amount={parseFloat(paymentAmount) || balance}
              tabId={currentTab.id}
              onPaymentSuccess={handleMpesaPaymentSuccess}
              onPaymentError={handleMpesaPaymentError}
            />
          </div>
        )}

        {/* Pay Button */}
        {!showMpesaPayment && (
          <button
            onClick={processPayment}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > balance}
            className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {paymentMethod === 'mpesa' ? 'Pay with M-PESA' : 'Process Payment'}
          </button>
        )}
      </div>
    </div>
  );
}