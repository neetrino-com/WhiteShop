'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input } from '@shop/ui';
import { apiClient } from '../lib/api-client';
import { getStoredLanguage } from '../lib/language';

interface BrandFilterProps {
  category?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  selectedBrand?: string;
}

interface BrandOption {
  id: string;
  name: string;
  count: number;
}

export function BrandFilter({ category, search, minPrice, maxPrice, selectedBrand }: BrandFilterProps) {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<BrandOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, [category, search, minPrice, maxPrice]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBrands(brands);
    } else {
      const query = searchQuery.toLowerCase().trim();
      setFilteredBrands(
        brands.filter((brand) => brand.name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, brands]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const language = getStoredLanguage();
      const params: Record<string, string> = {
        lang: language,
      };
      
      if (category) params.category = category;
      if (search) params.search = search;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      // Fetch products to extract brands
      const response = await apiClient.get('/api/v1/products', { params: { ...params, limit: '1000' } });
      
      // Extract unique brands from products
      const brandCountMap = new Map<string, { id: string; name: string; count: number }>();
      
      response.data?.forEach((product: any) => {
        if (product.brand?.id && product.brand?.name) {
          const brandId = product.brand.id;
          const brandName = product.brand.name;
          const existing = brandCountMap.get(brandId);
          brandCountMap.set(brandId, {
            id: brandId,
            name: brandName,
            count: (existing?.count || 0) + 1,
          });
        }
      });

      const brandOptions: BrandOption[] = Array.from(brandCountMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      setBrands(brandOptions);
      setFilteredBrands(brandOptions);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrands([]);
      setFilteredBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandSelect = (brandId: string) => {
    const params = new URLSearchParams();
    
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    
    if (selectedBrand === brandId) {
      // Deselect if already selected
      // Don't add brand param
    } else {
      params.set('brand', brandId);
    }

    // Preserve existing filter params from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const colors = urlParams.get('colors');
      const sizes = urlParams.get('sizes');
      if (colors) params.set('colors', colors);
      if (sizes) params.set('sizes', sizes);
    }

    router.push(`/products?${params.toString()}`);
  };

  if (loading) {
    return (
      <Card className="p-4 mb-6">
        <h3 className="text-base font-bold text-gray-800 mb-4 uppercase tracking-wide">Filter By Brand</h3>
        <div className="text-sm text-gray-500">Loading...</div>
      </Card>
    );
  }

  if (brands.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 mb-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 uppercase tracking-wide">Filter By Brand</h3>
      
      {/* Search Input */}
      <div className="mb-4 relative">
        <Input
          type="text"
          placeholder="Find a Brand"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pr-10"
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

      {/* Brand List */}
      {filteredBrands.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredBrands.map((brand) => {
            const isSelected = selectedBrand === brand.id;

            return (
              <button
                key={brand.id}
                onClick={() => handleBrandSelect(brand.id)}
                className={`w-full flex items-center justify-between py-2 px-1 rounded transition-colors group ${
                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-sm ${isSelected ? 'text-gray-900 font-semibold' : 'text-gray-900 group-hover:text-gray-700'}`}>
                  {brand.name}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {brand.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 py-4 text-center">
          No brands found
        </div>
      )}
    </Card>
  );
}

