'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@shop/ui';
import { apiClient } from '../lib/api-client';
import { getStoredLanguage } from '../lib/language';

interface SizeFilterProps {
  category?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  selectedSizes?: string[];
}

interface SizeOption {
  value: string;
  count: number;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function SizeFilter({ category, search, minPrice, maxPrice, selectedSizes = [] }: SizeFilterProps) {
  const router = useRouter();
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(selectedSizes);

  useEffect(() => {
    fetchSizes();
  }, [category, search, minPrice, maxPrice]);

  useEffect(() => {
    setSelected(selectedSizes);
  }, [selectedSizes]);

  const fetchSizes = async () => {
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

      // Fetch filters from API
      const response = await apiClient.get<{ colors: any[]; sizes: SizeOption[] }>('/api/v1/products/filters', { params });
      
      console.log('[SizeFilter] Filters response:', response.sizes?.length, 'sizes');
      
      setSizes(response.sizes || []);
    } catch (error) {
      console.error('Error fetching sizes:', error);
      setSizes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSizeToggle = (sizeValue: string) => {
    const newSelected = selected.includes(sizeValue)
      ? selected.filter((s) => s !== sizeValue)
      : [...selected, sizeValue];

    setSelected(newSelected);
    applyFilters(newSelected);
  };

  const applyFilters = (sizesToApply: string[]) => {
    const params = new URLSearchParams();
    
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sizesToApply.length > 0) {
      params.set('sizes', sizesToApply.join(','));
    }

    // Preserve existing filter params from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const colors = urlParams.get('colors');
      const brand = urlParams.get('brand');
      if (colors) params.set('colors', colors);
      if (brand) params.set('brand', brand);
    }

    router.push(`/products?${params.toString()}`);
  };

  if (loading) {
    return (
      <Card className="p-4 mb-6">
        <h3 className="text-base font-bold text-gray-800 mb-4 uppercase tracking-wide">Filter By Size</h3>
        <div className="text-sm text-gray-500">Loading...</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 uppercase tracking-wide">Filter By Size</h3>
      {sizes.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          No sizes available
        </div>
      ) : (
        <div className="space-y-2">
          {sizes.map((size) => {
          const isSelected = selected.includes(size.value);

          return (
            <button
              key={size.value}
              onClick={() => handleSizeToggle(size.value)}
              className={`w-full flex items-center justify-between py-2 px-1 rounded transition-colors group ${
                isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-sm ${isSelected ? 'text-gray-900 font-semibold' : 'text-gray-900 group-hover:text-gray-700'}`}>
                {size.value}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {size.count}
              </span>
            </button>
          );
        })}
        </div>
      )}
    </Card>
  );
}

