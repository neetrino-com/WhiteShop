'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../../lib/currency';
import { getStoredLanguage } from '../../../lib/language';
import { useAuth } from '../../../lib/auth/AuthContext';
import { RelatedProducts } from '../../../components/RelatedProducts';
import { ProductReviews } from '../../../components/ProductReviews';

interface ProductPageProps {
  params: Promise<{ slug?: string }>;
}

interface ProductMedia {
  url?: string;
  type?: string;
}

interface VariantOption {
  attribute: string;
  value: string;
  key: string;
}

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  available: boolean;
  options: VariantOption[];
}

interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  media: ProductMedia[] | string[];
  variants: ProductVariant[];
  brand?: {
    id: string;
    name: string;
  };
  categories?: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
}


// Reserved routes that should not be treated as product slugs
const RESERVED_ROUTES = ['admin', 'login', 'register', 'cart', 'checkout', 'profile', 'orders', 'wishlist', 'compare', 'categories', 'products', 'about', 'contact', 'delivery', 'shipping', 'returns', 'faq', 'support', 'stores', 'privacy', 'terms', 'cookies'];

const WISHLIST_KEY = 'shop_wishlist';

export default function ProductPage({ params }: ProductPageProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currency, setCurrency] = useState(getStoredCurrency());
  const [language, setLanguage] = useState(getStoredLanguage());
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const thumbnailsPerView = 3;
  // Helper function to get color hex/rgb from color name
  const getColorValue = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      'beige': '#F5F5DC',
      'black': '#000000',
      'blue': '#0000FF',
      'brown': '#A52A2A',
      'gray': '#808080',
      'grey': '#808080',
      'green': '#008000',
      'red': '#FF0000',
      'white': '#FFFFFF',
      'yellow': '#FFFF00',
      'orange': '#FFA500',
      'pink': '#FFC0CB',
      'purple': '#800080',
      'navy': '#000080',
      'maroon': '#800000',
      'olive': '#808000',
      'teal': '#008080',
      'cyan': '#00FFFF',
      'magenta': '#FF00FF',
      'lime': '#00FF00',
      'silver': '#C0C0C0',
      'gold': '#FFD700',
    };
    
    const normalizedName = colorName.toLowerCase().trim();
    return colorMap[normalizedName] || '#CCCCCC'; // Default gray if color not found
  };
  
  // In Next.js 15, params is always a Promise for dynamic routes
  const resolvedParams = use(params);
  const slug = resolvedParams?.slug ?? '';

  // Check if slug is a reserved route and redirect early
  useEffect(() => {
    if (!slug) return;

    if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
      router.replace(`/${slug}`);
      return;
    }
  }, [slug, router]);

  useEffect(() => {
    if (!slug) return;

    // Skip if it's a reserved route
    if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
      return;
    }

    async function fetchProduct() {
      try {
        setLoading(true);
        const data = await apiClient.get<Product>(`/api/v1/products/${slug}`);
        setProduct(data);
        setCurrentImageIndex(0);
        setThumbnailStartIndex(0);
        
        // Initialize selected variant, color and size
        if (data.variants && data.variants.length > 0) {
          const firstVariant = data.variants[0];
          setSelectedVariant(firstVariant);
          
          // Find color from first variant
          const colorOption = firstVariant.options?.find(opt => opt.key === 'color');
          if (colorOption) {
            setSelectedColor(colorOption.value);
          }
          
          // Find size from first variant
          const sizeOption = firstVariant.options?.find(opt => opt.key === 'size');
          if (sizeOption) {
            setSelectedSize(sizeOption.value);
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();

    const handleCurrencyUpdate = () => {
      setCurrency(getStoredCurrency());
    };

    const handleLanguageUpdate = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('language-updated', handleLanguageUpdate);

    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, [slug]);

  // Check wishlist status
  useEffect(() => {
    if (!product) return;

    const checkWishlist = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(WISHLIST_KEY);
        const wishlist = stored ? JSON.parse(stored) : [];
        setIsInWishlist(wishlist.includes(product.id));
      } catch {
        setIsInWishlist(false);
      }
    };

    checkWishlist();

    const handleWishlistUpdate = () => checkWishlist();
    window.addEventListener('wishlist-updated', handleWishlistUpdate);

    return () => {
      window.removeEventListener('wishlist-updated', handleWishlistUpdate);
    };
  }, [product?.id]);

  // Debug: log images to console - moved before early returns to maintain hooks order
  useEffect(() => {
    if (product) {
      console.log('Product media:', product.media);
      const getImageUrl = (mediaItem: ProductMedia | string | any): string | null => {
        if (!mediaItem) return null;
        if (typeof mediaItem === 'string') return mediaItem;
        if (typeof mediaItem === 'object') return mediaItem.url || mediaItem.src || null;
        return null;
      };
      const images = (product.media || [])
        .map(getImageUrl)
        .filter((url): url is string => url !== null && url !== '');
      console.log('Extracted images:', images);
      console.log('Images count:', images.length);
    }
  }, [product]);

  // Helper function to find variant by color and size - must be before early returns
  const findVariantByColorAndSize = useCallback((color: string | null, size: string | null): ProductVariant | null => {
    if (!product?.variants || product.variants.length === 0) return null;
    
    // If both color and size are selected, find exact match
    if (color && size) {
      const variant = product.variants.find(v => {
        const hasColor = v.options?.some(opt => opt.key === 'color' && opt.value === color);
        const hasSize = v.options?.some(opt => opt.key === 'size' && opt.value === size);
        return hasColor && hasSize && v.stock > 0;
      });
      if (variant) return variant;
    }
    
    // If only color is selected, find first variant with that color
    if (color) {
      const variant = product.variants.find(v => {
        const hasColor = v.options?.some(opt => opt.key === 'color' && opt.value === color);
        return hasColor && v.stock > 0;
      });
      if (variant) return variant;
    }
    
    // If only size is selected, find first variant with that size
    if (size) {
      const variant = product.variants.find(v => {
        const hasSize = v.options?.some(opt => opt.key === 'size' && opt.value === size);
        return hasSize && v.stock > 0;
      });
      if (variant) return variant;
    }
    
    // Otherwise return first available variant
    return product.variants.find(v => v.stock > 0) || product.variants[0] || null;
  }, [product?.variants]);

  // Update selected variant when color or size changes
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const newVariant = findVariantByColorAndSize(selectedColor, selectedSize);
      if (newVariant && newVariant.id !== selectedVariant?.id) {
        setSelectedVariant(newVariant);
      }
    }
  }, [selectedColor, selectedSize, findVariantByColorAndSize, selectedVariant?.id, product]);

  // Extract image URLs helper function
  const getImageUrl = useCallback((mediaItem: ProductMedia | string | any): string | null => {
    if (!mediaItem) return null;
    if (typeof mediaItem === 'string') return mediaItem;
    if (typeof mediaItem === 'object') return mediaItem.url || mediaItem.src || null;
    return null;
  }, []);

  // Get images array from product
  const images = product ? (() => {
    const extracted = (product.media || [])
      .map(getImageUrl)
      .filter((url): url is string => url !== null && url !== '');
    
    // If no images from API, add placeholder images for testing navigation
    if (extracted.length === 0) {
      return [
        'https://via.placeholder.com/600/000000/FFFFFF?text=Image+1',
        'https://via.placeholder.com/600/333333/FFFFFF?text=Image+2',
        'https://via.placeholder.com/600/666666/FFFFFF?text=Image+3',
        'https://via.placeholder.com/600/999999/FFFFFF?text=Image+4',
      ];
    }
    return extracted;
  })() : [];

  // Auto-scroll thumbnails when main image changes
  useEffect(() => {
    if (images.length > thumbnailsPerView) {
      if (currentImageIndex < thumbnailStartIndex) {
        setThumbnailStartIndex(currentImageIndex);
      } else if (currentImageIndex >= thumbnailStartIndex + thumbnailsPerView) {
        setThumbnailStartIndex(currentImageIndex - thumbnailsPerView + 1);
      }
    }
  }, [currentImageIndex, images.length, thumbnailStartIndex, thumbnailsPerView]);

  // Early return if slug is a reserved route (redirecting)
  if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="aspect-square bg-gray-200 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h1>
          <p className="text-gray-600">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }


  // Group variants by color
  const colorGroups: Array<{ color: string; stock: number; variants: ProductVariant[] }> = [];
  if (product.variants && product.variants.length > 0) {
    const colorMap = new Map<string, ProductVariant[]>();
    
    product.variants.forEach(variant => {
      const colorOption = variant.options?.find(opt => opt.key === 'color');
      const color = colorOption?.value || 'default';
      
      if (!colorMap.has(color)) {
        colorMap.set(color, []);
      }
      colorMap.get(color)!.push(variant);
    });
    
    colorMap.forEach((variants, color) => {
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      if (totalStock > 0) {
        colorGroups.push({
          color,
          stock: totalStock,
          variants,
        });
      }
    });
  }

  // Group variants by size
  const sizeGroups: Array<{ size: string; stock: number; variants: ProductVariant[] }> = [];
  if (product.variants && product.variants.length > 0) {
    const sizeMap = new Map<string, ProductVariant[]>();
    
    product.variants.forEach(variant => {
      const sizeOption = variant.options?.find(opt => opt.key === 'size');
      const size = sizeOption?.value || 'default';
      
      if (!sizeMap.has(size)) {
        sizeMap.set(size, []);
      }
      sizeMap.get(size)!.push(variant);
    });
    
    sizeMap.forEach((variants, size) => {
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      if (totalStock > 0) {
        sizeGroups.push({
          size,
          stock: totalStock,
          variants,
        });
      }
    });
  }


  // Get current variant
  const currentVariant = selectedVariant || findVariantByColorAndSize(selectedColor, selectedSize) || product.variants?.[0] || null;
  const price = currentVariant?.price || 0;
  const compareAtPrice = currentVariant?.compareAtPrice;

  // Handle color selection
  const handleColorSelect = (color: string) => {
    if (selectedColor === color) {
      setSelectedColor(null);
    } else {
      setSelectedColor(color);
    }
  };

  // Handle size selection
  const handleSizeSelect = (size: string) => {
    if (selectedSize === size) {
      setSelectedSize(null);
    } else {
      setSelectedSize(size);
    }
  };

  // Handle add to wishlist
  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product) return;
    
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(WISHLIST_KEY);
      const wishlist: string[] = stored ? JSON.parse(stored) : [];
      
      if (isInWishlist) {
        const updated = wishlist.filter((id) => id !== product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
        setIsInWishlist(false);
        setShowMessage('Removed from wishlist');
        setTimeout(() => setShowMessage(null), 2000);
      } else {
        wishlist.push(product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
        setIsInWishlist(true);
        setShowMessage('Added to wishlist');
        setTimeout(() => setShowMessage(null), 2000);
      }
      
      window.dispatchEvent(new Event('wishlist-updated'));
    } catch (error) {
      console.error('Error updating wishlist:', error);
      setShowMessage('Failed to update wishlist');
      setTimeout(() => setShowMessage(null), 3000);
    }
  };

  // Handle thumbnail navigation
  const handleThumbnailUp = () => {
    if (thumbnailStartIndex > 0) {
      setThumbnailStartIndex(thumbnailStartIndex - 1);
    }
  };

  const handleThumbnailDown = () => {
    if (images.length > thumbnailsPerView && thumbnailStartIndex < images.length - thumbnailsPerView) {
      setThumbnailStartIndex(thumbnailStartIndex + 1);
    }
  };

  // Get visible thumbnails
  const visibleThumbnails = images.slice(thumbnailStartIndex, thumbnailStartIndex + thumbnailsPerView);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image Gallery */}
        <div className="flex gap-4">
          {/* Thumbnail Gallery - Left Side */}
          <div className="flex flex-col items-center gap-2">
            {/* Thumbnail Images */}
            <div className="flex flex-col gap-2">
              {visibleThumbnails.map((image, index) => {
                const actualIndex = thumbnailStartIndex + index;
                const isActive = actualIndex === currentImageIndex;
                return (
                  <button
                    key={actualIndex}
                    onClick={() => {
                      setCurrentImageIndex(actualIndex);
                      // Adjust thumbnail view if needed
                      if (actualIndex >= thumbnailStartIndex + thumbnailsPerView) {
                        setThumbnailStartIndex(actualIndex - thumbnailsPerView + 1);
                      } else if (actualIndex < thumbnailStartIndex) {
                        setThumbnailStartIndex(actualIndex);
                      }
                    }}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      isActive
                        ? 'border-gray-900 shadow-md'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    aria-label={`View image ${actualIndex + 1}`}
                  >
                    <Image
                      src={image}
                      alt={`${product.title} - Image ${actualIndex + 1}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  </button>
                );
              })}
            </div>

            {/* Navigation Arrows */}
            {images.length > thumbnailsPerView && (
              <div className="flex flex-col gap-1 mt-2">
                <button
                  onClick={handleThumbnailUp}
                  disabled={thumbnailStartIndex === 0}
                  className={`w-8 h-8 flex items-center justify-center rounded border border-gray-300 transition-colors ${
                    thumbnailStartIndex === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  aria-label="Scroll thumbnails up"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={handleThumbnailDown}
                  disabled={thumbnailStartIndex >= images.length - thumbnailsPerView}
                  className={`w-8 h-8 flex items-center justify-center rounded border border-gray-300 transition-colors ${
                    thumbnailStartIndex >= images.length - thumbnailsPerView
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                  aria-label="Scroll thumbnails down"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Main Image - Right Side */}
          <div className="flex-1 relative">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group">
            {images.length > 0 ? (
                <>
              <Image
                src={images[currentImageIndex]}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                unoptimized
              />
                  {/* Zoom Button */}
                  <button
                    onClick={() => setShowZoom(true)}
                    className="absolute bottom-4 right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Zoom image"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 2L6 6M14 6L18 2M2 18L6 14M14 14L18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <rect x="6" y="6" width="8" height="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </button>
                </>
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">No Image</span>
              </div>
            )}
            </div>
          </div>

          {/* Zoom Modal */}
          {showZoom && images.length > 0 && (
            <div
              className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
              onClick={() => setShowZoom(false)}
            >
                <button
                onClick={() => setShowZoom(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                aria-label="Close zoom"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                </button>
              <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
                <Image
                  src={images[currentImageIndex]}
                  alt={product.title}
                  width={1200}
                  height={1200}
                  className="max-w-full max-h-[90vh] object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.brand && (
            <p className="text-sm text-gray-500 mb-2">{product.brand.name}</p>
          )}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {product.title}
          </h1>
          {product.subtitle && (
            <p className="text-lg text-gray-600 mb-4">{product.subtitle}</p>
          )}
          <div className="flex items-center gap-3 mb-6">
            <p className="text-2xl font-bold text-gray-900">
              {formatPrice(price, currency)}
            </p>
            {compareAtPrice && compareAtPrice > price && (
              <p className="text-xl text-gray-500 line-through">
                {formatPrice(compareAtPrice, currency)}
              </p>
            )}
          </div>
          
          {product.description && (
            <div 
              className="text-gray-600 mb-8 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          )}

          {/* Color Selector */}
          {colorGroups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                Գույն
              </h3>
              <div className="flex flex-wrap gap-3">
                {colorGroups.map((group) => {
                  const isSelected = selectedColor === group.color;
                  const colorName = group.color;
                  const colorValue = getColorValue(colorName);
                  
                  // Check if this color has available variants with selected size
                  const availableVariants = selectedSize
                    ? group.variants.filter(v => {
                        const hasSize = v.options?.some(opt => opt.key === 'size' && opt.value === selectedSize);
                        return hasSize && v.stock > 0;
                      })
                    : group.variants.filter(v => v.stock > 0);
                  
                  const isDisabled = availableVariants.length === 0 && selectedSize !== null;
                  
                  return (
                    <button
                      key={group.color}
                      type="button"
                      onClick={() => {
                        if (!isDisabled) {
                          handleColorSelect(group.color);
                        }
                      }}
                      disabled={isDisabled}
                      className={`
                        relative flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all
                        ${isSelected 
                          ? 'border-gray-900 bg-gray-50 shadow-md' 
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                      aria-label={`Select color ${colorName}`}
                    >
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: colorValue }}
                      />
                      <span className="text-sm font-medium text-gray-900 capitalize">{colorName}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {group.stock}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {sizeGroups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                Չափս
              </h3>
              <div className="flex flex-wrap gap-3">
                {sizeGroups.map((group) => {
                  const isSelected = selectedSize === group.size;
                  const sizeName = group.size;
                  
                  // Check if this size has available variants with selected color
                  const availableVariants = selectedColor
                    ? group.variants.filter(v => {
                        const hasColor = v.options?.some(opt => opt.key === 'color' && opt.value === selectedColor);
                        return hasColor && v.stock > 0;
                      })
                    : group.variants.filter(v => v.stock > 0);
                  
                  const isDisabled = availableVariants.length === 0 && selectedColor !== null;
                  
                  return (
                    <button
                      key={group.size}
                      type="button"
                      onClick={() => {
                        if (!isDisabled) {
                          handleSizeSelect(group.size);
                        }
                      }}
                      disabled={isDisabled}
                      className={`
                        min-w-[60px] px-4 py-2.5 rounded-lg border-2 transition-all text-center
                        ${isSelected 
                          ? 'border-gray-900 bg-gray-50 shadow-md font-semibold' 
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                      aria-label={`Select size ${sizeName}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium text-gray-900">{sizeName}</span>
                        <span className="text-xs text-gray-500">{group.stock} հատ</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Status */}
          {currentVariant && (
            <div className="mb-6">
              <p className={`text-sm font-medium ${currentVariant.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {currentVariant.stock > 0 
                  ? `✓ Պահեստում: ${currentVariant.stock} հատ` 
                  : '✗ Պահեստում չկա'
                }
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Button 
              type="button"
              variant="primary" 
              size="lg" 
              className="w-full"
              disabled={!currentVariant || currentVariant.stock === 0 || isAddingToCart}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Add to cart clicked', { currentVariant, productId: product.id, isLoggedIn });
                
                if (!currentVariant || currentVariant.stock === 0) {
                  console.warn('Cannot add to cart: no variant or out of stock', { currentVariant });
                  return;
                }
                
                if (!isLoggedIn) {
                  console.log('User not logged in, redirecting to login');
                  router.push(`/login?redirect=/products/${slug}`);
                  return;
                }

                setIsAddingToCart(true);
                try {
                  console.log('Adding to cart:', {
                    productId: product.id,
                    variantId: currentVariant.id,
                    quantity: 1,
                  });
                  
                  await apiClient.post(
                    '/api/v1/cart/items',
                    {
                      productId: product.id,
                      variantId: currentVariant.id,
                      quantity: 1,
                    }
                  );

                  console.log('Successfully added to cart');
                  setShowMessage('Added to cart');
                  setTimeout(() => setShowMessage(null), 2000);
                  
                  // Trigger cart update event
                  window.dispatchEvent(new Event('cart-updated'));
                } catch (error: any) {
                  console.error('Error adding to cart:', error);
                  if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
                    setIsAddingToCart(false);
                    router.push(`/login?redirect=/products/${slug}`);
                    return;
                  } else {
                    setShowMessage('Failed to add to cart');
                    setTimeout(() => setShowMessage(null), 3000);
                  }
                } finally {
                  setIsAddingToCart(false);
                }
              }}
            >
              {isAddingToCart ? 'Adding...' : (currentVariant && currentVariant.stock > 0 ? 'Add to Cart' : 'Out of Stock')}
            </Button>
            <Button 
              type="button"
              variant="outline" 
              size="lg" 
              className="w-full"
              onClick={handleAddToWishlist}
            >
              {isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
            </Button>
          </div>

          {/* Success/Error Message */}
          {showMessage && (
            <div className="mt-4 p-4 bg-gray-900 text-white rounded-md text-sm shadow-lg animate-fade-in">
              {showMessage}
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {product.categories && product.categories.length > 0 && (
        <RelatedProducts 
          categorySlug={product.categories[0].slug} 
          currentProductId={product.id}
        />
      )}

      {/* Product Reviews */}
      <ProductReviews productId={product.id} />
    </div>
  );
}

