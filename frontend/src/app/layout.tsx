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
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            (function() {
              try {
                const stored = localStorage.getItem('audioforge-theme');
                if (stored === 'dark') {
                  document.documentElement.classList.add('dark');
                } else if (stored === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  }
                }
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className="antialiased">
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
