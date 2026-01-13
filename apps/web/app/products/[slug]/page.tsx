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
    
    // First, collect all attribute value imageUrls to exclude them from product images
    const attributeValueImageUrls = new Set<string>();
    if (product.productAttributes && Array.isArray(product.productAttributes)) {
      product.productAttributes.forEach((productAttr) => {
        if (productAttr.attribute?.values && Array.isArray(productAttr.attribute.values)) {
          productAttr.attribute.values.forEach((val: { imageUrl?: string | null }) => {
            if (val.imageUrl) {
              const processed = processImageUrl(val.imageUrl);
              if (processed) {
                attributeValueImageUrls.add(processed);
                // Also add normalized versions for comparison
                if (processed.startsWith('/')) {
                  attributeValueImageUrls.add(processed.substring(1));
                } else {
                  attributeValueImageUrls.add(`/${processed}`);
                }
              }
            }
          });
        }
      });
    }
    
    const allRawImages: any[] = [];
    // 1. Add general product media first
    if (product.media) allRawImages.push(...product.media);
    
    // 2. Add all variant images (but filter out attribute value images)
    if (product.variants) {
      product.variants.forEach(v => {
        if (v.imageUrl) {
          const split = smartSplitUrls(v.imageUrl);
          split.forEach((url: string) => {
            const processed = processImageUrl(url);
            if (processed) {
              // Check if this image is an attribute value image
              const isAttributeImage = attributeValueImageUrls.has(processed) || 
                                     attributeValueImageUrls.has(processed.startsWith('/') ? processed.substring(1) : `/${processed}`);
              if (!isAttributeImage) {
                allRawImages.push(url);
              }
            }
          });
        }
      });
    }

    const processedImages = allRawImages
      .map(processImageUrl)
      .filter((url): url is string => url !== null);
    
    // Filter out any attribute value images that might have been added
    const filteredImages = processedImages.filter(url => {
      const normalized = url.startsWith('/') ? url : `/${url}`;
      const withoutSlash = url.startsWith('/') ? url.substring(1) : url;
      return !attributeValueImageUrls.has(url) && 
             !attributeValueImageUrls.has(normalized) && 
             !attributeValueImageUrls.has(withoutSlash);
    });
    
    // Return all unique images (excluding attribute value images)
    return Array.from(new Set(filteredImages));
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
          console.warn(`[PRODUCT PAGE] Product not found in ${currentLang}, trying English fallback`);
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
        if (colorOption) setSelectedColor(colorOption.value);
        const sizeOption = initialVariant.options?.find(opt => opt.key === 'size');
        if (sizeOption) setSelectedSize(sizeOption.value);
      }
    } catch (error: any) {
      console.error('[PRODUCT PAGE] Error fetching product:', error);
      
      // If product not found (404), clear product state and show error
      if (error?.status === 404) {
        console.warn(`[PRODUCT PAGE] Product '${slug}' not found or not published`);
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
    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('language-updated', handleLanguageUpdate);
    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('language-updated', handleLanguageUpdate);
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

  // Helper function to get option value (supports both new and old format)
  const getOptionValue = useCallback((options: VariantOption[] | undefined, key: string): string | null => {
    if (!options) return null;
    const opt = options.find(o => o.key === key || o.attribute === key);
    return opt?.value?.toLowerCase().trim() || null;
  }, []);

  const findVariantByColorAndSize = useCallback((color: string | null, size: string | null): ProductVariant | null => {
    if (!product?.variants || product.variants.length === 0) return null;
    
    const normalizedColor = color?.toLowerCase().trim();
    const normalizedSize = size?.toLowerCase().trim();

    // 1. Try exact match (Case-insensitive)
    if (normalizedColor && normalizedSize) {
      const variant = product.variants.find(v => {
        const vColor = getOptionValue(v.options, 'color');
        const vSize = getOptionValue(v.options, 'size');
        return vColor === normalizedColor && vSize === normalizedSize;
      });
      if (variant) return variant;
    }

    // 2. If color selected but no exact match with size, find any variant of this color
    if (normalizedColor) {
      // Prefer in-stock variant of this color
      const colorVariants = product.variants.filter(v => {
        const vColor = getOptionValue(v.options, 'color');
        return vColor === normalizedColor;
      });
      
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
  }, [product?.variants, getOptionValue]);

  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const newVariant = findVariantByColorAndSize(selectedColor, selectedSize);
      
      if (newVariant && newVariant.id !== selectedVariant?.id) {
        console.log('🔄 [PRODUCT PAGE] Variant changed:', {
          from: selectedVariant?.id,
          to: newVariant.id,
          color: selectedColor,
          size: selectedSize,
          price: newVariant.price,
          stock: newVariant.stock,
          sku: newVariant.sku
        });
        setSelectedVariant(newVariant);
        
        // Synchronize selection states with the found variant (supports both formats)
        const colorValue = getOptionValue(newVariant.options, 'color');
        const sizeValue = getOptionValue(newVariant.options, 'size');
        
        if (colorValue && colorValue !== selectedColor?.toLowerCase().trim()) {
          setSelectedColor(colorValue);
        }
        if (sizeValue && sizeValue !== selectedSize?.toLowerCase().trim()) {
          setSelectedSize(sizeValue);
        }
      }
    }
  }, [selectedColor, selectedSize, findVariantByColorAndSize, selectedVariant?.id, product]);

  // Build attribute groups from productAttributes (new format) or from variants (old format)
  const attributeGroups = new Map<string, Array<{
    valueId?: string;
    value: string;
    label: string;
    stock: number;
    variants: ProductVariant[];
    imageUrl?: string | null;
    colors?: string[] | null;
  }>>();

  if (product?.productAttributes && product.productAttributes.length > 0) {
    // New format: Use productAttributes
    product.productAttributes.forEach((productAttr) => {
      const attrKey = productAttr.attribute.key;
      const valueMap = new Map<string, { valueId?: string; value: string; label: string; variants: ProductVariant[] }>();

      product.variants?.forEach((variant) => {
        const option = variant.options?.find((opt) => {
          if (opt.valueId && opt.attributeId === productAttr.attribute.id) {
            return true;
          }
          return opt.key === attrKey || opt.attribute === attrKey;
        });

        if (option) {
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
          valueMap.get(mapKey)!.variants.push(variant);
        }
      });

      const groups = Array.from(valueMap.values()).map((item) => {
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
        
        // Debug logging for material attribute
        if (productAttr.attribute.key === 'material') {
          console.log('🔍 [PRODUCT PAGE] Material attribute value lookup:', {
            attributeKey: productAttr.attribute.key,
            itemValueId: item.valueId,
            itemValue: item.value,
            itemLabel: item.label,
            foundAttrValue: attrValue ? {
              id: attrValue.id,
              value: attrValue.value,
              label: attrValue.label,
              imageUrl: attrValue.imageUrl
            } : null,
            allAttributeValues: productAttr.attribute.values?.map((v: any) => ({
              id: v.id,
              value: v.value,
              label: v.label,
              imageUrl: v.imageUrl
            })) || []
          });
        }
        
        return {
          valueId: item.valueId,
          value: item.value,
          label: item.label,
          stock: item.variants.reduce((sum, v) => sum + v.stock, 0),
          variants: item.variants,
          imageUrl: attrValue?.imageUrl || null,
          colors: attrValue?.colors || null,
        };
      });

      attributeGroups.set(attrKey, groups);
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
      
      // For each attribute key not already in attributeGroups, create attribute group from variants
      allAttributeKeys.forEach((attrKey) => {
        if (!attributeGroups.has(attrKey)) {
          const valueMap = new Map<string, { valueId?: string; value: string; label: string; variants: ProductVariant[] }>();
          
          product.variants?.forEach((variant) => {
            const option = variant.options?.find((opt) => 
              (opt.key === attrKey || opt.attribute === attrKey)
            );
            
            if (option) {
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
              valueMap.get(mapKey)!.variants.push(variant);
            }
          });
          
          if (valueMap.size > 0) {
            // Try to find attribute values from productAttributes to get imageUrl
            const productAttr = product.productAttributes?.find((pa: any) => 
              pa.attribute?.key === attrKey
            );
            
            const groups = Array.from(valueMap.values()).map((item) => {
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
              
              return {
                valueId: item.valueId,
                value: item.value,
                label: item.label,
                stock: item.variants.reduce((sum, v) => sum + v.stock, 0),
                variants: item.variants,
                imageUrl: attrValue?.imageUrl || null,
                colors: attrValue?.colors || null,
              };
            });
            
            attributeGroups.set(attrKey, groups);
            console.log('✅ [PRODUCT PAGE] Added attribute from variants:', attrKey, groups);
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

      product.variants.forEach((variant) => {
        const color = getOptionValue(variant.options, 'color');
        const size = getOptionValue(variant.options, 'size');

        if (color) {
          if (!colorMap.has(color)) colorMap.set(color, []);
          colorMap.get(color)!.push(variant);
        }

        if (size) {
          if (!sizeMap.has(size)) sizeMap.set(size, []);
          sizeMap.get(size)!.push(variant);
        }
        
        // Extract other attributes
        variant.options?.forEach((opt) => {
          const attrKey = opt.key || opt.attribute || '';
          if (attrKey && attrKey !== 'color' && attrKey !== 'size') {
            if (!otherAttributesMap.has(attrKey)) {
              otherAttributesMap.set(attrKey, new Map());
            }
            const value = opt.value || '';
            if (value) {
              const valueMap = otherAttributesMap.get(attrKey)!;
              if (!valueMap.has(value)) {
                valueMap.set(value, []);
              }
              valueMap.get(value)!.push(variant);
            }
          }
        });
      });

      if (colorMap.size > 0) {
        attributeGroups.set('color', Array.from(colorMap.entries()).map(([value, variants]) => ({
          value,
          label: value,
          stock: variants.reduce((sum, v) => sum + v.stock, 0),
          variants,
        })));
      }

      if (sizeMap.size > 0) {
        attributeGroups.set('size', Array.from(sizeMap.entries()).map(([value, variants]) => ({
          value,
          label: value,
          stock: variants.reduce((sum, v) => sum + v.stock, 0),
          variants,
        })));
      }
      
      // Add other attributes
      otherAttributesMap.forEach((valueMap, attrKey) => {
        attributeGroups.set(attrKey, Array.from(valueMap.entries()).map(([value, variants]) => ({
          value,
          label: value,
          stock: variants.reduce((sum, v) => sum + v.stock, 0),
          variants,
          imageUrl: null,
          colors: null,
        })));
        console.log('✅ [PRODUCT PAGE] Added attribute from old format:', attrKey);
      });
    }
  }

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

  // Debug logging for stock display - only log when product is loaded
  if (product && product.id) {
    console.log('📦 [PRODUCT PAGE] Stock information:', {
      productId: product.id,
      productSlug: product.slug,
      colorGroups: colorGroups.map(g => ({ color: g.color, stock: g.stock })),
      sizeGroups: sizeGroups.map(g => ({ size: g.size, stock: g.stock })),
      attributeGroups: Array.from(attributeGroups.entries()).map(([key, groups]) => ({
        key,
        groups: groups.map(g => ({ value: g.value, stock: g.stock })),
      })),
    });
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
        const variantWithImage = product.variants.find(v => {
          const colorOpt = getOptionValue(v.options, 'color');
          return colorOpt === color.toLowerCase().trim() && v.imageUrl;
        });
        
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
        setShowMessage(t(language, 'product.removedFromWishlist'));
      } else {
        wishlist.push(product.id);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
        setIsInWishlist(true);
        setShowMessage(t(language, 'product.addedToWishlist'));
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
    } catch (err) { console.error(err); }
  };

  if (loading || !product) return <div className="max-w-7xl mx-auto px-4 py-16 text-center">{t(language, 'common.messages.loading')}</div>;

  const visibleThumbnails = images.slice(thumbnailStartIndex, thumbnailStartIndex + thumbnailsPerView);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 items-start">
        <div className="flex gap-6 items-start">
          {/* Left Column - Thumbnails (Vertical) */}
          <div className="flex flex-col gap-4 w-28 flex-shrink-0">
            <div className="flex flex-col gap-4 flex-1">
              {visibleThumbnails.map((image, index) => {
                const actualIndex = thumbnailStartIndex + index;
                const isActive = actualIndex === currentImageIndex;
                return (
                  <button 
                    key={actualIndex} 
                    onClick={() => setCurrentImageIndex(actualIndex)}
                    className={`relative w-full aspect-[3/4] rounded-lg overflow-hidden border bg-white transition-all duration-300 ${
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
            
            {/* Navigation Arrows - Both at the bottom, side by side */}
            {images.length > thumbnailsPerView && (
              <div className="flex flex-row gap-1.5 justify-center">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newIndex = Math.max(0, currentImageIndex - 1);
                    setCurrentImageIndex(newIndex);
                    // Update thumbnail scroll to show the new image
                    if (newIndex < thumbnailStartIndex) {
                      setThumbnailStartIndex(newIndex);
                    }
                  }}
                  disabled={currentImageIndex <= 0}
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
                    const newIndex = Math.min(images.length - 1, currentImageIndex + 1);
                    setCurrentImageIndex(newIndex);
                    // Update thumbnail scroll to show the new image
                    if (newIndex >= thumbnailStartIndex + thumbnailsPerView) {
                      setThumbnailStartIndex(newIndex - thumbnailsPerView + 1);
                    }
                  }}
                  disabled={currentImageIndex >= images.length - 1}
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

            <div className="mt-8 p-6 bg-white border border-gray-200 rounded-2xl space-y-5">
            {/* Rating Section */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
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
              <span className="text-sm text-gray-600">
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

                return (
                  <div key={attrKey} className="space-y-2">
                    <label className="text-sm font-bold uppercase">
                      {attrKey === 'color' ? t(language, 'product.color') : 
                       attrKey === 'size' ? t(language, 'product.size') : 
                       attributeName}:
                    </label>
                    {isColor ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        {attrGroups.map((g) => {
                          const isSelected = selectedColor === g.value.toLowerCase().trim();
                          const isDisabled = g.stock <= 0;
                          const hasImage = g.imageUrl;
                          const colorHex = g.colors && Array.isArray(g.colors) && g.colors.length > 0 
                            ? g.colors[0] 
                            : getColorValue(g.value);
                          
                          return (
                            <div key={g.valueId || g.value} className="flex flex-col items-center gap-1">
                              <button 
                                onClick={() => !isDisabled && handleColorSelect(g.value)}
                                disabled={isDisabled}
                                className={`w-10 h-10 rounded-full border-2 transition-all overflow-hidden ${
                                  isSelected 
                                    ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-900 scale-110' 
                                    : isDisabled 
                                      ? 'border-gray-100 opacity-30 grayscale cursor-not-allowed' 
                                      : 'border-gray-300 hover:scale-105'
                                }`}
                                style={hasImage ? {} : { backgroundColor: colorHex }}
                                title={isDisabled ? `${getAttributeLabel(language, attrKey, g.value)} (${t(language, 'product.outOfStock')})` : `${getAttributeLabel(language, attrKey, g.value)}${g.stock > 0 ? ` (${g.stock} ${t(language, 'product.pcs')})` : ''}`} 
                              >
                                {hasImage ? (
                                  <img 
                                    src={g.imageUrl!} 
                                    alt={g.label}
                                    className="w-full h-full object-cover"
                                  />
                                ) : null}
                              </button>
                              {g.stock > 0 && (
                                <span className="text-xs text-gray-500">{g.stock}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : isSize ? (
                      <div className="flex flex-wrap gap-2">
                        {attrGroups.map((g) => {
                          let displayStock = g.stock;
                          if (selectedColor) {
                            const v = g.variants.find(v => {
                              const colorOpt = getOptionValue(v.options, 'color');
                              return colorOpt === selectedColor.toLowerCase().trim();
                            });
                            displayStock = v ? v.stock : 0;
                          }
                          const isSelected = selectedSize === g.value.toLowerCase().trim();
                          const isDisabled = displayStock <= 0;
                          const hasImage = g.imageUrl;

                          return (
                            <button 
                              key={g.valueId || g.value}
                              onClick={() => !isDisabled && handleSizeSelect(g.value)}
                              disabled={isDisabled}
                              className={`min-w-[50px] px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                                isSelected 
                                  ? 'border-gray-900 bg-gray-50' 
                                  : isDisabled 
                                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' 
                                    : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {hasImage && (
                                <img 
                                  src={g.imageUrl!} 
                                  alt={g.label}
                                  className="w-5 h-5 object-cover rounded border border-gray-300"
                                />
                              )}
                              <div className="flex flex-col text-center">
                                <span className="text-sm font-medium">{getAttributeLabel(language, attrKey, g.value)}</span>
                                {displayStock > 0 && (
                                  <span className="text-xs text-gray-500">({displayStock})</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      // Generic attribute selector
                      <div className="flex flex-wrap gap-2">
                        {attrGroups.map((g) => {
                          const selectedValueId = selectedAttributeValues.get(attrKey);
                          const isSelected = selectedValueId === g.valueId || (!g.valueId && selectedColor === g.value);
                          const isDisabled = g.stock <= 0;
                          const hasImage = g.imageUrl && g.imageUrl.trim() !== '';

                          // Debug logging for material attribute
                          if (attrKey === 'material' && g.imageUrl) {
                            console.log('🖼️ [PRODUCT PAGE] Material attribute image:', {
                              attributeKey: attrKey,
                              valueId: g.valueId,
                              value: g.value,
                              label: g.label,
                              imageUrl: g.imageUrl,
                              hasImage: hasImage
                            });
                          }

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
                              disabled={isDisabled}
                              className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                                isSelected
                                  ? 'border-gray-900 bg-gray-50'
                                  : isDisabled
                                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {hasImage ? (
                                <img 
                                  src={g.imageUrl!} 
                                  alt={g.label}
                                  className="w-6 h-6 object-cover rounded border border-gray-300 flex-shrink-0"
                                  onError={(e) => {
                                    console.error('❌ [PRODUCT PAGE] Failed to load attribute image:', g.imageUrl);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                              <span>{getAttributeLabel(language, attrKey, g.value)}</span>
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
                        const isSelected = selectedColor === g.color;
                        const isDisabled = g.stock <= 0;
                        
                        return (
                          <div key={g.color} className="flex flex-col items-center gap-1">
                            <button 
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
                            ? 'border-gray-900 bg-gray-50' 
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
                {isAddingToCart ? t(language, 'product.adding') : (isOutOfStock ? t(language, 'product.outOfStock') : (isVariationRequired ? getRequiredAttributesMessage() : t(language, 'product.addToCart')))}
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

      <div className="mt-24">
        <ProductReviews productId={product.id} />
      </div>
      <div className="mt-16">
        <RelatedProducts categorySlug={product.categories?.[0]?.slug} currentProductId={product.id} />
      </div>
    </div>
  );
}
