'use client';

import React, { useState, useEffect } from 'react';
import { BellRing } from 'lucide-react';

export default function TestPage() {
  const [showAlert, setShowAlert] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const handleTestClick = () => {
    console.log('🔔 TEST BUTTON CLICKED! Count:', clickCount + 1);
    setClickCount(prev => prev + 1);
    setShowAlert(true);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      console.log('🕒 Auto-hiding alert');
      setShowAlert(false);
    }, 3000);
  };

  console.log('🔄 Component re-rendered. showAlert:', showAlert, 'clickCount:', clickCount);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-orange-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tabeza Staff Dashboard</h1>
            <p className="text-orange-200 text-sm">Test Alert System</p>
          </div>
          <button 
            onClick={handleTestClick}
            className="p-3 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition"
            title="Test Alert"
          >
            <BellRing size={24} />
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Debug Panel:</h2>
          <div className="space-y-2 mb-6">
            <p>🔔 Button clicks: <strong className="text-orange-600">{clickCount}</strong></p>
            <p>🚨 Alert visible: <strong className={showAlert ? 'text-green-600' : 'text-red-600'}>{showAlert ? 'YES' : 'NO'}</strong></p>
            <p>🔄 Component renders: <strong className="text-blue-600">{clickCount + 1}</strong></p>
          </div>
          
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-bold mb-2 text-orange-800">Instructions:</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Click the bell icon in the header above</li>
              <li>You should see the "Alert visible" change to YES</li>
              <li>A full-screen red alert should appear</li>
              <li>Open browser console (F12) to see debug logs</li>
              <li>Alert auto-hides after 3 seconds</li>
            </ol>
          </div>
        </div>
      </div>

      {/* SIMPLE ALERT OVERLAY */}
      {showAlert && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => {
            console.log('👆 Alert clicked, dismissing');
            setShowAlert(false);
          }}
        >
          <div className="bg-gradient-to-br from-orange-600 to-amber-500 rounded-lg p-8 max-w-lg text-center border-4 border-amber-400 shadow-2xl">
            <div className="bg-white rounded-full p-6 mb-6 inline-block animate-bounce">
              <BellRing size={80} className="text-orange-600" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">🚨 ALERT! 🚨</h1>
            <p className="text-xl text-white mb-6">This is a test alert overlay</p>
            <p className="text-white text-sm">Click anywhere or wait 3 seconds</p>
            <div className="mt-4 p-2 bg-black bg-opacity-50 rounded">
              <p className="text-amber-400 font-mono">Auto-hides in 3 seconds</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}