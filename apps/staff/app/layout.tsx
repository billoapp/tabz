import type { Metadata } from 'next';
import './globals.css';
import { BarProvider } from '@/contexts/page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tabz Staff - Bar Management',
  description: 'Manage tabs, orders, and payments for your bar',
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