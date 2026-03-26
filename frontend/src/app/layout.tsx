import './globals.css';
import type { Metadata } from 'next';
import { ThemeInitializer } from '@/components/ThemeInitializer';

export const metadata: Metadata = {
  title: 'AudioForge - AI-Powered Audio Processing',
  description: 'Professional audio separation, noise reduction, and mixing platform',
};

const themeScript = `(function(){try{var t=localStorage.getItem('audioforge-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.remove('dark')}else{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}}catch(e){}}())`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
