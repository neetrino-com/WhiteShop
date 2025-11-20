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

/**
 * Get icon for category based on title/slug
 */
function getCategoryIcon(categoryTitle: string, categorySlug: string): React.ReactNode {
  const title = categoryTitle.toLowerCase();
  const slug = categorySlug.toLowerCase();

  // Cases
  if (title.includes('case') || slug.includes('case')) {
    return (
      <div className="w-20 h-20 rounded-lg bg-red-100 flex items-center justify-center shadow-sm">
        <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="4" width="12" height="16" rx="2" fill="currentColor"/>
          <rect x="8" y="6" width="8" height="12" fill="white" opacity="0.3"/>
          <circle cx="12" cy="11" r="1.5" fill="white"/>
        </svg>
      </div>
    );
  }

  // MagSafe
  if (title.includes('magsafe') || slug.includes('magsafe')) {
    return (
      <div className="w-20 h-20 rounded-lg bg-orange-100 flex items-center justify-center shadow-sm">
        <svg className="w-10 h-10 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="6" width="14" height="12" rx="1.5" fill="currentColor"/>
          <rect x="7" y="8" width="10" height="8" fill="white" opacity="0.2"/>
          <circle cx="12" cy="12" r="2.5" fill="white"/>
        </svg>
      </div>
    );
  }

  // Cables
  if (title.includes('cable') || slug.includes('cable')) {
    return (
      <div className="w-20 h-20 rounded-lg bg-gray-50 flex items-center justify-center shadow-sm border border-gray-200">
        <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 12l4-4m-4 4l4 4m12-4l-4-4m4 4l-4 4" />
          <circle cx="6" cy="12" r="2" fill="currentColor"/>
          <circle cx="18" cy="12" r="2" fill="currentColor"/>
        </svg>
      </div>
    );
  }

  // Charger
  if (title.includes('charger') || slug.includes('charger')) {
    return (
      <div className="w-20 h-20 rounded-lg bg-teal-100 flex items-center justify-center shadow-sm">
        <svg className="w-10 h-10 text-teal-600" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.2"/>
          <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.4"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
          <rect x="11" y="4" width="2" height="3" fill="currentColor"/>
        </svg>
      </div>
    );
  }

  // Straps
  if (title.includes('strap') || slug.includes('strap')) {
    return (
      <div className="w-20 h-20 rounded-lg bg-blue-100 flex items-center justify-center shadow-sm">
        <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" rx="1.5" fill="currentColor"/>
          <rect x="7" y="9" width="10" height="6" fill="white" opacity="0.3"/>
          <circle cx="10" cy="12" r="1" fill="white"/>
          <circle cx="12" cy="12" r="1" fill="white"/>
          <circle cx="14" cy="12" r="1" fill="white"/>
        </svg>
      </div>
    );
  }

  // Power Banks
  if (title.includes('power') || title.includes('bank') || slug.includes('power') || slug.includes('bank')) {
    return (
      <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center shadow-sm">
        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" rx="1.5" fill="currentColor"/>
          <rect x="7" y="9" width="10" height="6" fill="white" opacity="0.15"/>
          <rect x="9" y="11" width="6" height="2" fill="white" opacity="0.3"/>
        </svg>
      </div>
    );
  }

  // Default icon
  return (
    <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center shadow-sm">
      <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
      </svg>
    </div>
  );
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

export function CategoryGrid() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [categoryProducts, setCategoryProducts] = useState<Record<string, Product | null>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  /**
   * Fetch categories and product counts
   */
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const language = getStoredLanguage();
      const response = await apiClient.get<CategoriesResponse>('/api/v1/categories/tree', {
        params: { lang: language },
      });

      const categoriesList = response.data || [];
      // Get all categories including children (flatten the tree)
      const allCategories = flattenAllCategories(categoriesList);
      
      console.log('📦 [CategoryGrid] Root categories found:', categoriesList.length);
      console.log('📦 [CategoryGrid] Root categories:', categoriesList.map(c => c.title));
      console.log('📦 [CategoryGrid] Total categories (including children):', allCategories.length);
      console.log('📦 [CategoryGrid] All categories:', allCategories.map(c => c.title));
      
      // Set categories immediately so they render
      setCategories(allCategories);

      // Initialize counts and products for all categories
      const counts: Record<string, number> = {};
      const products: Record<string, Product | null> = {};
      
      // Initialize all categories with 0 count and null product
      allCategories.forEach(category => {
        counts[category.slug] = 0;
        products[category.slug] = null;
      });

      // Process all categories in parallel for better performance
      const categoryPromises = allCategories.map(async (category) => {
        try {
          // Fetch products to get count and find one with image
          const productsResponse = await apiClient.get<ProductsResponse>('/api/v1/products', {
            params: {
              category: category.slug,
              limit: '10', // Get more products to find one with image
              lang: language,
            },
          });
          counts[category.slug] = productsResponse.meta?.total || 0;
          // Get first product with image, or first product if no image available
          const productWithImage = productsResponse.data?.find(p => p.image) || productsResponse.data?.[0] || null;
          products[category.slug] = productWithImage;
          console.log(`✅ [CategoryGrid] Category "${category.title}": ${counts[category.slug]} products, image: ${productWithImage?.image ? 'yes' : 'no'}`);
        } catch (err) {
          console.error(`❌ [CategoryGrid] Error fetching products for category ${category.slug}:`, err);
          // Keep default values (0 and null)
        }
      });
      
      // Wait for all category data to load
      await Promise.all(categoryPromises);
      
      // Update state with all data
      setProductCounts(counts);
      setCategoryProducts(products);
      
      console.log('✅ [CategoryGrid] All categories processed. Total:', allCategories.length);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categorySlug: string) => {
    router.push(`/products?category=${categorySlug}`);
  };

  if (loading) {
    return (
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center gap-6 md:gap-8 lg:gap-12 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3 min-w-[100px]">
                <div className="w-20 h-20 rounded-lg bg-gray-200 animate-pulse shadow-sm"></div>
                <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  console.log('🎨 [CategoryGrid] Rendering categories:', categories.length);
  console.log('🎨 [CategoryGrid] Product counts:', productCounts);
  console.log('🎨 [CategoryGrid] Category products:', Object.keys(categoryProducts).length);
  console.log('🎨 [CategoryGrid] Categories to render:', categories.map(c => c.title));

  return (
    <section className="py-12 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-6 md:gap-8 lg:gap-12 flex-wrap">
          {categories.map((category) => {
            const productCount = productCounts[category.slug] ?? 0;
            const product = categoryProducts[category.slug];
            
            return (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategoryClick(category.slug);
                }}
                className="flex flex-col items-center gap-3 group cursor-pointer transition-all duration-300 hover:scale-105 min-w-[100px]"
              >
                {/* Product Image or Icon */}
                <div className="transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1 relative">
                  {product?.image ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-white shadow-md border-2 border-gray-200 group-hover:border-gray-400 transition-all duration-300">
                      <Image
                        src={product.image}
                        alt={category.title}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-300"
                        unoptimized
                      />
                    </div>
                  ) : (
                    getCategoryIcon(category.title, category.slug)
                  )}
                </div>
                
                {/* Category Name */}
                <span className="text-sm font-semibold text-gray-900 text-center max-w-[120px] group-hover:text-gray-700 transition-colors">
                  {category.title}
                </span>
                
                {/* Product Count */}
                <span className="text-xs text-gray-500 font-medium">
                  {productCount} products
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

