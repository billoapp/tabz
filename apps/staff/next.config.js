/** @type {import('next').NextConfig} */
const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  
  // Comprehensive build exclusions to prevent precaching errors
  buildExcludes: [
    /app-build-manifest\.json$/,
    /build-manifest\.json$/,
    /react-loadable-manifest\.json$/,
    /server\/.*\.js$/,
    /static\/chunks\/.*\.js$/,
    /\.map$/,
    /middleware-manifest\.json$/,
    /prerender-manifest\.json$/,
    /routes-manifest\.json$/,
    /export-marker\.json$/,
    /images-manifest\.json$/,
    /font-manifest\.json$/,
    /webpack-runtime-.*\.js$/,
    /framework-.*\.js$/,
    /main-.*\.js$/,
    /polyfills-.*\.js$/,
    /_app-.*\.js$/,
    /_error-.*\.js$/,
    /_document-.*\.js$/,
    /chunks\/pages\/.*\.js$/,
    /chunks\/.*\.js$/,
    /\.next\/static\/.*$/,
    /\.next\/server\/.*$/,
  ],
  
  // Unique cache ID for cache invalidation
  cacheId: `staff-pwa-${Date.now()}`,
  
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'tabeza-staff-v1',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    }
  ]
});

const nextConfig = {
  // Configure for monorepo - transpile shared packages
  transpilePackages: ['@tabeza/shared'],
  
  // Environment variables for client-side access
  env: {
    NEXT_PUBLIC_MPESA_MOCK_MODE: process.env.MPESA_MOCK_MODE,
  },
  
  // Experimental features for better monorepo support
  experimental: {
    externalDir: true,
  },
  
  // Webpack configuration for monorepo
  webpack: (config, { isServer }) => {
    // Handle shared package imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tabeza/shared': path.resolve(__dirname, '../../packages/shared'),
    };
    
    return config;
  },
  
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

module.exports = withPWA(nextConfig);