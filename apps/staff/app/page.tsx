'use client';

import React, { useState, useEffect } from 'react';
import { BellRing } from 'lucide-react';

export default function TabsPage() {
  const [showAlert, setShowAlert] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const handleTestClick = () => {
    console.log('🔔 Button clicked! Count:', clickCount + 1);
    setClickCount(prev => prev + 1);
    setShowAlert(true);
    
    setTimeout(() => {
      setShowAlert(false);
    }, 3000);
  };

  console.log('📱 Component rendered, showAlert:', showAlert, 'clickCount:', clickCount);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-orange-500 text-white p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Test Alert System</h1>
          <button 
            onClick={handleTestClick}
            className="p-3 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30"
            title="Test Alert"
          >
            <BellRing size={24} />
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Debug Info:</h2>
          <div className="space-y-2">
            <p>🔔 Button clicks: <strong>{clickCount}</strong></p>
            <p>🚨 Alert visible: <strong>{showAlert ? 'YES' : 'NO'}</strong></p>
            <p>🔄 Component renders: <strong>{clickCount + 1}</strong></p>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-bold mb-2">Instructions:</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Click the bell icon in the header</li>
              <li>Check if number increases above</li>
              <li>Open browser console (F12) to see logs</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Simple alert overlay for testing */}
      {showAlert && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => setShowAlert(false)}
        >
          <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-3xl p-8 max-w-lg text-center">
            <div className="bg-white rounded-full p-6 mb-6 inline-block">
              <BellRing size={80} className="text-red-600 animate-bounce" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">🚨 TEST ALERT! 🚨</h1>
            <p className="text-xl text-white mb-6">This is a test alert overlay</p>
            <p className="text-white">Click anywhere to dismiss</p>
          </div>
        </div>
      )}
    </div>
  );
}