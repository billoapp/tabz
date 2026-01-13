'use client';

import React, { useState, useEffect } from 'react';

interface EmojiClockProps {
  isVisible: boolean;
  onClose: () => void;
  type: 'order' | 'message';
}

const EmojiClock: React.FC<EmojiClockProps> = ({ isVisible, onClose, type }) => {
  const [scale, setScale] = useState(0);
  
  useEffect(() => {
    if (isVisible) {
      setScale(1);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setScale(0);
        setTimeout(onClose, 300);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);
  
  // Play system sound when clock appears
  useEffect(() => {
    if (isVisible) {
      playNotificationSound();
    }
  }, [isVisible]);
  
  if (!isVisible) {
    console.log('🧪 EmojiClock: isVisible is false, not rendering');
    return null;
  }
  
  console.log('🧪 EmojiClock: Rendering with type:', type);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div 
        className="text-center"
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.3s ease-out'
        }}
        onClick={onClose}
      >
        <div className="text-9xl mb-4 animate-shake">
          {type === 'order' ? '🕐' : '📬'}
        </div>
        <div className="text-white text-xl font-bold bg-black bg-opacity-50 px-4 py-2 rounded-lg">
          {type === 'order' ? 'New Order!' : 'New Message!'}
        </div>
      </div>
    </div>
  );
};

// System sound function
const playNotificationSound = () => {
  try {
    // Create system beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800Hz beep
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3; // Volume level
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2); // 200ms beep
    
    // Double beep for more attention
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 800;
      osc2.type = 'sine';
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(audioContext.currentTime + 0.2);
    }, 300);
  } catch (error) {
    console.log('Audio not supported:', error);
  }
};

export default EmojiClock;
