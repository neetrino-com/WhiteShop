'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';

type ViewMode = 'list' | 'grid-2' | 'grid-3';
type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default sorting' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
];

function ProductsHeaderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('grid-3');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Load view mode from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('products-view-mode');
    if (stored && ['list', 'grid-2', 'grid-3'].includes(stored)) {
      setViewMode(stored as ViewMode);
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
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
      <div className="flex justify-end items-center">
        {/* View Mode Icons and Sort Dropdown */}
        <div className="flex items-center gap-4">
          {/* View Mode Icons */}
          <div className="flex items-center gap-2">
            {/* List Icon */}
            <button
              onClick={() => handleViewModeChange('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'text-gray-900'
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

            {/* 2x2 Grid Icon */}
            <button
              onClick={() => handleViewModeChange('grid-2')}
              className={`p-2 transition-colors ${
                viewMode === 'grid-2'
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="2x2 grid view"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="11" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="2" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
                <rect x="11" y="11" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-2' ? 'currentColor' : 'none'} />
              </svg>
            </button>

            {/* 3x3 Grid Icon */}
            <button
              onClick={() => handleViewModeChange('grid-3')}
              className={`p-2 transition-colors ${
                viewMode === 'grid-3'
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="3x3 grid view"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="7.5" y="1.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="13.5" y="1.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="1.5" y="7.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="7.5" y="7.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="13.5" y="7.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="1.5" y="13.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="7.5" y="13.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
                <rect x="13.5" y="13.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" fill={viewMode === 'grid-3' ? 'currentColor' : 'none'} />
              </svg>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm text-gray-700"
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
    </div>
  );
}

export function ProductsHeader() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <div className="flex justify-end items-center">
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    }>
      <ProductsHeaderContent />
    </Suspense>
  );
}

