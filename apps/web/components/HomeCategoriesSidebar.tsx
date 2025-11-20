'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export function HomeCategoriesSidebar() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch categories and product counts
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const language = getStoredLanguage();
      const response = await apiClient.get<CategoriesResponse>('/api/v1/categories/tree', {
        params: { lang: language },
      });

      const categoriesList = response.data || [];
      setCategories(categoriesList);

      // Fetch product counts and first product for each category
      const counts: Record<string, number> = {};
      const allCategories = flattenCategories(categoriesList);
      
      // Fetch total count for "All"
      try {
        const allProductsResponse = await apiClient.get<ProductsResponse>('/api/v1/products', {
          params: {
            limit: '1',
            lang: language,
          },
        });
        counts['all'] = allProductsResponse.meta?.total || 0;
      } catch (err) {
        console.error('Error fetching all products count:', err);
        counts['all'] = 0;
      }

      // Fetch counts for each category
      for (const category of allCategories) {
        try {
          const productsResponse = await apiClient.get<ProductsResponse>('/api/v1/products', {
            params: {
              category: category.slug,
              limit: '1',
              lang: language,
            },
          });
          counts[category.slug] = productsResponse.meta?.total || 0;
        } catch (err) {
          console.error(`Error fetching products for category ${category.slug}:`, err);
          counts[category.slug] = 0;
        }
      }
      
      setProductCounts(counts);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  // Flatten categories tree
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

  // Handle category hover
  const handleCategoryHover = async (categorySlug: string | null) => {
    // Clear previous timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (!categorySlug || categorySlug === 'all') {
      // For "All", fetch any product
      setHoveredCategory('all');
      try {
        const language = getStoredLanguage();
        const response = await apiClient.get<ProductsResponse>('/api/v1/products', {
          params: {
            limit: '1',
            lang: language,
          },
        });

        if (response.data && response.data.length > 0) {
          setHoveredProduct(response.data[0]);
        } else {
          setHoveredProduct(null);
        }
      } catch (err) {
        console.error('Error fetching product for "All":', err);
        setHoveredProduct(null);
      }
      return;
    }

    setHoveredCategory(categorySlug);

    // Fetch one product from this category
    try {
      const language = getStoredLanguage();
      const response = await apiClient.get<ProductsResponse>('/api/v1/products', {
        params: {
          category: categorySlug,
          limit: '1',
          lang: language,
        },
      });

      if (response.data && response.data.length > 0) {
        setHoveredProduct(response.data[0]);
      } else {
        setHoveredProduct(null);
      }
    } catch (err) {
      console.error(`Error fetching product for category ${categorySlug}:`, err);
      setHoveredProduct(null);
    }
  };

  // Handle category click
  const handleCategoryClick = (categorySlug: string | null) => {
    if (categorySlug) {
      router.push(`/products?category=${categorySlug}`);
    } else {
      router.push('/products');
    }
  };

  // Filter categories by search
  const allCategories = flattenCategories(categories);
  const filteredCategories = searchQuery
    ? allCategories.filter((cat) =>
        cat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allCategories;

  // Calculate position for preview
  useEffect(() => {
    if (hoveredCategory && previewRef.current && sidebarRef.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const buttonRef = categoryButtonRefs.current[hoveredCategory] || categoryButtonRefs.current['all'];
      
      if (buttonRef) {
        const buttonRect = buttonRef.getBoundingClientRect();
        const preview = previewRef.current;
        
        // Position preview to the right of sidebar, aligned with the hovered button
        const left = sidebarRect.width + 10;
        const top = buttonRect.top - sidebarRect.top;
        
        setPreviewPosition({ top, left });
      }
    }
  }, [hoveredCategory, hoveredProduct]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-xs text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={sidebarRef}>
      <div className="bg-white rounded-lg shadow-sm">
        {/* Search Bar */}
        <div className="p-4 border-b">
          <div className="relative">
            <input
              type="text"
              placeholder="Search demos by keyword (e.g. 'books')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
            <svg
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Categories List */}
        <div className="p-2">
          {/* All Categories */}
          <button
            ref={(el) => (categoryButtonRefs.current['all'] = el)}
            onClick={() => handleCategoryClick(null)}
            onMouseEnter={() => {
              // Fetch a random product for "All"
              handleCategoryHover('all');
            }}
            onMouseLeave={() => {
              hoverTimeoutRef.current = setTimeout(() => {
                setHoveredCategory(null);
                setHoveredProduct(null);
              }, 200);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-left group"
          >
            <span className="text-sm font-semibold text-gray-900">All</span>
            <span className="px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-medium">
              {productCounts['all'] || 0}
            </span>
          </button>

          {/* Category Items */}
          {filteredCategories.map((category) => (
            <button
              key={category.id}
              ref={(el) => (categoryButtonRefs.current[category.slug] = el)}
              onClick={() => handleCategoryClick(category.slug)}
              onMouseEnter={() => handleCategoryHover(category.slug)}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredCategory(null);
                  setHoveredProduct(null);
                }, 200);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
            >
              <span className="text-sm text-gray-700 truncate">{category.title}</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium ml-2 flex-shrink-0">
                {productCounts[category.slug] || 0}
              </span>
            </button>
          ))}

          {filteredCategories.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              No categories found
            </div>
          )}
        </div>
      </div>

      {/* Product Preview on Hover */}
      {hoveredCategory && hoveredProduct && hoveredProduct.image && (
        <div
          ref={previewRef}
          className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-48"
          style={{
            top: `${previewPosition.top}px`,
            left: `${previewPosition.left}px`,
          }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
            }
          }}
          onMouseLeave={() => {
            setHoveredCategory(null);
            setHoveredProduct(null);
          }}
        >
          <div className="relative w-full h-32 mb-2 rounded overflow-hidden bg-gray-100">
            <Image
              src={hoveredProduct.image}
              alt={hoveredProduct.title}
              fill
              className="object-cover"
              sizes="192px"
              unoptimized
            />
          </div>
          <p className="text-xs text-gray-700 font-medium truncate">{hoveredProduct.title}</p>
        </div>
      )}
    </div>
  );
}

