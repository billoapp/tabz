import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import DeviceInitializer from '@/components/DeviceInitializer';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import PWADebugInfo from '@/components/PWADebugInfo';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://your-supabase-instance.supabase.co', 'your-supabase-key');

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tabeza v2.0',
  description: 'Tab management for bars and restaurants',
  keywords: ['tab management', 'bar', 'restaurant', 'ordering', 'payment'],
  authors: [{ name: 'Tabeza' }],
  creator: 'Tabeza',
  publisher: 'Tabeza',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/logo-192.png', sizes: '180x180' },
    ],
  },
  manifest: '/manifest.json',
  themeColor: '#ea580c',
  colorScheme: 'light',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tabeza',
  },
  applicationName: 'Tabeza Customer App',
  referrer: 'origin-when-cross-origin',
  category: 'business',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Basic PWA Meta Tags */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* iOS Specific Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Tabeza" />
        <link rel="apple-touch-icon" href="/logo-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/logo-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo-192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/logo-192.png" />
        
        {/* iOS Splash Screens */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* Android Specific Meta Tags */}
        <meta name="theme-color" content="#ea580c" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Tabeza" />
        
        {/* Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#ea580c" />
        <meta name="msapplication-TileImage" content="/logo-192.png" />
        <meta name="msapplication-config" content="none" />
        
        {/* PWA Display and Behavior */}
        <meta name="display-mode" content="standalone" />
        <meta name="orientation" content="portrait" />
        
        {/* Security and Performance */}
        <meta name="referrer" content="origin-when-cross-origin" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        
        {/* Prevent automatic detection and formatting */}
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
      </head>
      <body>
        <DeviceInitializer supabase={supabase}>
          <ToastProvider>
            <PWAInstallPrompt />
            {children}
            <PWADebugInfo />
          </ToastProvider>
        </DeviceInitializer>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}