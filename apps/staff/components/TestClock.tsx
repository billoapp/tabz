'use client';

import React from 'react';

interface TestClockProps {
  isVisible: boolean;
  onClose: () => void;
}

const TestClock: React.FC<TestClockProps> = ({ isVisible, onClose }) => {
  console.log('🧪 TestClock rendered:', { isVisible });
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-8 rounded-lg shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">TEST CLOCK</h2>
        <p className="mb-4">If you see this, the overlay works!</p>
        <button 
          onClick={onClose}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default TestClock;
