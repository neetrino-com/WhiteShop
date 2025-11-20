'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { LANGUAGES, type LanguageCode } from '../lib/language';

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Language icons/emojis
const getLanguageIcon = (code: LanguageCode): string => {
  const icons: Record<LanguageCode, string> = {
    en: '🇬🇧',
    hy: '🇦🇲',
    ru: '🇷🇺',
    ka: '🇬🇪',
  };
  return icons[code] || '🌐';
};

// Language colors for better visual distinction
const getLanguageColor = (code: LanguageCode, isActive: boolean): string => {
  if (isActive) {
    const colors: Record<LanguageCode, string> = {
      en: 'bg-blue-50 border-blue-200',
      hy: 'bg-orange-50 border-orange-200',
      ru: 'bg-red-50 border-red-200',
      ka: 'bg-white border-gray-300',
    };
    return colors[code] || 'bg-gray-100 border-gray-200';
  }
  return 'bg-white border-transparent';
};

declare global {
  interface Window {
    google: {
      translate: {
        TranslateElement: {
          new (
            options: {
              pageLanguage: string;
              includedLanguages: string;
              layout: number;
            },
            elementId: string
          ): void;
          InlineLayout: {
            SIMPLE: number;
          };
        };
      };
    };
  }
}

export function GoogleTranslate() {
  const [showMenu, setShowMenu] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>('en');
  const [isLoaded, setIsLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hiddenElementRef = useRef<HTMLDivElement>(null);

  // Initialize Google Translate
  useEffect(() => {
    const initTranslate = () => {
      if (typeof window !== 'undefined' && window.google?.translate && hiddenElementRef.current) {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'en,hy,ru,ka',
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            },
            'google_translate_element'
          );
          setIsLoaded(true);
        } catch (error) {
          console.error('Error initializing Google Translate:', error);
        }
      }
    };

    // Wait for Google Translate to load
    if (typeof window !== 'undefined') {
      if (window.google?.translate) {
        initTranslate();
      } else {
        // Wait for script to load
        const checkInterval = setInterval(() => {
          if (window.google?.translate) {
            initTranslate();
            clearInterval(checkInterval);
          }
        }, 100);

        return () => clearInterval(checkInterval);
      }
    }

    // Hide Google Translate banner and elements
    const style = document.createElement('style');
    style.id = 'google-translate-styles';
    style.textContent = `
      .goog-te-banner-frame {
        display: none !important;
      }
      #google_translate_element {
        position: absolute !important;
        left: -9999px !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .goog-te-menu-frame {
        display: none !important;
      }
      .skiptranslate {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById('google-translate-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  // Detect current language from Google Translate
  useEffect(() => {
    const checkLanguage = () => {
      if (typeof window !== 'undefined') {
        // Check cookie first
        const cookieLang = document.cookie
          .split('; ')
          .find(row => row.startsWith('googtrans='));
        
        if (cookieLang) {
          const langValue = cookieLang.split('=')[1];
          const langCode = langValue.split('/').pop()?.split('-')[0] as LanguageCode;
          if (langCode && langCode in LANGUAGES) {
            setCurrentLang(langCode);
            return;
          }
        }

        // Fallback to html lang attribute
        const lang = document.documentElement.lang || 'en';
        const langCode = lang.split('-')[0] as LanguageCode;
        if (langCode in LANGUAGES) {
          setCurrentLang(langCode);
        }
      }
    };

    checkLanguage();
    const interval = setInterval(checkLanguage, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const changeLanguage = (langCode: LanguageCode) => {
    if (typeof window !== 'undefined' && currentLang !== langCode) {
      const langMap: Record<LanguageCode, string> = {
        en: 'en',
        hy: 'hy',
        ru: 'ru',
        ka: 'ka',
      };

      const langValue = langMap[langCode];
      setCurrentLang(langCode);
      setShowMenu(false);
      
      // Try to find and use Google Translate select
      const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      
      if (select) {
        // Wait a bit for menu to close
        setTimeout(() => {
          if (select.value !== langValue) {
            select.value = langValue;
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
          }
        }, 100);
      } else {
        // Fallback: set cookie directly and reload
        document.cookie = `googtrans=/en/${langValue}; path=/; max-age=31536000`;
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <div
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-1 cursor-pointer text-gray-700 hover:text-gray-900 transition-colors"
        >
          <span className="text-sm">{LANGUAGES[currentLang].code.toUpperCase()}</span>
          <ChevronDownIcon />
        </div>
        {showMenu && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {Object.values(LANGUAGES).map((lang) => {
              const isActive = currentLang === lang.code;
              const icon = getLanguageIcon(lang.code);
              const colorClass = getLanguageColor(lang.code, isActive);
              
              return (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  disabled={isActive}
                  className={`w-full text-left px-4 py-3 text-sm transition-all duration-150 border-l-4 ${
                    isActive
                      ? `${colorClass} text-gray-900 font-semibold cursor-default`
                      : 'text-gray-700 hover:bg-gray-50 cursor-pointer border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 flex items-center justify-between">
                      <span className={isActive ? 'font-semibold' : 'font-medium'}>
                        {lang.nativeName}
                      </span>
                      <span className={`text-xs ml-2 ${isActive ? 'text-gray-700 font-semibold' : 'text-gray-500'}`}>
                        {lang.code.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Hidden element for Google Translate */}
      <div ref={hiddenElementRef} id="google_translate_element" className="absolute -left-[9999px] opacity-0 pointer-events-none"></div>
      
      <Script
        id="google-translate-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            function googleTranslateElementInit() {
              if (window.google && window.google.translate) {
                new google.translate.TranslateElement({
                  pageLanguage: 'en',
                  includedLanguages: 'en,hy,ru,ka',
                  layout: google.translate.TranslateElement.InlineLayout.SIMPLE
                }, 'google_translate_element');
              }
            }
          `,
        }}
      />
      <Script
        id="google-translate-script"
        strategy="afterInteractive"
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      />
    </>
  );
}

