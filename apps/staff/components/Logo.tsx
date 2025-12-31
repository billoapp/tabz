import { useState, useEffect } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'white' | 'dark' | 'auto';
}

const sizeMap = {
  sm: { width: 24, height: 24 },
  md: { width: 32, height: 32 },
  lg: { width: 48, height: 48 },
  xl: { width: 64, height: 64 },
};

export default function Logo({ size = 'md', className = '', variant = 'auto' }: LogoProps) {
  const dimensions = sizeMap[size];
  const [imageError, setImageError] = useState(false);
  const [detectedVariant, setDetectedVariant] = useState<'default' | 'white'>('default');
  
  // Auto-detect if logo should be white based on parent background
  useEffect(() => {
    if (variant === 'auto') {
      const checkBackground = () => {
        // Check if any parent has gradient background
        const element = document.querySelector(`[data-logo-container="true"]`);
        if (element) {
          const computedStyle = window.getComputedStyle(element);
          const background = computedStyle.background || computedStyle.backgroundColor;
          
          // Check for orange/red gradients or dark backgrounds
          if (background.includes('orange') || background.includes('red') || 
              background.includes('gradient') || background.includes('rgb(254') || 
              background.includes('rgb(239') || background.includes('rgb(220')) {
            setDetectedVariant('white');
          } else {
            setDetectedVariant('default');
          }
        }
      };
      
      checkBackground();
      // Re-check on window resize or DOM changes
      const observer = new MutationObserver(checkBackground);
      observer.observe(document.body, { 
        attributes: true, 
        subtree: true, 
        attributeFilter: ['class', 'style'] 
      });
      
      return () => observer.disconnect();
    }
  }, [variant]);
  
  // Determine final variant
  const finalVariant = variant === 'auto' ? detectedVariant : variant;
  
  // Fallback text logo if image fails to load
  if (imageError) {
    return (
      <div 
        data-logo-container="true"
        className={`flex items-center justify-center font-bold ${finalVariant === 'white' ? 'text-white' : 'text-orange-500'} ${className}`} 
        style={{ width: dimensions.width, height: dimensions.height, fontSize: dimensions.width * 0.4 }}
      >
        T
      </div>
    );
  }
  
  return (
    <div data-logo-container="true" className={`relative ${className}`}>
      <img
        src={finalVariant === 'white' ? '/logo-white.svg' : '/logo.svg'}
        alt="Tabeza Logo"
        width={dimensions.width}
        height={dimensions.height}
        className="object-contain"
        onError={() => setImageError(true)}
        style={{ width: dimensions.width, height: dimensions.height }}
      />
    </div>
  );
}
