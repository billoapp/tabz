import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'white' | 'dark';
}

const sizeMap = {
  sm: { width: 24, height: 24 },
  md: { width: 32, height: 32 },
  lg: { width: 48, height: 48 },
  xl: { width: 64, height: 64 },
};

export default function Logo({ size = 'md', className = '', variant = 'default' }: LogoProps) {
  const dimensions = sizeMap[size];
  
  return (
    <div className={`relative ${className}`}>
      <Image
        src={variant === 'white' ? '/logo-white.svg' : '/logo.svg'}
        alt="Tabeza Logo"
        width={dimensions.width}
        height={dimensions.height}
        className="object-contain"
        priority
      />
    </div>
  );
}
