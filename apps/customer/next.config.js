/** @type {import('next').NextConfig} */
const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Enable PWA in development mode for testing
  disable: false,
  // Configure workbox options for caching strategies
  workboxOptions: {
    // Skip waiting for new service worker to take control
    skipWaiting: true,
    // Take control of all clients immediately
    clientsClaim: true,
    // Clean up outdated caches automatically
    cleanupOutdatedCaches: true,
    // Configure offline fallback
    navigateFallback: '/offline.html',
    navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
    // Runtime caching configuration
    runtimeCaching: [
      {
        // Cache start URL with NetworkFirst strategy
        urlPattern: '/',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'start-url',
          plugins: [
            {
              cacheWillUpdate: async ({ request, response, event, state }) => {
                return response && response.type === 'opaqueredirect'
                  ? new Response(response.body, {
                      status: 200,
                      statusText: 'OK',
                      headers: response.headers,
                    })
                  : response;
              },
            },
          ],
        },
      },
      {
        // Cache static assets with CacheFirst strategy
        urlPattern: /^https?.*\.(png|jpg|jpeg|webp|svg|gif|tiff|js|css|woff|woff2|ttf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache images with StaleWhileRevalidate for better performance
        urlPattern: /^https?.*\.(png|jpg|jpeg|webp|svg|gif|ico)$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache API routes with NetworkFirst strategy and background sync
        urlPattern: /^https?.*\/api\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5 minutes
          },
          networkTimeoutSeconds: 10,
          cacheableResponse: {
            statuses: [0, 200],
          },
          backgroundSync: {
            name: 'api-queue',
            options: {
              maxRetentionTime: 24 * 60, // Retry for max of 24 hours (specified in minutes)
            },
          },
        },
      },
      {
        // Cache Supabase requests with NetworkFirst
        urlPattern: /^https?.*\.supabase\.co\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-cache',
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 2 * 60, // 2 minutes
          },
          networkTimeoutSeconds: 8,
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache app pages with NetworkFirst strategy
        urlPattern: /^https?.*\/(menu|cart|payment|start|tab).*$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'app-pages',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        // Cache all other requests with NetworkFirst strategy
        urlPattern: /^https?.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'tabeza-customer-v1',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
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