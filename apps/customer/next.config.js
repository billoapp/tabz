/** @type {import('next').NextConfig} */
const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true, // TEMPORARILY DISABLED - Fix M-Pesa first, then re-enable
  sw: 'sw.js', // Explicitly specify the service worker file
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'tabeza-customer-v1',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        },
        cacheableResponse: {
          statuses: [0, 200]
        },
        networkTimeoutSeconds: 10
      }
    }
  ]
});

const nextConfig = {
  // Configure for monorepo - transpile shared packages
  transpilePackages: ['@tabeza/shared'],
  
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

  // Add headers for static files
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);