/**
 * Balance Display Component
 * 
 * Displays tab balance with real-time updates, animations, and visual feedback.
 * Integrates with balance update service and payment notifications.
 * 
 * Requirements: 4.1, 4.3, 4.5
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useBalanceUpdates, UseBalanceUpdatesOptions } from '../../hooks/useBalanceUpdates';

export interface BalanceDisplayProps extends Omit<UseBalanceUpdatesOptions, 'tabId'> {
  tabId: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showStatus?: boolean;
  showAnimation?: boolean;
  showAutoCloseIndicator?: boolean;
  compact?: boolean;
  onBalanceClick?: () => void;
}

/**
 * Animated Balance Display Component
 * 
 * Shows current balance with smooth animations for changes
 * Includes status indicators and auto-close detection
 */
export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  tabId,
  className = '',
  size = 'medium',
  showStatus = true,
  showAnimation = true,
  showAutoCloseIndicator = true,
  compact = false,
  onBalanceClick,
  ...balanceOptions
}) => {
  const {
    currentBalance,
    previousBalance,
    isLoading,
    animation,
    statusIndicator,
    formattedBalance,
    autoCloseDetected,
    connectionStatus,
    isConnected
  } = useBalanceUpdates({
    tabId,
    enableAnimations: showAnimation,
    ...balanceOptions
  });

  // Animation state for CSS transitions
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  // Handle balance change animations
  useEffect(() => {
    if (animation && showAnimation) {
      setIsAnimating(true);
      
      // Set animation class based on type
      switch (animation.type) {
        case 'decrease':
          setAnimationClass('balance-decrease');
          break;
        case 'increase':
          setAnimationClass('balance-increase');
          break;
        case 'zero':
          setAnimationClass('balance-zero');
          break;
        default:
          setAnimationClass('');
      }

      // Clear animation after duration
      const timeout = setTimeout(() => {
        setIsAnimating(false);
        setAnimationClass('');
      }, animation.duration);

      return () => clearTimeout(timeout);
    }
  }, [animation, showAnimation]);

  // Size classes
  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl'
  };

  // Status color classes
  const statusColorClasses = {
    green: 'text-green-600 bg-green-50 border-green-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    orange: 'text-orange-600 bg-orange-50 border-orange-200',
    gray: 'text-gray-600 bg-gray-50 border-gray-200'
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-20"></div>
        </div>
        {!compact && (
          <div className="text-xs text-gray-500">Loading...</div>
        )}
      </div>
    );
  }

  // Error state
  if (!currentBalance) {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`}>
        <span className="text-sm">❌</span>
        <span className={sizeClasses[size]}>Balance unavailable</span>
      </div>
    );
  }

  return (
    <div className={`balance-display ${className}`}>
      {/* Auto-close indicator */}
      {showAutoCloseIndicator && autoCloseDetected && (
        <div className="mb-2 px-2 py-1 bg-green-100 border border-green-200 rounded-md text-green-800 text-xs font-medium animate-pulse">
          🎉 Tab closing automatically!
        </div>
      )}

      {/* Main balance display */}
      <div 
        className={`
          flex items-center gap-2 transition-all duration-300
          ${onBalanceClick ? 'cursor-pointer hover:opacity-80' : ''}
          ${isAnimating ? animationClass : ''}
        `}
        onClick={onBalanceClick}
      >
        {/* Status indicator */}
        {showStatus && !compact && (
          <div className={`
            flex items-center justify-center w-6 h-6 rounded-full text-xs
            ${statusColorClasses[statusIndicator.color as keyof typeof statusColorClasses]}
          `}>
            {statusIndicator.icon}
          </div>
        )}

        {/* Balance amount */}
        <div className="flex flex-col">
          <div className={`
            font-bold transition-all duration-300
            ${sizeClasses[size]}
            ${isAnimating ? 'transform scale-110' : ''}
          `}>
            {formattedBalance}
          </div>
          
          {/* Status message */}
          {showStatus && !compact && (
            <div className={`
              text-xs transition-opacity duration-300
              ${statusColorClasses[statusIndicator.color as keyof typeof statusColorClasses].split(' ')[0]}
            `}>
              {statusIndicator.message}
            </div>
          )}
        </div>

        {/* Connection status indicator */}
        {!isConnected && (
          <div className="text-xs text-gray-400" title="Offline - balance may not be current">
            📶
          </div>
        )}
      </div>

      {/* Animation overlay for visual feedback */}
      {isAnimating && animation && showAnimation && (
        <div className="absolute inset-0 pointer-events-none">
          {animation.type === 'decrease' && (
            <div className="animate-bounce text-green-500 text-xs font-bold">
              -KSh {animation.amount.toLocaleString()}
            </div>
          )}
          {animation.type === 'increase' && (
            <div className="animate-bounce text-red-500 text-xs font-bold">
              +KSh {animation.amount.toLocaleString()}
            </div>
          )}
          {animation.type === 'zero' && (
            <div className="animate-pulse text-green-600 text-xs font-bold">
              ✅ Paid in full!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact Balance Display
 * 
 * Minimal balance display for tight spaces
 */
export const CompactBalanceDisplay: React.FC<Omit<BalanceDisplayProps, 'compact' | 'showStatus'>> = (props) => {
  return (
    <BalanceDisplay
      {...props}
      compact={true}
      showStatus={false}
      size="small"
    />
  );
};

/**
 * Balance Card Component
 * 
 * Full-featured balance display with card styling
 */
export const BalanceCard: React.FC<BalanceDisplayProps & {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({
  title = "Current Balance",
  subtitle,
  actions,
  className = '',
  ...props
}) => {
  return (
    <div className={`bg-white rounded-lg border p-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Balance display */}
      <BalanceDisplay
        {...props}
        size="large"
        className="justify-center"
      />
    </div>
  );
};

