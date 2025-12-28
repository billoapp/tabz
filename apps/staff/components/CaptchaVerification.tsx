'use client';

import React, { useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface CaptchaVerificationProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
}

export default function CaptchaVerification({ 
  onVerify, 
  onError, 
  onExpire 
}: CaptchaVerificationProps) {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const captchaRef = React.useRef<HCaptcha>(null);

  const onLoad = () => {
    setLoading(false);
  };

  const onVerifyCaptcha = (token: string) => {
    setToken(token);
    onVerify(token);
  };

  const onErrorCaptcha = (error: string) => {
    console.error('hCaptcha error:', error);
    setToken('');
    if (onError) onError(error);
  };

  const onExpireCaptcha = () => {
    console.log('hCaptcha expired');
    setToken('');
    if (onExpire) onExpire();
  };

  const resetCaptcha = () => {
    if (captchaRef.current) {
      captchaRef.current.resetCaptcha();
    }
    setToken('');
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="mb-2 text-center">
          <p className="text-sm text-gray-600">Please verify you're human</p>
        </div>
        
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        )}
        
        <HCaptcha
          ref={captchaRef}
          sitekey={process.env.PUBLIC_HCAPTCHA_SITE_KEY || ''}
          onLoad={onLoad}
          onVerify={onVerifyCaptcha}
          onError={onErrorCaptcha}
          onExpire={onExpireCaptcha}
        />
        
        {token && (
          <div className="mt-3 flex items-center justify-center">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verification successful
            </div>
          </div>
        )}
      </div>
      
      {token && (
        <button
          onClick={resetCaptcha}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Reset verification
        </button>
      )}
    </div>
  );
}
