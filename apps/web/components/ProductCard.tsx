'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice, getStoredCurrency } from '../lib/currency';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth/AuthContext';

interface ProductLabel {
  id: string;
  type: 'text' | 'percentage';
  value: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color: string | null;
}

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
  labels?: ProductLabel[];
  compareAtPrice?: number;
  originalPrice?: number | null;
  globalDiscount?: number | null;
}

type ViewMode = 'list' | 'grid-2' | 'grid-3';

interface ProductCardProps {
  product: Product;
  viewMode?: ViewMode;
}

const WISHLIST_KEY = 'shop_wishlist';
const COMPARE_KEY = 'shop_compare';

// Иконки
const CompareIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M3 10L7 6M3 10L7 14M3 10H17M17 10L13 6M17 10L13 14" 
      stroke="currentColor" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      fill={filled ? "currentColor" : "none"}
    />
  </svg>
);

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

const CartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M3 3H5L5.5 5M7 13H15L18 5H5.5M7 13L5.5 5M7 13L5.5 15.5M7 13H15M15 13C14.4 13 13.9 13.4 13.8 14M15 13C15.6 13 16.1 13.4 16.2 14M5.5 15.5H16.5M5.5 15.5C5.2 15.5 5 15.7 5 16C5 16.3 5.2 16.5 5.5 16.5H16.5C16.8 16.5 17 16.3 17 16C17 15.7 16.8 15.5 16.5 15.5" 
      stroke="currentColor" 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
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
  const handleWishlistToggle = (e: React.MouseEvent) => {
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
  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(COMPARE_KEY);
      const compare: string[] = stored ? JSON.parse(stored) : [];
      
      // Максимум 4 продукта для сравнения
      if (isInCompare) {
        const updated = compare.filter((id) => id !== product.id);
        localStorage.setItem(COMPARE_KEY, JSON.stringify(updated));
        setIsInCompare(false);
      } else {
        if (compare.length >= 4) {
          alert('You can compare maximum 4 products');
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
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product.inStock) {
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

        const productDetails = await apiClient.get<ProductDetails>(`/api/v1/products/${product.slug}`);
        
        if (!productDetails.variants || productDetails.variants.length === 0) {
          alert('No variants available');
          setIsAddingToCart(false);
          return;
        }

        const variantId = productDetails.variants[0].id;
        
        // Проверяем, есть ли уже этот товар в корзине
        const existingItem = cart.find(item => item.productId === product.id && item.variantId === variantId);
        
        if (existingItem) {
          existingItem.quantity += 1;
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
      } catch (error) {
        console.error('Error adding to guest cart:', error);
        // Если не удалось добавить в localStorage, перенаправляем на login
        router.push(`/login?redirect=/products`);
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

      const productDetails = await apiClient.get<ProductDetails>(`/api/v1/products/${product.slug}`);

      if (!productDetails.variants || productDetails.variants.length === 0) {
        alert('No variants available');
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
      console.error('Error adding to cart:', error);
      // Если ошибка авторизации, перенаправляем на login
      if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error?.status === 401 || error?.statusCode === 401) {
        router.push(`/login?redirect=/products`);
      }
    } finally {
      setIsAddingToCart(false);
    }
  };

  // List view layout (similar to cart)
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-4 px-6 py-4">
          {/* Product Image - small like in cart */}
          <Link
            href={`/products/${product.slug}`}
            className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden"
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
          <div className="flex-1 min-w-0">
            <Link href={`/products/${product.slug}`} className="block">
              <h3 className="text-xl font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-2">
                {product.title}
              </h3>
              <p className="text-lg text-gray-500 mt-1">
                {product.brand?.name || 'Grocery'}
              </p>
            </Link>
          </div>

          {/* Price */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-blue-600 whitespace-nowrap">
                {formatPrice(product.price || 0, currency || 'USD')}
              </span>
              {(product.originalPrice && product.originalPrice > product.price) || 
               (product.compareAtPrice && product.compareAtPrice > product.price) ? (
                <span className="text-lg text-gray-500 line-through whitespace-nowrap">
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
            <div className="flex items-center gap-2">
              {/* Compare Icon */}
              <button
                onClick={handleCompareToggle}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isInCompare
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={isInCompare ? 'Remove from compare' : 'Add to compare'}
                aria-label={isInCompare ? 'Remove from compare' : 'Add to compare'}
              >
                <CompareIcon filled={isInCompare} />
              </button>

              {/* Wishlist Icon */}
              <button
                onClick={handleWishlistToggle}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isInWishlist
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <WishlistIcon filled={isInWishlist} />
              </button>

              {/* Cart Icon */}
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock || isAddingToCart}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  product.inStock && !isAddingToCart
                    ? 'bg-gray-100 text-gray-700 hover:bg-green-600 hover:text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={product.inStock ? 'Add to cart' : 'Out of stock'}
                aria-label={product.inStock ? 'Add to cart' : 'Out of stock'}
              >
                {isAddingToCart ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <CartIcon />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to get label style based on position and type
  const getLabelStyle = (label: ProductLabel) => {
    const baseStyle = 'absolute z-20 px-2 py-1 text-xs font-bold rounded-md';
    const positionStyles = {
      'top-left': 'top-2 left-2',
      'top-right': 'top-2 right-2',
      'bottom-left': 'bottom-2 left-2',
      'bottom-right': 'bottom-2 right-2',
    };
    
    let colorStyle = '';
    if (label.color) {
      colorStyle = `background-color: ${label.color}; color: white;`;
    } else {
      // Default colors based on type
      if (label.type === 'percentage') {
        colorStyle = 'bg-red-600 text-white';
      } else {
        // Text labels - different colors based on value
        const value = label.value.toLowerCase();
        if (value.includes('new') || value.includes('նոր')) {
          colorStyle = 'bg-green-600 text-white';
        } else if (value.includes('hot') || value.includes('տաք')) {
          colorStyle = 'bg-orange-600 text-white';
        } else if (value.includes('sale') || value.includes('զեղչ')) {
          colorStyle = 'bg-red-600 text-white';
        } else {
          colorStyle = 'bg-blue-600 text-white';
        }
      }
    }
    
    return `${baseStyle} ${positionStyles[label.position]} ${!label.color ? colorStyle : ''}`;
  };

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
        
        {/* Product Labels */}
        {product.labels && product.labels.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {product.labels.map((label) => (
              <div
                key={label.id}
                className={getLabelStyle(label)}
                style={label.color ? { backgroundColor: label.color, color: 'white' } : undefined}
              >
                {label.type === 'percentage' ? `${label.value}%` : label.value}
              </div>
            ))}
          </div>
        )}
        
        {/* Action Icons - появляются при наведении */}
        <div className={`absolute ${isCompact ? 'top-1.5 right-1.5' : 'top-3 right-3'} flex flex-col ${isCompact ? 'gap-1.5' : 'gap-2'} opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10`}>
          {/* Compare Icon */}
          <button
            onClick={handleCompareToggle}
            className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center transition-all duration-200 ${
              isInCompare
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
            }`}
            title={isInCompare ? 'Remove from compare' : 'Add to compare'}
            aria-label={isInCompare ? 'Remove from compare' : 'Add to compare'}
          >
            {isCompact ? (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M3 10L7 6M3 10L7 14M3 10H17M17 10L13 6M17 10L13 14" 
                  stroke="currentColor" 
                  strokeWidth="1.8" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill={isInCompare ? "currentColor" : "none"}
                />
              </svg>
            ) : (
              <CompareIcon filled={isInCompare} />
            )}
          </button>

          {/* Wishlist Icon */}
          <button
            onClick={handleWishlistToggle}
            className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center transition-all duration-200 ${
              isInWishlist
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
            }`}
            title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
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
          
          {/* Category - Using brand name as category or default to "Grocery" */}
          <p className={`${isCompact ? 'text-sm' : 'text-lg'} text-gray-500 ${isCompact ? 'mb-1' : 'mb-2'}`}>
            {product.brand?.name || 'Grocery'}
          </p>
        </Link>

        {/* Price + Cart Row */}
        <div className={`mt-2 flex items-center justify-between ${isCompact ? 'gap-2' : 'gap-4'}`}>
          <div className="flex flex-col">
            <span className={`${isCompact ? 'text-lg' : 'text-2xl'} font-semibold text-gray-900`}>
              {formatPrice(product.price || 0, currency || 'USD')}
            </span>
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
            title={product.inStock ? 'Add to cart' : 'Out of stock'}
            aria-label={product.inStock ? 'Add to cart' : 'Out of stock'}
          >
            {isAddingToCart ? (
              <svg className={`animate-spin ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              isCompact ? (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="M3 3H5L5.5 5M7 13H15L18 5H5.5M7 13L5.5 5M7 13L5.5 15.5M7 13H15M15 13C14.4 13 13.9 13.4 13.8 14M15 13C15.6 13 16.1 13.4 16.2 14M5.5 15.5H16.5M5.5 15.5C5.2 15.5 5 15.7 5 16C5 16.3 5.2 16.5 5.5 16.5H16.5C16.8 16.5 17 16.3 17 16C17 15.7 16.8 15.5 16.5 15.5" 
                    stroke="currentColor" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                </svg>
              ) : (
                <CartIcon />
              )
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

