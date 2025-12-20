import type { Metadata } from 'next';
import './globals.css';
import { BarProvider } from '@/contexts/page';

export const metadata: Metadata = {
  title: 'Kwikoda Staff - Bar Management',
  description: 'Manage tabs, orders, and payments for your bar',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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