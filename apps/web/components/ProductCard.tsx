'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice, getStoredCurrency } from '../lib/currency';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth/AuthContext';
import { useTranslation } from '../lib/i18n-client';
import { CompareIcon } from './icons/CompareIcon';
import { CartIcon as CartPngIcon } from './icons/CartIcon';
import { ProductLabels } from './ProductLabels';

interface Product {
  id: string;
  slug: string;
  title: string;
  price: number;
  image: string | null;
  inStock: boolean;
  brand: {
    id: string;
    name: string;
  } | null;
  labels?: import('./ProductLabels').ProductLabel[];
  compareAtPrice?: number | null;
  originalPrice?: number | null;
  globalDiscount?: number | null;
  discountPercent?: number | null;
  colors?: string[]; // Available colors from variants
}

type ViewMode = 'list' | 'grid-2' | 'grid-3';

interface ProductCardProps {
  product: Product;
  viewMode?: ViewMode;
}

const WISHLIST_KEY = 'shop_wishlist';
const COMPARE_KEY = 'shop_compare';

// Color mapping for common color names
const colorMap: Record<string, string> = {
  beige: '#F5F5DC',
  black: '#000000',
  blue: '#0000FF',
  brown: '#A52A2A',
  gray: '#808080',
  grey: '#808080',
  green: '#008000',
  red: '#FF0000',
  white: '#FFFFFF',
  yellow: '#FFFF00',
  orange: '#FFA500',
  pink: '#FFC0CB',
  purple: '#800080',
  navy: '#000080',
  maroon: '#800000',
  teal: '#008080',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  lime: '#00FF00',
  olive: '#808000',
  silver: '#C0C0C0',
  gold: '#FFD700',
  tan: '#D2B48C',
  khaki: '#F0E68C',
  coral: '#FF7F50',
  salmon: '#FA8072',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  indigo: '#4B0082',
  crimson: '#DC143C',
  lavender: '#E6E6FA',
  peach: '#FFE5B4',
  mint: '#98FB98',
  ivory: '#FFFFF0',
  cream: '#FFFDD0',
};

const getColorHex = (colorName: string): string => {
  const normalized = colorName.toLowerCase().trim();
  return colorMap[normalized] || '#CCCCCC';
};

// Иконки
const WishlistIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M10 17L8.55 15.7C4.4 12.2 2 10.1 2 7.5C2 5.4 3.4 4 5.5 4C6.8 4 8.1 4.6 9 5.5C9.9 4.6 11.2 4 12.5 4C14.6 4 16 5.4 16 7.5C16 10.1 13.6 12.2 9.45 15.7L10 17Z" 
      stroke="currentColor" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill={filled ? "currentColor" : "none"} 
    />
  </svg>
);

/**
 * Product card component with Compare, Wishlist and Cart icons
 * Displays product image, title, category, price and action buttons
 */
