'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@shop/ui';
import { apiClient } from '../lib/api-client';
import { getStoredLanguage } from '../lib/language';

interface ColorFilterProps {
  category?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  selectedColors?: string[];
}

interface ColorOption {
  value: string;
  label: string;
  count: number;
}

// Color mapping for common color names
const colorMap: Record<string, string> = {
  beige: '#F5F5DC',
  black: '#000000',
  blue: '#0000FF',
  brown: '#A52A2A',
  gray: '#808080',
  grey: '#808080',
  green: '#008000',
  red: '#FF0000',
  white: '#FFFFFF',
  yellow: '#FFFF00',
  orange: '#FFA500',
  pink: '#FFC0CB',
  purple: '#800080',
  navy: '#000080',
  maroon: '#800000',
  teal: '#008080',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  lime: '#00FF00',
  olive: '#808000',
  silver: '#C0C0C0',
  gold: '#FFD700',
  tan: '#D2B48C',
  khaki: '#F0E68C',
  coral: '#FF7F50',
  salmon: '#FA8072',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  indigo: '#4B0082',
  crimson: '#DC143C',
  lavender: '#E6E6FA',
  peach: '#FFE5B4',
  mint: '#98FB98',
  ivory: '#FFFFF0',
  cream: '#FFFDD0',
};

const getColorHex = (colorName: string): string => {
  const normalized = colorName.toLowerCase().trim();
  return colorMap[normalized] || '#CCCCCC';
};

export function ColorFilter({ category, search, minPrice, maxPrice, selectedColors = [] }: ColorFilterProps) {
  const router = useRouter();
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(selectedColors);

  useEffect(() => {
    fetchColors();
  }, [category, search, minPrice, maxPrice]);

  useEffect(() => {
    setSelected(selectedColors);
  }, [selectedColors]);

  const fetchColors = async () => {
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
      const response = await apiClient.get<{ colors: ColorOption[]; sizes: any[] }>('/api/v1/products/filters', { params });
      
      console.log('[ColorFilter] Filters response:', response.colors?.length, 'colors');
      
      setColors(response.colors || []);
    } catch (error) {
      console.error('Error fetching colors:', error);
      setColors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleColorToggle = (colorValue: string) => {
    const newSelected = selected.includes(colorValue)
      ? selected.filter((c) => c !== colorValue)
      : [...selected, colorValue];

    setSelected(newSelected);
    applyFilters(newSelected);
  };

  const applyFilters = (colorsToApply: string[]) => {
    const params = new URLSearchParams();
    
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (colorsToApply.length > 0) {
      params.set('colors', colorsToApply.join(','));
    }

    // Preserve existing filter params from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sizes = urlParams.get('sizes');
      const brand = urlParams.get('brand');
      if (sizes) params.set('sizes', sizes);
      if (brand) params.set('brand', brand);
    }

    router.push(`/products?${params.toString()}`);
  };

  if (loading) {
    return (
      <Card className="p-4 mb-6">
        <h3 className="text-base font-bold text-gray-800 mb-4 uppercase tracking-wide">Filter By Color</h3>
        <div className="text-sm text-gray-500">Loading...</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 uppercase tracking-wide">Filter By Color</h3>
      {colors.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          No colors available
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {colors.map((color) => {
          const isSelected = selected.includes(color.value);
          const colorHex = getColorHex(color.label);

          return (
            <button
              key={color.value}
              onClick={() => handleColorToggle(color.value)}
              className="w-full flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: colorHex }}
                  aria-label={color.label}
                />
                <span className="text-sm text-gray-900 group-hover:text-gray-700">{color.label}</span>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {color.count}
              </span>
            </button>
          );
        })}
        </div>
      )}
    </Card>
  );
}

