'use client';

import React, { useEffect, useState } from 'react';
import { X, Clock, Calendar, Store } from 'lucide-react';

interface BarClosedSlideInProps {
  isOpen: boolean;
  onClose: () => void;
  barName: string;
  nextOpenTime: string;
  businessHours?: {
    [key: string]: {
      open: string;
      close: string;
      closeNextDay?: boolean;
    };
  };
}

export const BarClosedSlideIn: React.FC<BarClosedSlideInProps> = ({
  isOpen,
  onClose,
  barName,
  nextOpenTime,
  businessHours
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isToday: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isToday: true });

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent body scroll when slide-in is open
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      // Restore body scroll
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Calculate countdown to next opening time
  useEffect(() => {
    if (!isOpen) return;

    const calculateCountdown = () => {
      const now = new Date();
      const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Try to get business hours for today
      let nextOpeningTime: Date | null = null;
      let isToday = true;
      
      if (businessHours) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        // Check if bar opens later today
        const todayHours = businessHours[dayNames[today]];
        if (todayHours && todayHours.open) {
          const [openHour, openMinute] = todayHours.open.split(':').map(Number);
          const todayOpening = new Date();
          todayOpening.setHours(openHour, openMinute, 0, 0);
          
          if (todayOpening > now) {
            nextOpeningTime = todayOpening;
            isToday = true;
          }
        }
        
        // If not opening today, find next opening day
        if (!nextOpeningTime) {
          for (let i = 1; i <= 7; i++) {
            const nextDay = (today + i) % 7;
            const nextDayHours = businessHours[dayNames[nextDay]];
            
            if (nextDayHours && nextDayHours.open) {
              const [openHour, openMinute] = nextDayHours.open.split(':').map(Number);
              const nextOpening = new Date();
              nextOpening.setDate(now.getDate() + i);
              nextOpening.setHours(openHour, openMinute, 0, 0);
              
              nextOpeningTime = nextOpening;
              isToday = false;
              break;
            }
          }
        }
      }
      
      // Fallback to simple parsing if no business hours
      if (!nextOpeningTime && nextOpenTime.includes('at')) {
        const timeMatch = nextOpenTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (timeMatch) {
          let [_, hourStr, minuteStr, period] = timeMatch;
          let hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          
          // Convert to 24-hour format
          if (period?.toLowerCase() === 'pm' && hour < 12) hour += 12;
          if (period?.toLowerCase() === 'am' && hour === 12) hour = 0;
          
          const targetDate = new Date();
          targetDate.setHours(hour, minute, 0, 0);
          
          // If time has passed, assume tomorrow
          if (targetDate <= now) {
            targetDate.setDate(targetDate.getDate() + 1);
            isToday = false;
          }
          
          nextOpeningTime = targetDate;
        }
      }
      
      if (!nextOpeningTime) {
        // Default fallback - assume 8 hours from now
        nextOpeningTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        isToday = false;
      }
      
      const diff = nextOpeningTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, isToday: true };
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      return { hours, minutes, seconds, isToday };
    };

    // Initial calculation
    setCountdown(calculateCountdown());

    // Update countdown every second
    const interval = setInterval(() => {
      setCountdown(calculateCountdown());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, nextOpenTime, businessHours]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const formatCountdown = () => {
    const { hours, minutes, seconds, isToday } = countdown;
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ${minutes}m`;
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    
    return `${minutes}m ${seconds}s`;
  };

  const formatBusinessHours = () => {
    if (!businessHours) return null;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-gray-800 mb-3">Business Hours</h4>
        <div className="space-y-2">
          {dayNames.map((day, index) => {
            const dayKey = day.toLowerCase();
            const hours = businessHours[dayKey];
            
            if (!hours || !hours.open || !hours.close) return null;
            
            const isToday = index === today;
            
            return (
              <div 
                key={day} 
                className={`flex justify-between items-center py-1 px-2 rounded ${
                  isToday ? 'bg-orange-50 font-semibold text-orange-700' : 'text-gray-600'
                }`}
              >
                <span className="text-sm">{day}</span>
                <span className="text-sm">
                  {hours.open} - {hours.close}
                  {hours.closeNextDay && ' (next day)'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Slide-in panel */}
      <div 
        className={`relative bg-white rounded-t-3xl shadow-2xl w-full max-w-lg transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X size={20} className="text-gray-600" />
        </button>
        
        {/* Content */}
        <div className="px-6 pb-8 pt-4">
          {/* Icon and title */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store size={40} className="text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{barName}</h2>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full">
              <Clock size={16} className="text-red-600" />
              <span className="text-red-600 font-semibold">Currently Closed</span>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="text-center mb-6">
            <p className="text-gray-700 mb-3">
              {countdown.isToday ? 'Opens later today' : 'Opens next time in'}:
            </p>
            <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl p-4 shadow-lg">
              <div className="text-3xl font-bold mb-1">
                {formatCountdown()}
              </div>
              <div className="text-sm opacity-90">
                {countdown.isToday ? 'Later today' : nextOpenTime}
              </div>
            </div>
          </div>
          
          {/* Business hours (if available) */}
          {businessHours && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              {formatBusinessHours()}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all shadow-lg"
            >
              Set Reminder
            </button>
            <button
              onClick={handleClose}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
          
          {/* Footer note */}
          <div className="text-center mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              🔔 We'll notify you when {barName} opens
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
