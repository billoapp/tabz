import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import DeviceInitializer from '@/components/DeviceInitializer';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tabeza',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <DeviceInitializer>
          <ToastProvider>
            <PWAInstallPrompt />
            {children}
          </ToastProvider>
        </DeviceInitializer>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}