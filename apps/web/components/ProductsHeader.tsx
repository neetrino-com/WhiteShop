'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';

type ViewMode = 'list' | 'grid-2' | 'grid-3';
type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

interface ProductsHeaderProps {
  /**
   * Ընդհանուր ապրանքների քանակը՝ բոլոր էջերում (from API meta.total)
   */
  total: number;
  /**
   * Մի էջում ցուցադրվող ապրանքների քանակը (from API meta.limit)
   */
  perPage: number;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default sorting' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
];

function ProductsHeaderContent({ total, perPage }: ProductsHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('grid-2');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSortDropdownRef = useRef<HTMLDivElement>(null);

  // Derive current "show per page" value from URL or fallback to perPage prop
  const limitFromUrl = searchParams.get('limit');
  const currentLimit = Number.isNaN(parseInt(limitFromUrl || '', 10))
    ? perPage
    : parseInt(limitFromUrl as string, 10);

  const hasActiveFilters = (() => {
    const filterKeys = ['search', 'category', 'minPrice', 'maxPrice', 'colors', 'sizes', 'brand'];
    return filterKeys.some((key) => !!searchParams.get(key));
  })();

  // Load view mode from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('products-view-mode');
    if (stored && ['list', 'grid-2', 'grid-3'].includes(stored)) {
      setViewMode(stored as ViewMode);
    } else {
      // Default to grid-2 if nothing stored
      setViewMode('grid-2');
      localStorage.setItem('products-view-mode', 'grid-2');
    }
  }, []);

  // Load sort from URL params
  useEffect(() => {
    const sortParam = searchParams.get('sort') as SortOption;
    if (sortParam && sortOptions.some(opt => opt.value === sortParam)) {
      setSortBy(sortParam);
    }
  }, [searchParams]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideDesktop = sortDropdownRef.current?.contains(target);
      const isClickInsideMobile = mobileSortDropdownRef.current?.contains(target);
      
      if (!isClickInsideDesktop && !isClickInsideMobile) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('products-view-mode', mode);
    // Dispatch event to update grid layout
    window.dispatchEvent(new CustomEvent('view-mode-changed', { detail: mode }));
  };

  const handleSortChange = (option: SortOption) => {
    setSortBy(option);
    setShowSortDropdown(false);
    
    // Update URL with sort parameter
    const params = new URLSearchParams(searchParams.toString());
    if (option === 'default') {
      params.delete('sort');
    } else {
      params.set('sort', option);
    }
    // Reset to page 1 when sorting changes
    params.delete('page');
    
    router.push(`/products?${params.toString()}`);
  };

  const handleClearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    const filterKeys = ['search', 'category', 'minPrice', 'maxPrice', 'colors', 'sizes', 'brand'];

    filterKeys.forEach((key) => params.delete(key));
    // Reset page when filters are cleared
    params.delete('page');

    const queryString = params.toString();
    router.push(queryString ? `/products?${queryString}` : '/products');
  };

  const handleLimitChange = (value: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', value.toString());
    // Reset page when page size changes
    params.delete('page');

    router.push(`/products?${params.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
      {/* Desktop: All elements in one horizontal line */}
      <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
        {/* Left side: Clear filters + All products title */}
        <div className="flex items-center gap-4">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 text-sm text-gray-900 hover:text-gray-700 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-900"
              >
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Clear filters</span>
            </button>
          )}
          
          <h1 className="text-xl font-bold text-gray-900">
            All products ({total})
          </h1>
        </div>

        {/* Right side: Show + View toggles + Sort */}
        <div className="flex items-center gap-4">
          {/* Show dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900">Show</span>
            <select
              value={currentLimit}
              onChange={(event) => handleLimitChange(parseInt(event.target.value, 10))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 min-w-[60px]"
            >
              {[10, 20, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Icons: List, Grid (2x2), and Grid (3x3) */}
          <div className="flex items-center gap-1">
            {/* List View */}
            <button
              onClick={() => handleViewModeChange('list')}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="List view"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            
            {/* Grid View (2x2) */}
            <button
              onClick={() => handleViewModeChange('grid-2')}
              className={`rounded-lg p-2 transition-all ${
                viewMode === 'grid-2'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              aria-label="Grid view 2x2"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="11" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="2" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="11" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
              </svg>
            </button>

            {/* Grid View (3x3) */}
            <button
              onClick={() => handleViewModeChange('grid-3')}
              className={`rounded-lg p-2 transition-all ${
                viewMode === 'grid-3'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              aria-label="Grid view 3x3"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="4" cy="4" r="1.5" fill="currentColor" />
                <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                <circle cx="16" cy="4" r="1.5" fill="currentColor" />
                <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                <circle cx="4" cy="16" r="1.5" fill="currentColor" />
                <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                <circle cx="16" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm text-gray-900 min-w-[160px]"
            >
              <span>{sortOptions.find(opt => opt.value === sortBy)?.label || 'Default sorting'}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}
              >
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showSortDropdown && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      sortBy === option.value
                        ? 'bg-gray-100 text-gray-900 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Stacked layout */}
      <div className="sm:hidden flex flex-col gap-4">
        {/* Top: All Products Title + Clear Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 text-sm text-gray-900"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4L4 12M4 4L12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Clear filters</span>
              </button>
            )}
            
            <h1 className="text-lg font-bold text-gray-900">
              All products ({total})
            </h1>
          </div>
        </div>

        {/* Bottom: Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Sort + Show */}
          <div className="flex items-center gap-2">
            {/* Mobile Sort */}
            <div className="relative" ref={mobileSortDropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-gray-700"
                aria-label="Sort products"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showSortDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortBy === option.value
                          ? 'bg-gray-100 text-gray-900 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Show selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show</span>
              <select
                value={currentLimit}
                onChange={(event) => handleLimitChange(parseInt(event.target.value, 10))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {[10, 20, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: View Mode Icons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="List view"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => handleViewModeChange('grid-2')}
              className={`rounded-lg p-2 transition-all ${
                viewMode === 'grid-2'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              aria-label="Grid view 2x2"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="11" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="2" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="11" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
              </svg>
            </button>
            <button
              onClick={() => handleViewModeChange('grid-3')}
              className={`rounded-lg p-2 transition-all ${
                viewMode === 'grid-3'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              aria-label="Grid view 3x3"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="4" cy="4" r="1.5" fill="currentColor" />
                <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                <circle cx="16" cy="4" r="1.5" fill="currentColor" />
                <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                <circle cx="4" cy="16" r="1.5" fill="currentColor" />
                <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                <circle cx="16" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductsHeader(props: ProductsHeaderProps) {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <div className="flex justify-end items-center">
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    }>
      <ProductsHeaderContent {...props} />
    </Suspense>
  );
}

