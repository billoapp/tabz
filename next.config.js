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
};

module.exports = nextConfig;
