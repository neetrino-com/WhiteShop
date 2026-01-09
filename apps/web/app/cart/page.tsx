'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@shop/ui';
import { apiClient } from '../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../lib/currency';
import { getStoredLanguage } from '../../lib/language';
import { useTranslation } from '../../lib/i18n-client';
import { useAuth } from '../../lib/auth/AuthContext';

interface CartItem {
  id: string;
  variant: {
    id: string;
    sku: string;
    stock?: number;
    product: {
      id: string;
      title: string;
      slug: string;
      image?: string | null;
    };
  };
  quantity: number;
  price: number;
  originalPrice?: number | null;
  total: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  itemsCount: number;
}

const CART_KEY = 'shop_cart_guest';

export default function CartPage() {
  const { isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState(getStoredCurrency());
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  // Track if we updated locally to prevent unnecessary re-fetch
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    fetchCart();

    const handleCurrencyUpdate = () => {
      setCurrency(getStoredCurrency());
    };


    const handleCartUpdate = () => {
      // If we just updated locally, skip re-fetch to avoid page reload
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      
      // Only re-fetch if update came from external source (another component)
      fetchCart();
    };

    const handleAuthUpdate = () => {
      fetchCart();
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('auth-updated', handleAuthUpdate);

    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('auth-updated', handleAuthUpdate);
    };
  }, [isLoggedIn]);

  async function fetchCart() {
    try {
      setLoading(true);
      
      // Եթե օգտատերը գրանցված չէ, օգտագործում ենք localStorage
      if (!isLoggedIn) {
        if (typeof window === 'undefined') {
          setCart(null);
          setLoading(false);
          return;
        }

        try {
          const stored = localStorage.getItem(CART_KEY);
          const guestCart: Array<{ productId: string; productSlug?: string; variantId: string; quantity: number }> = stored ? JSON.parse(stored) : [];
          
          if (guestCart.length === 0) {
            setCart(null);
            setLoading(false);
            return;
          }

          // Ստանում ենք ապրանքների տվյալները API-ից
          const itemsWithDetails: Array<{ item: CartItem | null; shouldRemove: boolean }> = await Promise.all(
            guestCart.map(async (item, index) => {
              try {
                // Եթե productSlug-ը չկա, ապրանքը չի կարող ստացվել (API-ն ակնկալում է slug)
                if (!item.productSlug) {
                  console.warn(`Product ${item.productId} does not have slug, removing from cart`);
                  return { item: null, shouldRemove: true };
                }

                // Ստանում ենք ապրանքի տվյալները slug-ով
                const productData = await apiClient.get<{
                  id: string;
                  slug: string;
                  translations?: Array<{ title: string; locale: string }>;
                  media?: Array<{ url?: string; src?: string } | string>;
                  variants?: Array<{
                    _id: string;
                    id: string;
                    sku: string;
                    price: number;
                    originalPrice?: number | null;
                    stock?: number;
                  }>;
                }>(`/api/v1/products/${item.productSlug}`);

                const variant = productData.variants?.find(v => 
                  (v._id?.toString() || v.id) === item.variantId
                ) || productData.variants?.[0];

                if (!variant) {
                  console.warn(`Variant ${item.variantId} not found for product ${item.productId}`);
                  return { item: null, shouldRemove: true };
                }

                const translation = productData.translations?.[0];
                const imageUrl = productData.media?.[0] 
                  ? (typeof productData.media[0] === 'string' 
                      ? productData.media[0] 
                      : productData.media[0].url || productData.media[0].src)
                  : null;

                return {
                  item: {
                    id: `${item.productId}-${item.variantId}-${index}`,
                    variant: {
                      id: variant._id?.toString() || variant.id,
                      sku: variant.sku || '',
                      stock: variant.stock !== undefined ? variant.stock : undefined,
                      product: {
                        id: productData.id,
                        title: translation?.title || t('common.messages.product'),
                        slug: productData.slug,
                        image: imageUrl,
                      },
                    },
                    quantity: item.quantity,
                    price: variant.price,
                    originalPrice: variant.originalPrice || null,
                    total: variant.price * item.quantity,
                  },
                  shouldRemove: false,
                };
              } catch (error: any) {
                // Եթե ապրանքը չի գտնվում (404), հեռացնում ենք այն localStorage-ից
                if (error?.status === 404 || error?.statusCode === 404) {
                  console.warn(`Product ${item.productId} not found (404), removing from cart`);
                  return { item: null, shouldRemove: true };
                }
                console.error(`Error fetching product ${item.productId}:`, error);
                return { item: null, shouldRemove: false };
              }
            })
          );

          // Հեռացնում ենք ապրանքները, որոնք չեն գտնվել
          const itemsToRemove = itemsWithDetails
            .map((result, index) => result.shouldRemove ? index : -1)
            .filter(index => index !== -1);
          
          if (itemsToRemove.length > 0) {
            const updatedCart = guestCart.filter((_, index) => !itemsToRemove.includes(index));
            localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));
          }

          const validItems = itemsWithDetails
            .map(result => result.item)
            .filter((item): item is CartItem => item !== null);
          
          if (validItems.length === 0) {
            setCart(null);
            setLoading(false);
            return;
          }

          const subtotal = validItems.reduce((sum, item) => sum + item.total, 0);
          const itemsCount = validItems.reduce((sum, item) => sum + item.quantity, 0);

          setCart({
            id: 'guest-cart',
            items: validItems,
            totals: {
              subtotal,
              discount: 0,
              shipping: 0,
              tax: 0,
              total: subtotal,
              currency: 'AMD',
            },
            itemsCount,
          });
        } catch (error) {
          console.error('Error loading guest cart:', error);
          setCart(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Եթե օգտատերը գրանցված է, օգտագործում ենք API
      const response = await apiClient.get<{ cart: Cart }>('/api/v1/cart');
      setCart(response.cart);
    } catch (error) {
      console.error('Error fetching cart:', error);
      setCart(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    // Optimistic update: remove item from UI immediately
    if (!cart) return;
    
    const itemToRemove = cart.items.find(item => item.id === itemId);
    if (!itemToRemove) return;

    // Mark as local update to prevent re-fetch in event handler
    isLocalUpdateRef.current = true;

    // Calculate new totals
    const updatedItems = cart.items.filter(item => item.id !== itemId);
    const newSubtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const newItemsCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

    // Update UI immediately (optimistic update - no loading state, no page reload)
    setCart({
      ...cart,
      items: updatedItems,
      totals: {
        ...cart.totals,
        subtotal: newSubtotal,
        total: newSubtotal + cart.totals.tax + cart.totals.shipping - cart.totals.discount,
      },
      itemsCount: newItemsCount,
    });

    try {
      // Եթե օգտատերը գրանցված չէ, օգտագործում ենք localStorage
      if (!isLoggedIn) {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem(CART_KEY);
        const guestCart: Array<{ productId: string; productSlug?: string; variantId: string; quantity: number }> = stored ? JSON.parse(stored) : [];
        
        // itemId-ն ունի format: `${productId}-${variantId}-${index}`
        const parts = itemId.split('-');
        if (parts.length >= 2) {
          const productId = parts[0];
          const variantId = parts.slice(1, -1).join('-'); // variantId-ն կարող է պարունակել '-'
          
          const updatedCart = guestCart.filter(
            item => !(item.productId === productId && item.variantId === variantId)
          );
          
          localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));
          // Dispatch event for other components (header, etc.) - but our handler won't re-fetch
          // because isLocalUpdateRef.current is true
          window.dispatchEvent(new Event('cart-updated'));
        }
        return;
      }

      // For logged-in users, delete from API
      await apiClient.delete(`/api/v1/cart/items/${itemId}`);
      // Dispatch event for other components (header, etc.) - but our handler won't re-fetch
      // because isLocalUpdateRef.current is true
      window.dispatchEvent(new Event('cart-updated'));
    } catch (error) {
      console.error('Error removing item:', error);
      // Revert optimistic update on error
      fetchCart();
    }
  }

  async function handleUpdateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) {
      handleRemoveItem(itemId);
      return;
    }

    // Find the cart item to check stock
    const cartItem = cart?.items.find(item => item.id === itemId);
    if (!cartItem) return;

    if (cartItem.variant.stock !== undefined) {
      if (quantity > cartItem.variant.stock) {
        alert(`Մատչելի քանակը ${cartItem.variant.stock} հատ է: Դուք չեք կարող ավելացնել ավելի շատ քանակ:`);
        return;
      }
    }

    // Mark as local update to prevent re-fetch in event handler
    isLocalUpdateRef.current = true;

    // Optimistic update: update UI immediately (no loading state, no page reload)
    if (cart) {
      const updatedItems = cart.items.map(item => 
        item.id === itemId 
          ? { ...item, quantity, total: item.price * quantity }
          : item
      );
      const newSubtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const newItemsCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

      setCart({
        ...cart,
        items: updatedItems,
        totals: {
          ...cart.totals,
          subtotal: newSubtotal,
          total: newSubtotal + cart.totals.tax + cart.totals.shipping - cart.totals.discount,
        },
        itemsCount: newItemsCount,
      });
    }

    setUpdatingItems(prev => new Set(prev).add(itemId));

    try {
      // Եթե օգտատերը գրանցված չէ, օգտագործում ենք localStorage
      if (!isLoggedIn) {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem(CART_KEY);
        const guestCart: Array<{ productId: string; productSlug?: string; variantId: string; quantity: number }> = stored ? JSON.parse(stored) : [];
        
        // itemId-ն ունի format: `${productId}-${variantId}-${index}`
        const parts = itemId.split('-');
        if (parts.length >= 2) {
          const productId = parts[0];
          const variantId = parts.slice(1, -1).join('-'); // variantId-ն կարող է պարունակել '-'
          
          const item = guestCart.find(
            item => item.productId === productId && item.variantId === variantId
          );
          
          if (item) {
            // Check stock for guest cart
            if (cartItem.variant.stock !== undefined && quantity > cartItem.variant.stock) {
              alert(`Մատչելի քանակը ${cartItem.variant.stock} հատ է: Դուք չեք կարող ավելացնել ավելի շատ քանակ:`);
              // Revert optimistic update
              fetchCart();
              setUpdatingItems(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
              });
              return;
            }
            
            item.quantity = quantity;
            localStorage.setItem(CART_KEY, JSON.stringify(guestCart));
            // Dispatch event for other components (header, etc.) - but our handler won't re-fetch
            // because isLocalUpdateRef.current is true
            window.dispatchEvent(new Event('cart-updated'));
          }
        }
        
        setUpdatingItems(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        return;
      }

      // For logged-in users, update via API
      await apiClient.patch(
        `/api/v1/cart/items/${itemId}`,
        { quantity }
      );

      // Dispatch event for other components (header, etc.) - but our handler won't re-fetch
      // because isLocalUpdateRef.current is true
      window.dispatchEvent(new Event('cart-updated'));
    } catch (error: any) {
      console.error('Error updating quantity:', error);
      // Revert optimistic update on error
      fetchCart();
      
      // Show user-friendly error message
      const errorMessage = error?.detail || error?.message || t('common.messages.failedToUpdateQuantity');
      if (errorMessage.includes('stock') || errorMessage.includes('exceeds')) {
        alert(t('common.alerts.stockInsufficient').replace('{message}', errorMessage));
      } else {
        alert(errorMessage);
      }
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }


  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('common.cart.title')}</h1>
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <Image
              src="https://cdn-icons-png.flaticon.com/512/3081/3081986.png"
              alt={t('common.cart.empty')}
              width={96}
              height={96}
              className="mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('common.cart.empty')}
            </h2>
            <Link href="/products">
              <Button variant="primary" size="lg" className="mt-6">
                {t('common.buttons.browseProducts')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('common.cart.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="md:col-span-6">
            <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{t('common.messages.product')}</span>
          </div>
          <div className="md:col-span-2 text-center">
            <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{t('common.messages.quantity')}</span>
          </div>
          <div className="md:col-span-3 text-center">
            <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{t('common.messages.subtotal')}</span>
          </div>
          <div className="md:col-span-1"></div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 px-4 sm:px-6 py-6 hover:bg-gray-50 transition-colors relative"
            >
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="absolute top-2 right-2 md:top-4 md:right-4 w-7 h-7 rounded-full bg-white hover:bg-red-50 flex items-center justify-center text-gray-500 hover:text-red-600 transition-colors shadow-md border border-gray-200 hover:border-red-300 z-10"
                aria-label={t('common.buttons.remove')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Product */}
              <div className="md:col-span-6 flex items-start gap-4">
                <Link
                  href={`/products/${item.variant.product.slug}`}
                  className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden"
                >
                  {item.variant.product.image ? (
                    <Image
                      src={item.variant.product.image}
                      alt={item.variant.product.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${item.variant.product.slug}`}
                    className="text-base font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
                  >
                    {item.variant.product.title}
                  </Link>
                  {item.variant.sku && (
                    <p className="text-xs text-gray-500 mt-1">{t('common.messages.sku')}: {item.variant.sku}</p>
                  )}
                </div>
              </div>

              {/* Quantity */}
              <div className="md:col-span-2 flex flex-col items-start md:items-center justify-center">
                <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase md:hidden">
                  {t('common.messages.quantity')}
                </p>
                <div className="flex items-center justify-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={updatingItems.has(item.id)}
                    className="w-9 h-9 flex-shrink-0 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t('common.ariaLabels.decreaseQuantity')}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={item.variant.stock !== undefined ? item.variant.stock : undefined}
                    value={item.quantity}
                    onChange={(e) => {
                      const newQuantity = parseInt(e.target.value) || 1;
                      handleUpdateQuantity(item.id, newQuantity);
                    }}
                    disabled={updatingItems.has(item.id)}
                    className="w-20 h-9 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-medium pl-2 pr-5"
                    title={item.variant.stock !== undefined ? t('common.messages.availableQuantity').replace('{stock}', item.variant.stock.toString()) : ''}
                  />
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={updatingItems.has(item.id) || (item.variant.stock !== undefined && item.quantity >= item.variant.stock)}
                    className="w-9 h-9 flex-shrink-0 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t('common.ariaLabels.increaseQuantity')}
                    title={item.variant.stock !== undefined && item.quantity >= item.variant.stock ? t('common.messages.availableQuantity').replace('{stock}', item.variant.stock.toString()) : t('common.messages.addQuantity')}
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Subtotal */}
              <div className="md:col-span-3 flex flex-col md:flex-row md:items-center md:justify-start md:ml-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                  {t('common.messages.subtotal')}
                </p>
                <div className="flex flex-col gap-1 mt-1 md:mt-0">
                  <span className="text-lg font-semibold text-blue-600">
                    {formatPrice(item.total, currency)}
                  </span>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <span className="text-sm text-gray-500 line-through">
                      {formatPrice(item.originalPrice * item.quantity, currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
        <div className="bg-white rounded-lg border border-gray-200 p-6 lg:sticky lg:top-24">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {t('common.cart.orderSummary')}
          </h2>
          <div className="space-y-4 mb-6">
            <div className="flex justify-between text-gray-600">
              <span>{t('common.cart.subtotal')}</span>
              <span>{formatPrice(cart.totals.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('common.cart.shipping')}</span>
              <span>{t('common.cart.free')}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('common.cart.tax')}</span>
              <span>{formatPrice(cart.totals.tax, currency)}</span>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>{t('common.cart.total')}</span>
                <span>{formatPrice(cart.totals.total, currency)}</span>
              </div>
            </div>
          </div>
          <Button 
            variant="primary" 
            className="w-full" 
            size="lg"
            onClick={() => {
              // Allow guest checkout - no redirect to login
              window.location.href = '/checkout';
            }}
          >
            {t('common.buttons.proceedToCheckout')}
          </Button>
          <Button
            variant="outline"
            className="w-full mt-3"
            size="md"
            onClick={() => {
              window.location.href = '/products';
            }}
          >
            {t('common.buttons.browseProducts')}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