/**
 * Balance Trend Component
 * 
 * Shows balance with trend indicators
 */
export const BalanceTrend: React.FC<BalanceDisplayProps & {
  showTrend?: boolean;
}> = ({
  showTrend = true,
  ...props
}) => {
  const { currentBalance, previousBalance } = useBalanceUpdates({
    tabId: props.tabId,
    ...props
  });

  const getTrendIndicator = () => {
    if (!currentBalance || previousBalance === null) return null;
    
    const change = currentBalance.balance - previousBalance;
    if (Math.abs(change) < 1) return null; // No significant change
    
    if (change > 0) {
      return <span className="text-red-500 text-xs">↗️ +KSh {change.toLocaleString()}</span>;
    } else {
      return <span className="text-green-500 text-xs">↘️ -KSh {Math.abs(change).toLocaleString()}</span>;
    }
  };

  return (
    <div className="space-y-1">
      <BalanceDisplay {...props} />
      {showTrend && getTrendIndicator() && (
        <div className="flex justify-center">
          {getTrendIndicator()}
        </div>
      )}
    </div>
  );
};

/* CSS for animations - to be included in global styles */
export const balanceDisplayStyles = `
  .balance-decrease {
    animation: balanceDecrease 0.8s ease-out;
  }
  
  .balance-increase {
    animation: balanceIncrease 0.8s ease-in-out;
  }
  
  .balance-zero {
    animation: balanceZero 1.2s ease-in-out;
  }
  
  @keyframes balanceDecrease {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); color: #10b981; }
    100% { transform: scale(1); }
  }
  
  @keyframes balanceIncrease {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); color: #ef4444; }
    100% { transform: scale(1); }
  }
  
  @keyframes balanceZero {
    0% { transform: scale(1); }
    25% { transform: scale(1.2); color: #10b981; }
    50% { transform: scale(1.1); }
    75% { transform: scale(1.15); }
    100% { transform: scale(1); color: #10b981; }
  }
`;