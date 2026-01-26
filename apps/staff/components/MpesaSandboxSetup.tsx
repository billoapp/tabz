'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Key, Phone, Info, ExternalLink } from 'lucide-react';

interface MpesaSandboxSetupProps {
  barData: {
    mpesa_enabled: boolean;
    mpesa_environment: string;
    mpesa_business_shortcode: string;
    mpesa_consumer_key_encrypted: string | null;
    mpesa_consumer_secret_encrypted: string | null;
    mpesa_passkey_encrypted: string | null;
    mpesa_callback_url: string | null;
  };
}

export default function MpesaSandboxSetup({ barData }: MpesaSandboxSetupProps) {
  if (!barData.mpesa_enabled || barData.mpesa_environment !== 'sandbox') {
    return null;
  }

  const hasConsumerKey = barData.mpesa_consumer_key_encrypted && 
    barData.mpesa_consumer_key_encrypted !== 'test_encrypted_value';
  const hasConsumerSecret = barData.mpesa_consumer_secret_encrypted && 
    barData.mpesa_consumer_secret_encrypted !== 'test_encrypted_value';
  const isFullyConfigured = hasConsumerKey && hasConsumerSecret;

  return (
    <div className="space-y-4">
      {/* Auto-Setup Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 mb-2">M-Pesa Sandbox Auto-Setup</h4>
            <p className="text-sm text-blue-700 mb-3">
              We've automatically configured your sandbox defaults. You only need to add your Safaricom API keys.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Business Shortcode: {barData.mpesa_business_shortcode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Passkey: Auto-configured</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Callback URL: Set</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Environment: Sandbox</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What Still Needs Setup */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Key size={20} className="text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-800 mb-2">Required: Add Your Safaricom API Keys</h4>
            <p className="text-sm text-yellow-700 mb-3">
              Get these from your Safaricom Developer Portal account:
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                {hasConsumerKey ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-red-500" />
                )}
                <span className={hasConsumerKey ? 'text-green-700' : 'text-red-700'}>
                  Consumer Key {hasConsumerKey ? '(Configured)' : '(Required)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasConsumerSecret ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-red-500" />
                )}
                <span className={hasConsumerSecret ? 'text-green-700' : 'text-red-700'}>
                  Consumer Secret {hasConsumerSecret ? '(Configured)' : '(Required)'}
                </span>
              </div>
            </div>

            <a 
              href="https://developer.safaricom.co.ke/MyApps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <ExternalLink size={14} />
              Get API Keys from Safaricom Developer Portal
            </a>
          </div>
        </div>
      </div>

      {/* Test Phone Number & PIN Notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Phone size={20} className="text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-800 mb-2">Sandbox Testing Information</h4>
            <div className="text-sm text-green-700 space-y-2">
              <div>
                <span className="font-medium">Test Phone Number:</span>
                <span className="ml-2 font-mono bg-green-100 px-2 py-1 rounded">254708374149</span>
              </div>
              <div>
                <span className="font-medium">Test PIN:</span>
                <span className="ml-2 font-mono bg-green-100 px-2 py-1 rounded">1234</span>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Use these credentials when testing M-Pesa payments in sandbox mode.
                Real money is not involved in sandbox testing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Complete Status */}
      {isFullyConfigured && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <h4 className="font-medium text-green-800">M-Pesa Sandbox Ready!</h4>
              <p className="text-sm text-green-700 mt-1">
                Your M-Pesa integration is fully configured and ready for testing.
                Customers can now make payments using the test credentials above.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}