/**
 * M-PESA Environment Switcher Component
 * Provides environment switching with safety checks
 */

'use client';

import React, { useState } from 'react';
import { AlertTriangle, Shield, TestTube, Globe } from 'lucide-react';

interface EnvironmentSwitcherProps {
  currentEnvironment: 'sandbox' | 'production';
  hasCredentials: boolean;
  isValidated: boolean;
  onEnvironmentChange: (environment: 'sandbox' | 'production') => void;
}

export default function EnvironmentSwitcher({
  currentEnvironment,
  hasCredentials,
  isValidated,
  onEnvironmentChange
}: EnvironmentSwitcherProps) {
  const [showProductionWarning, setShowProductionWarning] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const handleEnvironmentClick = (environment: 'sandbox' | 'production') => {
    if (environment === currentEnvironment) return;

    if (environment === 'production') {
      setShowProductionWarning(true);
      setConfirmationText('');
    } else {
      onEnvironmentChange(environment);
    }
  };

  const handleProductionConfirm = () => {
    if (confirmationText.toLowerCase() === 'production') {
      onEnvironmentChange('production');
      setShowProductionWarning(false);
      setConfirmationText('');
    }
  };

  const handleProductionCancel = () => {
    setShowProductionWarning(false);
    setConfirmationText('');
  };

  const getEnvironmentStatus = (env: 'sandbox' | 'production') => {
    if (env === currentEnvironment) {
      return {
        color: env === 'production' ? 'green' : 'orange',
        text: 'Active',
        icon: env === 'production' ? <Globe size={16} /> : <TestTube size={16} />
      };
    }
    return {
      color: 'gray',
      text: 'Inactive',
      icon: env === 'production' ? <Globe size={16} /> : <TestTube size={16} />
    };
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Environment Selection
          </label>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Sandbox Environment */}
            <button
              onClick={() => handleEnvironmentClick('sandbox')}
              className={`p-4 rounded-lg text-left transition border-2 ${
                currentEnvironment === 'sandbox'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TestTube size={18} className={
                    currentEnvironment === 'sandbox' ? 'text-orange-600' : 'text-gray-500'
                  } />
                  <span className="font-medium text-gray-800">Sandbox</span>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentEnvironment === 'sandbox'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {getEnvironmentStatus('sandbox').text}
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Safe testing environment with no real money transactions
              </p>
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  currentEnvironment === 'sandbox' ? 'bg-orange-500' : 'bg-gray-400'
                }`}></div>
                <span className="text-gray-500">Test credentials required</span>
              </div>
            </button>

            {/* Production Environment */}
            <button
              onClick={() => handleEnvironmentClick('production')}
              className={`p-4 rounded-lg text-left transition border-2 ${
                currentEnvironment === 'production'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Globe size={18} className={
                    currentEnvironment === 'production' ? 'text-green-600' : 'text-gray-500'
                  } />
                  <span className="font-medium text-gray-800">Production</span>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentEnvironment === 'production'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {getEnvironmentStatus('production').text}
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Live environment processing real money transactions
              </p>
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  currentEnvironment === 'production' ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span className="text-gray-500">Live credentials required</span>
              </div>
            </button>
          </div>
        </div>

        {/* Environment Status Information */}
        <div className={`p-3 rounded-lg border ${
          currentEnvironment === 'production'
            ? 'border-green-200 bg-green-50'
            : 'border-orange-200 bg-orange-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className={
              currentEnvironment === 'production' ? 'text-green-600' : 'text-orange-600'
            } />
            <span className="text-sm font-medium">
              Current: {currentEnvironment === 'production' ? 'Production' : 'Sandbox'} Mode
            </span>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${hasCredentials ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Credentials: {hasCredentials ? 'Configured' : 'Missing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isValidated ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span>Validation: {isValidated ? 'Passed' : 'Pending'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Warning Modal */}
      {showProductionWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Switch to Production?</h3>
                <p className="text-sm text-gray-600">This will process real money transactions</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium mb-2">⚠️ Production Environment Warnings:</p>
                <ul className="text-xs text-red-700 space-y-1 ml-4">
                  <li>• Real money will be processed</li>
                  <li>• All transactions are final</li>
                  <li>• Ensure callback URLs are accessible</li>
                  <li>• Monitor transactions carefully</li>
                  <li>• Have support procedures ready</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type "production" to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="production"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleProductionCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProductionConfirm}
                  disabled={confirmationText.toLowerCase() !== 'production'}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Switch to Production
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}