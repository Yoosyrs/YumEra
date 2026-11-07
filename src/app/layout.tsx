import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { PwaInit } from '@/components/pwa-init';

export const metadata: Metadata = {
  title: {
    default: 'YUMERA: ETERNAL UNIVERSE',
    template: '%s · YumEra',
  },
  description: 'A social universe for people who love fictional worlds. Yumeshipping, F/O, yumesonas and original universes.',
  applicationName: 'YumEra',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'YumEra',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0612',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
        <PwaInit />
      </body>
    </html>
  );
}
