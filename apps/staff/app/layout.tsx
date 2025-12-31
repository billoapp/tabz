import type { Metadata } from 'next';
import './globals.css';
import { BarProvider } from '@/contexts/page';
import { ToastProvider } from '../../../components/ui/Toast';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://tabeza.co.ke'), // Update with your actual domain
  
  title: {
    default: 'Tabeza Venue - Bar Management System',
    template: '%s | Tabeza Venue',
  },
  
  description: 'Professional bar and restaurant management system for Kenyan venues. Track tabs, manage orders, process payments, and eliminate revenue loss. 100% free forever.',
  
  keywords: [
    'bar management Kenya',
    'restaurant POS system',
    'digital bar tabs',
    'tab management software',
    'Kenya hospitality tech',
    'bar revenue tracking',
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
  
  // Open Graph (Facebook, WhatsApp, iMessage, LinkedIn)
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://staff.tabeza.co.ke',
    siteName: 'Tabeza Venue',
    title: 'Tabeza Venue - Professional Bar Management',
    description: 'Eliminate revenue loss. Track every tab. Process payments seamlessly. Join hundreds of Kenyan venues using Tabeza. 100% free forever.',
    images: [
      {
        url: '/og-banner-staff.png', // We'll create this
        width: 1200,
        height: 630,
        alt: 'Tabeza - Professional Bar & Restaurant Management System',
        type: 'image/png',
      },
      {
        url: '/logo-512.png', // Fallback
        width: 512,
        height: 512,
        alt: 'Tabeza Logo',
        type: 'image/png',
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Tabeza Venue - Professional Bar Management',
    description: 'Eliminate revenue loss. Track every tab. 100% free forever.',
    images: ['/og-banner-staff.png'],
    creator: '@tabeza_ke', // Add your Twitter handle if you have one
    site: '@tabeza_ke',
  },
  
  // App-specific metadata
  applicationName: 'Tabeza Venue',
  appleWebApp: {
    capable: true,
    title: 'Tabeza Venue',
    statusBarStyle: 'black-translucent',
  },
  
  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
      { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  
  manifest: '/manifest.json',
  
  // Additional metadata
  category: 'business',
  classification: 'Business Software',
  
  // Verification (add when you have these)
  // verification: {
  //   google: 'your-google-site-verification',
  //   yandex: 'your-yandex-verification',
  // },
  
  // Alternate languages (if you support multiple languages)
  // alternates: {
  //   languages: {
  //     'en-KE': 'https://staff.tabeza.co.ke',
  //     'sw-KE': 'https://staff.tabeza.co.ke/sw',
  //   },
  // },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F97316', // Your brand orange color
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
        {/* Additional meta tags */}
        <meta name="theme-color" content="#F97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Preconnect to important domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Structured Data for SEO */}
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
            {children}
          </BarProvider>
        </ToastProvider>
      </body>
    </html>
  );
}