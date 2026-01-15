'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

export default function PWATestButton() {
  const [showBanner, setShowBanner] = useState(false);

  // Only show in development or preview
  const shouldShow = process.env.NODE_ENV === 'development' || 
                    (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));

  if (!shouldShow) return null;

  return (
    <>
      {/* Test Button */}
      <button
        onClick={() => setShowBanner(!showBanner)}
        className="fixed bottom-4 left-4 z-50 bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
        title="Test PWA Install Banner"
      >
        <Download size={20} />
      </button>

      {/* Test Banner */}
      {showBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 p-4">
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow-xl p-4 max-w-md mx-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">TEST: Install Tabeza App</h3>
                <p className="text-sm text-green-100">
                  This is a test banner to verify rendering works
                </p>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded-full transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="text-xs text-green-200 opacity-75 space-y-1">
              <div>Environment: {process.env.NODE_ENV}</div>
              <div>Hostname: {typeof window !== 'undefined' ? window.location.hostname : 'unknown'}</div>
              <div>Protocol: {typeof window !== 'undefined' ? window.location.protocol : 'unknown'}</div>
              <div>User Agent: {typeof window !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'unknown'}</div>
            </div>
            
            <button
              onClick={() => alert('Test install clicked!')}
              className="w-full mt-3 bg-white text-green-600 font-semibold py-2 px-4 rounded-lg hover:bg-green-50 transition-colors"
            >
              Test Install Button
            </button>
          </div>
        </div>
      )}
    </>
  );
}