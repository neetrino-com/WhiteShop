'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '../lib/api-client';
import { getStoredLanguage } from '../lib/language';

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

interface Product {
  id: string;
  slug: string;
  title: string;
  image: string | null;
}

interface ProductsResponse {
  data: Product[];
  meta: {
    total: number;
  };
}

/**
 * Flatten categories tree to get all categories
 */
function flattenCategories(cats: Category[]): Category[] {
  const result: Category[] = [];
  cats.forEach((cat) => {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children));
    }
  });
  return result;
}

/**
 * Get category icon based on title/slug
 */
function getCategoryIcon(categoryTitle: string, categorySlug: string, isActive: boolean): React.ReactNode {
  const title = categoryTitle.toLowerCase();
  const slug = categorySlug.toLowerCase();

  // ALL category - grey circle
  if (title === 'all' || slug === 'all') {
    return (
      <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
        isActive ? 'bg-gray-300' : 'bg-gray-200'
      }`}>
        <span className="text-sm font-bold text-gray-900">ALL</span>
      </div>
    );
  }

  // NEW category - green circle
  if (title.includes('new') || slug.includes('new')) {
    return (
      <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
        isActive ? 'bg-green-200' : 'bg-green-100'
      }`}>
        <span className="text-sm font-bold text-green-700">NEW</span>
      </div>
    );
  }

  // SALE category - red circle
  if (title.includes('sale') || slug.includes('sale')) {
    return (
      <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
        isActive ? 'bg-red-200' : 'bg-red-100'
      }`}>
        <span className="text-sm font-bold text-red-700">SALE</span>
      </div>
    );
  }

  // Default - white circle (will be filled with product image if available)
  return (
    <div className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center overflow-hidden">
      {/* Product image will be inserted here if available */}
    </div>
  );
}

function CategoryNavigationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryProducts, setCategoryProducts] = useState<Record<string, Product | null>>({});
  const currentCategory = searchParams?.get('category');

  useEffect(() => {
    fetchCategories();
  }, []);

  /**
   * Fetch categories and first product for each category
   */
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const language = getStoredLanguage();
      const response = await apiClient.get<CategoriesResponse>('/api/v1/categories/tree', {
        params: { lang: language },
      });

      const categoriesList = response.data || [];
      const allCategories = flattenCategories(categoriesList);
      setCategories(allCategories);

      // Fetch first product with image for each category
      const products: Record<string, Product | null> = {};
      
      // Add "All" category
      const allCategoriesWithAll = [
        { id: 'all', slug: 'all', title: 'All', fullPath: 'all', children: [] } as Category,
        ...allCategories
      ];

      // Fetch products for each category
      const categoryPromises = allCategoriesWithAll.map(async (category) => {
        try {
          const productsResponse = await apiClient.get<ProductsResponse>('/api/v1/products', {
            params: {
              category: category.slug === 'all' ? undefined : category.slug,
              limit: '5',
              lang: language,
            },
          });
          // Get first product with image
          const productWithImage = productsResponse.data?.find(p => p.image) || productsResponse.data?.[0] || null;
          products[category.slug] = productWithImage;
        } catch (err) {
          console.error(`Error fetching product for category ${category.slug}:`, err);
          products[category.slug] = null;
        }
      });

      await Promise.all(categoryPromises);
      setCategoryProducts(products);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categorySlug: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    
    if (categorySlug && categorySlug !== 'all') {
      params.set('category', categorySlug);
    } else {
      params.delete('category');
    }
    
    // Reset to page 1 when changing category
    params.delete('page');
    
    router.push(`/products?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 overflow-x-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[100px]">
                <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse"></div>
                <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Add "All" category at the beginning
  const allCategoriesWithAll = [
    { id: 'all', slug: 'all', title: 'All', fullPath: 'all', children: [] } as Category,
    ...categories
  ];

  // Limit to first 10 categories for horizontal navigation
  const displayCategories = allCategoriesWithAll.slice(0, 10);

  return (
    <div className="bg-white border-b border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 md:gap-8 overflow-x-auto scrollbar-hide pb-2">
          {displayCategories.map((category) => {
            const isActive = category.slug === 'all' 
              ? !currentCategory 
              : currentCategory === category.slug;
            const product = categoryProducts[category.slug];
            const title = category.title;
            const slug = category.slug;
            
            // Determine label text
            let labelText = title;
            if (slug === 'all') {
              labelText = 'Shop All';
            } else if (title.toLowerCase().includes('new')) {
              labelText = 'New Arrivals';
            } else if (title.toLowerCase().includes('sale')) {
              labelText = 'Sale';
            }

            return (
              <Link
                key={category.id}
                href={category.slug === 'all' ? '/products' : `/products?category=${category.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategoryClick(category.slug === 'all' ? null : category.slug);
                }}
                className="flex flex-col items-center gap-2 min-w-[100px] group cursor-pointer transition-all duration-200 hover:opacity-80"
              >
                {/* Category Icon/Image */}
                <div className="relative">
                  {(slug === 'all' || title.toLowerCase().includes('new') || title.toLowerCase().includes('sale')) ? (
                    getCategoryIcon(title, slug, isActive)
                  ) : (
                    <div className={`w-20 h-20 rounded-full bg-white border-2 flex items-center justify-center overflow-hidden transition-all ${
                      isActive ? 'border-gray-400 shadow-md' : 'border-gray-200'
                    }`}>
                      {product?.image ? (
                        <Image
                          src={product.image}
                          alt={category.title}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Category Label */}
                <span className={`text-xs text-center font-medium transition-colors ${
                  isActive 
                    ? 'text-gray-900 underline' 
                    : 'text-gray-700'
                }`}>
                  {labelText}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CategoryNavigation() {
  return (
    <Suspense fallback={
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 overflow-x-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[100px]">
                <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse"></div>
                <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <CategoryNavigationContent />
    </Suspense>
  );
}


