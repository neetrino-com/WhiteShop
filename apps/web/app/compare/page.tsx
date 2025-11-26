'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@shop/ui';
import { apiClient } from '../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../lib/currency';
import { getStoredLanguage } from '../../lib/language';
import { getTranslation } from '../../lib/translations';
import { useAuth } from '../../lib/auth/AuthContext';

interface Product {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  inStock: boolean;
  brand: {
    id: string;
    name: string;
  } | null;
  description?: string;
}

const COMPARE_KEY = 'shop_compare';

function getCompare(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(COMPARE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}


export default function ComparePage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [currency, setCurrency] = useState(getStoredCurrency());
  const [language, setLanguage] = useState(getStoredLanguage());
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set());

  const translateLabel = useCallback(
    (key: string, fallback?: string) => {
      const value = getTranslation(key, language);
      if (value && value !== key) {
        return value;
      }
      const derived = fallback || key.split('.').pop() || key;
      const cleaned = derived
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim();
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    },
    [language]
  );

  useEffect(() => {
    // Get compare IDs from localStorage
    const ids = getCompare();
    setCompareIds(ids);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch products by IDs
    async function fetchProducts() {
      try {
        setLoading(true);
        // Fetch all products and filter by compare IDs
        const language = getStoredLanguage();
        const response = await apiClient.get<{
          data: Product[];
          meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
          };
        }>('/api/v1/products', {
          params: {
            limit: '1000', // Get all products to filter
            lang: language,
          },
        });

        // Filter products that are in compare
        const compareProducts = response.data.filter((product) =>
          ids.includes(product.id)
        );
        setProducts(compareProducts);
      } catch (error) {
        console.error('Error fetching compare products:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();

    // Listen for compare updates
    const handleCompareUpdate = () => {
      const updatedIds = getCompare();
      setCompareIds(updatedIds);
      if (updatedIds.length === 0) {
        setProducts([]);
      } else {
        // Re-fetch if needed
        fetchProducts();
      }
    };

    window.addEventListener('compare-updated', handleCompareUpdate);
    return () => {
      window.removeEventListener('compare-updated', handleCompareUpdate);
    };
  }, []);

  // Listen for currency and language updates
  useEffect(() => {
    const handleCurrencyUpdate = () => {
      setCurrency(getStoredCurrency());
    };

    const handleLanguageUpdate = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, []);

  const handleRemove = (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const updatedIds = compareIds.filter((id) => id !== productId);
    localStorage.setItem(COMPARE_KEY, JSON.stringify(updatedIds));
    setCompareIds(updatedIds);
    setProducts(products.filter((p) => p.id !== productId));
    window.dispatchEvent(new Event('compare-updated'));
  };

  const handleAddToCart = async (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product.inStock) {
      return;
    }

    if (!isLoggedIn) {
      router.push(`/login?redirect=/compare`);
      return;
    }

    setAddingToCart(prev => new Set(prev).add(product.id));

    try {
      // Get product details to get variant ID
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

      // Trigger cart update event
      window.dispatchEvent(new Event('cart-updated'));
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        router.push(`/login?redirect=/compare`);
      }
    } finally {
      setAddingToCart(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4 mx-auto"></div>
            <div className="mt-4 bg-gray-200 rounded-lg h-48"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{translateLabel('compare.title', 'Compare Products')}</h1>
        {products.length > 0 && (
          <p className="text-sm text-gray-600">
            {products.length} of 4 {products.length === 1 ? translateLabel('compare.product', 'Product') : translateLabel('compare.products', 'Products')}
          </p>
        )}
      </div>

      {products.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[150px] sticky left-0 bg-gray-50 z-10">
                    {translateLabel('compare.characteristic', 'Characteristic')}
                  </th>
                  {products.map((product) => (
                    <th
                      key={product.id}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 min-w-[220px] relative"
                    >
                      <button
                        onClick={(e) => handleRemove(e, product.id)}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                        title={translateLabel('compare.remove', 'Remove')}
                        aria-label={translateLabel('compare.remove', 'Remove')}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Изображение */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                    {translateLabel('compare.image', 'Image')}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-4 text-center">
                      <Link href={`/products/${product.slug}`} className="inline-block">
                        <div className="w-32 h-32 mx-auto bg-gray-100 rounded-lg overflow-hidden relative">
                          {product.image ? (
                            <Image
                              src={product.image}
                              alt={product.title}
                              fill
                              className="object-cover"
                              sizes="128px"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">No Image</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                  ))}
                </tr>

                {/* Название */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                    {translateLabel('compare.name', 'Name')}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-4">
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors block text-center"
                      >
                        {product.title}
                      </Link>
                    </td>
                  ))}
                </tr>

                {/* Бренд */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                    {translateLabel('compare.brand', 'Brand')}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-4 text-center text-sm text-gray-600">
                      {product.brand ? product.brand.name : '-'}
                    </td>
                  ))}
                </tr>

                {/* Цена */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                    {translateLabel('compare.price', 'Price')}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-lg font-bold text-gray-900">
                          {formatPrice(product.price, currency)}
                        </p>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <p className="text-sm text-gray-400 line-through">
                            {formatPrice(product.compareAtPrice, currency)}
                          </p>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Наличие */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                    {translateLabel('compare.availability', 'Availability')}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          product.inStock
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.inStock
                          ? getTranslation('stock.inStock', language)
                          : getTranslation('stock.outOfStock', language)}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Действия */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                    {translateLabel('compare.actions', 'Actions')}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="px-4 py-4 text-center">
                      <div className="flex flex-col gap-2 items-center">
                        <Link
                          href={`/products/${product.slug}`}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {translateLabel('compare.viewDetails', 'View details')}
                        </Link>
                        {product.inStock && (
                          <button
                            onClick={(e) => handleAddToCart(e, product)}
                            disabled={addingToCart.has(product.id)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {addingToCart.has(product.id)
                              ? translateLabel('cart.adding', 'Adding...')
                              : translateLabel('cart.addToCart', 'Add to cart')}
                          </button>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="max-w-md mx-auto">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {translateLabel('compare.empty', 'Compare list is empty')}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {translateLabel('compare.emptyDescription', 'Add products to compare them side by side.')}
            </p>
            <Link href="/products">
              <Button variant="primary" size="md">
                {translateLabel('compare.browseProducts', 'Browse products')}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

  