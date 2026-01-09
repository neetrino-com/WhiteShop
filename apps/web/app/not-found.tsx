'use client';

import Link from 'next/link';
import { useTranslation } from '../lib/i18n-client';

/**
 * Custom 404 Not Found Page
 * 
 * This page is displayed when a route is not found.
 * Using route segment config to prevent prerendering.
 */
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function NotFound() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">{t('common.notFound.title')}</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          {t('common.notFound.description')}
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            {t('common.notFound.goHome')}
          </Link>
          <Link
            href="/products"
            className="px-6 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {t('common.buttons.browseProducts')}
          </Link>
        </div>
      </div>
    </div>
  );
}
