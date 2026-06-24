import type { Metadata } from 'next';
import { Inter, Lexend, JetBrains_Mono } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
  display: 'swap',
  weight: ['500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Retail POS — Manajemen Toko',
  description: 'Sistem manajemen transaksi, stok, produk, dan promo toko retail',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body
        className={`${inter.variable} ${lexend.variable} ${jetbrainsMono.variable} font-sans bg-ink-50 text-ink-900 antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
