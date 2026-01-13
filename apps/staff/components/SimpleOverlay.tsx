'use client';

import React from 'react';

interface SimpleOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const SimpleOverlay: React.FC<SimpleOverlayProps> = ({ isVisible, onClose }) => {
  console.log('🔥 SimpleOverlay rendered:', { isVisible });
  
  if (!isVisible) {
    console.log('🔥 SimpleOverlay: not visible');
    return null;
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '20px',
        fontSize: '72px'
      }}>
        🕐
      </div>
    </div>
  );
};

export default SimpleOverlay;
