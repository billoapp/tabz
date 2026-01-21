/**
 * M-PESA Error Reporting and Resolution Guidance Component
 * Provides detailed error analysis and resolution steps
 */

'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Book, MessageSquare } from 'lucide-react';

interface ErrorReportingProps {
  transactionId?: string;
  errorCode?: number;
  errorMessage?: string;
  environment: 'sandbox' | 'production';
}

interface ErrorResolution {
  code: number;
  title: string;
  description: string;
  category: 'user' | 'system' | 'network' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionSteps: string[];
  preventionTips?: string[];
  documentationUrl?: string;
}

const ERROR_RESOLUTIONS: ErrorResolution[] = [
  {
    code: 0,
    title: 'Success',
    description: 'Transaction completed successfully',
    category: 'user',
    severity: 'low',
    resolutionSteps: ['No action required - transaction successful'],
    preventionTips: ['Continue normal operations']
  },
  {
    code: 1,
    title: 'Insufficient Funds',
    description: 'Customer does not have enough balance in their M-PESA account',
    category: 'user',
    severity: 'medium',
    resolutionSteps: [
      'Inform customer about insufficient funds',
      'Suggest customer tops up their M-PESA account',
      'Offer alternative payment methods',
      'Allow customer to retry payment after top-up'
    ],
    preventionTips: [
      'Display clear payment amount before initiating',
      'Provide balance check guidance to customers',
      'Offer multiple payment options'
    ]
  },
  {
    code: 17,
    title: 'Invalid Phone Number',
    description: 'The phone number provided is not valid or not registered with M-PESA',
    category: 'user',
    severity: 'medium',
    resolutionSteps: [
      'Verify phone number format (254XXXXXXXXX)',
      'Confirm customer has M-PESA account',
      'Ask customer to double-check their number',
      'Ensure number is active and registered'
    ],
    preventionTips: [
      'Implement real-time phone number validation',
      'Show format examples (254XXXXXXXXX)',
      'Add confirmation step for phone numbers'
    ]
  },
  {
    code: 26,
    title: 'System Malfunction',
    description: 'M-PESA system is experiencing technical difficulties',
    category: 'system',
    severity: 'high',
    resolutionSteps: [
      'Wait 5-10 minutes and retry',
      'Check Safaricom system status',
      'Inform customer about temporary system issues',
      'Offer alternative payment methods',
      'Monitor for system recovery'
    ],
    preventionTips: [
      'Implement automatic retry logic',
      'Set up system status monitoring',
      'Have backup payment methods ready'
    ],
    documentationUrl: 'https://developer.safaricom.co.ke/docs'
  },
  {
    code: 1001,
    title: 'Unable to Lock Subscriber',
    description: 'Customer\'s account is temporarily locked or busy',
    category: 'user',
    severity: 'medium',
    resolutionSteps: [
      'Ask customer to wait 2-3 minutes',
      'Ensure customer is not using M-PESA elsewhere',
      'Retry the transaction',
      'Contact customer support if persistent'
    ],
    preventionTips: [
      'Educate customers about single-session usage',
      'Implement retry mechanisms with delays'
    ]
  },
  {
    code: 1019,
    title: 'Transaction Expired',
    description: 'Customer did not respond to STK push prompt in time',
    category: 'user',
    severity: 'medium',
    resolutionSteps: [
      'Inform customer about timeout (usually 60 seconds)',
      'Ask customer to be ready before initiating payment',
      'Retry the transaction',
      'Ensure customer\'s phone is active and has signal'
    ],
    preventionTips: [
      'Set clear expectations about response time',
      'Send SMS notifications about pending payments',
      'Implement longer timeout periods if possible'
    ]
  },
  {
    code: 1032,
    title: 'Request Cancelled by User',
    description: 'Customer cancelled the payment request on their phone',
    category: 'user',
    severity: 'low',
    resolutionSteps: [
      'Confirm if customer intended to cancel',
      'Offer to retry the payment',
      'Provide alternative payment methods',
      'No technical action required'
    ],
    preventionTips: [
      'Provide clear payment instructions',
      'Explain the payment process to customers',
      'Offer customer support during payment'
    ]
  },
  {
    code: 2001,
    title: 'Invalid Credentials',
    description: 'M-PESA API credentials are invalid or expired',
    category: 'configuration',
    severity: 'critical',
    resolutionSteps: [
      'Verify consumer key and secret in Daraja portal',
      'Check if credentials have expired',
      'Regenerate credentials if necessary',
      'Update credentials in system',
      'Test credentials with validation endpoint'
    ],
    preventionTips: [
      'Set up credential expiry monitoring',
      'Implement automatic credential validation',
      'Keep backup credentials ready'
    ],
    documentationUrl: 'https://developer.safaricom.co.ke/docs/authentication'
  }
];

