/** @type {import('next').NextConfig} */
const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Disable automatic registration - we do it manually
  skipWaiting: true,
  disable: false, // CRITICAL: Always enable PWA for testing
  // CRITICAL: Force service worker activation
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  reloadOnOnline: true,
  // Use simple service worker to avoid installation issues
  sw: 'sw-simple.js',
  // Disable runtime caching to avoid workbox generation
  runtimeCaching: []
});

const nextConfig = {
  // Configure for monorepo
  transpilePackages: ['@/components', '@/lib'],
  
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

module.exports = withPWA(nextConfig);