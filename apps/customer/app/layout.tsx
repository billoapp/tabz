import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import DeviceInitializer from '@/components/DeviceInitializer';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import PWADebug from '@/components/PWADebug';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tabeza',
  },
  applicationName: 'Tabeza Customer App',
  referrer: 'origin-when-cross-origin',
  category: 'business',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ea580c',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DeviceInitializer>
          <ToastProvider>
            <PWAInstallPrompt />
            <PWADebug />
            {children}
          </ToastProvider>
        </DeviceInitializer>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}