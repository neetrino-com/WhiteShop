'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@shop/ui';
import { apiClient } from '../lib/api-client';
import { getStoredLanguage } from '../lib/language';
import { getStoredCurrency, CURRENCIES } from '../lib/currency';

interface PriceFilterProps {
  currentMinPrice?: string;
  currentMaxPrice?: string;
  category?: string;
  search?: string;
}

interface PriceRange {
  min: number;
  max: number;
}

export function PriceFilter({ currentMinPrice, currentMaxPrice, category, search }: PriceFilterProps) {
  const router = useRouter();
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 100000 });
  const [minPrice, setMinPrice] = useState(currentMinPrice ? parseFloat(currentMinPrice) : 0);
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice ? parseFloat(currentMaxPrice) : 100000);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const currency = getStoredCurrency();
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';

  useEffect(() => {
    fetchPriceRange();
  }, [category]);

  useEffect(() => {
    if (currentMinPrice) {
      setMinPrice(parseFloat(currentMinPrice));
    } else {
      setMinPrice(priceRange.min);
    }
    if (currentMaxPrice) {
      setMaxPrice(parseFloat(currentMaxPrice));
    } else {
      setMaxPrice(priceRange.max);
    }
  }, [currentMinPrice, currentMaxPrice, priceRange]);

  const fetchPriceRange = async () => {
    try {
      const language = getStoredLanguage();
      const params: Record<string, string> = { lang: language };
      if (category) params.category = category;

      const response = await apiClient.get<PriceRange>('/api/v1/products/price-range', { params });
      setPriceRange(response);
      if (!currentMinPrice) setMinPrice(response.min);
      if (!currentMaxPrice) setMaxPrice(response.max);
    } catch (error) {
      console.error('Error fetching price range:', error);
    }
  };

  const getPercentage = (value: number) => {
    return ((value - priceRange.min) / (priceRange.max - priceRange.min)) * 100;
  };

  const handleMouseDown = (type: 'min' | 'max') => {
    setIsDragging(type);
  };

  const updatePrice = (clientX: number) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const value = priceRange.min + (percentage / 100) * (priceRange.max - priceRange.min);

    if (isDragging === 'min') {
      const currentMax = typeof maxPrice === 'number' && !isNaN(maxPrice) ? maxPrice : priceRange.max;
      const newMin = Math.max(priceRange.min, Math.min(value, currentMax - 1));
      setMinPrice(Math.round(newMin));
    } else if (isDragging === 'max') {
      const currentMin = typeof minPrice === 'number' && !isNaN(minPrice) ? minPrice : priceRange.min;
      const newMax = Math.min(priceRange.max, Math.max(value, currentMin + 1));
      setMaxPrice(Math.round(newMax));
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    updatePrice(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length === 0) return;
    updatePrice(e.touches[0].clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleTouchEnd = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, minPrice, maxPrice, priceRange]);

  // Auto-apply filter when dragging ends
  useEffect(() => {
    if (!isDragging) {
      // Only apply if values have changed from initial/default
      const shouldApplyMin = minPrice !== priceRange.min;
      const shouldApplyMax = maxPrice !== priceRange.max;
      
      if (shouldApplyMin || shouldApplyMax) {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (shouldApplyMin) params.set('minPrice', minPrice.toString());
        if (shouldApplyMax) params.set('maxPrice', maxPrice.toString());
        
        // Preserve existing filter params from URL
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const colors = urlParams.get('colors');
          const sizes = urlParams.get('sizes');
          const brand = urlParams.get('brand');
          if (colors) params.set('colors', colors);
          if (sizes) params.set('sizes', sizes);
          if (brand) params.set('brand', brand);
        }
        
        // Use a small delay to debounce rapid changes
        const timeoutId = setTimeout(() => {
          router.push(`/products?${params.toString()}`);
        }, 300);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isDragging, minPrice, maxPrice, priceRange, search, category, router]);

  const formatPrice = (price: number) => {
    if (typeof price !== 'number' || isNaN(price) || !isFinite(price)) {
      return '0';
    }
    try {
      const safeCurrency = currency || 'USD';
      return new Intl.NumberFormat('hy-AM', {
        style: 'currency',
        currency: safeCurrency,
        minimumFractionDigits: 0,
      }).format(price);
    } catch (error) {
      console.error('Error formatting price:', error);
      return price.toString();
    }
  };

  const safeMinPrice: number = typeof minPrice === 'number' && !isNaN(minPrice) && isFinite(minPrice) ? minPrice : 0;
  const safeMaxPrice: number = typeof maxPrice === 'number' && !isNaN(maxPrice) && isFinite(maxPrice) ? maxPrice : 100000;
  
  const minPercentage = getPercentage(safeMinPrice);
  const maxPercentage = getPercentage(safeMaxPrice);

  return (
    <Card className="p-4 mb-6">
      <h3 className="text-base font-bold text-gray-800 mb-4 text-center uppercase tracking-wide">Filter By Price</h3>
      
      {/* Range Slider */}
      <div className="mb-4">
        <div
          ref={sliderRef}
          className="relative h-1 bg-gray-200 cursor-pointer"
          onMouseDown={(e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (!rect) return;
            const percentage = ((e.clientX - rect.left) / rect.width) * 100;
            const value = priceRange.min + (percentage / 100) * (priceRange.max - priceRange.min);
            
            const currentMin = typeof minPrice === 'number' && !isNaN(minPrice) ? minPrice : priceRange.min;
            const currentMax = typeof maxPrice === 'number' && !isNaN(maxPrice) ? maxPrice : priceRange.max;
            
            if (Math.abs(value - currentMin) < Math.abs(value - currentMax)) {
              handleMouseDown('min');
            } else {
              handleMouseDown('max');
            }
          }}
        >
          {/* Active range - light blue */}
          <div
            className="absolute h-1 bg-sky-400"
            style={{
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`,
            }}
          />
          
          {/* Min handle - T-shaped marker */}
          <div
            className="absolute cursor-grab active:cursor-grabbing z-10"
            style={{ left: `${minPercentage}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown('min');
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleMouseDown('min');
            }}
          >
            {/* T-shaped marker - vertical line extending above and below the horizontal line */}
            <div className="w-1 h-5 bg-sky-400" />
          </div>
          
          {/* Max handle - T-shaped marker */}
          <div
            className="absolute cursor-grab active:cursor-grabbing z-10"
            style={{ left: `${maxPercentage}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown('max');
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleMouseDown('max');
            }}
          >
            {/* T-shaped marker - vertical line extending above and below the horizontal line */}
            <div className="w-1 h-5 bg-sky-400" />
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div className="text-gray-700 text-center">
        <span className="text-sm text-gray-500">Price: </span>
        <span className="text-sm font-semibold text-gray-900">
          {formatPrice(Number(safeMinPrice) || 0)} - {formatPrice(Number(safeMaxPrice) || 100000)}
        </span>
      </div>
    </Card>
  );
}

