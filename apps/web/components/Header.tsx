'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { getStoredCurrency, setStoredCurrency, type CurrencyCode, CURRENCIES, formatPrice } from '../lib/currency';
import { getStoredLanguage, setStoredLanguage } from '../lib/language';
import { useAuth } from '../lib/auth/AuthContext';
import { apiClient } from '../lib/api-client';
import { GoogleTranslate } from './GoogleTranslate';
import contactData from '../../../config/contact.json';
import { Instagram, Facebook, Linkedin } from 'lucide-react';

type SocialLinks = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
};

const socialLinks: SocialLinks =
  (contactData as typeof contactData & { social?: SocialLinks }).social || {};

interface Category {
  id: string;
  slug: string;
  title: string;
  fullPath: string;
  children: Category[];
}

interface CategoriesResponse {
  data: Category[];
}

// Icon Components
const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <path d="M5 17C5 14.5 7.5 12.5 10 12.5C12.5 12.5 15 14.5 15 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CompareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left arrow pointing right */}
    <path d="M3 10L7 6M3 10L7 14M3 10H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    {/* Right arrow pointing left */}
    <path d="M17 10L13 6M17 10L13 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
  
const WishlistIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 17L8.55 15.7C4.4 12.2 2 10.1 2 7.5C2 5.4 3.4 4 5.5 4C6.8 4 8.1 4.6 9 5.5C9.9 4.6 11.2 4 12.5 4C14.6 4 16 5.4 16 7.5C16 10.1 13.6 12.2 9.45 15.7L10 17Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const CartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3H5L5.5 5M7 13H15L18 5H5.5M7 13L5.5 5M7 13L5.5 15.5M7 13H15M15 13C14.4 13 13.9 13.4 13.8 14M15 13C15.6 13 16.1 13.4 16.2 14M5.5 15.5H16.5M5.5 15.5C5.2 15.5 5 15.7 5 16C5 16.3 5.2 16.5 5.5 16.5H16.5C16.8 16.5 17 16.3 17 16C17 15.7 16.8 15.5 16.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <path d="M14 14L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

interface BadgeIconProps {
  icon: React.ReactNode;
  badge?: number;
  className?: string;
  iconClassName?: string;
}

const BadgeIcon = ({ icon, badge = 0, className = '', iconClassName = '' }: BadgeIconProps) => (
  <div className={`relative ${className}`}>
    <div className={iconClassName}>
      {icon}
    </div>
    {badge > 0 && (
      <span className="
      absolute 
      -top-5 
      -right-5 
      bg-gradient-to-br from-red-500 to-red-600 
      text-white text-[10px] font-bold 
      rounded-full min-w-[20px] h-5 px-1.5 
      flex items-center justify-center 
      leading-none shadow-lg border-2 border-white 
      animate-pulse
    ">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </div>
);

const WISHLIST_KEY = 'shop_wishlist';
const COMPARE_KEY = 'shop_compare';
const CART_KEY = 'shop_cart_guest';

function getWishlistCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(WISHLIST_KEY);
    return stored ? JSON.parse(stored).length : 0;
  } catch {
    return 0;
  }
}

function getCompareCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(COMPARE_KEY);
    return stored ? JSON.parse(stored).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Component that syncs search params with state
 * Must be wrapped in Suspense because it uses useSearchParams()
 */
function HeaderSearchSync({
  setSearchQuery,
  setSelectedCategory,
  categories,
}: {
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: Category | null) => void;
  categories: Category[];
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const searchParam = searchParams.get('search');
    const categoryParam = searchParams.get('category');
    setSearchQuery(searchParam || '');
    
    // Set selected category from URL
    if (categoryParam && categories.length > 0) {
      const flattenCategories = (cats: Category[]): Category[] => {
        const result: Category[] = [];
        cats.forEach((cat) => {
          result.push(cat);
          if (cat.children && cat.children.length > 0) {
            result.push(...flattenCategories(cat.children));
          }
        });
        return result;
      };
      const allCategories = flattenCategories(categories);
      const foundCategory = allCategories.find((cat) => cat.slug === categoryParam);
      setSelectedCategory(foundCategory || null);
    } else {
      setSelectedCategory(null);
    }
  }, [searchParams, categories, setSearchQuery, setSelectedCategory]);

  return null;
}

