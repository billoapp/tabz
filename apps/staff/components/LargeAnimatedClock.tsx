'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart, MessageCircle, X } from 'lucide-react';

interface LargeAnimatedClockProps {
  isVisible: boolean;
  onClose: () => void;
  type: 'order' | 'message';
}

const LargeAnimatedClock: React.FC<LargeAnimatedClockProps> = ({
  isVisible,
  onClose,
  type
}) => {
  const [scale, setScale] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  // Entrance animation and rotation
  useEffect(() => {
    setMounted(true);
    if (isVisible) {
      // Entrance animation: scale from 0 to 1
      const timer = setTimeout(() => setScale(1), 100);
      
      // Continuous rotation animation
      const interval = setInterval(() => {
        setRotation(prev => (prev + 6) % 360); // 6 degrees every 100ms = smooth rotation
      }, 100);
      
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [isVisible]);
  
  // Auto-hide after 3 seconds
  useEffect(() => {
    if (isVisible && mounted) {
      const timer = setTimeout(() => {
        setScale(0);
        setTimeout(onClose, 300); // Wait for scale animation to finish
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, mounted]);
  
  // Play system sound when clock appears
  useEffect(() => {
    if (isVisible && mounted) {
      playNotificationSound(type);
    }
  }, [isVisible, mounted, type]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div 
        className="bg-white rounded-full shadow-2xl flex items-center justify-center relative overflow-hidden"
        style={{
          width: '300px',
          height: '300px',
          transform: `scale(${scale})`,
          transition: 'transform 0.3s ease-out'
        }}
        onClick={onClose}
      >
        {/* Clock face */}
        <div className="relative w-full h-full">
          {/* Hour markers */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-4 bg-gray-800"
              style={{
                top: '10px',
                left: '50%',
                transform: `translateX(-50%) rotate(${i * 30}deg)`,
                transformOrigin: 'center 140px'
              }}
            />
          ))}
          
          {/* Clock hands */}
          <div 
            className="absolute w-1 bg-gray-900 rounded-full"
            style={{
              height: '80px',
              top: '70px',
              left: '50%',
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transformOrigin: 'center bottom',
              transition: 'transform 0.1s linear'
            }}
          />
          
          {/* Center dot */}
          <div className="absolute w-4 h-4 bg-gray-900 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        
        {/* Type indicator overlay */}
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          {type === 'order' ? (
            <div className="bg-orange-500 text-white p-4 rounded-full shadow-lg animate-pulse">
              <ShoppingCart size={40} />
            </div>
          ) : (
            <div className="bg-blue-500 text-white p-4 rounded-full shadow-lg animate-pulse">
              <MessageCircle size={40} />
            </div>
          )}
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all duration-200"
        >
          <X size={20} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
};

// System sound function
const playNotificationSound = (notificationType: 'order' | 'message') => {
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
    // Fallback: use browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Order/Message', {
        body: notificationType === 'order' ? 'New customer order received!' : 'New customer message received!',
        icon: '/favicon.ico'
      });
    }
  }
};

export default LargeAnimatedClock;
