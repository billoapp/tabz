/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Configure for monorepo
  transpilePackages: ['@/components', '@/lib'],
  
  // Handle static assets from root public directory
  output: 'standalone',
  
  // Ensure proper image optimization
  images: {
    unoptimized: true,
    domains: [],
  },
  
  // Turbopack configuration for monorepo - correct syntax for Next.js 16
  turbopack: {
    root: path.resolve(__dirname, '../..')
  },
  
  // Ensure proper asset handling for mobile
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  
  // Enable proper CSS compilation
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;