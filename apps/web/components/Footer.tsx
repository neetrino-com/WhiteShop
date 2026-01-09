'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { getStoredLanguage } from '../lib/language';
import { useTranslation } from '../lib/i18n-client';
import contactData from '../../../config/contact.json';

export function Footer() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<'en' | 'ru' | 'am'>('en');

  useEffect(() => {
    const storedLang = getStoredLanguage();
    const mappedLang = storedLang === 'hy' ? 'am' : (storedLang === 'ka' ? 'en' : storedLang);
    if (mappedLang === 'am' || mappedLang === 'ru' || mappedLang === 'en') {
      setLanguage(mappedLang as 'en' | 'ru' | 'am');
    } else {
      setLanguage('en');
    }

    const handleLanguageUpdate = () => {
      const newLang = getStoredLanguage();
      const mappedNewLang = newLang === 'hy' ? 'am' : (newLang === 'ka' ? 'en' : newLang);
      if (mappedNewLang === 'am' || mappedNewLang === 'ru' || mappedNewLang === 'en') {
        setLanguage(mappedNewLang as 'en' | 'ru' | 'am');
      } else {
        setLanguage('en');
      }
    };

    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, []);

  const address = contactData.address[language] || contactData.address.en;

  return (
    <footer className="bg-black border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t('common.footer.shop')}</h3>
            <p className="text-sm text-gray-300">
              {t('common.footer.description')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t('common.footer.quickLinks')}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/products"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.navigation.products')}
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.navigation.categories')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.navigation.about')}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.navigation.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('common.footer.legal')}</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.footer.privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.footer.termsOfService')}
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.footer.cookiePolicy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.footer.refundPolicy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/delivery-terms"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('common.footer.deliveryTerms')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('common.footer.contactInfo')}</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-sm text-gray-300">{address}</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <a
                  href={`tel:${contactData.phone}`}
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {contactData.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <a
                  href={`mailto:${contactData.email}`}
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {contactData.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-300">
              {t('common.footer.copyright').replace('{year}', new Date().getFullYear().toString())}
            </p>
            
            {/* Payment Methods */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 mr-2">{t('common.footer.paymentMethods')}</span>
              <div className="flex items-center gap-3">
                <Image
                  src="https://static.tert.am/storage/files/tert/2020/04/27/idram_main_visual-770x_.png"
                  alt="Idram"
                  width={80}
                  height={30}
                  className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity"
                  unoptimized
                />
                <Image
                  src="https://finport.am/mcgallery/20190415121452.jpg"
                  alt="ArCa"
                  width={80}
                  height={30}
                  className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

