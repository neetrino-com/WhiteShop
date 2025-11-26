import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientProviders } from '../components/ClientProviders';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Breadcrumb } from '../components/Breadcrumb';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Shop - Professional E-commerce',
  description: 'Modern e-commerce platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default to 'en' on server, will be updated client-side if needed
  return (
    <html lang="en">
      <body className={inter.className}>
        <Suspense fallback={null}>
          <ClientProviders>
            <Header />
            <Breadcrumb />
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
          </ClientProviders>
        </Suspense>
      </body>
    </html>
  );
}

