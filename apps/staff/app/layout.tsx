import type { Metadata } from 'next';
import './globals.css';
import { BarProvider } from '@/contexts/page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tabeza Venue - Bar Management',
  description: 'Manage tabs, orders, and payments for your bar',
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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
      <body className="font-sans antialiased">
        <BarProvider>
          {children}
        </BarProvider>
      </body>
    </html>
  );
}