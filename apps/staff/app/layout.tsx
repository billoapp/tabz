import type { Metadata } from 'next';
import './globals.css';
import { BarProvider } from '@/contexts/page';
import { ToastProvider } from '@/components/ui/Toast';
import PWAUpdateManager from '@/components/PWAUpdateManager';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://tabeza.co.ke'),
  
  title: {
    default: 'Tabeza Venue - Digital Tab System',
    template: '%s | Tabeza Venue',
  },
  
  description: 'Professional tab management system for Kenyan venues. Track tabs, manage orders, process payments, and eliminate revenue loss. 100% free forever.',
  
  keywords: [
    'tab management Kenya',
    'restaurant tab system',
    'digital bar tabs',
    'tab management software',
    'Kenya hospitality tech',
    'tab revenue tracking',
    'M-Pesa payments',
    'restaurant management',
    'Nairobi bars',
    'venue management system',
    'hospitality software Kenya'
  ],
  
  authors: [{ name: 'Tabeza', url: 'https://tabeza.co.ke' }],
  creator: 'Tabeza',
  publisher: 'Tabeza',
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://tabeza.co.ke',
    siteName: 'Tabeza Venue',
    title: 'Tabeza Venue - Digital Tab System',
    description: 'Eliminate revenue loss. Track every tab. Process payments seamlessly. Join hundreds of Kenyan venues using Tabeza. 100% free forever.',
    images: [
      {
        url: '/og-banner-staff.png',
        width: 1200,
        height: 630,
        alt: 'Tabeza - Digital Tab Management System',
        type: 'image/png',
        secureUrl: 'https://tabeza.co.ke/og-banner-staff.png',
      },
    ],
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'Tabeza Venue - Digital Tab System',
    description: 'Eliminate revenue loss. Track every tab. 100% free forever.',
    images: ['https://tabeza.co.ke/og-banner-staff.png'],
    creator: '@tabeza_ke',
    site: '@tabeza_ke',
  },
  
  applicationName: 'Tabeza Venue',
  appleWebApp: {
    capable: true,
    title: 'Tabeza Venue',
    statusBarStyle: 'black-translucent',
  },
  
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
  },
  
  manifest: '/manifest.json',
  
  category: 'business',
  classification: 'Business Software',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F97316',
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#F97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Tabeza Venue',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'KES',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                ratingCount: '150',
              },
              description: 'Professional bar and restaurant management system for Kenyan venues',
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>
          <BarProvider>
            <PWAInstallPrompt />
            <PWAUpdateManager />
            {children}
          </BarProvider>
        </ToastProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}