import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { ThemeInitializer } from '@/components/ThemeInitializer';

export const metadata: Metadata = {
  title: 'AudioForge - AI-Powered Audio Processing',
  description: 'Professional audio separation, noise reduction, and mixing platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
