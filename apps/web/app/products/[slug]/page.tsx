'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import type { MouseEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../../lib/currency';
import { getStoredLanguage, type LanguageCode } from '../../../lib/language';
import { t, getProductText, getAttributeLabel } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/AuthContext';
import { RelatedProducts } from '../../../components/RelatedProducts';
import { ProductReviews } from '../../../components/ProductReviews';
import { Heart, Minus, Plus, Maximize2 } from 'lucide-react';
import { CompareIcon } from '../../../components/icons/CompareIcon';
import { ProductLabels } from '../../../components/ProductLabels';
import {
  processImageUrl,
  smartSplitUrls,
  normalizeUrlForComparison,
  cleanImageUrls,
  separateMainAndVariantImages,
} from '../../../lib/utils/image-utils';

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
  valueId?: string; // New format: AttributeValue ID
  attributeId?: string; // New format: Attribute ID
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

interface ProductAttribute {
  id: string;
  attribute: {
    id: string;
    key: string;
    name: string;
    values: Array<{
      id: string;
      value: string;
      label: string;
      imageUrl?: string | null;
      colors?: string[] | null;
    }>;
  };
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
  productAttributes?: ProductAttribute[];
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
  // Initialize with 'en' to match server-side default and prevent hydration mismatch
  // eslint-disable-next-line no-unused-vars
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<Map<string, string>>(new Map());
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isInCompare, setIsInCompare] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<Array<{ rating: number }>>([]);
  const thumbnailsPerView = 3; // Show 3 thumbnails at a time

  // Use unified image utilities (imported from image-utils.ts)

  // Get images array from product - using unified utilities
  // Note: product.media is already cleaned and separated from variant images by findBySlug
  const images = useMemo(() => {
    if (!product) return [];
    
    console.log('🖼️ [PRODUCT IMAGES] Building images array for product:', product.id);
    
    // Collect all main images (product.media is already cleaned in findBySlug)
    const mainImages = Array.isArray(product.media) ? product.media : [];
    const cleanedMain = cleanImageUrls(mainImages);
    console.log('🖼️ [PRODUCT IMAGES] Main images from product.media:', cleanedMain.length);
    
    // Collect all variant images
    const variantImages: any[] = [];
    if (product.variants && Array.isArray(product.variants)) {
      // Sort variants by position for consistent order
      const sortedVariants = [...product.variants].sort((a, b) => {
        const aPos = (a as any).position ?? 0;
        const bPos = (b as any).position ?? 0;
        return aPos - bPos;
      });
      
      sortedVariants.forEach((v) => {
        if (v.imageUrl) {
          const urls = smartSplitUrls(v.imageUrl);
          variantImages.push(...urls);
        }
      });
    }
    
    const cleanedVariantImages = cleanImageUrls(variantImages);
    console.log('🖼️ [PRODUCT IMAGES] Variant images:', cleanedVariantImages.length);
    
    // Combine all images: main first, then variant images
    // Use array to preserve order, Set to track duplicates
    const allImages: string[] = [];
    const seenNormalized = new Set<string>();
    
    // Add main images first (preserve order)
    cleanedMain.forEach((img) => {
      const processed = processImageUrl(img) || img;
      const normalized = normalizeUrlForComparison(processed);
      if (!seenNormalized.has(normalized)) {
        allImages.push(img);
        seenNormalized.add(normalized);
      }
    });
    
    // Add variant images that are not already in main images
    cleanedVariantImages.forEach((img) => {
      const processed = processImageUrl(img) || img;
      const normalized = normalizeUrlForComparison(processed);
      if (!seenNormalized.has(normalized)) {
        allImages.push(img);
        seenNormalized.add(normalized);
      }
    });
    
    console.log('🖼️ [PRODUCT IMAGES] Final images count:', allImages.length);
    console.log('🖼️ [PRODUCT IMAGES] Main images:', cleanedMain.length);
    console.log('🖼️ [PRODUCT IMAGES] Variant images:', cleanedVariantImages.length);
    console.log('🖼️ [PRODUCT IMAGES] Unique images after deduplication:', allImages.length);
    
    return allImages;
  }, [product]);

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

  // Fetch product function - defined outside useEffect to be accessible
  const fetchProduct = useCallback(async () => {
    if (!slug || RESERVED_ROUTES.includes(slug.toLowerCase())) return;
    
    try {
      setLoading(true);
      const currentLang = getStoredLanguage();
      
      // Try to fetch with current language first
      let data: Product;
      try {
        data = await apiClient.get<Product>(`/api/v1/products/${slug}`, {
          params: { lang: currentLang }
        });
      } catch (error: any) {
        // If 404 and not English, try fallback to English
        if (error?.status === 404 && currentLang !== 'en') {
          try {
            data = await apiClient.get<Product>(`/api/v1/products/${slug}`, {
              params: { lang: 'en' }
            });
          } catch (fallbackError) {
            // If English also fails, throw the original error
            throw error;
          }
        } else {
          // Re-throw if it's not a 404 or if we're already trying English
          throw error;
        }
      }
      
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
        if (colorOption) setSelectedColor(colorOption.value?.toLowerCase().trim() || null);
        const sizeOption = initialVariant.options?.find(opt => opt.key === 'size');
        if (sizeOption) setSelectedSize(sizeOption.value?.toLowerCase().trim() || null);
      }
    } catch (error: any) {
      // If product not found (404), clear product state and show error
      if (error?.status === 404) {
        setProduct(null);
        // Optionally redirect to 404 page or show error message
        // router.push('/404');
      }
      // Don't clear existing product on other errors - keep showing the last successfully loaded product
      // This prevents losing the product when switching languages if translation doesn't exist
    } finally {
      setLoading(false);
    }
  }, [slug, variantIdFromUrl]);

  // Initialize language from localStorage after mount to prevent hydration mismatch
  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  useEffect(() => {
    if (!slug || RESERVED_ROUTES.includes(slug.toLowerCase())) return;

    fetchProduct();

    const handleCurrencyUpdate = () => setCurrency(getStoredCurrency());
    const handleLanguageUpdate = () => {
      setLanguage(getStoredLanguage());
      // Refetch product when language changes to update labels
      fetchProduct();
    };
    // Listen for currency rates updates to force re-render
    const handleCurrencyRatesUpdate = () => {
      // Force re-render by updating currency state
      setCurrency(getStoredCurrency());
    };
    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('language-updated', handleLanguageUpdate);
    window.addEventListener('currency-rates-updated', handleCurrencyRatesUpdate);
    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('language-updated', handleLanguageUpdate);
      window.removeEventListener('currency-rates-updated', handleCurrencyRatesUpdate);
    };
  }, [slug, variantIdFromUrl, router, fetchProduct]);

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
    if (!product || !slug) return;
    
    const loadReviews = async () => {
      try {
        const data = await apiClient.get<Array<{ rating: number }>>(`/api/v1/products/${slug}/reviews`);
        setReviews(data || []);
      } catch (error: any) {
        // If 404, product might not have reviews yet - that's okay
        setReviews([]);
      }
    };
    
    loadReviews();
    
    // Listen for review updates
    const handleReviewUpdate = () => {
      loadReviews();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('review-updated', handleReviewUpdate);
      return () => window.removeEventListener('review-updated', handleReviewUpdate);
    }
  }, [product?.id, slug]);

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  // Scroll to reviews section
  const scrollToReviews = useCallback(() => {
    const reviewsElement = document.getElementById('product-reviews');
    if (reviewsElement) {
      reviewsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Helper function to get option value (supports both new and old format)
  const getOptionValue = useCallback((options: VariantOption[] | undefined, key: string): string | null => {
    if (!options) return null;
    const opt = options.find(o => o.key === key || o.attribute === key);
    return opt?.value?.toLowerCase().trim() || null;
  }, []);

  // Helper function to check if variant has a specific color value (checks ALL color options)
  // A variant can have multiple color values (e.g., color: ["red", "blue"])
  const variantHasColor = useCallback((variant: ProductVariant, color: string): boolean => {
    if (!variant.options || !color) return false;
    const normalizedColor = color.toLowerCase().trim();
    
    // Check ALL options for color attribute
    const colorOptions = variant.options.filter(opt => 
      (opt.key === 'color' || opt.attribute === 'color')
    );
    
    // Check if any color option matches
    return colorOptions.some(opt => {
      const optValue = opt.value?.toLowerCase().trim();
      return optValue === normalizedColor;
    });
  }, []);

  const findVariantByColorAndSize = useCallback((color: string | null, size: string | null): ProductVariant | null => {
    if (!product?.variants || product.variants.length === 0) return null;
    
    const normalizedColor = color?.toLowerCase().trim();
    const normalizedSize = size?.toLowerCase().trim();

    // 1. Try exact match (Case-insensitive)
    // IMPORTANT: Use variantHasColor to check ALL color options, not just the first one
    if (normalizedColor && normalizedSize) {
      const variant = product.variants.find(v => {
        const hasColor = variantHasColor(v, normalizedColor);
        const vSize = getOptionValue(v.options, 'size');
        return hasColor && vSize === normalizedSize;
      });
      if (variant) return variant;
    }

    // 2. If color selected but no exact match with size, find any variant of this color
    if (normalizedColor) {
      // Prefer in-stock variant of this color
      // IMPORTANT: Use variantHasColor to check ALL color options
      const colorVariants = product.variants.filter(v => variantHasColor(v, normalizedColor));
      
      if (colorVariants.length > 0) {
        return colorVariants.find(v => v.stock > 0) || colorVariants[0];
      }
    }

    // 3. If only size selected or fallback for size
    if (normalizedSize) {
      const sizeVariants = product.variants.filter(v => {
        const vSize = getOptionValue(v.options, 'size');
        return vSize === normalizedSize;
      });
      
      if (sizeVariants.length > 0) {
        return sizeVariants.find(v => v.stock > 0) || sizeVariants[0];
      }
    }

    // 4. Ultimate fallback
    return product.variants.find(v => v.stock > 0) || product.variants[0] || null;
  }, [product?.variants, getOptionValue, variantHasColor]);

  /**
   * Find variant by all selected attributes (color, size, and other attributes)
   * This function considers all selected attribute values to find the best matching variant
   */
  const findVariantByAllAttributes = useCallback((
    color: string | null,
    size: string | null,
    otherAttributes: Map<string, string>
  ): ProductVariant | null => {
    if (!product?.variants || product.variants.length === 0) return null;
    
    const normalizedColor = color?.toLowerCase().trim();
    const normalizedSize = size?.toLowerCase().trim();

    // Build a map of all selected attributes (including color and size)
    const allSelectedAttributes = new Map<string, string>();
    if (normalizedColor) allSelectedAttributes.set('color', normalizedColor);
    if (normalizedSize) allSelectedAttributes.set('size', normalizedSize);
    otherAttributes.forEach((value, key) => {
      if (key !== 'color' && key !== 'size') {
        allSelectedAttributes.set(key, value.toLowerCase().trim());
      }
    });

    // Helper to check if a variant matches all selected attributes
    const variantMatches = (variant: ProductVariant): boolean => {
      // Check color - IMPORTANT: Use variantHasColor to check ALL color options
      if (normalizedColor) {
        if (!variantHasColor(variant, normalizedColor)) return false;
      }

      // Check size
      if (normalizedSize) {
        const vSize = getOptionValue(variant.options, 'size');
        if (vSize !== normalizedSize) return false;
      }

      // Check other attributes
      for (const [attrKey, attrValue] of otherAttributes.entries()) {
        if (attrKey === 'color' || attrKey === 'size') continue;
        
        const variantValue = getOptionValue(variant.options, attrKey);
        const normalizedAttrValue = attrValue.toLowerCase().trim();
        
        // Try matching by valueId first (if available)
        const option = variant.options?.find(opt => 
          opt.key === attrKey || opt.attribute === attrKey
        );
        
        if (option) {
          // Check by valueId if both have it
          if (option.valueId && attrValue) {
            // If the selected value is an ID, match by ID
            if (option.valueId === attrValue) {
              continue;
            }
          }
          
          // Fallback to value matching
          if (variantValue !== normalizedAttrValue) {
            return false;
          }
        } else {
          return false;
        }
      }

      return true;
    };

    // 1. Try to find exact match with all attributes
    const exactMatch = product.variants.find(v => variantMatches(v) && v.imageUrl);
    if (exactMatch) {
      return exactMatch;
    }

    // 2. Try to find any match (even without image) with all attributes
    const anyMatch = product.variants.find(v => variantMatches(v));
    if (anyMatch) {
      return anyMatch;
    }

    // 3. Fallback: find by color and size only
    if (normalizedColor || normalizedSize) {
      return findVariantByColorAndSize(normalizedColor || null, normalizedSize || null);
    }

    // 4. Ultimate fallback
    return product.variants.find(v => v.stock > 0) || product.variants[0] || null;
  }, [product?.variants, getOptionValue, findVariantByColorAndSize, variantHasColor]);

  /**
   * Switch to variant's image if it exists
   * This function finds the variant's image in the images array and switches to it
   * Note: If variant image matches an attribute value image, it won't be in the gallery,
   * so we won't switch to it (attribute value images are excluded from gallery)
   */
  const switchToVariantImage = useCallback((variant: ProductVariant | null) => {
    if (!variant || !variant.imageUrl || !product) {
      return;
    }

    const splitUrls = smartSplitUrls(variant.imageUrl);
    if (splitUrls.length === 0) {
      return;
    }

    // Helper function to normalize URLs for comparison
    const normalizeUrl = (url: string): string => {
      let normalized = url.trim();
      // Remove leading/trailing slashes for comparison
      if (normalized.startsWith('/')) normalized = normalized.substring(1);
      if (normalized.endsWith('/')) normalized = normalized.substring(0, normalized.length - 1);
      return normalized.toLowerCase();
    };

    // Check if variant image is an attribute value image (these are excluded from gallery)
    const isAttributeValueImage = (url: string): boolean => {
      if (!product.productAttributes) return false;
      
      for (const productAttr of product.productAttributes) {
        if (productAttr.attribute?.values) {
          for (const val of productAttr.attribute.values) {
            if (val.imageUrl) {
              const attrProcessed = processImageUrl(val.imageUrl);
              if (attrProcessed) {
                const normalizedAttr = normalizeUrl(attrProcessed);
                const normalizedVariant = normalizeUrl(url);
                if (normalizedAttr === normalizedVariant) {
                  return true;
                }
              }
            }
          }
        }
      }
      return false;
    };

    // Try to find the first variant image in the images array
    for (const url of splitUrls) {
      if (!url || url.trim() === '') continue;
      
      const processedUrl = processImageUrl(url);
      if (!processedUrl) {
        console.log(`⚠️ [VARIANT IMAGE] Failed to process URL: ${url.substring(0, 50)}...`);
        continue;
      }

      // If this variant image is an attribute value image, skip it
      // (attribute value images are not in the gallery, so we can't switch to them)
      if (isAttributeValueImage(processedUrl)) {
        console.log(`⏭️ [VARIANT IMAGE] Skipping attribute value image: ${processedUrl.substring(0, 50)}...`);
        continue;
      }

      // Try multiple matching strategies with better normalization
      const imageIndex = images.findIndex(img => {
        if (!img) return false;
        
        // Process both URLs for consistent comparison
        const processedImg = processImageUrl(img);
        if (!processedImg) return false;
        
        const normalizedImg = normalizeUrl(processedImg);
        const normalizedProcessed = normalizeUrl(processedUrl);
        
        // Exact match after normalization
        if (normalizedImg === normalizedProcessed) {
          console.log(`✅ [VARIANT IMAGE] Found exact match: ${processedUrl.substring(0, 50)}...`);
          return true;
        }
        
        // Match with/without leading slash (handle both processed URLs)
        const imgWithSlash = processedImg.startsWith('/') ? processedImg : `/${processedImg}`;
        const imgWithoutSlash = processedImg.startsWith('/') ? processedImg.substring(1) : processedImg;
        const processedWithSlash = processedUrl.startsWith('/') ? processedUrl : `/${processedUrl}`;
        const processedWithoutSlash = processedUrl.startsWith('/') ? processedUrl.substring(1) : processedUrl;
        
        if (imgWithSlash === processedWithSlash || 
            imgWithoutSlash === processedWithoutSlash ||
            imgWithSlash === processedWithoutSlash ||
            imgWithoutSlash === processedWithSlash) {
          console.log(`✅ [VARIANT IMAGE] Found match with slash normalization: ${processedUrl.substring(0, 50)}...`);
          return true;
        }
        
        // Match by filename (for cases where paths differ but filename is same)
        // Only for non-base64 URLs
        if (!processedImg.startsWith('data:') && !processedUrl.startsWith('data:')) {
          const imgFilename = processedImg.split('/').pop()?.toLowerCase().split('?')[0];
          const processedFilename = processedUrl.split('/').pop()?.toLowerCase().split('?')[0];
          if (imgFilename && processedFilename && imgFilename === processedFilename) {
            console.log(`✅ [VARIANT IMAGE] Found match by filename: ${imgFilename}`);
            return true;
          }
        }
        
        // For base64 images, compare directly
        if (processedImg.startsWith('data:') && processedUrl.startsWith('data:')) {
          if (processedImg === processedUrl) {
            console.log(`✅ [VARIANT IMAGE] Found base64 match`);
            return true;
          }
        }
        
        return false;
      });

      if (imageIndex !== -1) {
        console.log(`🖼️ [VARIANT IMAGE] Switching to image index ${imageIndex}: ${processedUrl.substring(0, 50)}...`);
        setCurrentImageIndex(imageIndex);
        
        // No need to update thumbnail scroll - all images are visible
        return;
      } else {
        console.log(`❌ [VARIANT IMAGE] Image not found in gallery: ${processedUrl.substring(0, 50)}...`);
        console.log(`   Available images: ${images.length} total`);
        console.log(`   First few images:`, images.slice(0, 3).map(img => img?.substring(0, 50)));
      }
    }
    
    // Fallback: If variant image not found, try to find any variant with the same color
    // and use its image if available in the gallery
    // IMPORTANT: Use variantHasColor to check ALL color options
    if (product?.variants) {
      // Get the first color value from variant to find matching variants
      const variantColor = getOptionValue(variant.options, 'color');
      if (variantColor) {
        const colorVariants = product.variants.filter(v => {
          return variantHasColor(v, variantColor) && v.imageUrl;
        });
        
        // Try to find image from any variant with the same color
        for (const colorVariant of colorVariants) {
          if (!colorVariant.imageUrl) continue;
          
          const colorSplitUrls = smartSplitUrls(colorVariant.imageUrl);
          for (const colorUrl of colorSplitUrls) {
            if (!colorUrl || colorUrl.trim() === '') continue;
            
            const processedColorUrl = processImageUrl(colorUrl);
            if (!processedColorUrl) continue;
            
            // Skip attribute value images
            if (isAttributeValueImage(processedColorUrl)) continue;
            
            const colorImageIndex = images.findIndex(img => {
              if (!img) return false;
              const processedImg = processImageUrl(img);
              if (!processedImg) return false;
              
              const normalizedImg = normalizeUrl(processedImg);
              const normalizedColor = normalizeUrl(processedColorUrl);
              
              if (normalizedImg === normalizedColor) {
                return true;
              }
              
              // Try with/without slash
              const imgWithSlash = processedImg.startsWith('/') ? processedImg : `/${processedImg}`;
              const imgWithoutSlash = processedImg.startsWith('/') ? processedImg.substring(1) : processedImg;
              const colorWithSlash = processedColorUrl.startsWith('/') ? processedColorUrl : `/${processedColorUrl}`;
              const colorWithoutSlash = processedColorUrl.startsWith('/') ? processedColorUrl.substring(1) : processedColorUrl;
              
              return imgWithSlash === colorWithSlash || 
                     imgWithoutSlash === colorWithoutSlash ||
                     imgWithSlash === colorWithoutSlash ||
                     imgWithoutSlash === colorWithSlash;
            });
            
            if (colorImageIndex !== -1) {
              console.log(`🖼️ [VARIANT IMAGE] Found fallback image from same color variant at index ${colorImageIndex}`);
              setCurrentImageIndex(colorImageIndex);
              return;
            }
          }
        }
      }
    }
    
    console.log(`⚠️ [VARIANT IMAGE] No variant image found in gallery for variant ${variant.id}`);
  }, [images, processImageUrl, smartSplitUrls, product, getOptionValue, variantHasColor]);

  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      // Find variant considering all selected attributes (color, size, and others)
      const newVariant = findVariantByAllAttributes(selectedColor, selectedSize, selectedAttributeValues);
      
      if (newVariant && newVariant.id !== selectedVariant?.id) {
        setSelectedVariant(newVariant);
        
        // Switch to variant's image if it exists
        switchToVariantImage(newVariant);
        
        // Synchronize selection states with the found variant (supports both formats)
        const colorValue = getOptionValue(newVariant.options, 'color');
        const sizeValue = getOptionValue(newVariant.options, 'size');
        
        if (colorValue && colorValue !== selectedColor?.toLowerCase().trim()) {
          setSelectedColor(colorValue);
        }
        if (sizeValue && sizeValue !== selectedSize?.toLowerCase().trim()) {
          setSelectedSize(sizeValue);
        }
      } else if (newVariant && newVariant.imageUrl) {
        // Always try to switch to variant's image when color changes, even if variant didn't change
        // This ensures the image updates when color is selected
        switchToVariantImage(newVariant);
      }
    }
  }, [selectedColor, selectedSize, selectedAttributeValues, findVariantByAllAttributes, switchToVariantImage, selectedVariant?.id, product, getOptionValue]);

  // Build attribute groups from productAttributes (new format) or from variants (old format)
  // This useMemo ensures attribute groups are recalculated when product or selectedVariant changes
  const attributeGroups = useMemo(() => {
    const groups = new Map<string, Array<{
      valueId?: string;
      value: string;
      label: string;
      stock: number;
      variants: ProductVariant[];
      imageUrl?: string | null;
      colors?: string[] | null;
    }>>();

    if (!product) {
      console.log('🔄 [ATTRIBUTE GROUPS] No product, returning empty groups');
      return groups;
    }

    console.log('🔄 [ATTRIBUTE GROUPS] Building attribute groups for product:', product.id);
    console.log('🔄 [ATTRIBUTE GROUPS] Selected color:', selectedColor);
    console.log('🔄 [ATTRIBUTE GROUPS] Selected size:', selectedSize);
    console.log('🔄 [ATTRIBUTE GROUPS] Selected attributes:', Array.from(selectedAttributeValues.entries()));

    // Helper function to check if a variant is compatible with currently selected attributes
    // This is used to filter which attribute values to show based on current selections
    // IMPORTANT: A variant can have multiple values for the same attribute (e.g., color: [red, blue, yellow])
    // So we need to check ALL options, not just the first one
    const isVariantCompatible = (variant: ProductVariant, currentSelections: Map<string, string>, excludeAttrKey?: string): boolean => {
      // If no selections, all variants are compatible
      if (currentSelections.size === 0) return true;
      
      // Check each selected attribute (excluding the one we're building)
      for (const [attrKey, selectedValue] of currentSelections.entries()) {
        // Skip the attribute we're currently building
        if (excludeAttrKey && attrKey === excludeAttrKey) {
          continue;
        }
        
        // IMPORTANT: Check ALL options for this attribute, not just the first one
        // A variant can have multiple values for the same attribute
        const normalizedSelectedValue = selectedValue.toLowerCase().trim();
        let hasMatchingValue = false;
        
        // Check all options for this attribute
        const matchingOptions = variant.options?.filter(opt => {
          const optKey = opt.key || opt.attribute;
          return optKey === attrKey;
        }) || [];
        
        if (matchingOptions.length === 0) {
          // Variant doesn't have this attribute, so it's not compatible
          return false;
        }
        
        // Check if any of the options match the selected value
        for (const option of matchingOptions) {
          const optValue = option.value?.toLowerCase().trim();
          const optValueId = option.valueId;
          
          // Match by value (case-insensitive)
          if (optValue === normalizedSelectedValue) {
            hasMatchingValue = true;
            break;
          }
          
          // Match by valueId
          if (optValueId && optValueId === selectedValue) {
            hasMatchingValue = true;
            break;
          }
        }
        
        // If no matching value found, variant is not compatible
        if (!hasMatchingValue) {
          return false;
        }
      }
      return true; // All selected attributes match
    };

    // Get currently selected attributes (excluding the attribute we're building)
    const getCurrentSelections = (excludeAttrKey: string): Map<string, string> => {
      const selections = new Map<string, string>();
      if (selectedColor && excludeAttrKey !== 'color') {
        selections.set('color', selectedColor);
      }
      if (selectedSize && excludeAttrKey !== 'size') {
        selections.set('size', selectedSize);
      }
      selectedAttributeValues.forEach((value, key) => {
        if (key !== excludeAttrKey) {
          selections.set(key, value);
        }
      });
      return selections;
    };

    if (product.productAttributes && product.productAttributes.length > 0) {
      // New format: Use productAttributes
      product.productAttributes.forEach((productAttr) => {
        const attrKey = productAttr.attribute.key;
        const valueMap = new Map<string, { valueId?: string; value: string; label: string; variants: ProductVariant[] }>();
        
        // IMPORTANT: Show ALL attribute values, regardless of other selections
        // We don't filter variants here - we show all values that exist in any variant
        // Stock will be calculated separately based on current selections

        product.variants?.forEach((variant) => {
          // Include ALL variants - don't filter by compatibility
          // This ensures all attribute values are shown
          // IMPORTANT: Use filter() instead of find() to get ALL options for this attribute
          // A variant can have multiple values for the same attribute (e.g., color: [red, blue])

          const options = variant.options?.filter((opt) => {
            if (opt.valueId && opt.attributeId === productAttr.attribute.id) {
              return true;
            }
            return opt.key === attrKey || opt.attribute === attrKey;
          }) || [];

          // Process ALL options for this attribute (not just the first one)
          options.forEach((option) => {
            const valueId = option.valueId || '';
            const value = option.value || '';
            // Get label from AttributeValue if available, otherwise use value
            let label = option.value || '';
            if (valueId && productAttr.attribute.values) {
              const attrValue = productAttr.attribute.values.find((v: any) => v.id === valueId);
              if (attrValue) {
                label = attrValue.label || attrValue.value || value;
              }
            }

            const mapKey = valueId || value;
            if (!valueMap.has(mapKey)) {
              valueMap.set(mapKey, {
                valueId: valueId || undefined,
                value,
                label,
                variants: [],
              });
            }
            // Add variant to this value's variants list (avoid duplicates)
            if (!valueMap.get(mapKey)!.variants.some(v => v.id === variant.id)) {
              valueMap.get(mapKey)!.variants.push(variant);
            }
          });
        });

        // Get current selections for stock calculation (excluding this attribute)
        const currentSelections = getCurrentSelections(attrKey);
        
        const groupsArray = Array.from(valueMap.values()).map((item) => {
          // Find the attribute value to get imageUrl and colors
          // Try multiple matching strategies to ensure we find the correct attribute value
          let attrValue = null;
          if (item.valueId && productAttr.attribute.values) {
            // First try by valueId (most reliable)
            attrValue = productAttr.attribute.values.find((v: any) => v.id === item.valueId);
          }
          if (!attrValue && productAttr.attribute.values) {
            // Fallback: try by value (case-insensitive)
            attrValue = productAttr.attribute.values.find((v: any) => 
              v.value?.toLowerCase() === item.value?.toLowerCase() ||
              v.value === item.value
            );
          }
          if (!attrValue && productAttr.attribute.values) {
            // Last resort: try by label (case-insensitive)
            attrValue = productAttr.attribute.values.find((v: any) => 
              v.label?.toLowerCase() === item.label?.toLowerCase() ||
              v.label === item.label
            );
          }
          
          // Calculate stock: if other attributes are selected, show stock only for compatible variants
          // Otherwise, show total stock for all variants with this value
          let stock = 0;
          if (currentSelections.size > 0) {
            // Filter variants by compatibility and sum their stock
            const compatibleVariants = item.variants.filter(v => {
              const compatible = isVariantCompatible(v, currentSelections, attrKey);
              console.log(`🔄 [STOCK] Checking variant ${v.id} for attribute "${attrKey}" value "${item.value}":`, {
                compatible,
                currentSelections: Array.from(currentSelections.entries()),
                variantOptions: v.options
              });
              return compatible;
            });
            stock = compatibleVariants.reduce((sum, v) => sum + v.stock, 0);
            console.log(`🔄 [STOCK] Attribute "${attrKey}" value "${item.value}": ${compatibleVariants.length} compatible variants, stock: ${stock}`);
          } else {
            // No selections, show total stock
            stock = item.variants.reduce((sum, v) => sum + v.stock, 0);
          }
          
          return {
            valueId: item.valueId,
            value: item.value,
            label: item.label,
            stock: stock,
            variants: item.variants,
            imageUrl: attrValue?.imageUrl || null,
            colors: attrValue?.colors || null,
          };
        });

        console.log(`🔄 [ATTRIBUTE GROUPS] Built ${groupsArray.length} values for attribute "${attrKey}" from productAttributes`);
        groups.set(attrKey, groupsArray);
      });
      
      // Also extract any additional attributes from variant options that might not be in productAttributes
      // This handles cases where attributes were added to variants but not yet synced to productAttributes
      if (product?.variants) {
        const allAttributeKeys = new Set<string>();
        
        // Collect all attribute keys from variant options
        product.variants.forEach((variant) => {
          variant.options?.forEach((opt) => {
            const attrKey = opt.key || opt.attribute || '';
            if (attrKey && attrKey !== 'color' && attrKey !== 'size') {
              allAttributeKeys.add(attrKey);
            }
          });
        });
        
        // For each attribute key not already in groups, create attribute group from variants
        allAttributeKeys.forEach((attrKey) => {
          if (!groups.has(attrKey)) {
            const valueMap = new Map<string, { valueId?: string; value: string; label: string; variants: ProductVariant[] }>();
            
            // IMPORTANT: Show ALL attribute values, regardless of other selections
            // We don't filter variants here - we show all values that exist in any variant
            // Stock will be calculated separately based on current selections
            
            product.variants?.forEach((variant) => {
              // Include ALL variants - don't filter by compatibility
              // This ensures all attribute values are shown
              // IMPORTANT: Use filter() instead of find() to get ALL options for this attribute
              // A variant can have multiple values for the same attribute (e.g., color: [red, blue])

              const options = variant.options?.filter((opt) => 
                (opt.key === attrKey || opt.attribute === attrKey)
              ) || [];
              
              // Process ALL options for this attribute (not just the first one)
              options.forEach((option) => {
                const valueId = option.valueId || '';
                const value = option.value || '';
                const label = option.value || '';
                
                const mapKey = valueId || value;
                if (!valueMap.has(mapKey)) {
                  valueMap.set(mapKey, {
                    valueId: valueId || undefined,
                    value,
                    label,
                    variants: [],
                  });
                }
                // Add variant to this value's variants list (avoid duplicates)
                if (!valueMap.get(mapKey)!.variants.some(v => v.id === variant.id)) {
                  valueMap.get(mapKey)!.variants.push(variant);
                }
              });
            });
            
            if (valueMap.size > 0) {
              // Try to find attribute values from productAttributes to get imageUrl
              const productAttr = product.productAttributes?.find((pa: any) => 
                pa.attribute?.key === attrKey
              );
              
            // Get current selections for stock calculation (excluding this attribute)
            const currentSelections = getCurrentSelections(attrKey);
            
            const groupsArray = Array.from(valueMap.values()).map((item) => {
              // Try to find attribute value to get imageUrl and colors
              let attrValue = null;
              if (productAttr?.attribute?.values) {
                if (item.valueId) {
                  attrValue = productAttr.attribute.values.find((v: any) => v.id === item.valueId);
                }
                if (!attrValue) {
                  attrValue = productAttr.attribute.values.find((v: any) => 
                    v.value?.toLowerCase() === item.value?.toLowerCase() ||
                    v.value === item.value
                  );
                }
                if (!attrValue) {
                  attrValue = productAttr.attribute.values.find((v: any) => 
                    v.label?.toLowerCase() === item.label?.toLowerCase() ||
                    v.label === item.label
                  );
                }
              }
              
              // Calculate stock: if other attributes are selected, show stock only for compatible variants
              // Otherwise, show total stock for all variants with this value
              let stock = 0;
              if (currentSelections.size > 0) {
                // Filter variants by compatibility and sum their stock
                const compatibleVariants = item.variants.filter(v => 
                  isVariantCompatible(v, currentSelections, attrKey)
                );
                stock = compatibleVariants.reduce((sum, v) => sum + v.stock, 0);
              } else {
                // No selections, show total stock
                stock = item.variants.reduce((sum, v) => sum + v.stock, 0);
              }
              
              return {
                valueId: item.valueId,
                value: item.value,
                label: item.label,
                stock: stock,
                variants: item.variants,
                imageUrl: attrValue?.imageUrl || null,
                colors: attrValue?.colors || null,
              };
            });
              
              console.log(`🔄 [ATTRIBUTE GROUPS] Built ${groupsArray.length} values for additional attribute "${attrKey}" from variants`);
              groups.set(attrKey, groupsArray);
            }
          }
        });
      }
    } else {
      // Old format: Extract from variants
      if (product?.variants) {
        const colorMap = new Map<string, ProductVariant[]>();
        const sizeMap = new Map<string, ProductVariant[]>();
        const otherAttributesMap = new Map<string, Map<string, ProductVariant[]>>();

        // IMPORTANT: Show ALL attribute values, regardless of other selections
        // We don't filter variants here - we show all values that exist in any variant
        // Stock will be calculated separately based on current selections

        product.variants.forEach((variant) => {
          // For old format, show all variants (no filtering by compatibility)
          // This ensures all attribute values are shown
          // IMPORTANT: Process ALL options for each attribute, not just the first one
          // A variant can have multiple values for the same attribute (e.g., color: [red, blue])

          // Extract ALL color values (not just the first one)
          variant.options?.forEach((opt) => {
            const attrKey = opt.key || opt.attribute || '';
            const value = opt.value || '';
            
            if (!value) return;
            
            if (attrKey === 'color') {
              const normalizedColor = value.toLowerCase().trim();
              if (!colorMap.has(normalizedColor)) {
                colorMap.set(normalizedColor, []);
              }
              // Add variant to this color's variants list (avoid duplicates)
              if (!colorMap.get(normalizedColor)!.some(v => v.id === variant.id)) {
                colorMap.get(normalizedColor)!.push(variant);
              }
            } else if (attrKey === 'size') {
              const normalizedSize = value.toLowerCase().trim();
              if (!sizeMap.has(normalizedSize)) {
                sizeMap.set(normalizedSize, []);
              }
              // Add variant to this size's variants list (avoid duplicates)
              if (!sizeMap.get(normalizedSize)!.some(v => v.id === variant.id)) {
                sizeMap.get(normalizedSize)!.push(variant);
              }
            } else if (attrKey) {
              // Extract other attributes
              if (!otherAttributesMap.has(attrKey)) {
                otherAttributesMap.set(attrKey, new Map());
              }
              const valueMap = otherAttributesMap.get(attrKey)!;
              const normalizedValue = value.toLowerCase().trim();
              if (!valueMap.has(normalizedValue)) {
                valueMap.set(normalizedValue, []);
              }
              // Add variant to this value's variants list (avoid duplicates)
              if (!valueMap.get(normalizedValue)!.some(v => v.id === variant.id)) {
                valueMap.get(normalizedValue)!.push(variant);
              }
            }
          });
        });

        // Get current selections for stock calculation
        const colorSelections = getCurrentSelections('color');
        const sizeSelections = getCurrentSelections('size');
        
        if (colorMap.size > 0) {
          groups.set('color', Array.from(colorMap.entries()).map(([value, variants]) => {
            // Calculate stock: if other attributes are selected, show stock only for compatible variants
            let stock = 0;
            if (colorSelections.size > 0) {
              const compatibleVariants = variants.filter(v => 
                isVariantCompatible(v, colorSelections, 'color')
              );
              stock = compatibleVariants.reduce((sum, v) => sum + v.stock, 0);
            } else {
              stock = variants.reduce((sum, v) => sum + v.stock, 0);
            }
            
            return {
              value,
              label: value,
              stock: stock,
              variants,
            };
          }));
        }

        if (sizeMap.size > 0) {
          groups.set('size', Array.from(sizeMap.entries()).map(([value, variants]) => {
            // Calculate stock: if other attributes are selected, show stock only for compatible variants
            let stock = 0;
            if (sizeSelections.size > 0) {
              const compatibleVariants = variants.filter(v => 
                isVariantCompatible(v, sizeSelections, 'size')
              );
              stock = compatibleVariants.reduce((sum, v) => sum + v.stock, 0);
            } else {
              stock = variants.reduce((sum, v) => sum + v.stock, 0);
            }
            
            return {
              value,
              label: value,
              stock: stock,
              variants,
            };
          }));
        }
        
        // Add other attributes
        otherAttributesMap.forEach((valueMap, attrKey) => {
          const attrSelections = getCurrentSelections(attrKey);
          
          groups.set(attrKey, Array.from(valueMap.entries()).map(([value, variants]) => {
            // Calculate stock: if other attributes are selected, show stock only for compatible variants
            let stock = 0;
            if (attrSelections.size > 0) {
              const compatibleVariants = variants.filter(v => 
                isVariantCompatible(v, attrSelections, attrKey)
              );
              stock = compatibleVariants.reduce((sum, v) => sum + v.stock, 0);
            } else {
              stock = variants.reduce((sum, v) => sum + v.stock, 0);
            }
            
            return {
              value,
              label: value,
              stock: stock,
              variants,
              imageUrl: null,
              colors: null,
            };
          }));
        });
      }
    }

    console.log('🔄 [ATTRIBUTE GROUPS] Final groups:', Array.from(groups.keys()), 'total attributes:', groups.size);
    groups.forEach((values, key) => {
      console.log(`🔄 [ATTRIBUTE GROUPS] "${key}": ${values.length} values`, values.map(v => v.value));
    });
    
    return groups;
  }, [product, selectedColor, selectedSize, selectedAttributeValues, getOptionValue]);

  // Backward compatibility: Keep colorGroups and sizeGroups for existing UI
  const colorGroups: Array<{ color: string; stock: number; variants: ProductVariant[] }> = [];
  const colorAttrGroup = attributeGroups.get('color');
  if (colorAttrGroup) {
    colorGroups.push(...colorAttrGroup.map((g) => ({
      color: g.value,
      stock: g.stock,
      variants: g.variants,
    })));
  }

  const sizeGroups: Array<{ size: string; stock: number; variants: ProductVariant[] }> = [];
  const sizeAttrGroup = attributeGroups.get('size');
  if (sizeAttrGroup) {
    sizeGroups.push(...sizeAttrGroup.map((g) => ({
      size: g.value,
      stock: g.stock,
      variants: g.variants,
    })));
  }

  const currentVariant = selectedVariant || findVariantByColorAndSize(selectedColor, selectedSize) || product?.variants?.[0] || null;
  const price = currentVariant?.price || 0;
  const originalPrice = currentVariant?.originalPrice;
  const compareAtPrice = currentVariant?.compareAtPrice;
  const discountPercent = currentVariant?.productDiscount || product?.productDiscount || null;
  const maxQuantity = currentVariant?.stock && currentVariant.stock > 0 ? currentVariant.stock : 0;
  const isOutOfStock = !currentVariant || currentVariant.stock <= 0;
  
  // Check which attributes are available and required
  const hasColorAttribute = colorGroups.length > 0 && colorGroups.some(g => g.stock > 0);
  const hasSizeAttribute = sizeGroups.length > 0 && sizeGroups.some(g => g.stock > 0);
  const needsColor = hasColorAttribute && !selectedColor;
  const needsSize = hasSizeAttribute && !selectedSize;
  const isVariationRequired = needsColor || needsSize;
  
  // Generate user-friendly message for required attributes
  const getRequiredAttributesMessage = (): string => {
    if (needsColor && needsSize) {
      return t(language, 'product.selectColorAndSize');
    } else if (needsColor) {
      return t(language, 'product.selectColor');
    } else if (needsSize) {
      return t(language, 'product.selectSize');
    }
    return t(language, 'product.selectOptions');
  };
  
  // Check if selected variant's attribute values have stock
  // Returns a map of attribute keys to whether they're unavailable (stock = 0)
  const unavailableAttributes = useMemo(() => {
    const unavailable = new Map<string, boolean>();
    
    if (!currentVariant || !product) return unavailable;
    
    // Check each attribute in the selected variant
    currentVariant.options?.forEach((option) => {
      const attrKey = option.key || option.attribute;
      if (!attrKey) return;
      
      // Get the attribute group for this attribute
      const attrGroup = attributeGroups.get(attrKey);
      if (!attrGroup) return;
      
      // Find the attribute value in the group that matches the variant's option
      const attrValue = attrGroup.find((g) => {
        if (option.valueId && g.valueId) {
          return g.valueId === option.valueId;
        }
        return g.value?.toLowerCase().trim() === option.value?.toLowerCase().trim();
      });
      
      // If attribute value found and has no stock, mark as unavailable
      if (attrValue && attrValue.stock <= 0) {
        unavailable.set(attrKey, true);
      }
    });
    
    return unavailable;
  }, [currentVariant, attributeGroups, product]);
  
  // Check if any attribute is unavailable
  const hasUnavailableAttributes = unavailableAttributes.size > 0;
  
  const canAddToCart = !isOutOfStock && !isVariationRequired && !hasUnavailableAttributes;

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

  // Auto-scroll thumbnails to show selected image
  useEffect(() => {
    if (images.length > thumbnailsPerView) {
      if (currentImageIndex < thumbnailStartIndex) {
        // Selected image is above visible range - scroll up
        setThumbnailStartIndex(currentImageIndex);
      } else if (currentImageIndex >= thumbnailStartIndex + thumbnailsPerView) {
        // Selected image is below visible range - scroll down
        setThumbnailStartIndex(currentImageIndex - thumbnailsPerView + 1);
      }
    }
  }, [currentImageIndex, images.length, thumbnailStartIndex]);

  const handleColorSelect = (color: string) => {
    if (!color || !product) return;
    const normalizedColor = color.toLowerCase().trim();
    if (selectedColor === normalizedColor) {
      setSelectedColor(null);
    } else {
      setSelectedColor(normalizedColor);
      
      // Immediately try to find and switch to a variant image with this color
      // IMPORTANT: Use variantHasColor to check ALL color options, not just the first one
      const colorVariants = product.variants?.filter(v => {
        return variantHasColor(v, normalizedColor) && v.imageUrl;
      }) || [];
      
      // Try to find image from variants with this color
      for (const variant of colorVariants) {
        if (!variant.imageUrl) continue;
        
        const splitUrls = smartSplitUrls(variant.imageUrl);
        for (const url of splitUrls) {
          if (!url || url.trim() === '') continue;
          
          const processedUrl = processImageUrl(url);
          if (!processedUrl) continue;
          
          // Try to find this image in the images array
          const imageIndex = images.findIndex(img => {
            if (!img) return false;
            const processedImg = processImageUrl(img);
            if (!processedImg) return false;
            
            // Normalize both URLs for comparison
            const normalizeUrl = (u: string): string => {
              let n = u.trim().toLowerCase();
              if (n.startsWith('/')) n = n.substring(1);
              if (n.endsWith('/')) n = n.substring(0, n.length - 1);
              return n;
            };
            
            const normalizedImg = normalizeUrl(processedImg);
            const normalizedUrl = normalizeUrl(processedUrl);
            
            if (normalizedImg === normalizedUrl) return true;
            
            // Try with/without leading slash
            const imgWithSlash = processedImg.startsWith('/') ? processedImg : `/${processedImg}`;
            const imgWithoutSlash = processedImg.startsWith('/') ? processedImg.substring(1) : processedImg;
            const urlWithSlash = processedUrl.startsWith('/') ? processedUrl : `/${processedUrl}`;
            const urlWithoutSlash = processedUrl.startsWith('/') ? processedUrl.substring(1) : processedUrl;
            
            return imgWithSlash === urlWithSlash || 
                   imgWithoutSlash === urlWithoutSlash ||
                   imgWithSlash === urlWithoutSlash ||
                   imgWithoutSlash === urlWithSlash;
          });
          
          if (imageIndex !== -1) {
            console.log(`🎨 [COLOR SELECT] Switching to image index ${imageIndex} for color ${normalizedColor}`);
            setCurrentImageIndex(imageIndex);
            return; // Found and switched, exit early
          }
        }
      }
      
      console.log(`⚠️ [COLOR SELECT] No image found for color ${normalizedColor}`);
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
        setShowMessage(t(language, 'product.removedFromWishlist'));
      } else {
        wishlist.push(product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
        setIsInWishlist(true);
        setShowMessage(t(language, 'product.addedToWishlist'));
      }
      setTimeout(() => setShowMessage(null), 2000);
      window.dispatchEvent(new Event('wishlist-updated'));
    } catch (err) { }
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
        setShowMessage(t(language, 'product.removedFromCompare'));
      } else {
        if (compare.length >= 4) { setShowMessage(t(language, 'product.compareListFull')); }
        else {
          compare.push(product.id);
          localStorage.setItem(COMPARE_KEY, JSON.stringify(compare));
          setIsInCompare(true);
          setShowMessage(t(language, 'product.addedToCompare'));
        }
      }
      setTimeout(() => setShowMessage(null), 2000);
      window.dispatchEvent(new Event('compare-updated'));
    } catch (err) { }
  };

  if (loading || !product) return <div className="max-w-7xl mx-auto px-4 py-16 text-center">{t(language, 'common.messages.loading')}</div>;

  // Show only 3 thumbnails at a time, scrollable with navigation arrows
  const visibleThumbnails = images.slice(thumbnailStartIndex, thumbnailStartIndex + thumbnailsPerView);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 items-start">
        <div className="flex gap-6 items-start">
          {/* Left Column - Thumbnails (Vertical) - Show 3 at a time, scrollable */}
          <div className="flex flex-col gap-4 w-28 flex-shrink-0">
            <div className="flex flex-col gap-4 flex-1 overflow-hidden">
              {visibleThumbnails.map((image, index) => {
                const actualIndex = thumbnailStartIndex + index;
                const isActive = actualIndex === currentImageIndex;
                return (
                  <button 
                    key={actualIndex}
                    onClick={() => setCurrentImageIndex(actualIndex)}
                    className={`relative w-full aspect-[3/4] rounded-lg overflow-hidden border bg-white transition-all duration-300 flex-shrink-0 ${
                      isActive 
                        ? 'border-gray-400 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-2 ring-gray-300' 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)]'
                    }`}
                  >
                    <img 
                      src={image} 
                      alt="" 
                      className="w-full h-full object-cover transition-transform duration-300" 
                    />
                  </button>
                );
              })}
            </div>
            
            {/* Navigation Arrows - Scroll thumbnails */}
            {images.length > thumbnailsPerView && (
              <div className="flex flex-row gap-1.5 justify-center">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Scroll thumbnails up
                    const newStart = Math.max(0, thumbnailStartIndex - 1);
                    setThumbnailStartIndex(newStart);
                    // Also update current image if needed
                    if (currentImageIndex > newStart + thumbnailsPerView - 1) {
                      setCurrentImageIndex(newStart + thumbnailsPerView - 1);
                    } else if (currentImageIndex < newStart) {
                      setCurrentImageIndex(newStart);
                    }
                  }}
                  disabled={thumbnailStartIndex <= 0}
                  className="w-9 h-9 rounded border transition-all duration-200 flex items-center justify-center border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-200 hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-100 disabled:hover:border-gray-300 disabled:hover:shadow-none bg-gray-100"
                  aria-label={t(language, 'common.ariaLabels.previousThumbnail')}
                >
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M5 15l7-7 7 7" 
                    />
                  </svg>
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Scroll thumbnails down
                    const newStart = Math.min(images.length - thumbnailsPerView, thumbnailStartIndex + 1);
                    setThumbnailStartIndex(newStart);
                    // Also update current image if needed
                    if (currentImageIndex < newStart) {
                      setCurrentImageIndex(newStart);
                    } else if (currentImageIndex > newStart + thumbnailsPerView - 1) {
                      setCurrentImageIndex(newStart + thumbnailsPerView - 1);
                    }
                  }}
                  disabled={thumbnailStartIndex >= images.length - thumbnailsPerView}
                  className="w-9 h-9 rounded border transition-all duration-200 flex items-center justify-center border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-200 hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-100 disabled:hover:border-gray-300 disabled:hover:shadow-none bg-gray-100"
                  aria-label={t(language, 'common.ariaLabels.nextThumbnail')}
                >
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M19 9l-7 7-7-7" 
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
          
          {/* Right Column - Main Image */}
          <div className="flex-1">
            <div className="relative aspect-square bg-white rounded-lg overflow-hidden group shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            {images.length > 0 ? (
              <img 
                src={images[currentImageIndex]} 
                alt={product.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">{t(language, 'common.messages.noImage')}</div>
            )}
            
            {/* Discount Badge on Image - Blue circle in top-right */}
            {discountPercent && (
              <div className="absolute top-4 right-4 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold z-10 shadow-[0_2px_8px_rgba(37,99,235,0.3)]">
                -{discountPercent}%
              </div>
            )}

            {product.labels && <ProductLabels labels={product.labels} />}
            
            {/* Control Buttons - Bottom left */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-3 z-10">
              {/* Fullscreen Button */}
              <button 
                onClick={() => setShowZoom(true)} 
                className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-white/90 transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                aria-label={t(language, 'common.ariaLabels.fullscreenImage')}
              >
                <Maximize2 className="w-5 h-5 text-gray-800" />
              </button>
            </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex-1">
            {product.brand && <p className="text-sm text-gray-500 mb-2">{product.brand.name}</p>}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {getProductText(language, product.id, 'title') || product.title}
            </h1>
            <div className="mb-6">
              <div className="flex flex-col gap-1">
                {/* Discounted price with discount percentage */}
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-gray-900">{formatPrice(price, currency)}</p>
                  {discountPercent && discountPercent > 0 && (
                    <span className="text-lg font-semibold text-blue-600">
                      -{discountPercent}%
                    </span>
                  )}
                </div>
                {/* Original price below discounted price - full width, not inline */}
                {(originalPrice || (compareAtPrice && compareAtPrice > price)) && (
                  <p className="text-xl text-gray-500 line-through decoration-gray-400 mt-1">
                    {formatPrice(originalPrice || compareAtPrice || 0, currency)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-gray-600 mb-8 prose prose-sm" dangerouslySetInnerHTML={{ __html: getProductText(language, product.id, 'longDescription') || product.description || '' }} />

            <div className="mt-8 p-4 bg-white border border-gray-200 rounded-2xl space-y-4">
            {/* Rating Section */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(averageRating)
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                </span>
              </div>
              <span 
                onClick={scrollToReviews}
                className="text-sm text-gray-600 cursor-pointer hover:text-gray-900 hover:underline transition-colors"
              >
                ({reviews.length} {reviews.length === 1 ? t(language, 'common.reviews.review') : t(language, 'common.reviews.reviews')})
              </span>
            </div>

            {/* Attribute Selectors - Support both new (productAttributes) and old (colorGroups) format */}
            {/* Display all attributes from attributeGroups, not just from productAttributes */}
            {Array.from(attributeGroups.entries()).length > 0 ? (
              // Use attributeGroups which contains all attributes (from productAttributes and variants)
              Array.from(attributeGroups.entries()).map(([attrKey, attrGroups]) => {
                // Try to get attribute name from productAttributes if available
                const productAttr = product?.productAttributes?.find((pa: any) => pa.attribute?.key === attrKey);
                const attributeName = productAttr?.attribute?.name || attrKey.charAt(0).toUpperCase() + attrKey.slice(1);
                const isColor = attrKey === 'color';
                const isSize = attrKey === 'size';

                if (attrGroups.length === 0) return null;

                // Check if this attribute is unavailable for the selected variant
                const isUnavailable = unavailableAttributes.get(attrKey) || false;
                
                return (
                  <div key={attrKey} className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase ${isUnavailable ? 'text-red-600' : ''}`}>
                      {attrKey === 'color' ? t(language, 'product.color') : 
                       attrKey === 'size' ? t(language, 'product.size') : 
                       attributeName}:
                    </label>
                    {isColor ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {attrGroups.map((g) => {
                          const isSelected = selectedColor === g.value?.toLowerCase().trim();
                          // IMPORTANT: Don't disable based on stock - show all colors, even if stock is 0
                          // Stock is just informational, not a reason to hide the option
                          const isDisabled = false; // Always show all colors
                          const hasImage = g.imageUrl;
                          const colorHex = g.colors && Array.isArray(g.colors) && g.colors.length > 0 
                            ? g.colors[0] 
                            : getColorValue(g.value);
                          
                          // Dynamic sizing based on number of values
                          // Keep size consistent for 2 values, reduce for more
                          const totalValues = attrGroups.length;
                          const sizeClass = totalValues > 6 
                            ? 'w-8 h-8' 
                            : totalValues > 3 
                            ? 'w-9 h-9' 
                            : 'w-10 h-10';
                          
                          return (
                            <div key={g.valueId || g.value} className="flex flex-col items-center gap-0.5">
                              <button 
                                onClick={() => handleColorSelect(g.value)}
                                className={`${sizeClass} rounded-full transition-all overflow-hidden ${
                                  isSelected 
                                    ? 'border-[3px] border-green-500 scale-110' 
                                    : g.stock <= 0
                                      ? 'border-2 border-gray-200 opacity-60 hover:opacity-80' 
                                      : 'border-2 border-gray-300 hover:scale-105'
                                }`}
                                style={hasImage ? {} : { backgroundColor: colorHex }}
                                title={`${getAttributeLabel(language, attrKey, g.value)}${g.stock > 0 ? ` (${g.stock} ${t(language, 'product.pcs')})` : ` (${t(language, 'product.outOfStock')})`}`} 
                              >
                                {hasImage ? (
                                  <img 
                                    src={processedImageUrl!} 
                                    alt={g.label}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      console.error(`❌ [COLOR IMAGE] Failed to load image for color "${g.value}":`, processedImageUrl);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onLoad={() => {
                                      console.log(`✅ [COLOR IMAGE] Successfully loaded image for color "${g.value}":`, processedImageUrl);
                                    }}
                                  />
                                ) : null}
                              </button>
                              {g.stock > 0 && (
                                <span className={`${totalValues > 8 ? 'text-[10px]' : 'text-xs'} text-gray-500`}>{g.stock}</span>
                              )}
                              {g.stock <= 0 && (
                                <span className={`${totalValues > 8 ? 'text-[10px]' : 'text-xs'} text-gray-400`}>0</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : isSize ? (
                      <div className="flex flex-wrap gap-1.5">
                        {attrGroups.map((g) => {
                          // Use stock from groups (already calculated with compatibility)
                          const displayStock = g.stock;
                          const isSelected = selectedSize === g.value.toLowerCase().trim();
                          // IMPORTANT: Don't disable based on stock - show all sizes, even if stock is 0
                          // Stock is just informational, not a reason to hide the option
                          const isDisabled = false; // Always show all sizes
                          
                          // Process imageUrl to ensure it's in the correct format
                          const processedImageUrl = g.imageUrl ? processImageUrl(g.imageUrl) : null;
                          const hasImage = processedImageUrl && processedImageUrl.trim() !== '';
                          
                          // Dynamic sizing based on number of values
                          // Keep size consistent for 2 values, reduce for more
                          const totalValues = attrGroups.length;
                          const paddingClass = totalValues > 6 
                            ? 'px-2 py-1' 
                            : totalValues > 3 
                            ? 'px-2.5 py-1.5' 
                            : 'px-3 py-2';
                          const textSizeClass = totalValues > 6 
                            ? 'text-xs' 
                            : 'text-sm';
                          const imageSizeClass = totalValues > 6 
                            ? 'w-4 h-4' 
                            : 'w-5 h-5';
                          const minWidthClass = totalValues > 6 
                            ? 'min-w-[40px]' 
                            : 'min-w-[50px]';

                          return (
                            <button 
                              key={g.valueId || g.value}
                              onClick={() => handleSizeSelect(g.value)}
                              className={`${minWidthClass} ${paddingClass} rounded-lg border-2 transition-all flex items-center gap-1.5 ${
                                isSelected 
                                  ? 'border-green-500 bg-gray-50' 
                                  : displayStock <= 0
                                    ? 'border-gray-200 opacity-60 hover:opacity-80' 
                                    : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {hasImage && (
                                <img 
                                  src={processedImageUrl!} 
                                  alt={g.label}
                                  className={`${imageSizeClass} object-cover rounded border border-gray-300 flex-shrink-0`}
                                  onError={(e) => {
                                    console.error(`❌ [SIZE IMAGE] Failed to load image for size "${g.value}":`, processedImageUrl);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                  onLoad={() => {
                                    console.log(`✅ [SIZE IMAGE] Successfully loaded image for size "${g.value}":`, processedImageUrl);
                                  }}
                                />
                              )}
                              <div className="flex flex-col text-center">
                                <span className={`${textSizeClass} font-medium`}>{getAttributeLabel(language, attrKey, g.value)}</span>
                                <span className={`${totalValues > 10 ? 'text-[10px]' : 'text-xs'} ${displayStock > 0 ? 'text-gray-500' : 'text-gray-400'}`}>({displayStock})</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      // Generic attribute selector
                      <div className="flex flex-wrap gap-1.5">
                        {attrGroups.map((g) => {
                          const selectedValueId = selectedAttributeValues.get(attrKey);
                          const isSelected = selectedValueId === g.valueId || (!g.valueId && selectedColor === g.value);
                          // IMPORTANT: Don't disable based on stock - show all attribute values, even if stock is 0
                          // Stock is just informational, not a reason to hide the option
                          const isDisabled = false; // Always show all attribute values
                          
                          // Process imageUrl to ensure it's in the correct format
                          const processedImageUrl = g.imageUrl ? processImageUrl(g.imageUrl) : null;
                          const hasImage = processedImageUrl && processedImageUrl.trim() !== '';
                          const hasColors = g.colors && Array.isArray(g.colors) && g.colors.length > 0;
                          const colorHex = hasColors 
                            ? g.colors[0] 
                            : null;
                          
                          // Debug logging for image issues
                          if (g.imageUrl && !hasImage) {
                            console.warn(`⚠️ [ATTRIBUTE IMAGE] Failed to process imageUrl for attribute "${attrKey}" value "${g.value}":`, g.imageUrl);
                          }
                          
                          // Dynamic sizing based on number of values
                          // Keep size consistent for 2 values, reduce for more
                          const totalValues = attrGroups.length;
                          const paddingClass = totalValues > 6 
                            ? 'px-2 py-1' 
                            : totalValues > 3 
                            ? 'px-3 py-1.5' 
                            : 'px-4 py-2';
                          const textSizeClass = totalValues > 6 
                            ? 'text-xs' 
                            : 'text-sm';
                          const imageSizeClass = totalValues > 6 
                            ? 'w-4 h-4' 
                            : totalValues > 3 
                            ? 'w-5 h-5' 
                            : 'w-6 h-6';
                          const gapClass = totalValues > 6 
                            ? 'gap-1' 
                            : 'gap-2';

                          return (
                            <button
                              key={g.valueId || g.value}
                              onClick={() => {
                                if (!isDisabled) {
                                  const newMap = new Map(selectedAttributeValues);
                                  if (isSelected) {
                                    newMap.delete(attrKey);
                                  } else {
                                    newMap.set(attrKey, g.valueId || g.value);
                                  }
                                  setSelectedAttributeValues(newMap);
                                }
                              }}
                              className={`${paddingClass} rounded-lg border-2 transition-all flex items-center ${gapClass} ${
                                isSelected
                                  ? 'border-green-500 bg-gray-50'
                                  : g.stock <= 0
                                    ? 'border-gray-200 opacity-60 hover:opacity-80'
                                    : 'border-gray-200 hover:border-gray-400'
                              }`}
                              style={!hasImage && colorHex ? { backgroundColor: colorHex } : {}}
                            >
                              {hasImage ? (
                                <img 
                                  src={processedImageUrl!} 
                                  alt={g.label}
                                  className={`${imageSizeClass} object-cover rounded border border-gray-300 flex-shrink-0`}
                                  onError={(e) => {
                                    console.error(`❌ [ATTRIBUTE IMAGE] Failed to load image for attribute "${attrKey}" value "${g.value}":`, processedImageUrl);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                  onLoad={() => {
                                    console.log(`✅ [ATTRIBUTE IMAGE] Successfully loaded image for attribute "${attrKey}" value "${g.value}":`, processedImageUrl);
                                  }}
                                />
                              ) : hasColors && colorHex ? (
                                <div 
                                  className={`${imageSizeClass} rounded border border-gray-300 flex-shrink-0`}
                                  style={{ backgroundColor: colorHex }}
                                />
                              ) : null}
                              <span className={textSizeClass}>{getAttributeLabel(language, attrKey, g.value)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Old format: Use colorGroups and sizeGroups
              <>
                {colorGroups.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t(language, 'product.color')}:</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {colorGroups.map((g) => {
                        const isSelected = selectedColor === g.color?.toLowerCase().trim();
                        const isDisabled = g.stock <= 0;
                        
                        return (
                          <div key={g.color} className="flex flex-col items-center gap-1">
                            <button 
                              onClick={() => !isDisabled && handleColorSelect(g.color)}
                              disabled={isDisabled}
                              className={`w-10 h-10 rounded-full transition-all ${
                                isSelected 
                                  ? 'border-[3px] border-green-500 scale-110' 
                                  : isDisabled 
                                    ? 'border-2 border-gray-100 opacity-30 grayscale cursor-not-allowed' 
                                    : 'border-2 border-gray-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: getColorValue(g.color) }} 
                              title={isDisabled ? `${getAttributeLabel(language, 'color', g.color)} (${t(language, 'product.outOfStock')})` : `${getAttributeLabel(language, 'color', g.color)}${g.stock > 0 ? ` (${g.stock} ${t(language, 'product.pcs')})` : ''}`} 
                            />
                            {g.stock > 0 && (
                              <span className="text-xs text-gray-500">{g.stock}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Size Groups - Show only if not using new format */}
            {!product?.productAttributes && sizeGroups.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase">{t(language, 'product.size')}</label>
                <div className="flex flex-wrap gap-2">
                  {sizeGroups.map((g) => {
                    let displayStock = g.stock;
                    if (selectedColor) {
                      const v = g.variants.find(v => {
                        const colorOpt = getOptionValue(v.options, 'color');
                        return colorOpt === selectedColor.toLowerCase().trim();
                      });
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
                            ? 'border-green-500 bg-gray-50' 
                            : isDisabled 
                              ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' 
                              : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex flex-col text-center">
                          <span className={`text-sm font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>{getAttributeLabel(language, 'size', g.size)}</span>
                          {displayStock > 0 && (
                            <span className={`text-xs ${isDisabled ? 'text-gray-300' : 'text-gray-500'}`}>{displayStock} {t(language, 'product.pcs')}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            </div>
          </div>
          
          {/* Action Buttons - Aligned with bottom of image */}
          <div className="mt-auto pt-6">
            {/* Show required attributes message if needed */}
            {isVariationRequired && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  {getRequiredAttributesMessage()}
                </p>
              </div>
            )}
            {/* Show unavailable attributes message if needed */}
            {hasUnavailableAttributes && !isVariationRequired && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">
                  {Array.from(unavailableAttributes.entries()).map(([attrKey]) => {
                    const productAttr = product?.productAttributes?.find((pa: any) => pa.attribute?.key === attrKey);
                    const attributeName = productAttr?.attribute?.name || attrKey.charAt(0).toUpperCase() + attrKey.slice(1);
                    return attrKey === 'color' ? t(language, 'product.color') : 
                           attrKey === 'size' ? t(language, 'product.size') : 
                           attributeName;
                  }).join(', ')} {t(language, 'product.outOfStock')}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 pt-4 border-t">
              <div className="flex items-center border rounded-xl overflow-hidden bg-gray-50">
                <button onClick={() => adjustQuantity(-1)} className="w-12 h-12 flex items-center justify-center">-</button>
                <div className="w-12 text-center font-bold">{quantity}</div>
                <button onClick={() => adjustQuantity(1)} className="w-12 h-12 flex items-center justify-center">+</button>
              </div>
              <button disabled={!canAddToCart || isAddingToCart} className="flex-1 h-12 bg-gray-900 text-white rounded-xl uppercase font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
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
                    setShowMessage(`${t(language, 'product.addedToCart')} ${quantity} ${t(language, 'product.pcs')}`);
                    window.dispatchEvent(new Event('cart-updated'));
                  } catch (err) { setShowMessage(t(language, 'product.errorAddingToCart')); }
                  finally { setIsAddingToCart(false); setTimeout(() => setShowMessage(null), 2000); }
                }}>
                {isAddingToCart ? t(language, 'product.adding') : (isOutOfStock ? t(language, 'product.outOfStock') : (isVariationRequired ? getRequiredAttributesMessage() : (hasUnavailableAttributes ? t(language, 'product.outOfStock') : t(language, 'product.addToCart'))))}
              </button>
              <button onClick={handleCompareToggle} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${isInCompare ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <CompareIcon isActive={isInCompare} />
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
          <button 
            className="absolute top-4 right-4 text-white text-2xl"
            aria-label={t(language, 'common.buttons.close')}
            onClick={(e) => {
              e.stopPropagation();
              setShowZoom(false);
            }}
          >
            {t(language, 'common.buttons.close')}
          </button>
        </div>
      )}

      <div id="product-reviews" className="mt-24 scroll-mt-24">
        <ProductReviews productSlug={slug} productId={product.id} />
      </div>
      <div className="mt-16">
        <RelatedProducts categorySlug={product.categories?.[0]?.slug} currentProductId={product.id} />
      </div>
    </div>
  );
}
