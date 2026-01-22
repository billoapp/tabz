/**
 * Enhanced M-PESA Settings Component
 * Integrates credential validation, environment switching, production readiness, and transaction monitoring
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Settings, BarChart3, Shield, Save, AlertCircle } from 'lucide-react';
import CredentialValidation from './CredentialValidation';
import EnvironmentSwitcher from './EnvironmentSwitcher';
import ProductionReadinessChecklist from './ProductionReadinessChecklist';
import TransactionMonitor from './TransactionMonitor';

interface MpesaSettings {
  mpesa_enabled: boolean;
  mpesa_environment: 'sandbox' | 'production';
  mpesa_business_shortcode: string;
  mpesa_consumer_key: string;
  mpesa_consumer_secret: string;
  mpesa_passkey: string;
  mpesa_setup_completed: boolean;
  mpesa_last_test_at: string | null;
  mpesa_test_status: 'pending' | 'success' | 'failed';
  has_credentials: boolean;
}

interface EnhancedMpesaSettingsProps {
  barId: string;
  initialSettings?: Partial<MpesaSettings>;
}

export default function EnhancedMpesaSettings({ 
  barId, 
  initialSettings = {} 
}: EnhancedMpesaSettingsProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'monitoring' | 'readiness'>('settings');
  const [settings, setSettings] = useState<MpesaSettings>({
    mpesa_enabled: false,
    mpesa_environment: 'sandbox',
    mpesa_business_shortcode: '',
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_passkey: '',
    mpesa_setup_completed: false,
    mpesa_last_test_at: null,
    mpesa_test_status: 'pending',
    has_credentials: false,
    ...initialSettings
  });

  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [barId]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/mpesa-settings?barId=${barId}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Error loading M-PESA settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    // Validate required fields
    if (settings.mpesa_enabled) {
      if (!settings.mpesa_business_shortcode || 
          !settings.mpesa_consumer_key || 
          !settings.mpesa_consumer_secret || 
          !settings.mpesa_passkey) {
        alert('❌ All M-PESA credentials are required when M-PESA is enabled.');
        return;
      }

      // Validate business shortcode format
      if (!/^\d{5,7}$/.test(settings.mpesa_business_shortcode)) {
        alert('❌ Business shortcode must be 5-7 digits.');
        return;
      }
    }

    setSaving(true);

    try {
      const response = await fetch('/api/mpesa-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barId,
          mpesa_enabled: settings.mpesa_enabled,
          mpesa_environment: settings.mpesa_environment,
          mpesa_business_shortcode: settings.mpesa_business_shortcode,
          mpesa_consumer_key: settings.mpesa_consumer_key,
          mpesa_consumer_secret: settings.mpesa_consumer_secret,
          mpesa_passkey: settings.mpesa_passkey
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('✅ M-PESA settings saved successfully!');
        await loadSettings(); // Reload to get masked credentials
      } else {
        alert('❌ Failed to save M-PESA settings: ' + (result.error || 'Please try again.'));
      }
    } catch (error) {
      console.error('Error saving M-PESA settings:', error);
      alert('❌ Failed to save M-PESA settings: ' + (error instanceof Error ? error.message : 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleValidationComplete = (result: { success: boolean; message: string }) => {
    setValidationResult(result);
    if (result.success) {
      setSettings(prev => ({
        ...prev,
        mpesa_setup_completed: true,
        mpesa_test_status: 'success',
        mpesa_last_test_at: new Date().toISOString()
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        mpesa_setup_completed: false,
        mpesa_test_status: 'failed'
      }));
    }
  };

  const handleEnvironmentChange = (environment: 'sandbox' | 'production') => {
    setSettings(prev => ({
      ...prev,
      mpesa_environment: environment,
      mpesa_setup_completed: false, // Reset validation when environment changes
      mpesa_test_status: 'pending'
    }));
    setValidationResult(null);
  };

  const tabs = [
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: <Settings size={20} />,
      description: 'Configure credentials and environment'
    },
    {
      id: 'monitoring' as const,
      label: 'Monitoring',
      icon: <BarChart3 size={20} />,
      description: 'View transaction history and stats'
    },
    {
      id: 'readiness' as const,
      label: 'Production Readiness',
      icon: <Shield size={20} />,
      description: 'Check deployment readiness'
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <Phone size={24} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">M-PESA Integration</h2>
            <p className="text-sm text-gray-600">
              Configure and monitor M-PESA payments with comprehensive management tools
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className={`p-3 rounded-lg border ${
          settings.mpesa_setup_completed && settings.mpesa_enabled
            ? 'border-green-200 bg-green-50'
            : settings.has_credentials
            ? 'border-yellow-200 bg-yellow-50'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              settings.mpesa_setup_completed && settings.mpesa_enabled
                ? 'bg-green-500'
                : settings.has_credentials
                ? 'bg-yellow-500'
                : 'bg-gray-400'
            }`}></div>
            <span className="text-sm font-medium">
              {settings.mpesa_setup_completed && settings.mpesa_enabled
                ? `M-PESA Active (${settings.mpesa_environment})`
                : settings.has_credentials
                ? 'Setup Required'
                : 'Not Configured'}
            </span>
            {settings.mpesa_last_test_at && (
              <span className="text-xs text-gray-500 ml-auto">
                Last tested: {new Date(settings.mpesa_last_test_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <div className="text-left">
                <div>{tab.label}</div>
                <div className="text-xs opacity-75">{tab.description}</div>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Environment Switcher */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Environment Configuration</h3>
              <EnvironmentSwitcher
                currentEnvironment={settings.mpesa_environment}
                hasCredentials={settings.has_credentials}
                isValidated={settings.mpesa_setup_completed}
                onEnvironmentChange={handleEnvironmentChange}
              />
            </div>

            {/* Credentials Form */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Credentials</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Shortcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.mpesa_business_shortcode}
                    onChange={(e) => setSettings({...settings, mpesa_business_shortcode: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                    placeholder="e.g., 174379"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your PayBill or Till number from Daraja</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consumer Key <span className="text-red-500">*</span>
                    {settings.mpesa_consumer_key === '••••••••••••••••' && (
                      <span className="ml-2 text-xs text-green-600 font-medium">✓ Saved</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={settings.mpesa_consumer_key}
                    onChange={(e) => setSettings({...settings, mpesa_consumer_key: e.target.value})}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:border-green-500 focus:outline-none ${
                      settings.mpesa_consumer_key === '••••••••••••••••' 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200'
                    }`}
                    placeholder={settings.mpesa_consumer_key === '••••••••••••••••' 
                      ? 'Credential saved securely' 
                      : 'Enter your Daraja Consumer Key'
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consumer Secret <span className="text-red-500">*</span>
                    {settings.mpesa_consumer_secret === '••••••••••••••••' && (
                      <span className="ml-2 text-xs text-green-600 font-medium">✓ Saved</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={settings.mpesa_consumer_secret}
                    onChange={(e) => setSettings({...settings, mpesa_consumer_secret: e.target.value})}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:border-green-500 focus:outline-none ${
                      settings.mpesa_consumer_secret === '••••••••••••••••' 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200'
                    }`}
                    placeholder={settings.mpesa_consumer_secret === '••••••••••••••••' 
                      ? 'Credential saved securely' 
                      : 'Enter your Daraja Consumer Secret'
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Passkey <span className="text-red-500">*</span>
                    {settings.mpesa_passkey === '••••••••••••••••' && (
                      <span className="ml-2 text-xs text-green-600 font-medium">✓ Saved</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={settings.mpesa_passkey}
                    onChange={(e) => setSettings({...settings, mpesa_passkey: e.target.value})}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:border-green-500 focus:outline-none ${
                      settings.mpesa_passkey === '••••••••••••••••' 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200'
                    }`}
                    placeholder={settings.mpesa_passkey === '••••••••••••••••' 
                      ? 'Credential saved securely' 
                      : 'Enter your Daraja Passkey'
                    }
                  />
                </div>
              </div>

              {/* Information Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How to get Daraja credentials:</p>
                    <ul className="text-xs space-y-1 ml-2">
                      <li>• Visit <a href="https://developer.safaricom.co.ke" target="_blank" className="underline">developer.safaricom.co.ke</a></li>
                      <li>• Create an account and log in</li>
                      <li>• Create a new app and select "Lipa Na M-Pesa Online"</li>
                      <li>• Copy the Consumer Key, Consumer Secret, and Passkey</li>
                      <li>• Use your PayBill or Till number as Business Shortcode</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>

            {/* Credential Validation */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Validation & Testing</h3>
              <CredentialValidation
                barId={barId}
                environment={settings.mpesa_environment}
                businessShortcode={settings.mpesa_business_shortcode}
                hasCredentials={settings.has_credentials}
                onValidationComplete={handleValidationComplete}
              />
            </div>

            {/* Enable M-PESA Toggle */}
            {settings.mpesa_setup_completed && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Activation</h3>
                <label className="flex items-center justify-between p-4 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition border border-green-200">
                  <div className="flex items-center gap-3">
                    <Phone size={20} className="text-green-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Enable M-PESA Payments</span>
                      <p className="text-xs text-gray-500">Allow customers to pay via M-PESA</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mpesa_enabled}
                    onChange={(e) => setSettings({...settings, mpesa_enabled: e.target.checked})}
                    className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Transaction Monitoring</h3>
            <TransactionMonitor barId={barId} />
          </div>
        )}

        {activeTab === 'readiness' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Production Deployment Readiness</h3>
            <ProductionReadinessChecklist
              barId={barId}
              environment={settings.mpesa_environment}
              hasCredentials={settings.has_credentials}
              isValidated={settings.mpesa_setup_completed}
            />
          </div>
        )}
      </div>
    </div>
  );
}