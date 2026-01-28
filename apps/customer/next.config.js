/** @type {import('next').NextConfig} */
const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Enable PWA in both development and production for testing
  sw: 'sw.js', // Explicitly specify the service worker file
  // Exclude problematic Next.js 15 manifest files that cause precaching errors
  buildExcludes: [
    /middleware-manifest\.json$/,
    /app-build-manifest\.json$/, // Next.js 15 app build manifest
    /build-manifest\.json$/,
    /_buildManifest\.js$/,
    /_ssgManifest\.js$/,
    /\.map$/,
    /^manifest.*\.js$/,
    /app-build-manifest\.json$/, // Duplicate to ensure exclusion
    /_next\/app-build-manifest\.json$/ // Full path exclusion
  ],
  // Force clean service worker generation
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/app\.tabeza\.co\.ke\/_next\/static\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'tabeza-static-v2',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    },
    {
      urlPattern: /^https:\/\/app\.tabeza\.co\.ke\/_next\/image\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'tabeza-images-v2',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
        }
      }
    },
    {
      urlPattern: /^https:\/\/app\.tabeza\.co\.ke\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'tabeza-api-v2',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60 // 5 minutes
        },
        networkTimeoutSeconds: 10
      }
    },
    {
      urlPattern: /^https:\/\/app\.tabeza\.co\.ke\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'tabeza-pages-v2',
        expiration: {
          maxEntries: 50,
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
  
  // PWA-specific optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Performance optimizations for mobile
  // swcMinify is now enabled by default in Next.js 15+
  
  // Add service worker precache manifest with unique build ID to force regeneration
  generateBuildId: async () => {
    // Force new service worker generation by including timestamp
    return `tabeza-customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  
  // Ensure static assets are properly cached
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = withPWA(nextConfig);