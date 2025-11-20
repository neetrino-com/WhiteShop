import Link from 'next/link';
import { Button, Card, Input } from '@shop/ui';
import { apiClient } from '../../lib/api-client';
import { ProductCard } from '../../components/ProductCard';
import { getStoredLanguage } from '../../lib/language';
import { PriceFilter } from '../../components/PriceFilter';
import { ColorFilter } from '../../components/ColorFilter';
import { SizeFilter } from '../../components/SizeFilter';
import { BrandFilter } from '../../components/BrandFilter';
import { ProductsHeader } from '../../components/ProductsHeader';
import { ProductsGrid } from '../../components/ProductsGrid';
import { CategoryNavigation } from '../../components/CategoryNavigation';

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

async function getProducts(
  page: number = 1,
  search?: string,
  category?: string,
  minPrice?: string,
  maxPrice?: string,
  colors?: string,
  sizes?: string,
  brand?: string
): Promise<ProductsResponse> {
  try {
    const language = getStoredLanguage();
    const params: Record<string, string> = {
      page: page.toString(),
      limit: '24',
      lang: language,
    };
    
    if (search && search.trim()) {
      params.search = search.trim();
    }
    
    if (category && category.trim()) {
      params.category = category.trim();
    }
    
    if (minPrice && minPrice.trim()) {
      params.minPrice = minPrice.trim();
    }
    
    if (maxPrice && maxPrice.trim()) {
      params.maxPrice = maxPrice.trim();
    }

    if (colors && colors.trim()) {
      params.colors = colors.trim();
    }

    if (sizes && sizes.trim()) {
      params.sizes = sizes.trim();
    }

    if (brand && brand.trim()) {
      params.brand = brand.trim();
    }
    
    const response = await apiClient.get<ProductsResponse>('/api/v1/products', {
      params,
    });
    return response;
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 24,
        totalPages: 0,
      },
    };
  }
}


export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; search?: string; category?: string; minPrice?: string; maxPrice?: string; colors?: string; sizes?: string; brand?: string; sort?: string }> | { page?: string; search?: string; category?: string; minPrice?: string; maxPrice?: string; colors?: string; sizes?: string; brand?: string; sort?: string };
}) {
  // Handle both Promise (Next.js 15) and direct object (Next.js 14)
  const resolvedSearchParams = searchParams instanceof Promise 
    ? await searchParams 
    : (searchParams || {});
  
  const page = parseInt(resolvedSearchParams?.page || '1', 10);
  const search = resolvedSearchParams?.search;
  const category = resolvedSearchParams?.category;
  const minPrice = resolvedSearchParams?.minPrice;
  const maxPrice = resolvedSearchParams?.maxPrice;
  const colors = resolvedSearchParams?.colors;
  const sizes = resolvedSearchParams?.sizes;
  const brand = resolvedSearchParams?.brand;
  const sort = resolvedSearchParams?.sort;
  const productsData = await getProducts(page, search, category, minPrice, maxPrice, colors, sizes, brand);
  
  // Parse selected colors and sizes
  const selectedColors = colors ? colors.split(',').map(c => c.trim()) : [];
  const selectedSizes = sizes ? sizes.split(',').map(s => s.trim()) : [];

  return (
    <div className="w-full">
      {/* Category Navigation */}
      <CategoryNavigation />
      
      {/* Header with Breadcrumb, View Mode, and Sort */}
      <ProductsHeader />

      <div className="flex">
        {/* Left Sidebar - Filters (Full height, no padding) */}
        <aside className="w-64 flex-shrink-0 hidden lg:block bg-gray-50 min-h-screen">
          <div className="sticky top-4 p-4 space-y-6">
            <PriceFilter currentMinPrice={minPrice} currentMaxPrice={maxPrice} category={category} search={search} />
            <ColorFilter 
              category={category} 
              search={search} 
              minPrice={minPrice} 
              maxPrice={maxPrice}
              selectedColors={selectedColors}
            />
            <SizeFilter 
              category={category} 
              search={search} 
              minPrice={minPrice} 
              maxPrice={maxPrice}
              selectedSizes={selectedSizes}
            />
            <BrandFilter 
              category={category} 
              search={search} 
              minPrice={minPrice} 
              maxPrice={maxPrice}
              selectedBrand={brand}
            />
          </div>
        </aside>

        {/* Main Content - Products */}
        <div className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Mobile Filter - Show on small screens */}
          <div className="lg:hidden mb-6 space-y-4">
            <PriceFilter currentMinPrice={minPrice} currentMaxPrice={maxPrice} category={category} search={search} />
            <ColorFilter 
              category={category} 
              search={search} 
              minPrice={minPrice} 
              maxPrice={maxPrice}
              selectedColors={selectedColors}
            />
            <SizeFilter 
              category={category} 
              search={search} 
              minPrice={minPrice} 
              maxPrice={maxPrice}
              selectedSizes={selectedSizes}
            />
            <BrandFilter 
              category={category} 
              search={search} 
              minPrice={minPrice} 
              maxPrice={maxPrice}
              selectedBrand={brand}
            />
          </div>
      
          {productsData.data.length > 0 ? (
            <>
              <ProductsGrid products={productsData.data} sortBy={sort || 'default'} />

              {/* Pagination */}
              {productsData.meta.totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  {page > 1 && (
                    <Link href={`/products?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${minPrice ? `&minPrice=${encodeURIComponent(minPrice)}` : ''}${maxPrice ? `&maxPrice=${encodeURIComponent(maxPrice)}` : ''}${colors ? `&colors=${encodeURIComponent(colors)}` : ''}${sizes ? `&sizes=${encodeURIComponent(sizes)}` : ''}${brand ? `&brand=${encodeURIComponent(brand)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  )}
                  <span className="flex items-center px-4">
                    Page {page} of {productsData.meta.totalPages}
                  </span>
                  {page < productsData.meta.totalPages && (
                    <Link href={`/products?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${minPrice ? `&minPrice=${encodeURIComponent(minPrice)}` : ''}${maxPrice ? `&maxPrice=${encodeURIComponent(maxPrice)}` : ''}${colors ? `&colors=${encodeURIComponent(colors)}` : ''}${sizes ? `&sizes=${encodeURIComponent(sizes)}` : ''}${brand ? `&brand=${encodeURIComponent(brand)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {search ? `No products found for "${search}"` : 'No products found.'}
              </p>
              <p className="text-gray-400 mt-2">
                {search 
                  ? 'Try searching with different keywords.'
                  : 'Please make sure the API server is running and the database is seeded.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

