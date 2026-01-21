/**
 * M-PESA Credential Validation Component
 * Provides credential validation and testing functionality
 */

'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, Shield, TestTube } from 'lucide-react';

interface CredentialValidationProps {
  barId: string;
  environment: 'sandbox' | 'production';
  businessShortcode: string;
  hasCredentials: boolean;
  onValidationComplete: (result: ValidationResult) => void;
}

interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
}

export default function CredentialValidation({
  barId,
  environment,
  businessShortcode,
  hasCredentials,
  onValidationComplete
}: CredentialValidationProps) {
  const [testing, setTesting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<ValidationResult | null>(null);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);

  const handleTestCredentials = async () => {
    if (!hasCredentials || !businessShortcode) {
      const result = {
        success: false,
        message: 'Please save your credentials first before testing'
      };
      setLastTestResult(result);
      onValidationComplete(result);
      return;
    }

    setTesting(true);
    setLastTestResult(null);

    try {
      console.log('🧪 Testing M-PESA credentials...');
      
      const response = await fetch('/api/payments/mpesa/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barId })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const successResult = {
          success: true,
          message: `Credentials validated successfully for ${environment} environment`,
          details: {
            environment: result.environment,
            businessShortcode: result.businessShortcode
          }
        };
        setLastTestResult(successResult);
        setLastTestTime(new Date());
        onValidationComplete(successResult);
      } else {
        const errorResult = {
          success: false,
          message: result.error || 'Credential validation failed',
          details: result.details
        };
        setLastTestResult(errorResult);
        setLastTestTime(new Date());
        onValidationComplete(errorResult);
      }
    } catch (error) {
      console.error('❌ Credential test error:', error);
      const errorResult = {
        success: false,
        message: 'Network error during credential validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      setLastTestResult(errorResult);
      setLastTestTime(new Date());
      onValidationComplete(errorResult);
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = () => {
    if (!lastTestResult) return 'gray';
    return lastTestResult.success ? 'green' : 'red';
  };

  const getStatusIcon = () => {
    if (testing) return <Loader className="animate-spin" size={16} />;
    if (!lastTestResult) return <TestTube size={16} />;
    return lastTestResult.success ? 
      <CheckCircle size={16} className="text-green-600" /> : 
      <AlertCircle size={16} className="text-red-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Test Button */}
      <div className="flex gap-3">
        <button
          onClick={handleTestCredentials}
          disabled={testing || !hasCredentials}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition ${
            testing || !hasCredentials
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {getStatusIcon()}
          {testing ? 'Testing Connection...' : 'Test Credentials'}
        </button>

        {hasCredentials && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 ${
            getStatusColor() === 'green' 
              ? 'border-green-200 bg-green-50 text-green-700'
              : getStatusColor() === 'red'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}>
            <Shield size={16} />
            <span className="text-sm font-medium">
              {getStatusColor() === 'green' ? 'Validated' : 
               getStatusColor() === 'red' ? 'Failed' : 'Untested'}
            </span>
          </div>
        )}
      </div>

      {/* Test Result Display */}
      {lastTestResult && (
        <div className={`p-4 rounded-lg border ${
          lastTestResult.success
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-start gap-3">
            {lastTestResult.success ? (
              <CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                lastTestResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {lastTestResult.message}
              </p>
              
              {lastTestResult.details && (
                <div className="mt-2 text-sm opacity-80">
                  {typeof lastTestResult.details === 'string' ? (
                    <p>{lastTestResult.details}</p>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {JSON.stringify(lastTestResult.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              
              {lastTestTime && (
                <p className="text-xs mt-2 opacity-60">
                  Tested: {lastTestTime.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Environment-specific Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">
              {environment === 'sandbox' ? 'Sandbox Testing' : 'Production Environment'}
            </p>
            {environment === 'sandbox' ? (
              <ul className="text-xs space-y-1 ml-2">
                <li>• Use test phone numbers: 254708374149, 254711XXXXXX</li>
                <li>• Test amounts: 1-1000 KES recommended</li>
                <li>• No real money is processed</li>
                <li>• Callbacks may be delayed in sandbox</li>
              </ul>
            ) : (
              <ul className="text-xs space-y-1 ml-2">
                <li>• Real money transactions will be processed</li>
                <li>• Ensure callback URLs are accessible</li>
                <li>• Monitor transaction logs carefully</li>
                <li>• Have rollback procedures ready</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}