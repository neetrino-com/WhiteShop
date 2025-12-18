'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import type { MouseEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../../lib/currency';
import { getStoredLanguage } from '../../../lib/language';
import { useAuth } from '../../../lib/auth/AuthContext';
import { RelatedProducts } from '../../../components/RelatedProducts';
import { ProductReviews } from '../../../components/ProductReviews';
import { Heart, Minus, Plus } from 'lucide-react';
import { CompareIcon } from '../../../components/icons/CompareIcon';
import { ProductLabels } from '../../../components/ProductLabels';

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
  originalPrice?: number | null;
  compareAtPrice?: number;
  stock: number;
  available: boolean;
  options: VariantOption[];
  productDiscount?: number | null;
  globalDiscount?: number | null;
  imageUrl?: string;
}

interface ProductLabel {
  id: string;
  type: 'text' | 'percentage';
  value: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color: string | null;
}

interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  media: ProductMedia[] | string[];
  variants: ProductVariant[];
  labels?: ProductLabel[];
  brand?: {
    id: string;
    name: string;
  };
  categories?: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  productDiscount?: number | null;
  globalDiscount?: number | null;
}


// Reserved routes that should not be treated as product slugs
const RESERVED_ROUTES = ['admin', 'login', 'register', 'cart', 'checkout', 'profile', 'orders', 'wishlist', 'compare', 'categories', 'products', 'about', 'contact', 'delivery', 'shipping', 'returns', 'faq', 'support', 'stores', 'privacy', 'terms', 'cookies'];

const WISHLIST_KEY = 'shop_wishlist';
const COMPARE_KEY = 'shop_compare';

