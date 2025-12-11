'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import { LANGUAGES, type LanguageCode } from '../lib/language';

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Language icons/emojis
const getLanguageIcon = (code: LanguageCode): React.ReactNode => {
  const icons: Record<LanguageCode, React.ReactNode> = {
    en: (
      <Image
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Flag_of_the_United_Kingdom_%283-5%29.svg/1024px-Flag_of_the_United_Kingdom_%283-5%29.svg.png"
        alt="English"
        width={30}
        height={30}
        className="rounded"
        unoptimized
      />
    ),
    hy: (
      <Image
          src="https://janarmenia.com/uploads/0000/83/2022/04/28/anthem-armenia.jpg"
        alt="Armenian"
        width={30}
        height={30}
         className="rounded"
        unoptimized
      />
    ),
    ru: (
      <Image
        src="https://flagfactoryshop.com/image/cache/catalog/products/flags/national/mockups/russia_coa-600x400.jpg"
        alt="Russian"
        width={30}
        height={30}
         className="rounded"
        unoptimized
      />
    ),
    ka: (
      <Image
        src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSRqHb4LNq5xqV85VxehTa7JFyB4SVIQqrWtA&s"
        alt="Georgian"
        width={30}
        height={30}
         className="rounded"
        unoptimized
      />
    ),
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
  // eslint-disable-next-line no-unused-vars
  interface Window {
    google: {
      translate: {
        TranslateElement: {
          new (
            // eslint-disable-next-line no-unused-vars
            options: {
              pageLanguage: string;
              includedLanguages: string;
              layout: number;
            },
            // eslint-disable-next-line no-unused-vars
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
  const menuRef = useRef<HTMLDivElement>(null);
  const hiddenElementRef = useRef<HTMLDivElement>(null);

  // Initialize Google Translate
  useEffect(() => {
    const initTranslate = () => {
      if (
        typeof window !== 'undefined' && 
        window.google?.translate && 
        window.google.translate.TranslateElement?.InlineLayout &&
        hiddenElementRef.current
      ) {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'en,hy,ru,ka',
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            },
            'google_translate_element'
          );
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
          if (
            window.google?.translate && 
            window.google.translate.TranslateElement?.InlineLayout
          ) {
            initTranslate();
            clearInterval(checkInterval);
          }
        }, 100);
        
        // Очистка интервала после 10 секунд, чтобы избежать бесконечного ожидания
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 10000);

        return () => clearInterval(checkInterval);
      }
    }

    // Hide Google Translate banner and elements
    const style = document.createElement('style');
    style.id = 'google-translate-styles';
    style.textContent = `
      .goog-te-banner-frame {
        display: none !important;
        visibility: hidden !important;
      }
      body {
        top: 0 !important;
      }
      #google_translate_element {
        position: absolute !important;
        left: -9999px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
      }
      .goog-te-menu-frame {
        display: none !important;
        visibility: hidden !important;
      }
      .goog-tooltip,
      .goog-tooltip:hover,
      .goog-te-balloon-frame {
        display: none !important;
      }
      .skiptranslate {
        display: none !important;
      }
      iframe#goog-gt-tt,
      .goog-te-balloon-frame {
        display: none !important;
        visibility: hidden !important;
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

  // Force-hide Google banner/balloon even when language changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hideGoogleElements = () => {
      const selectors = [
        '.goog-te-banner-frame',
        '.goog-te-menu-frame',
        '.goog-te-balloon-frame',
        '#goog-gt-tt',
      ];
      selectors.forEach((selector) => {
        const el = document.querySelector(selector);
        if (el && el.parentElement) {
          el.parentElement.removeChild(el);
        }
      });
      document.body.style.top = '0px';
    };

    hideGoogleElements();
    const observer = new MutationObserver(() => hideGoogleElements());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
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

  /**
   * Switches the page language via Google Translate and logs the change.
   */
  const changeLanguage = (langCode: LanguageCode) => {
    if (typeof window !== 'undefined' && currentLang !== langCode) {
      console.info('[Header][LangCurrency] Changing language', {
        from: currentLang,
        to: langCode,
      });

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
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              aria-expanded={showMenu}
              className="flex items-center gap-2 bg-white px-3 py-2 text-gray-800 transition-colors hover:bg-gray-50"
            >
              <span className="flex h-8 w-8 items-center justify-center text-lg leading-none">
                {getLanguageIcon(currentLang)}
              </span>
              <span className="text-sm font-medium">{LANGUAGES[currentLang].name}</span>
              <ChevronDownIcon />
            </button>
        {showMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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