export default function ErrorReporting({
  transactionId,
  errorCode,
  errorMessage,
  environment
}: ErrorReportingProps) {
  const [selectedError, setSelectedError] = useState<ErrorResolution | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);

  // Find resolution for current error
  const currentResolution = errorCode ? 
    ERROR_RESOLUTIONS.find(r => r.code === errorCode) : null;

  const getSeverityColor = (severity: ErrorResolution['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category: ErrorResolution['category']) => {
    switch (category) {
      case 'user':
        return '👤';
      case 'system':
        return '⚙️';
      case 'network':
        return '🌐';
      case 'configuration':
        return '🔧';
      default:
        return '❓';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Error Analysis */}
      {currentResolution && (
        <div className={`p-4 rounded-lg border ${getSeverityColor(currentResolution.severity)}`}>
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold">Error {errorCode}: {currentResolution.title}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50">
                  {getCategoryIcon(currentResolution.category)} {currentResolution.category}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50">
                  {currentResolution.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm mb-3">{currentResolution.description}</p>
              
              {transactionId && (
                <p className="text-xs font-mono mb-3">Transaction ID: {transactionId}</p>
              )}
              
              {errorMessage && (
                <p className="text-xs mb-3">Original Message: {errorMessage}</p>
              )}
            </div>
          </div>

          {/* Resolution Steps */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Resolution Steps:</h4>
            <ol className="text-sm space-y-1">
              {currentResolution.resolutionSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-white bg-opacity-50 rounded-full text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Prevention Tips */}
          {currentResolution.preventionTips && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">Prevention Tips:</h4>
              <ul className="text-sm space-y-1">
                {currentResolution.preventionTips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Documentation Link */}
          {currentResolution.documentationUrl && (
            <a
              href={currentResolution.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm hover:underline"
            >
              <Book size={14} />
              View Documentation
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* Error Reference Guide */}
      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Error Reference Guide</h3>
            <button
              onClick={() => setShowAllErrors(!showAllErrors)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {showAllErrors ? 'Hide Guide' : 'Show All Errors'}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Common M-PESA error codes and their resolutions
          </p>
        </div>

        {showAllErrors && (
          <div className="p-4">
            <div className="grid gap-3">
              {ERROR_RESOLUTIONS.map((resolution) => (
                <div
                  key={resolution.code}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedError?.code === resolution.code
                      ? getSeverityColor(resolution.severity)
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedError(
                    selectedError?.code === resolution.code ? null : resolution
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        {resolution.code}
                      </span>
                      <span className="font-medium">{resolution.title}</span>
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                        {getCategoryIcon(resolution.category)} {resolution.category}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getSeverityColor(resolution.severity).split(' ')[1] + ' ' + 
                      getSeverityColor(resolution.severity).split(' ')[2]
                    }`}>
                      {resolution.severity.toUpperCase()}
                    </span>
                  </div>
                  
                  {selectedError?.code === resolution.code && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm mb-3">{resolution.description}</p>
                      <div className="text-sm">
                        <strong>Quick Resolution:</strong>
                        <ul className="mt-1 ml-4 space-y-1">
                          {resolution.resolutionSteps.slice(0, 2).map((step, index) => (
                            <li key={index} className="list-disc">{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Environment-Specific Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <MessageSquare size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">
              {environment === 'sandbox' ? 'Sandbox Environment Notes' : 'Production Environment Notes'}
            </p>
            {environment === 'sandbox' ? (
              <ul className="text-xs space-y-1 ml-2">
                <li>• Some errors may behave differently in sandbox</li>
                <li>• Use test phone numbers: 254708374149, 254711XXXXXX</li>
                <li>• Callbacks may be delayed or inconsistent</li>
                <li>• Not all error codes are available in sandbox</li>
              </ul>
            ) : (
              <ul className="text-xs space-y-1 ml-2">
                <li>• All errors represent real customer issues</li>
                <li>• Monitor error rates and patterns closely</li>
                <li>• Have customer support procedures ready</li>
                <li>• Document and escalate persistent issues</li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Support Contact */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">Need Additional Help?</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <p>If you're experiencing persistent issues or need additional support:</p>
          <ul className="ml-4 space-y-1">
            <li>• Check <a href="https://developer.safaricom.co.ke" target="_blank" className="text-blue-600 hover:underline">Safaricom Developer Portal</a></li>
            <li>• Review transaction logs for patterns</li>
            <li>• Contact Safaricom support for API issues</li>
            <li>• Document error frequency and customer impact</li>
          </ul>
        </div>
      </div>
    </div>
  );
}