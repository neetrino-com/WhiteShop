'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { getStoredLanguage } from '../lib/language';
import { ProductCard } from './ProductCard';

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
}

interface ProductsResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type FilterType = 'new-offers' | 'new' | 'featured' | 'bestseller';

interface Tab {
  id: FilterType;
  label: string;
  filter: string | null;
}

const tabs: Tab[] = [
  { id: 'new-offers', label: 'NEW OFFERS', filter: null },
  { id: 'new', label: 'NEW', filter: 'new' },
  { id: 'featured', label: 'FEATURED', filter: 'featured' },
  { id: 'bestseller', label: 'TOP SELLERS', filter: 'bestseller' },
];

const PRODUCTS_PER_PAGE = 10;

/**
 * FeaturedProductsTabs Component
 * Displays products with tabs for filtering (NEW OFFERS, NEW, FEATURED, TOP SELLERS)
 * Similar to the reference design with underlined active tab
 */
export function FeaturedProductsTabs() {
  const [activeTab, setActiveTab] = useState<FilterType>('new-offers');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch products based on active filter
   */
  const fetchProducts = async (filter: string | null) => {
    try {
      setLoading(true);
      setError(null);
      console.log('📦 [FeaturedProductsTabs] Fetching products with filter:', filter);

      const language = getStoredLanguage();
      const params: Record<string, string> = {
        page: '1',
        limit: PRODUCTS_PER_PAGE.toString(),
        lang: language,
      };

      // Add filter if provided (new-offers doesn't have filter, shows all)
      if (filter) {
        params.filter = filter;
      }

      const response = await apiClient.get<ProductsResponse>('/api/v1/products', {
        params,
      });

      console.log(`✅ [FeaturedProductsTabs] Loaded ${response.data.length} products`);
      // Ограничиваем до 10 продуктов максимум
      setProducts((response.data || []).slice(0, PRODUCTS_PER_PAGE));
    } catch (err: any) {
      console.error('❌ [FeaturedProductsTabs] Error fetching products:', err);
      setError('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle tab change
   */
  const handleTabChange = (tabId: FilterType) => {
    setActiveTab(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    fetchProducts(tab?.filter || null);
  };

  // Load products on mount
  useEffect(() => {
    fetchProducts(null); // Load all products for "NEW OFFERS"
  }, []);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Featured Products
        </h2>

        {/* Tabs Navigation */}
        <div className="flex justify-center items-center gap-6 md:gap-8 mb-8 flex-wrap">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  relative px-4 py-2 text-sm font-medium transition-colors duration-200
                  ${isActive 
                    ? 'text-red-600' 
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
                aria-label={`Show ${tab.label} products`}
                aria-pressed={isActive}
              >
                {tab.label}
                {/* Active indicator - underline */}
                {isActive && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(PRODUCTS_PER_PAGE)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => {
                const tab = tabs.find((t) => t.id === activeTab);
                fetchProducts(tab?.filter || null);
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.slice(0, PRODUCTS_PER_PAGE).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No products available in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
}