export default function ProductPage({ params }: ProductPageProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currency, setCurrency] = useState(getStoredCurrency());
  // Language state - used in handleLanguageUpdate function (setLanguage)
  // eslint-disable-next-line no-unused-vars
  const [language, setLanguage] = useState(getStoredLanguage());
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isInCompare, setIsInCompare] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<Array<{ rating: number }>>([]);
  const thumbnailsPerView = 3;

  // Unified image processing helper - DEFINED FIRST
  const processImageUrl = useCallback((url: any): string | null => {
    if (!url) return null;
    
    let finalUrl = '';
    if (typeof url === 'string') {
      finalUrl = url.trim();
    } else if (typeof url === 'object') {
      finalUrl = (url.url || url.src || '').trim();
    }
    
    if (!finalUrl) return null;
    
    if (finalUrl.startsWith('http') || finalUrl.startsWith('data:')) {
      return finalUrl;
    }
    
    if (finalUrl.startsWith('/')) {
      return finalUrl;
    }
    
    return `/${finalUrl}`;
  }, []);

  /**
   * Smart split for comma-separated image URLs that handles Base64 data URIs
   */
  const smartSplitUrls = useCallback((str: string | null | undefined): string[] => {
    if (!str) return [];
    if (!str.includes('data:')) {
      return str.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    const parts = str.split(',');
    const results: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.startsWith('data:')) {
        if (i + 1 < parts.length) {
          results.push(part + ',' + parts[i + 1].trim());
          i++;
        } else {
          results.push(part);
        }
      } else if (part) {
        results.push(part);
      }
    }
    return results;
  }, []);

  // Get images array from product - DEFINED SECOND
  const images = useMemo(() => {
    if (!product) return [];
    
    const allRawImages: any[] = [];
    // 1. Add general product media first
    if (product.media) allRawImages.push(...product.media);
    
    // 2. Add all variant images
    if (product.variants) {
      product.variants.forEach(v => {
        if (v.imageUrl) {
          const split = smartSplitUrls(v.imageUrl);
          allRawImages.push(...split);
        }
      });
    }

    const processedImages = allRawImages
      .map(processImageUrl)
      .filter((url): url is string => url !== null);
    
    // Return all unique images (no filtering by color anymore)
    return Array.from(new Set(processedImages));
  }, [product, processImageUrl, smartSplitUrls]);

  // Helper function to get color hex/rgb from color name
  const getColorValue = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      'beige': '#F5F5DC', 'black': '#000000', 'blue': '#0000FF', 'brown': '#A52A2A',
      'gray': '#808080', 'grey': '#808080', 'green': '#008000', 'red': '#FF0000',
      'white': '#FFFFFF', 'yellow': '#FFFF00', 'orange': '#FFA500', 'pink': '#FFC0CB',
      'purple': '#800080', 'navy': '#000080', 'maroon': '#800000', 'olive': '#808000',
      'teal': '#008080', 'cyan': '#00FFFF', 'magenta': '#FF00FF', 'lime': '#00FF00',
      'silver': '#C0C0C0', 'gold': '#FFD700',
    };
    const normalizedName = colorName.toLowerCase().trim();
    return colorMap[normalizedName] || '#CCCCCC';
  };
  
  const resolvedParams = use(params);
  const rawSlug = resolvedParams?.slug ?? '';
  const slugParts = rawSlug.includes(':') ? rawSlug.split(':') : [rawSlug];
  const slug = slugParts[0];
  const variantIdFromUrl = slugParts.length > 1 ? slugParts[1] : null;

  useEffect(() => {
    if (!slug) return;
    if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
      router.replace(`/${slug}`);
    }
  }, [slug, router]);

  useEffect(() => {
    if (!slug || RESERVED_ROUTES.includes(slug.toLowerCase())) return;

    async function fetchProduct() {
      try {
        setLoading(true);
        const data = await apiClient.get<Product>(`/api/v1/products/${slug}`);
        setProduct(data);
        setCurrentImageIndex(0);
        setThumbnailStartIndex(0);
        
        if (data.variants && data.variants.length > 0) {
          let initialVariant = data.variants[0];
          if (variantIdFromUrl) {
            const variantById = data.variants.find(v => v.id === variantIdFromUrl || v.id.endsWith(variantIdFromUrl));
            const variantByIndex = data.variants[parseInt(variantIdFromUrl) - 1];
            initialVariant = variantById || variantByIndex || data.variants[0];
          }
          setSelectedVariant(initialVariant);
          const colorOption = initialVariant.options?.find(opt => opt.key === 'color');
          if (colorOption) setSelectedColor(colorOption.value);
          const sizeOption = initialVariant.options?.find(opt => opt.key === 'size');
          if (sizeOption) setSelectedSize(sizeOption.value);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();

    const handleCurrencyUpdate = () => setCurrency(getStoredCurrency());
    const handleLanguageUpdate = () => setLanguage(getStoredLanguage());
    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, [slug, variantIdFromUrl, router]);

  useEffect(() => {
    if (!product) return;
    const checkWishlist = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(WISHLIST_KEY);
        const wishlist = stored ? JSON.parse(stored) : [];
        setIsInWishlist(wishlist.includes(product.id));
      } catch { setIsInWishlist(false); }
    };
    checkWishlist();
    window.addEventListener('wishlist-updated', checkWishlist);
    return () => window.removeEventListener('wishlist-updated', checkWishlist);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const checkCompare = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(COMPARE_KEY);
        const compare = stored ? JSON.parse(stored) : [];
        setIsInCompare(compare.includes(product.id));
      } catch { setIsInCompare(false); }
    };
    checkCompare();
    window.addEventListener('compare-updated', checkCompare);
    return () => window.removeEventListener('compare-updated', checkCompare);
  }, [product?.id]);

  // Ensure currentImageIndex is valid
  useEffect(() => {
    if (images.length > 0 && currentImageIndex >= images.length) {
      setCurrentImageIndex(0);
    }
  }, [images.length, currentImageIndex]);

  useEffect(() => {
    if (!product) return;
    const loadReviews = () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = localStorage.getItem(`reviews_${product.id}`);
        if (stored) setReviews(JSON.parse(stored));
      } catch (error) { console.error('Error loading reviews:', error); }
    };
    loadReviews();
    window.addEventListener('review-updated', loadReviews);
    return () => window.removeEventListener('review-updated', loadReviews);
  }, [product?.id]);

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const findVariantByColorAndSize = useCallback((color: string | null, size: string | null): ProductVariant | null => {
    if (!product?.variants || product.variants.length === 0) return null;
    if (color && size) {
      const variant = product.variants.find(v => 
        v.options?.some(opt => opt.key === 'color' && opt.value === color) &&
        v.options?.some(opt => opt.key === 'size' && opt.value === size)
      );
      if (variant) return variant;
    }
    if (color && !size) {
      const variant = product.variants.find(v => v.options?.some(opt => opt.key === 'color' && opt.value === color) && v.stock > 0) 
                   || product.variants.find(v => v.options?.some(opt => opt.key === 'color' && opt.value === color));
      if (variant) return variant;
    }
    if (size && !color) {
      const variant = product.variants.find(v => v.options?.some(opt => opt.key === 'size' && opt.value === size) && v.stock > 0)
                   || product.variants.find(v => v.options?.some(opt => opt.key === 'size' && opt.value === size));
      if (variant) return variant;
    }
    return product.variants.find(v => v.stock > 0) || product.variants[0] || null;
  }, [product?.variants]);

  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const newVariant = findVariantByColorAndSize(selectedColor, selectedSize);
      if (newVariant && newVariant.id !== selectedVariant?.id) {
        setSelectedVariant(newVariant);
      }
    }
  }, [selectedColor, selectedSize, findVariantByColorAndSize, selectedVariant?.id, product]);

  const colorGroups: Array<{ color: string; stock: number; variants: ProductVariant[] }> = [];
  if (product?.variants) {
    const colorMap = new Map<string, ProductVariant[]>();
    product.variants.forEach(variant => {
      const color = variant.options?.find(opt => opt.key === 'color')?.value || 'default';
      if (!colorMap.has(color)) colorMap.set(color, []);
      colorMap.get(color)!.push(variant);
    });
    colorMap.forEach((variants, color) => {
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      colorGroups.push({ color, stock: totalStock, variants });
    });
  }

  const sizeGroups: Array<{ size: string; stock: number; variants: ProductVariant[] }> = [];
  if (product?.variants) {
    const sizeMap = new Map<string, ProductVariant[]>();
    product.variants.forEach(variant => {
      const size = variant.options?.find(opt => opt.key === 'size')?.value || 'default';
      if (!sizeMap.has(size)) sizeMap.set(size, []);
      sizeMap.get(size)!.push(variant);
    });
    sizeMap.forEach((variants, size) => {
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      sizeGroups.push({ size, stock: totalStock, variants });
    });
  }

  const currentVariant = selectedVariant || findVariantByColorAndSize(selectedColor, selectedSize) || product?.variants?.[0] || null;
  const price = currentVariant?.price || 0;
  const originalPrice = currentVariant?.originalPrice;
  const compareAtPrice = currentVariant?.compareAtPrice;
  const discountPercent = currentVariant?.productDiscount || product?.productDiscount || null;
  const maxQuantity = currentVariant?.stock && currentVariant.stock > 0 ? currentVariant.stock : 0;
  const isOutOfStock = !currentVariant || currentVariant.stock <= 0;
  const isVariationRequired = (colorGroups.filter(g => g.stock > 0).length > 0 && !selectedColor) || 
                               (sizeGroups.filter(g => g.stock > 0).length > 0 && !selectedSize);
  const canAddToCart = !isOutOfStock && !isVariationRequired;

  useEffect(() => {
    if (!currentVariant || currentVariant.stock <= 0) { setQuantity(0); return; }
    setQuantity(prev => {
      const currentStock = currentVariant.stock;
      if (prev > currentStock) return currentStock;
      if (prev <= 0 && currentStock > 0) return 1;
      return prev;
    });
  }, [currentVariant?.id, currentVariant?.stock]);

  const adjustQuantity = (delta: number) => {
    if (isOutOfStock || isVariationRequired) return;
    setQuantity(prev => {
      const next = prev + delta;
      if (next < 1) return currentVariant && currentVariant.stock > 0 ? 1 : 0;
      return next > maxQuantity ? maxQuantity : next;
    });
  };

  useEffect(() => {
    if (images.length > thumbnailsPerView) {
      if (currentImageIndex < thumbnailStartIndex) setThumbnailStartIndex(currentImageIndex);
      else if (currentImageIndex >= thumbnailStartIndex + thumbnailsPerView) setThumbnailStartIndex(currentImageIndex - thumbnailsPerView + 1);
    }
  }, [currentImageIndex, images.length, thumbnailStartIndex]);

  const handleColorSelect = (color: string) => {
    if (selectedColor === color) {
      setSelectedColor(null);
    } else {
      setSelectedColor(color);
      
      // Find the first image associated with this color and jump to it
      if (product?.variants) {
        const variantWithImage = product.variants.find(v => 
          v.options?.some(opt => opt.key === 'color' && opt.value === color) && 
          v.imageUrl
        );
        
        if (variantWithImage && variantWithImage.imageUrl) {
          const firstColorImageUrl = smartSplitUrls(variantWithImage.imageUrl)[0];
          const processedUrl = processImageUrl(firstColorImageUrl);
          
          if (processedUrl) {
            const imageIndex = images.indexOf(processedUrl);
            if (imageIndex !== -1) {
              setCurrentImageIndex(imageIndex);
              
              // Also update thumbnail scroll if needed
              if (imageIndex < thumbnailStartIndex || imageIndex >= thumbnailStartIndex + thumbnailsPerView) {
                const newStart = Math.max(0, Math.min(images.length - thumbnailsPerView, imageIndex));
                setThumbnailStartIndex(newStart);
              }
            }
          }
        }
      }
    }
  };

  const handleSizeSelect = (size: string) => {
    if (selectedSize === size) setSelectedSize(null);
    else setSelectedSize(size);
  };

  const handleAddToWishlist = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product || typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(WISHLIST_KEY);
      const wishlist: string[] = stored ? JSON.parse(stored) : [];
      if (isInWishlist) {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist.filter(id => id !== product.id)));
        setIsInWishlist(false);
        setShowMessage('Removed from wishlist');
      } else {
        wishlist.push(product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
        setIsInWishlist(true);
        setShowMessage('Added to wishlist');
      }
      setTimeout(() => setShowMessage(null), 2000);
      window.dispatchEvent(new Event('wishlist-updated'));
    } catch (err) { console.error(err); }
  };

  const handleCompareToggle = (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product || typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(COMPARE_KEY);
      const compare: string[] = stored ? JSON.parse(stored) : [];
      if (isInCompare) {
        localStorage.setItem(COMPARE_KEY, JSON.stringify(compare.filter(id => id !== product.id)));
        setIsInCompare(false);
        setShowMessage('Removed from compare');
      } else {
        if (compare.length >= 4) { setShowMessage('Compare list is full'); }
        else {
          compare.push(product.id);
          localStorage.setItem(COMPARE_KEY, JSON.stringify(compare));
          setIsInCompare(true);
          setShowMessage('Added to compare');
        }
      }
      setTimeout(() => setShowMessage(null), 2000);
      window.dispatchEvent(new Event('compare-updated'));
    } catch (err) { console.error(err); }
  };

  if (loading || !product) return <div className="max-w-7xl mx-auto px-4 py-16 text-center">Loading...</div>;

  const visibleThumbnails = images.slice(thumbnailStartIndex, thumbnailStartIndex + thumbnailsPerView);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col gap-2">
              {visibleThumbnails.map((image, index) => {
                const actualIndex = thumbnailStartIndex + index;
                const isActive = actualIndex === currentImageIndex;
                return (
                  <button key={actualIndex} onClick={() => setCurrentImageIndex(actualIndex)}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${isActive ? 'border-gray-900 shadow-md' : 'border-gray-200'}`}>
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
            {images.length > thumbnailsPerView && (
              <div className="flex flex-col gap-1">
                <button onClick={() => setThumbnailStartIndex(Math.max(0, thumbnailStartIndex - 1))} className="p-1 border rounded">▲</button>
                <button onClick={() => setThumbnailStartIndex(Math.min(images.length - thumbnailsPerView, thumbnailStartIndex + 1))} className="p-1 border rounded">▼</button>
              </div>
            )}
          </div>
          <div className="flex-1 relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
            {images.length > 0 ? (
              <img src={images[currentImageIndex]} alt={product.title} className="w-full h-full object-cover" />
            ) : <div className="w-full h-full flex items-center justify-center">No Image</div>}
            {product.labels && <ProductLabels labels={product.labels} />}
            <button onClick={() => setShowZoom(true)} className="absolute bottom-4 right-4 p-2 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity">🔍</button>
          </div>
        </div>

        <div>
          {product.brand && <p className="text-sm text-gray-500 mb-2">{product.brand.name}</p>}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{product.title}</h1>
          <div className="mb-6">
            <p className="text-2xl font-bold text-gray-900">{formatPrice(price, currency)}</p>
            {discountPercent && <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-sm">-{discountPercent}%</span>}
          </div>
          <div className="text-gray-600 mb-8 prose prose-sm" dangerouslySetInnerHTML={{ __html: product.description || '' }} />

          <div className="mt-8 p-6 bg-white border border-gray-200 rounded-2xl space-y-5">
            {colorGroups.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Color:</label>
                <div className="flex flex-wrap gap-2">
                  {colorGroups.map((g) => {
                    const isSelected = selectedColor === g.color;
                    const isDisabled = g.stock <= 0;
                    
                    return (
                      <button 
                        key={g.color} 
                        onClick={() => !isDisabled && handleColorSelect(g.color)}
                        disabled={isDisabled}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          isSelected 
                            ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-900 scale-110' 
                            : isDisabled 
                              ? 'border-gray-100 opacity-30 grayscale cursor-not-allowed' 
                              : 'border-gray-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: getColorValue(g.color) }} 
                        title={isDisabled ? `${g.color} (Out of Stock)` : g.color} 
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {sizeGroups.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase">Size</label>
                <div className="flex flex-wrap gap-2">
                  {sizeGroups.map((g) => {
                    let displayStock = g.stock;
                    if (selectedColor) {
                      const v = g.variants.find(v => v.options?.some(opt => opt.key === 'color' && opt.value === selectedColor));
                      displayStock = v ? v.stock : 0;
                    }
                    const isSelected = selectedSize === g.size;
                    const isDisabled = displayStock <= 0;

                    return (
                      <button 
                        key={g.size} 
                        onClick={() => !isDisabled && handleSizeSelect(g.size)}
                        disabled={isDisabled}
                        className={`min-w-[50px] px-3 py-2 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'border-gray-900 bg-gray-50' 
                            : isDisabled 
                              ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' 
                              : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex flex-col text-center">
                          <span className={`text-sm font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>{g.size}</span>
                          <span className={`text-xs ${isDisabled ? 'text-gray-300' : 'text-gray-500'}`}>{displayStock} pcs</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t">
              <div className="flex items-center border rounded-xl overflow-hidden bg-gray-50">
                <button onClick={() => adjustQuantity(-1)} className="w-12 h-12 flex items-center justify-center">-</button>
                <div className="w-12 text-center font-bold">{quantity}</div>
                <button onClick={() => adjustQuantity(1)} className="w-12 h-12 flex items-center justify-center">+</button>
              </div>
              <button disabled={!canAddToCart || isAddingToCart} className="flex-1 h-12 bg-gray-900 text-white rounded-xl uppercase font-bold disabled:bg-gray-300"
                onClick={async () => {
                  if (!canAddToCart || !product || !currentVariant) return;
                  setIsAddingToCart(true);
                  try {
                    if (!isLoggedIn) {
                      const stored = localStorage.getItem('shop_cart_guest');
                      const cart = stored ? JSON.parse(stored) : [];
                      const existing = cart.find((i: any) => i.variantId === currentVariant.id);
                      if (existing) existing.quantity += quantity;
                      else cart.push({ productId: product.id, productSlug: product.slug, variantId: currentVariant.id, quantity });
                      localStorage.setItem('shop_cart_guest', JSON.stringify(cart));
                    } else {
                      await apiClient.post('/api/v1/cart/items', { productId: product.id, variantId: currentVariant.id, quantity });
                    }
                    setShowMessage(`Added ${quantity} pcs to cart`);
                    window.dispatchEvent(new Event('cart-updated'));
                  } catch (err) { setShowMessage('Error adding to cart'); }
                  finally { setIsAddingToCart(false); setTimeout(() => setShowMessage(null), 2000); }
                }}>
                {isAddingToCart ? 'Adding...' : (isOutOfStock ? 'Out of Stock' : (isVariationRequired ? 'Select Options' : 'Add to Cart'))}
              </button>
              <button onClick={handleAddToWishlist} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center ${isInWishlist ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                <Heart fill={isInWishlist ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
          {showMessage && <div className="mt-4 p-4 bg-gray-900 text-white rounded-md shadow-lg">{showMessage}</div>}
        </div>
      </div>
      
      {showZoom && images.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={() => setShowZoom(false)}>
          <img src={images[currentImageIndex]} alt="" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl">✕</button>
        </div>
      )}

      <ProductReviews productId={product.id} />
      <div className="mt-16">
        <RelatedProducts categorySlug={product.categories?.[0]?.slug} currentProductId={product.id} />
      </div>
    </div>
  );
}
