'use client';

import { useState, useEffect } from 'react';
import { getStoredLanguage, setStoredLanguage, LANGUAGES, type LanguageCode } from '../lib/language';
import { useTranslation } from '../lib/i18n-client';

/**
 * Language Switcher Component
 * Allows users to change the application language
 * 
 * @example
 * <LanguageSwitcher />
 */
export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getStoredLanguage());
  const [showMenu, setShowMenu] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleLanguageUpdate = () => {
      setCurrentLang(getStoredLanguage());
    };

    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, []);

  const handleLanguageChange = (langCode: LanguageCode) => {
    if (langCode !== currentLang) {
      setStoredLanguage(langCode);
      // setStoredLanguage automatically reloads the page
    }
    setShowMenu(false);
  };

  const currentLanguage = LANGUAGES[currentLang];

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
        aria-label="Change language"
      >
        <span className="text-lg" role="img" aria-label={currentLanguage.nativeName}>
          {currentLang === 'en' ? '🇬🇧' : currentLang === 'hy' ? '🇦🇲' : currentLang === 'ru' ? '🇷🇺' : '🇬🇪'}
        </span>
        <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
        <span className="sm:hidden">{currentLanguage.code.toUpperCase()}</span>
        <svg
          className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
            {Object.entries(LANGUAGES).map(([code, lang]) => {
              const isActive = code === currentLang;
              const flag = code === 'en' ? '🇬🇧' : code === 'hy' ? '🇦🇲' : code === 'ru' ? '🇷🇺' : '🇬🇪';
              
              return (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code as LanguageCode)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{flag}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{lang.nativeName}</span>
                    <span className="text-xs text-gray-500">{lang.name}</span>
                  </div>
                  {isActive && (
                    <svg
                      className="w-5 h-5 ml-auto text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Simple Language Switcher - Minimal version
 * Just shows flags/icons without dropdown
 */
export function SimpleLanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getStoredLanguage());

  useEffect(() => {
    const handleLanguageUpdate = () => {
      setCurrentLang(getStoredLanguage());
    };

    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, []);

  const handleLanguageChange = (langCode: LanguageCode) => {
    if (langCode !== currentLang) {
      setStoredLanguage(langCode);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {Object.entries(LANGUAGES).map(([code, lang]) => {
        const isActive = code === currentLang;
        const flag = code === 'en' ? '🇬🇧' : code === 'hy' ? '🇦🇲' : code === 'ru' ? '🇷🇺' : '🇬🇪';
        
        return (
          <button
            key={code}
            onClick={() => handleLanguageChange(code as LanguageCode)}
            className={`px-2 py-1 rounded transition-all ${
              isActive
                ? 'bg-blue-100 text-blue-700 scale-110'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={lang.nativeName}
            aria-label={`Switch to ${lang.name}`}
          >
            <span className="text-lg">{flag}</span>
          </button>
        );
      })}
    </div>
  );
}




