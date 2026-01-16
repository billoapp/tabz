/** @type {import('next').NextConfig} */
const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Enable PWA in development mode for testing
  disable: false,
  // Take control of all clients immediately
  clientsClaim: true,
  // Clean up outdated caches automatically
  cleanupOutdatedCaches: true,
  // Configure offline fallback
  navigateFallback: '/offline.html',
  navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
  // Runtime caching configuration - simplified to avoid build issues
  runtimeCaching: [
    {
      // Cache static assets with CacheFirst strategy
      urlPattern: /^https?.*\.(png|jpg|jpeg|webp|svg|gif|tiff|js|css)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      // Cache API routes with NetworkFirst strategy
      urlPattern: /^https?.*\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
  // Public excludes - files that should not be precached
  publicExcludes: [
    '!robots.txt',
    '!sitemap.xml',
    '!favicon.ico',
  ],
  // Build excludes - patterns to exclude from precaching
  buildExcludes: [
    /chunks\/images\/.*$/,
    /chunks\/pages\/.*$/,
    /media\/.*$/,
  ],
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