import React from 'react'
import { ConnectionStatus } from '../hooks/useRealtimeSubscription'

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus
  retryCount?: number
  className?: string
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  status,
  retryCount = 0,
  className = ''
}) => {
  const getStatusConfig = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return {
          icon: '🟢',
          text: 'Live updates active',
          color: 'text-green-600'
        }
      case 'connecting':
        return {
          icon: '🟡',
          text: 'Connecting...',
          color: 'text-yellow-600'
        }
      case 'retrying':
        return {
          icon: '🟡',
          text: `Reconnecting... (${retryCount}/${5})`,
          color: 'text-yellow-600'
        }
      case 'error':
        return {
          icon: '🔴',
          text: 'Connection error',
          color: 'text-red-600'
        }
      case 'disconnected':
        return {
          icon: '🔴',
          text: 'Connection lost',
          color: 'text-red-600'
        }
      default:
        return {
          icon: '⚪',
          text: 'Unknown status',
          color: 'text-gray-600'
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-lg">{config.icon}</span>
      <span className={config.color}>{config.text}</span>
    </div>
  )
}
