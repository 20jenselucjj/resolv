import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { WebVitalsReporter } from '@/components/WebVitalsReporter';
import { PWARegistrar } from '@/components/PWARegistrar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Resolv',
    default: 'Resolv',
  },
  manifest: '/manifest.json',
  other: {
    'theme-color': '#1E40AF',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1E40AF',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <body>
        <WebVitalsReporter />
        <PWARegistrar />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
