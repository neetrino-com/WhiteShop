'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStoredLanguage } from '../lib/language';
import { getTranslation } from '../lib/translations';
import { useState, useEffect } from 'react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<'en' | 'ru' | 'hy' | 'ka'>('en');

  useEffect(() => {
    const storedLang = getStoredLanguage();
    setLanguage(storedLang);

    const handleLanguageUpdate = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, []);

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: getTranslation('breadcrumb.home', language), href: '/' },
    ];

    if (pathname === '/') {
      return items;
    }

    const segments = pathname.split('/').filter(Boolean);

    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      
      // Translate common routes
      let label = segment;
      
      // Map common routes to translations
      const routeMap: Record<string, string> = {
        'products': 'breadcrumb.products',
        'categories': 'breadcrumb.categories',
        'cart': 'breadcrumb.cart',
        'wishlist': 'breadcrumb.wishlist',
        'compare': 'breadcrumb.compare',
        'checkout': 'breadcrumb.checkout',
        'profile': 'breadcrumb.profile',
        'orders': 'breadcrumb.orders',
        'login': 'breadcrumb.login',
        'register': 'breadcrumb.register',
        'about': 'breadcrumb.about',
        'contact': 'breadcrumb.contact',
        'admin': 'breadcrumb.admin',
        'faq': 'breadcrumb.faq',
        'shipping': 'breadcrumb.shipping',
        'returns': 'breadcrumb.returns',
        'support': 'breadcrumb.support',
        'privacy': 'breadcrumb.privacy',
        'terms': 'breadcrumb.terms',
        'cookies': 'breadcrumb.cookies',
        'delivery': 'breadcrumb.delivery',
        'stores': 'breadcrumb.stores',
      };

      if (routeMap[segment]) {
        label = getTranslation(routeMap[segment], language);
      } else {
        // Capitalize and format segment (for product slugs, etc.)
        label = segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      items.push({ label, href });
    });

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  // Don't show breadcrumb on home page
  if (pathname === '/') {
    return null;
  }

  return (
    <nav className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center text-sm">
          {breadcrumbs.map((item, index) => (
            <div key={item.href} className="flex items-center">
              {index > 0 && (
                <span className="mx-2 text-gray-400">/</span>
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-gray-900 font-semibold">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}


