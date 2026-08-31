import type { Metadata, Viewport } from 'next';
import { Onest, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { t } from '@/lib/strings';

// Кириллица-расширенная нужна для казахских букв (ә ғ қ ң ө ұ ү і) —
// без неё они молча подменяются другим шрифтом посреди слова.
const onest = Onest({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-onest',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['400', '500', '700'],
  variable: '--font-mono-jb',
  display: 'swap',
});

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1F2F4' },
    { media: '(prefers-color-scheme: dark)', color: '#121417' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${onest.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