export function ProductCard({ product, viewMode = 'grid-3' }: ProductCardProps) {
  const isCompact = viewMode === 'grid-3';
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [currency, setCurrency] = useState(getStoredCurrency());
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isInCompare, setIsInCompare] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Проверка состояния wishlist и compare
  useEffect(() => {
    const checkWishlist = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(WISHLIST_KEY);
        const wishlist = stored ? JSON.parse(stored) : [];
        setIsInWishlist(wishlist.includes(product.id));
      } catch {
        setIsInWishlist(false);
      }
    };

    const checkCompare = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(COMPARE_KEY);
        const compare = stored ? JSON.parse(stored) : [];
        setIsInCompare(compare.includes(product.id));
      } catch {
        setIsInCompare(false);
      }
    };

    checkWishlist();
    checkCompare();

    // Слушаем обновления
    const handleWishlistUpdate = () => checkWishlist();
    const handleCompareUpdate = () => checkCompare();

    window.addEventListener('wishlist-updated', handleWishlistUpdate);
    window.addEventListener('compare-updated', handleCompareUpdate);

    return () => {
      window.removeEventListener('wishlist-updated', handleWishlistUpdate);
      window.removeEventListener('compare-updated', handleCompareUpdate);
    };
  }, [product.id]);

  // Listen for currency updates
  useEffect(() => {
    const handleCurrencyUpdate = () => {
      setCurrency(getStoredCurrency());
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);
    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
    };
  }, []);

  // Добавление/удаление из wishlist
  const handleWishlistToggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Проверка авторизации - если не залогинен, перенаправляем на страницу входа
    if (!isLoggedIn) {
      router.push(`/login?redirect=/products`);
      return;
    }
    
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(WISHLIST_KEY);
      const wishlist: string[] = stored ? JSON.parse(stored) : [];
      
      if (isInWishlist) {
        const updated = wishlist.filter((id) => id !== product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
        setIsInWishlist(false);
      } else {
        wishlist.push(product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
        setIsInWishlist(true);
      }
      
      window.dispatchEvent(new Event('wishlist-updated'));
    } catch (error) {
      console.error('Error updating wishlist:', error);
    }
  };

  // Добавление/удаление из compare
  const handleCompareToggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(COMPARE_KEY);
      const compare: string[] = stored ? JSON.parse(stored) : [];
      
      // Максимум 4 продукта для сравнения
      console.info('[Compare] Toggling compare from ProductCard', {
        productId: product.id,
        action: isInCompare ? 'remove' : 'add',
      });
      if (isInCompare) {
        const updated = compare.filter((id) => id !== product.id);
        localStorage.setItem(COMPARE_KEY, JSON.stringify(updated));
        setIsInCompare(false);
      } else {
        if (compare.length >= 4) {
          alert(t('common.alerts.compareMaxReached'));
          return;
        }
        compare.push(product.id);
        localStorage.setItem(COMPARE_KEY, JSON.stringify(compare));
        setIsInCompare(true);
      }
      
      window.dispatchEvent(new Event('compare-updated'));
    } catch (error) {
      console.error('Error updating compare:', error);
    }
  };

  // Добавление в корзину
  const handleAddToCart = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product.inStock) {
      return;
    }

    // Validate product slug before making API call
    if (!product.slug || product.slug.trim() === '' || product.slug.includes(' ')) {
      console.error('❌ [PRODUCT CARD] Invalid product slug:', product.slug);
      alert(t('common.alerts.invalidProduct'));
      return;
    }

    // Если пользователь не залогинен, используем localStorage для корзины
    if (!isLoggedIn) {
      setIsAddingToCart(true);
      try {
        const CART_KEY = 'shop_cart_guest';
        const stored = localStorage.getItem(CART_KEY);
        const cart: Array<{ productId: string; productSlug: string; variantId?: string; quantity: number }> = stored ? JSON.parse(stored) : [];
        
        // Получаем детали продукта для получения variant ID
        interface ProductDetails {
          id: string;
          slug: string;
          variants?: Array<{
            id: string;
            sku: string;
            price: number;
            stock: number;
            available: boolean;
          }>;
        }

        // Encode slug to handle special characters
        const encodedSlug = encodeURIComponent(product.slug.trim());
        const productDetails = await apiClient.get<ProductDetails>(`/api/v1/products/${encodedSlug}`);
        
        if (!productDetails.variants || productDetails.variants.length === 0) {
          alert(t('common.alerts.noVariantsAvailable'));
          setIsAddingToCart(false);
          return;
        }

        const variantId = productDetails.variants[0].id;
        const variant = productDetails.variants[0];
        
        // Проверяем, есть ли уже этот товар в корзине
        const existingItem = cart.find(item => item.productId === product.id && item.variantId === variantId);
        
        // Calculate total quantity that will be in cart after adding
        const currentQuantityInCart = existingItem?.quantity || 0;
        const totalQuantity = currentQuantityInCart + 1;
        
        // Check if total quantity exceeds available stock
        if (totalQuantity > variant.stock) {
          console.log('🚫 [PRODUCT CARD - GUEST CART] Stock limit exceeded:', {
            variantId,
            currentInCart: currentQuantityInCart,
            requestedQuantity: 1,
            totalQuantity,
            availableStock: variant.stock
          });
          alert(t('common.alerts.noMoreStockAvailable'));
          setIsAddingToCart(false);
          return;
        }
        
        if (existingItem) {
          existingItem.quantity = totalQuantity;
          // Обновляем slug, если его не было
          if (!existingItem.productSlug) {
            existingItem.productSlug = productDetails.slug;
          }
        } else {
          cart.push({
            productId: product.id,
            productSlug: productDetails.slug || product.slug,
            variantId: variantId,
            quantity: 1,
          });
        }
        
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        window.dispatchEvent(new Event('cart-updated'));
      } catch (error: any) {
        console.error('❌ [PRODUCT CARD] Error adding to guest cart:', error);
        
        // Check if error is about product not found
        if (error?.message?.includes('does not exist') || error?.message?.includes('404') || error?.status === 404) {
          alert(t('common.alerts.productNotFound'));
        } else {
          // Если не удалось добавить в localStorage, перенаправляем на login
          router.push(`/login?redirect=/products`);
        }
      } finally {
        setIsAddingToCart(false);
      }
      return;
    }

    setIsAddingToCart(true);

    try {
      // Получаем детали продукта для получения variant ID
      interface ProductDetails {
        id: string;
        variants?: Array<{
          id: string;
          sku: string;
          price: number;
          stock: number;
          available: boolean;
        }>;
      }

      // Encode slug to handle special characters
      const encodedSlug = encodeURIComponent(product.slug.trim());
      const productDetails = await apiClient.get<ProductDetails>(`/api/v1/products/${encodedSlug}`);

      if (!productDetails.variants || productDetails.variants.length === 0) {
        alert(t('common.alerts.noVariantsAvailable'));
        return;
      }

      const variantId = productDetails.variants[0].id;
      
      await apiClient.post(
        '/api/v1/cart/items',
        {
          productId: product.id,
          variantId: variantId,
          quantity: 1,
        }
      );

      // Триггерим обновление корзины
      window.dispatchEvent(new Event('cart-updated'));
    } catch (error: any) {
      console.error('❌ [PRODUCT CARD] Error adding to cart:', error);
      
      // Check if error is about product not found
      if (error?.message?.includes('does not exist') || error?.message?.includes('404') || error?.status === 404 || error?.statusCode === 404) {
        alert(t('common.alerts.productNotFound'));
        setIsAddingToCart(false);
        return;
      }
      
      // Check if error is about insufficient stock
      if (error.response?.data?.detail?.includes('No more stock available') || 
          error.response?.data?.detail?.includes('exceeds available stock') ||
          error.response?.data?.title === 'Insufficient stock') {
        alert(t('common.alerts.noMoreStockAvailable'));
        setIsAddingToCart(false);
        return;
      }
      
      // Если ошибка авторизации, перенаправляем на login
      if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error?.status === 401 || error?.statusCode === 401) {
        router.push(`/login?redirect=/products`);
      } else {
        // Generic error message
        alert(t('common.alerts.failedToAddToCart'));
      }
    } finally {
      setIsAddingToCart(false);
    }
  };

  // List view layout (similar to cart)
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:bg-gray-50 transition-colors">
        {/* Mobile: Vertical layout, Desktop: Horizontal layout */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-4 sm:px-6 py-4">
          {/* Product Image - small like in cart */}
          <Link
            href={`/products/${product.slug}`}
            className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden self-start sm:self-center"
          >
            {product.image && !imageError ? (
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </Link>

          {/* Product Info */}
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <Link href={`/products/${product.slug}`} className="block">
              <h3 className="text-lg sm:text-xl font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-2">
                {product.title}
              </h3>
              <p className="text-base sm:text-lg text-gray-500 mt-1">
                {product.brand?.name || t('common.defaults.category')}
              </p>
            </Link>
            {/* Available Colors */}
            {product.colors && product.colors.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {product.colors.slice(0, 6).map((color, index) => {
                  const colorHex = getColorHex(color);
                  return (
                    <div
                      key={index}
                      className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: colorHex }}
                      title={color}
                      aria-label={`Color: ${color}`}
                    />
                  );
                })}
                {product.colors.length > 6 && (
                  <span className="text-sm text-gray-500">
                    +{product.colors.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Price and Actions - Mobile: Stacked, Desktop: Horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            {/* Price */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-semibold text-blue-600">
                  {formatPrice(product.price || 0, currency || 'USD')}
                </span>
                {product.discountPercent && product.discountPercent > 0 ? (
                  <span className="text-xs sm:text-sm font-semibold text-blue-600">
                    -{product.discountPercent}%
                  </span>
                ) : null}
              </div>
              {(product.originalPrice && product.originalPrice > product.price) || 
               (product.compareAtPrice && product.compareAtPrice > product.price) ? (
                <span className="text-base sm:text-lg text-gray-500 line-through mt-0.5">
                  {formatPrice(
                    (product.originalPrice && product.originalPrice > product.price) 
                      ? product.originalPrice 
                      : (product.compareAtPrice || 0), 
                    currency || 'USD'
                  )}
                </span>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              {/* Compare Icon */}
              <button
                onClick={handleCompareToggle}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  isInCompare
                    ? 'border-gray-900 text-gray-900 bg-white shadow-sm'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
                title={isInCompare ? t('common.messages.removedFromCompare') : t('common.messages.addedToCompare')}
                aria-label={isInCompare ? t('common.messages.removedFromCompare') : t('common.messages.addedToCompare')}
              >
                <CompareIcon isActive={isInCompare} />
              </button>

              {/* Wishlist Icon */}
              <button
                onClick={handleWishlistToggle}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isInWishlist
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={isInWishlist ? t('common.messages.removedFromWishlist') : t('common.messages.addedToWishlist')}
                aria-label={isInWishlist ? t('common.messages.removedFromWishlist') : t('common.messages.addedToWishlist')}
              >
                <WishlistIcon filled={isInWishlist} />
              </button>

              {/* Cart Icon */}
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock || isAddingToCart}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  product.inStock && !isAddingToCart
                    ? 'bg-gray-100 text-gray-700 hover:bg-green-600 hover:text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={product.inStock ? t('common.buttons.addToCart') : t('common.stock.outOfStock')}
                aria-label={product.inStock ? t('common.buttons.addToCart') : t('common.stock.outOfStock')}
              >
                {isAddingToCart ? (
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <CartPngIcon size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view layout (original)
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative group">
      {/* Product Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        <Link href={`/products/${product.slug}`} className="block w-full h-full">
          {product.image && !imageError ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              unoptimized
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-sm">No Image</span>
            </div>
          )}
        </Link>
        
        {/* Product Labels - stacked per corner */}
        {product.labels && product.labels.length > 0 && <ProductLabels labels={product.labels} />}
        
        {/* Action Icons - появляются при наведении */}
        <div className={`absolute ${isCompact ? 'top-1.5 right-1.5' : 'top-3 right-3'} flex flex-col ${isCompact ? 'gap-1.5' : 'gap-2'} opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10`}>
          {/* Compare Icon */}
          <button
            onClick={handleCompareToggle}
            className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              isInCompare
                ? 'border-gray-900 text-gray-900 bg-white shadow-sm'
                : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
            title={isInCompare ? t('common.messages.removedFromCompare') : t('common.messages.addedToCompare')}
            aria-label={isInCompare ? t('common.ariaLabels.removeFromCompare') : t('common.ariaLabels.addToCompare')}
          >
            <CompareIcon isActive={isInCompare} size={isCompact ? 16 : 18} />
          </button>

          {/* Wishlist Icon */}
          <button
            onClick={handleWishlistToggle}
            className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center transition-all duration-200 ${
              isInWishlist
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
            }`}
            title={isInWishlist ? t('common.messages.removedFromWishlist') : t('common.messages.addedToWishlist')}
            aria-label={isInWishlist ? t('common.ariaLabels.removeFromWishlist') : t('common.ariaLabels.addToWishlist')}
          >
            {isCompact ? (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M10 17L8.55 15.7C4.4 12.2 2 10.1 2 7.5C2 5.4 3.4 4 5.5 4C6.8 4 8.1 4.6 9 5.5C9.9 4.6 11.2 4 12.5 4C14.6 4 16 5.4 16 7.5C16 10.1 13.6 12.2 9.45 15.7L10 17Z" 
                  stroke="currentColor" 
                  strokeWidth="1.8" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill={isInWishlist ? "currentColor" : "none"} 
                />
              </svg>
            ) : (
              <WishlistIcon filled={isInWishlist} />
            )}
          </button>
        </div>
      </div>
      
      {/* Product Info */}
      <div className={isCompact ? 'p-2.5' : 'p-4'}>
        <Link href={`/products/${product.slug}`} className="block">
          {/* Product Title */}
          <h3 className={`${isCompact ? 'text-base' : 'text-xl'} font-medium text-gray-900 ${isCompact ? 'mb-0.5' : 'mb-1'} line-clamp-2`}>
            {product.title}
          </h3>
          
          {/* Category - Using brand name as category or default */}
          <p className={`${isCompact ? 'text-sm' : 'text-lg'} text-gray-500 ${isCompact ? 'mb-1' : 'mb-2'}`}>
            {product.brand?.name || t('common.defaults.category')}
          </p>
        </Link>

        {/* Available Colors */}
        {product.colors && product.colors.length > 0 && (
          <div className={`flex items-center gap-1.5 ${isCompact ? 'mb-1' : 'mb-2'} flex-wrap`}>
            {product.colors.slice(0, 6).map((color, index) => {
              const colorHex = getColorHex(color);
              return (
                <div
                  key={index}
                  className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full border border-gray-300 flex-shrink-0`}
                  style={{ backgroundColor: colorHex }}
                  title={color}
                  aria-label={t('common.ariaLabels.color').replace('{color}', color)}
                />
              );
            })}
            {product.colors.length > 6 && (
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-500`}>
                +{product.colors.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Price + Cart Row */}
        <div className={`mt-2 flex items-center justify-between ${isCompact ? 'gap-2' : 'gap-4'}`}>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`${isCompact ? 'text-lg' : 'text-2xl'} font-semibold text-gray-900`}>
                {formatPrice(product.price || 0, currency || 'USD')}
              </span>
              {product.discountPercent && product.discountPercent > 0 ? (
                <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-blue-600`}>
                  -{product.discountPercent}%
                </span>
              ) : null}
            </div>
            {(product.originalPrice && product.originalPrice > product.price) || 
             (product.compareAtPrice && product.compareAtPrice > product.price) ? (
              <span className={`${isCompact ? 'text-sm' : 'text-lg'} text-gray-500 line-through`}>
                {formatPrice(
                  (product.originalPrice && product.originalPrice > product.price) 
                    ? product.originalPrice 
                    : (product.compareAtPrice || 0), 
                  currency || 'USD'
                )}
              </span>
            ) : null}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock || isAddingToCart}
            className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center transition-all duration-200 ${
              product.inStock && !isAddingToCart
                ? 'bg-transparent text-gray-600 hover:bg-green-600 hover:text-white hover:shadow-md'
                : 'bg-transparent text-gray-400 cursor-not-allowed'
            }`}
            title={product.inStock ? t('common.buttons.addToCart') : t('common.stock.outOfStock')}
            aria-label={product.inStock ? t('common.ariaLabels.addToCart') : t('common.ariaLabels.outOfStock')}
          >
            {isAddingToCart ? (
              <svg className={`animate-spin ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <CartPngIcon size={isCompact ? 18 : 24} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

