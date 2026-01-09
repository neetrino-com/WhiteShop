'use client';

/**
 * Client-side i18n React hook
 * This file contains React hooks that can only be used in Client Components
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { type LanguageCode } from './language';
import { getStoredLanguage } from './language';
import { t, getProductText, getAttributeLabel, clearTranslationCache, type ProductField } from './i18n';

// Import translations to check available languages
import enCommon from '../locales/en/common.json';
import hyCommon from '../locales/hy/common.json';
import ruCommon from '../locales/ru/common.json';

const translations: Partial<Record<LanguageCode, any>> = {
  en: { common: enCommon },
  hy: { common: hyCommon },
  ru: { common: ruCommon },
};

/**
 * React hook for translations in client components
 * Automatically handles language updates and memoization
 * 
 * @returns Object with translation function and current language
 * 
 * @example
 * ```tsx
 * const { t, lang } = useTranslation();
 * return <button>{t('common.buttons.addToCart')}</button>;
 * ```
 */
export function useTranslation() {
  // Always start with 'en' to prevent hydration mismatch
  // The language will be updated after mount in useEffect
  const [lang, setLang] = useState<LanguageCode>('en');

  // Listen to language changes and update state reactively
  useEffect(() => {
    // Update language on mount to ensure we have the latest from localStorage
    const updateLanguage = () => {
      const storedLang = getStoredLanguage();
      const newLang: LanguageCode = (storedLang && storedLang in translations) ? storedLang : 'en';
      setLang((currentLang) => {
        if (newLang !== currentLang) {
          // Clear translation cache when language changes
          clearTranslationCache();
          return newLang;
        }
        return currentLang;
      });
    };

    // Update immediately on mount
    updateLanguage();

    // Listen to language-updated events
    const handleLanguageUpdate = () => {
      updateLanguage();
    };

    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Memoized translation function with validation
  const translate = useCallback(
    (path: string) => {
      if (!path || typeof path !== 'string') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[i18n] useTranslation: Invalid path provided to t()', path);
        }
        return '';
      }
      return t(lang, path);
    },
    [lang]
  );

  // Memoized product text getter
  const getProduct = useCallback(
    (productId: string, field: ProductField) => {
      if (!productId || typeof productId !== 'string') {
        return '';
      }
      return getProductText(lang, productId, field);
    },
    [lang]
  );

  // Memoized attribute label getter
  const getAttribute = useCallback(
    (type: string, value: string) => {
      if (!type || !value || typeof type !== 'string' || typeof value !== 'string') {
        return value || '';
      }
      return getAttributeLabel(lang, type, value);
    },
    [lang]
  );

  return useMemo(
    () => ({
      t: translate,
      lang,
      getProductText: getProduct,
      getAttributeLabel: getAttribute,
    }),
    [translate, lang, getProduct, getAttribute]
  );
}