export function Header() {
  const router = useRouter();
  const { isLoggedIn, user, logout, isAdmin } = useAuth();
  const [compareCount, setCompareCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCurrency, setShowCurrency] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProductsMenu, setShowProductsMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const currencyRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const productsMenuRef = useRef<HTMLDivElement>(null);
  const productsMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch cart data with debouncing
  const fetchCart = async () => {
    // Եթե օգտատերը գրանցված չէ, օգտագործում ենք localStorage
    if (!isLoggedIn) {
      if (typeof window === 'undefined') {
        setCartCount(0);
        setCartTotal(0);
        return;
      }

      try {
        const stored = localStorage.getItem(CART_KEY);
        const guestCart: Array<{ productId: string; productSlug?: string; variantId: string; quantity: number }> = stored ? JSON.parse(stored) : [];
        
        if (guestCart.length === 0) {
          setCartCount(0);
          setCartTotal(0);
          return;
        }

        const itemsCount = guestCart.reduce((sum, item) => sum + item.quantity, 0);
        setCartCount(itemsCount);

        // Հաշվարկում ենք total-ը ապրանքների գների հիման վրա
        // և հեռացնում ենք գոյություն չունեցող ապրանքները
        let total = 0;
        const validCartItems: typeof guestCart = [];
        
        try {
          const itemsWithPrices = await Promise.all(
            guestCart.map(async (item) => {
              try {
                if (!item.productSlug) {
                  return { price: 0, isValid: false };
                }

                const productData = await apiClient.get<{
                  variants?: Array<{
                    _id: string;
                    id: string;
                    price: number;
                  }>;
                }>(`/api/v1/products/${item.productSlug}`);

                const variant = productData.variants?.find(v => 
                  (v._id?.toString() || v.id) === item.variantId
                ) || productData.variants?.[0];

                if (!variant) {
                  return { price: 0, isValid: false };
                }

                // Ապրանքը գոյություն ունի, ավելացնում ենք validCartItems-ին
                validCartItems.push(item);
                return { price: variant.price * item.quantity, isValid: true };
              } catch (error: any) {
                // 404 սխալը նորմալ իրավիճակ է (ապրանքը հեռացված է կամ չհրապարակված)
                if (error?.status === 404 || error?.statusCode === 404) {
                  console.warn(`⚠️ [CART] Ապրանքը գոյություն չունի կամ հեռացված է: ${item.productSlug}`);
                } else {
                  // Այլ սխալների համար լոգավորում ենք
                  console.error(`❌ [CART] Սխալ ապրանքը բեռնելիս ${item.productId}:`, error);
                }
                return { price: 0, isValid: false };
              }
            })
          );

          total = itemsWithPrices.reduce((sum, item) => sum + item.price, 0);
          
          // Եթե հեռացվել են ապրանքներ, թարմացնում ենք localStorage-ը
          if (validCartItems.length !== guestCart.length) {
            const removedCount = guestCart.length - validCartItems.length;
            console.log(`🧹 [CART] Հեռացվել է ${removedCount} գոյություն չունեցող ապրանք զամբյուղից`);
            
            if (validCartItems.length > 0) {
              localStorage.setItem(CART_KEY, JSON.stringify(validCartItems));
            } else {
              localStorage.removeItem(CART_KEY);
            }
            
            // Թարմացնում ենք itemsCount-ը
            const newItemsCount = validCartItems.reduce((sum, item) => sum + item.quantity, 0);
            setCartCount(newItemsCount);
          }
        } catch (error) {
          console.error('❌ [CART] Սխալ զամբյուղի ընդհանուր գումարը հաշվարկելիս:', error);
        }

        setCartTotal(total);
      } catch (error) {
        console.error('Error loading guest cart:', error);
        setCartCount(0);
        setCartTotal(0);
      }
      return;
    }

    // Check if token exists in localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setCartCount(0);
        setCartTotal(0);
        return;
      }
    }

    // Small delay to avoid simultaneous requests
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const response = await apiClient.get<{
        cart: {
          itemsCount: number;
          totals: {
            total: number;
          };
        };
      }>('/api/v1/cart');
      
      setCartCount(response.cart?.itemsCount || 0);
      setCartTotal(response.cart?.totals?.total || 0);
    } catch (error: any) {
      // Only log non-authentication errors
      if (error?.status !== 401 && error?.statusCode !== 401) {
        console.error('Error fetching cart:', error);
      }
      // Silently handle 401 errors (user not logged in or token expired)
      setCartCount(0);
      setCartTotal(0);
    }
  };

  // Load wishlist and compare counts from localStorage
  useEffect(() => {
    const updateCounts = () => {
      setWishlistCount(getWishlistCount());
      setCompareCount(getCompareCount());
    };

    // Initial load
    updateCounts();

    // Listen for updates
    const handleWishlistUpdate = () => {
      setWishlistCount(getWishlistCount());
    };

    const handleCompareUpdate = () => {
      setCompareCount(getCompareCount());
    };

    const handleAuthUpdate = () => {
      // Refresh counts when auth state changes
      updateCounts();
      fetchCart();
    };

    const handleCartUpdate = () => {
      fetchCart();
    };

    window.addEventListener('wishlist-updated', handleWishlistUpdate);
    window.addEventListener('compare-updated', handleCompareUpdate);
    window.addEventListener('auth-updated', handleAuthUpdate);
    window.addEventListener('cart-updated', handleCartUpdate);

    return () => {
      window.removeEventListener('wishlist-updated', handleWishlistUpdate);
      window.removeEventListener('compare-updated', handleCompareUpdate);
      window.removeEventListener('auth-updated', handleAuthUpdate);
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, [isLoggedIn]);

  // Fetch cart when logged in state changes
  useEffect(() => {
    fetchCart();
  }, [isLoggedIn]);

  // Load currency from localStorage and ensure language is 'en'
  useEffect(() => {
    // Only set language to English if it's not already 'en' to avoid infinite reload
    const currentLanguage = getStoredLanguage();
    if (currentLanguage !== 'en') {
      setStoredLanguage('en');
      // setStoredLanguage will reload the page, so we return early
      return;
    }
    
    setSelectedCurrency(getStoredCurrency());

    const handleCurrencyUpdate = () => {
      setSelectedCurrency(getStoredCurrency());
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);

    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
    };
  }, []);

  // Sync search input with URL params - handled by HeaderSearchSync component wrapped in Suspense

  // Fetch categories (language is always 'en')
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      // Small delay to avoid simultaneous requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Language is always 'en'
      const response = await apiClient.get<CategoriesResponse>('/api/v1/categories/tree', {
        params: { lang: 'en' },
      });
      setCategories(response.data || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Flatten categories tree to show all categories
  const flattenCategories = (cats: Category[]): Category[] => {
    const result: Category[] = [];
    cats.forEach((cat) => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children));
      }
    });
    return result;
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(event.target as Node)) {
        setShowCurrency(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (productsMenuRef.current && !productsMenuRef.current.contains(event.target as Node)) {
        setShowProductsMenu(false);
      }
      if (searchModalRef.current && !searchModalRef.current.contains(event.target as Node)) {
        setShowSearchModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (productsMenuTimeoutRef.current) {
        clearTimeout(productsMenuTimeoutRef.current);
      }
    };
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchModal]);

  // Close search modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSearchModal) {
        setShowSearchModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSearchModal]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    const params = new URLSearchParams();
    
    if (query) {
      params.set('search', query);
    }
    
    // Note: Category selection is removed from search modal
    // Users can use the categories icon button in header for category filtering
    
    setShowSearchModal(false);
    const queryString = params.toString();
    router.push(queryString ? `/products?${queryString}` : '/products');
  };

  const handleCurrencyChange = (currency: CurrencyCode) => {
    setStoredCurrency(currency);
    setSelectedCurrency(currency);
    setShowCurrency(false);
    // Trigger currency update event to refresh prices
    window.dispatchEvent(new Event('currency-updated'));
  };

  return (
    <header className="bg-gradient-to-b from-gray-50 to-white sticky top-0 z-50 border-b border-gray-200/80 shadow-sm backdrop-blur-sm bg-white/95">
      <Suspense fallback={null}>
        <HeaderSearchSync
          setSearchQuery={setSearchQuery}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
        />
      </Suspense>
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-sm">
            {/* Phone + Social */}
            <div className="flex items-center gap-4 text-gray-700">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 3C2 2.44772 2.44772 2 3 2H5.15287C5.64171 2 6.0589 2.35341 6.13927 2.8356L6.87858 7.27147C6.95075 7.70451 6.73206 8.13397 6.3394 8.3303L4.79126 9.10437C5.90715 11.8783 8.12168 14.0929 10.8956 15.2088L11.6697 13.6606C11.866 13.2679 12.2955 13.0493 12.7285 13.1214L17.1644 13.8607C17.6466 13.9411 18 14.3583 18 14.8471V17C18 17.5523 17.5523 18 17 18H15C7.8203 18 2 12.1797 2 5V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{contactData.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 pl-3 border-l border-gray-200">
                <a
                  href={socialLinks.instagram || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-pink-600 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href={socialLinks.facebook || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href={socialLinks.linkedin || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-700 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Currency and Google Translate */}
            <div className="flex items-center gap-4">
              {/* Google Translate */}
              <GoogleTranslate />
              
              {/* Currency Selector */}
              <div className="relative" ref={currencyRef}>
                <div
                  onClick={() => {
                    setShowCurrency(!showCurrency);
                  }}
                  className="flex items-center gap-1 cursor-pointer text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <span className="text-sm">{selectedCurrency}</span>
                  <ChevronDownIcon />
                </div>
                {showCurrency && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-gray-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {Object.values(CURRENCIES).map((currency) => (
                      <button
                        key={currency.code}
                        onClick={() => handleCurrencyChange(currency.code)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-all duration-150 ${selectedCurrency === currency.code
                            ? 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-900 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{currency.code}</span>
                          <span className="text-gray-500">{currency.symbol}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto pl-4 sm:pl-6 lg:pl-8 pr-4 sm:pr-6 lg:pr-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0 group">
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover:from-gray-800 group-hover:to-gray-600 transition-all duration-300">
              White-Shop
            </span>
          </Link>

          {/* Navigation Links - Centered */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {/* Home Link */}
            <Link href="/" className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium whitespace-nowrap">
              Home
            </Link>
            {/* Products with Categories Dropdown */}
            <div 
              className="relative" 
              ref={productsMenuRef}
              onMouseEnter={() => {
                // Clear any pending timeout
                if (productsMenuTimeoutRef.current) {
                  clearTimeout(productsMenuTimeoutRef.current);
                  productsMenuTimeoutRef.current = null;
                }
                setShowProductsMenu(true);
              }}
              onMouseLeave={() => {
                // Add small delay before closing to allow mouse movement to dropdown
                productsMenuTimeoutRef.current = setTimeout(() => {
                  setShowProductsMenu(false);
                }, 150);
              }}
            >
              <Link
                href="/categories"
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium whitespace-nowrap flex items-center gap-1"
              >
                Products
                <ChevronDownIcon />
              </Link>
              {showProductsMenu && (
                <>
                  {/* Invisible bridge to prevent gap issues */}
                  <div className="absolute top-full left-0 w-full h-2" />
                  <div className="absolute top-full left-0 pt-2 w-64 z-50">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200/80 overflow-hidden max-h-[400px] overflow-y-auto">
                      <Link
                        href="/products"
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150 font-medium border-b border-gray-100"
                        onClick={() => setShowProductsMenu(false)}
                      >
                        All Products
                      </Link>
                      {loadingCategories ? (
                        <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
                      ) : (
                        flattenCategories(categories).map((category) => (
                          <Link
                            key={category.id}
                            href={`/products?category=${category.slug}`}
                            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150"
                            onClick={() => setShowProductsMenu(false)}
                          >
                            {category.title}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Link href="/about" className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium whitespace-nowrap">
              About Us
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium whitespace-nowrap">
              Contact
            </Link>
          </nav>

          {/* Right Side Actions - Icons Only */}
          <div className="flex items-center gap-2">
            {/* Search Icon Button */}
            <button
              onClick={() => {
                setShowSearchModal(!showSearchModal);
                setShowCurrency(false);
              }}
              className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 relative group"
              aria-label="Search"
            >
              <SearchIcon />
            </button>

            {/* Icons */}
              {/* Profile / User Menu */}
              <div className="relative" ref={userMenuRef}>
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                    >
                      <ProfileIcon />
                    </button>
                    {showUserMenu && (
                      <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl shadow-2xl border border-gray-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <Link
                          href="/profile"
                          className="block px-5 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-150 font-medium border-b border-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          Profile
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            className="block px-5 py-3 text-sm text-blue-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-white transition-all duration-150 font-medium border-b border-gray-100"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Admin Panel
                            </div>
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
                          className="block w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-white transition-all duration-150 font-medium"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <Link href="/login" className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 group">
                    <ProfileIcon />
                  </Link>
                )}
              </div>

              {/* Compare */}
              <Link href="/compare" className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 relative group">
                <BadgeIcon icon={<CompareIcon />} badge={compareCount} />
              </Link>

              {/* Wishlist */}
              <Link href="/wishlist" className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 relative group">
                <BadgeIcon icon={<WishlistIcon />} badge={wishlistCount} />
              </Link>

              {/* Shopping Cart */}
              <Link href="/cart" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 relative">
                  <BadgeIcon icon={<CartIcon />} badge={cartCount} />
                </div>
                <span className="text-gray-800 font-bold text-sm hidden sm:block min-w-[3.5rem] group-hover:text-gray-900 transition-colors">
                  {formatPrice(cartTotal, selectedCurrency)}
                </span>
              </Link>
            </div>
          </div>

      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4">
          <div 
            ref={searchModalRef}
            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200/80 p-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              {/* Search Input */}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products"
                className="flex-1 h-11 px-4 border-2 border-gray-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm placeholder:text-gray-400"
              />
              
              {/* Search Button */}
              <button
                type="submit"
                className="h-11 px-6 bg-gray-900 text-white rounded-r-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                <SearchIcon />
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}

