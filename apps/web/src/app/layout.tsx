import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { WebVitalsReporter } from '@/components/WebVitalsReporter';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <body>
        <WebVitalsReporter />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
