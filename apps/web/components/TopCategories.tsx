'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface CategoryWithData {
  category: Category;
  productCount: number;
  product: Product | null;
}

/**
 * Flatten categories tree to get all categories (root + children)
 */
function flattenAllCategories(cats: Category[]): Category[] {
  const result: Category[] = [];
  cats.forEach((cat) => {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenAllCategories(cat.children));
    }
  });
  return result;
}

/**
 * TopCategories Component
 * Displays top 5 categories with most products in circular icons
 */
export function TopCategories() {
  const router = useRouter();
  const [topCategories, setTopCategories] = useState<CategoryWithData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopCategories();
  }, []);

  /**
   * Fetch categories, get product counts, and select top 5
   */
  const fetchTopCategories = async () => {
    try {
      setLoading(true);
      console.log('📦 [TopCategories] Fetching categories...');
      
      const language = getStoredLanguage();
      const response = await apiClient.get<CategoriesResponse>('/api/v1/categories/tree', {
        params: { lang: language },
      });

      const categoriesList = response.data || [];
      // Get all categories including children (flatten the tree)
      const allCategories = flattenAllCategories(categoriesList);
      
      console.log('📦 [TopCategories] Total categories found:', allCategories.length);

      // Fetch product counts and first product with image for each category
      const categoryDataPromises = allCategories.map(async (category): Promise<CategoryWithData> => {
        try {
          // Fetch products to get count and find one with image
          const productsResponse = await apiClient.get<ProductsResponse>('/api/v1/products', {
            params: {
              category: category.slug,
              limit: '10', // Get more products to find one with image
              lang: language,
            },
          });
          
          const productCount = productsResponse.meta?.total || 0;
          // Get first product with image, or first product if no image available
          const productWithImage = productsResponse.data?.find(p => p.image) || productsResponse.data?.[0] || null;
          
          console.log(`✅ [TopCategories] Category "${category.title}": ${productCount} products, image: ${productWithImage?.image ? 'yes' : 'no'}`);
          
          return {
            category,
            productCount,
            product: productWithImage,
          };
        } catch (err) {
          console.error(`❌ [TopCategories] Error fetching products for category ${category.slug}:`, err);
          return {
            category,
            productCount: 0,
            product: null,
          };
        }
      });
      
      // Wait for all category data to load
      const allCategoryData = await Promise.all(categoryDataPromises);
      
      // Filter out categories with 0 products, sort by product count (descending), and take top 5
      const sortedCategories = allCategoryData
        .filter(item => item.productCount > 0)
        .sort((a, b) => b.productCount - a.productCount)
        .slice(0, 5);
      
      setTopCategories(sortedCategories);
      console.log('✅ [TopCategories] Top 5 categories selected:', sortedCategories.map(c => `${c.category.title} (${c.productCount} products)`));
    } catch (err: any) {
      console.error('❌ [TopCategories] Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categorySlug: string) => {
    router.push(`/products?category=${categorySlug}`);
  };

  if (loading) {
    return (
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center gap-8 md:gap-12 lg:gap-16 flex-wrap">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3 min-w-[120px]">
                <div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse shadow-sm"></div>
                <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (topCategories.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center gap-6 md:gap-8 lg:gap-12 xl:gap-16 flex-wrap">
          {topCategories.map((item) => {
            const { category, productCount, product } = item;
            
            return (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategoryClick(category.slug);
                }}
                className="flex flex-col items-center gap-3 group cursor-pointer transition-all duration-300 hover:scale-105 min-w-[120px] outline-none focus:outline-none hover:outline-none focus-visible:outline-none ring-0 focus:ring-0 hover:ring-0"
              >
                {/* Circular Icon with Product Image */}
                <div className="transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1 relative outline-none">
                  {product?.image ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 shadow-md transition-all duration-300 flex items-center justify-center outline-none ring-0">
                      <Image
                        src={product.image}
                        alt={category.title}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-300 outline-none"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center shadow-md transition-all duration-300 outline-none ring-0">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Category Name */}
                <span className="text-sm font-semibold text-gray-900 text-center max-w-[140px] group-hover:text-gray-700 transition-colors">
                  {category.title}
                </span>
                
                {/* Product Count */}
                <span className="text-xs text-gray-500 font-medium">
                  {productCount} {productCount === 1 ? 'product' : 'products'}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

