'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../../lib/api-client';
import { getColorHex, COLOR_MAP } from '../../../../lib/colorMap';

// Component for adding new color/size
function NewColorSizeInput({ 
  variantId: _variantId, 
  type: _type, 
  onAdd, 
  placeholder 
}: { 
  variantId: string; 
  type: 'color' | 'size'; 
  onAdd: (_name: string) => void; 
  placeholder: string;
}) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        disabled={!name.trim()}
        className="whitespace-nowrap"
      >
        + Add
      </Button>
    </div>
  );
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  requiresSizes?: boolean;
}

interface Attribute {
  id: string;
  key: string;
  name: string;
  type: string;
  filterable?: boolean;
  values: Array<{
    id: string;
    value: string;
    label: string;
  }>;
}

// Color data with images, stock, price, and sizes for each color
interface ColorData {
  colorValue: string;
  colorLabel: string;
  images: string[]; // Массив изображений для этого цвета (file upload)
  stock: string; // Base stock for color (if no sizes)
  price?: string; // Цена для этого конкретного цвета (опционально)
  compareAtPrice?: string; // Старая цена для этого конкретного цвета (скидка)
  sizes: string[]; // Размеры для этого цвета
  sizeStocks: Record<string, string>; // Stock для каждого размера этого цвета: { "S": "10", "M": "5" }
  sizeLabels?: Record<string, string>; // Original labels for manually added sizes: { "s": "S" }
  isFeatured?: boolean; // Является ли этот цвет основным для товара
}

// Unified variant structure - один variant с несколькими цветами
// Note: sizes are now managed at color level, not variant level
interface Variant {
  id: string;
  price: string; // Общая цена для всех цветов (fallback, если color-ի price չկա)
  compareAtPrice: string;
  sku: string;
  // Deprecated: sizes and sizeStocks are now in ColorData
  // Keeping for backward compatibility during migration
  sizes?: string[]; 
  sizeStocks?: Record<string, string>;
  sizeLabels?: Record<string, string>;
  colors: ColorData[]; // Массив цветов, каждый со своими изображениями, stock, price, и sizes
}

interface ProductLabel {
  id?: string;
  type: 'text' | 'percentage';
  value: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string | null;
}

interface ProductData {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  descriptionHtml?: string;
  brandId?: string | null;
  primaryCategoryId?: string | null;
  categoryIds?: string[];
  published: boolean;
    featured?: boolean;
  media?: string[];
  labels?: ProductLabel[];
  variants?: Array<{
    id?: string;
    price: string;
    compareAtPrice?: string;
    stock: string;
    sku?: string;
    color?: string;
    size?: string;
    imageUrl?: string;
    published?: boolean;
  }>;
}

function AddProductPageContent() {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');
  const isEditMode = !!productId;
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    subtitle: '',
    descriptionHtml: '',
    brandId: '',
    primaryCategoryId: '',
    categoryIds: [] as string[],
    published: false,
    featured: false,
    imageUrls: [] as string[],
    featuredImageIndex: 0,
    variants: [] as Variant[],
    labels: [] as ProductLabel[],
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const colorImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [colorImageTarget, setColorImageTarget] = useState<{ variantId: string; colorValue: string } | null>(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryRequiresSizes, setNewCategoryRequiresSizes] = useState(false);
  const [useNewBrand, setUseNewBrand] = useState(false);
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newSizeName, setNewSizeName] = useState('');
  const [addingColor, setAddingColor] = useState(false);
  const [addingSize, setAddingSize] = useState(false);
  const [colorMessage, setColorMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sizeMessage, setSizeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn || !isAdmin) {
        router.push('/admin');
        return;
      }
    }
  }, [isLoggedIn, isAdmin, isLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('📥 [ADMIN] Fetching brands, categories, and attributes...');
        const [brandsRes, categoriesRes, attributesRes] = await Promise.all([
          apiClient.get<{ data: Brand[] }>('/api/v1/admin/brands'),
          apiClient.get<{ data: Category[] }>('/api/v1/admin/categories'),
          apiClient.get<{ data: Attribute[] }>('/api/v1/admin/attributes'),
        ]);
        setBrands(brandsRes.data || []);
        setCategories(categoriesRes.data || []);
        setAttributes(attributesRes.data || []);
        console.log('✅ [ADMIN] Data fetched:', {
          brands: brandsRes.data?.length || 0,
          categories: categoriesRes.data?.length || 0,
          attributes: attributesRes.data?.length || 0,
        });
        // Debug: Log categories with requiresSizes
        if (categoriesRes.data) {
          console.log('📋 [ADMIN] Categories with requiresSizes:', 
            categoriesRes.data.map(cat => ({ 
              id: cat.id, 
              title: cat.title, 
              requiresSizes: cat.requiresSizes 
            }))
          );
        }
      } catch (err: any) {
        console.error('❌ [ADMIN] Error fetching data:', err);
        alert(`Error loading data: ${err.message || 'Unknown error'}`);
      }
    };
    fetchData();
  }, []);

  // Load product data if in edit mode
  useEffect(() => {
    if (productId && isLoggedIn && isAdmin) {
      const loadProduct = async () => {
        try {
          setLoadingProduct(true);
          console.log('📥 [ADMIN] Loading product for edit:', productId);
          const product = await apiClient.get<ProductData>(`/api/v1/admin/products/${productId}`);
          
          // Transform product data to form format
          // Note: colorAttribute and sizeAttribute are available in attributes array if needed
          
          // Merge all variants into a single variant with colors and their sizes
          // Преобразуем старые варианты в новую структуру с ColorData, где sizes находятся в каждом color-ում
          const colorDataMap = new Map<string, ColorData>(); // colorValue -> ColorData
          let firstPrice = '';
          let firstCompareAtPrice = '';
          let firstSku = '';
          
          (product.variants || []).forEach((variant: any, index: number) => {
            const color = variant.color || '';
            const size = variant.size || '';
            
            // Convert stock to string, handling 0 correctly
            const stockValue = variant.stock !== undefined && variant.stock !== null 
              ? String(variant.stock) 
              : '';
            
            // Collect colors with their images, sizes, and stocks
            if (color) {
              if (!colorDataMap.has(color)) {
                // Get color label from attributes or use color value
                const colorAttribute = attributes.find((attr) => attr.key === 'color');
                const colorValueObj = colorAttribute?.values.find((v) => v.value === color);
                const colorLabel = colorValueObj?.label || 
                  (color.charAt(0).toUpperCase() + color.slice(1).replace(/-/g, ' '));
                
                // Initialize color data with empty sizes
                const colorData: ColorData = {
                  colorValue: color,
                  colorLabel: colorLabel,
                  images: smartSplitUrls(variant.imageUrl),
                  stock: size ? '' : stockValue, // Base stock only if no size
                  price: variant.price !== undefined && variant.price !== null ? String(variant.price) : '',
                  compareAtPrice: variant.compareAtPrice !== undefined && variant.compareAtPrice !== null ? String(variant.compareAtPrice) : '',
                  sizes: [],
                  sizeStocks: {},
                  sizeLabels: {},
                  isFeatured: !!variant.isFeatured,
                };
                
                // If variant has size, add it to color's sizes
                if (size) {
                  colorData.sizes = [size];
                  colorData.sizeStocks = { [size]: stockValue };
                  // Get size label if it's a custom size (not from attributes)
                  if (variant.sizeLabel) {
                    colorData.sizeLabels = { [size]: variant.sizeLabel };
                  }
                }
                
                colorDataMap.set(color, colorData);
              } else {
                // If color already exists, merge data
                const existingColorData = colorDataMap.get(color)!;
                
                // Add images if not already present
                if (variant.imageUrl) {
                  const imageUrls = smartSplitUrls(variant.imageUrl);
                  imageUrls.forEach((url: string) => {
                    // Check for existence with normalization to prevent duplicates
                    const exists = existingColorData.images.some(existingUrl => {
                      if (url.startsWith('data:') || existingUrl.startsWith('data:')) {
                        return url === existingUrl;
                      }
                      const n1 = existingUrl.startsWith('/') ? existingUrl : `/${existingUrl}`;
                      const n2 = url.startsWith('/') ? url : `/${url}`;
                      return n1 === n2 || existingUrl === url;
                    });
                    
                    if (url && !exists) {
                      existingColorData.images.push(url);
                    }
                  });
                }
                
                // If variant has size, add it to color's sizes if not already present
                if (size) {
                  if (!existingColorData.sizes.includes(size)) {
                    existingColorData.sizes.push(size);
                  }
                  // Update stock for this size
                  existingColorData.sizeStocks[size] = stockValue;
                  // Update size label if available
                  if (variant.sizeLabel) {
                    if (!existingColorData.sizeLabels) existingColorData.sizeLabels = {};
                    existingColorData.sizeLabels[size] = variant.sizeLabel;
                  }
                } else {
                  // If no size, update base stock (sum if multiple variants without sizes)
                  const currentStockNum = parseInt(existingColorData.stock) || 0;
                  const variantStockNum = parseInt(stockValue) || 0;
                  existingColorData.stock = String(currentStockNum + variantStockNum);
                }

                // Update featured status if this variant is marked as featured
                if (variant.isFeatured) {
                  existingColorData.isFeatured = true;
                }
              }
            }
            
            // Use first variant's price, compareAtPrice, sku as defaults
            if (index === 0) {
              firstPrice = variant.price !== undefined && variant.price !== null ? String(variant.price) : '';
              firstCompareAtPrice = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null ? String(variant.compareAtPrice) : '';
              firstSku = variant.sku || '';
            }
          });
          
          // Create a single merged variant with all colors (sizes are now in each color)
          const mergedVariant: Variant = {
            id: `variant-${Date.now()}-${Math.random()}`,
            price: firstPrice,
            compareAtPrice: firstCompareAtPrice,
            sku: firstSku,
            colors: Array.from(colorDataMap.values()),
          };
          
          // Collect all images assigned to variants to filter them out from general media
          const variantImages = new Set<string>();
          mergedVariant.colors.forEach(c => {
            c.images.forEach(img => {
              if (img) {
                variantImages.add(img);
                // Also add normalized version for comparison
                const normalized = img.startsWith('/') ? img : `/${img}`;
                variantImages.add(normalized);
              }
            });
          });

          const mediaList = product.media || [];
          // Filter out images that are already assigned to variants
          const normalizedMedia = Array.isArray(mediaList)
            ? mediaList
                .map((item: any) => (typeof item === 'string' ? item : item?.url || ''))
                .filter((url: string) => {
                  if (!url) return false;
                  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
                  return !variantImages.has(url) && !variantImages.has(normalizedUrl);
                })
            : [];
          
          const featuredIndexFromApi = Array.isArray(mediaList)
            ? mediaList.findIndex((item: any) => {
                const url = typeof item === 'string' ? item : item?.url || '';
                if (!url) return false;
                const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
                return typeof item === 'object' && item?.isFeatured && !variantImages.has(url) && !variantImages.has(normalizedUrl);
              })
            : -1;

          setFormData({
            title: product.title || '',
            slug: product.slug || '',
            subtitle: product.subtitle || '',
            descriptionHtml: product.descriptionHtml || '',
            brandId: product.brandId || '',
            primaryCategoryId: product.primaryCategoryId || '',
            categoryIds: product.categoryIds || [],
            published: product.published || false,
            featured: product.featured || false,
            imageUrls: normalizedMedia,
            featuredImageIndex:
              featuredIndexFromApi >= 0 && featuredIndexFromApi < normalizedMedia.length
                ? featuredIndexFromApi
                : 0,
            variants: [mergedVariant], // Single variant with all colors and sizes
            labels: (product.labels || []).map((label: any) => ({
              id: label.id || '',
              type: label.type || 'text',
              value: label.value || '',
              position: label.position || 'top-left',
              color: label.color || null,
            })),
          });
          
          // Reset new brand/category fields when loading existing product
          setUseNewBrand(false);
          setUseNewCategory(false);
          setNewBrandName('');
          setNewCategoryName('');
          setNewCategoryRequiresSizes(false);
          
          console.log('✅ [ADMIN] Product loaded for edit');
        } catch (err: any) {
          console.error('❌ [ADMIN] Error loading product:', err);
          alert(`Error loading product: ${err.message || 'Unknown error'}`);
          router.push('/admin/products');
        } finally {
          setLoadingProduct(false);
        }
      };
      
      loadProduct();
    }
  }, [productId, isLoggedIn, isAdmin, router, attributes]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-|]/g, '') // Allow pipe character (|) in slug
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  /**
   * Helper function to process image URLs
   * Handles relative paths, absolute URLs and base64
   */
  const processImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // For relative paths, ensure they start with a slash
    return url.startsWith('/') ? url : `/${url}`;
  };

  /**
   * Smart split for comma-separated image URLs that handles Base64 data URIs
   */
  const smartSplitUrls = (str: string | null | undefined): string[] => {
    if (!str) return [];
    if (!str.includes('data:')) {
      return str.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    // If it contains data URIs, we need to be careful with commas
    const parts = str.split(',');
    const results: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.startsWith('data:')) {
        // This is the start of a data URI (e.g., "data:image/png;base64")
        // The next part is the actual base64 data
        if (i + 1 < parts.length) {
          results.push(part + ',' + parts[i + 1].trim());
          i++; // Skip the next part as it's been consumed
        } else {
          results.push(part);
        }
      } else if (part) {
        results.push(part);
      }
    }
    return results;
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  // Check if selected category requires sizes
  const isClothingCategory = () => {
    // If adding new category and requiresSizes is checked, return true
    if (useNewCategory && newCategoryRequiresSizes) {
      console.log('🔍 [VALIDATION] isClothingCategory: true (new category with requiresSizes)');
      return true;
    }
    
    // If no category selected, return false
    if (!formData.primaryCategoryId) {
      console.log('🔍 [VALIDATION] isClothingCategory: false (no category selected)');
      return false;
    }
    
    const selectedCategory = categories.find((cat) => cat.id === formData.primaryCategoryId);
    if (!selectedCategory) {
      console.log('🔍 [VALIDATION] isClothingCategory: false (category not found)');
      return false;
    }
    
    // Only check if category has requiresSizes field explicitly set to true
    // If undefined or false, return false (sizes not required)
    const requiresSizes = selectedCategory.requiresSizes === true;
    console.log('🔍 [VALIDATION] isClothingCategory:', requiresSizes, {
      categoryId: selectedCategory.id,
      categoryTitle: selectedCategory.title,
      requiresSizes: selectedCategory.requiresSizes
    });
    return requiresSizes;
  };

  // Variant management functions
  const addVariant = () => {
    const newVariant: Variant = {
      id: `variant-${Date.now()}`,
      price: '',
      compareAtPrice: '',
      sku: '',
      colors: [], // Начинаем с пустого массива цветов
    };
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
  };

  // Toggle color selection for variant - добавляет/удаляет цвет с пустыми данными
  const toggleVariantColor = (variantId: string, colorValue: string, colorLabel: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          const colors = v.colors || [];
          const colorIndex = colors.findIndex((c) => c.colorValue === colorValue);
          
          if (colorIndex > -1) {
            // Remove color
            return {
              ...v,
              colors: colors.filter((_, idx) => idx !== colorIndex),
            };
          } else {
            // Add color with empty images, stock, sizes
            const newColor: ColorData = {
              colorValue,
              colorLabel,
              images: [],
              stock: '',
              sizes: [],
              sizeStocks: {},
              sizeLabels: {},
            };
            return {
              ...v,
              colors: [...colors, newColor],
            };
          }
        }
        return v;
      }),
    }));
  };

  // Update stock for a specific color
  const updateColorStock = (variantId: string, colorValue: string, stock: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) =>
              c.colorValue === colorValue ? { ...c, stock } : c
            ),
          };
        }
        return v;
      }),
    }));
  };

  // Update price for a specific color
  const updateColorPrice = (variantId: string, colorValue: string, price: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) =>
              c.colorValue === colorValue ? { ...c, price } : c
            ),
          };
        }
        return v;
      }),
    }));
  };

  const updateColorCompareAtPrice = (variantId: string, colorValue: string, compareAtPrice: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) =>
              c.colorValue === colorValue ? { ...c, compareAtPrice } : c
            ),
          };
        }
        return v;
      }),
    }));
  };

  // Toggle size selection for a specific color in variant
  const toggleColorSize = (variantId: string, colorValue: string, sizeValue: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) => {
              if (c.colorValue === colorValue) {
                const sizes = c.sizes || [];
                const sizeStocks = c.sizeStocks || {};
                const sizeLabels = c.sizeLabels || {};
                const sizeIndex = sizes.indexOf(sizeValue);
                
                if (sizeIndex > -1) {
                  // Remove size
                  const newSizes = sizes.filter((s) => s !== sizeValue);
                  const newSizeStocks = { ...sizeStocks };
                  const newSizeLabels = { ...sizeLabels };
                  delete newSizeStocks[sizeValue];
                  delete newSizeLabels[sizeValue];
                  return {
                    ...c,
                    sizes: newSizes,
                    sizeStocks: newSizeStocks,
                    sizeLabels: newSizeLabels,
                  };
                } else {
                  // Add size
                  return {
                    ...c,
                    sizes: [...sizes, sizeValue],
                    sizeStocks: { ...sizeStocks, [sizeValue]: '' },
                  };
                }
              }
              return c;
            }),
          };
        }
        return v;
      }),
    }));
  };

  // Update stock for a specific size in a specific color
  const updateColorSizeStock = (variantId: string, colorValue: string, sizeValue: string, stock: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) => {
              if (c.colorValue === colorValue) {
                return {
                  ...c,
                  sizeStocks: {
                    ...(c.sizeStocks || {}),
                    [sizeValue]: stock,
                  },
                };
              }
              return c;
            }),
          };
        }
        return v;
      }),
    }));
  };

  // Add new color directly to variant (manual color entry)
  const addNewColorToVariant = (variantId: string, colorName: string) => {
    if (!colorName.trim()) return;
    
    const trimmedName = colorName.trim();
    const colorValue = generateSlug(trimmedName);
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          const colors = v.colors || [];
          
          // Check if color already exists
          if (colors.some((c) => c.colorValue === colorValue)) {
            return v; // Color already exists, don't add again
          }
          
          // Add new color with empty images, stock, and sizes
          const newColor: ColorData = {
            colorValue,
            colorLabel: trimmedName,
            images: [],
            stock: '',
            sizes: [],
            sizeStocks: {},
            sizeLabels: {},
          };
          
          return {
            ...v,
            colors: [...colors, newColor],
          };
        }
        return v;
      }),
    }));
  };

  // Add new size directly to a specific color in variant
  const addNewSizeToColor = (variantId: string, colorValue: string, sizeName: string) => {
    if (!sizeName.trim()) return;
    
    const trimmedName = sizeName.trim();
    const sizeValue = generateSlug(trimmedName);
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) => {
              if (c.colorValue === colorValue) {
                const sizes = c.sizes || [];
                const sizeStocks = c.sizeStocks || {};
                const sizeLabels = c.sizeLabels || {};
                
                // Check if size already exists
                if (sizes.includes(sizeValue)) {
                  return c; // Size already exists, don't add again
                }
                
                // Add new size with original label and empty stock
                return {
                  ...c,
                  sizes: [...sizes, sizeValue],
                  sizeStocks: { ...sizeStocks, [sizeValue]: '' },
                  sizeLabels: { ...sizeLabels, [sizeValue]: trimmedName },
                };
              }
              return c;
            }),
          };
        }
        return v;
      }),
    }));
  };

  const removeVariant = (variantId: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== variantId),
    }));
  };

  const updateVariant = (variantId: string, field: keyof Variant, value: any) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.id === variantId ? { ...v, [field]: value } : v
      ),
    }));
  };

  // Add images to a specific color in variant
  const addColorImages = (variantId: string, colorValue: string, images: string[]) => {
    console.log('🖼️ [ADMIN] Adding images to color:', {
      variantId,
      colorValue,
      imagesCount: images.length
    });
    
    setFormData((prev) => {
      const updated = {
        ...prev,
        variants: prev.variants.map((v) => {
          if (v.id === variantId) {
            const updatedColors = v.colors.map((c) => {
              if (c.colorValue === colorValue) {
                // Deduplicate new images
                const uniqueNewImages = images.filter(newImg => !c.images.includes(newImg));
                const newImages = [...c.images, ...uniqueNewImages];
                
                console.log('✅ [ADMIN] Updated color images:', {
                  colorValue: c.colorValue,
                  oldCount: c.images.length,
                  newCount: newImages.length,
                  addedCount: uniqueNewImages.length
                });
                return { ...c, images: newImages };
              }
              return c;
            });
            
            return {
              ...v,
              colors: updatedColors,
            };
          }
          return v;
        }),
      };
      
      return updated;
    });
  };

  // Remove image from a specific color
  const removeColorImage = (variantId: string, colorValue: string, imageIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) =>
              c.colorValue === colorValue
                ? { ...c, images: c.images.filter((_, idx) => idx !== imageIndex) }
                : c
            ),
          };
        }
        return v;
      }),
    }));
  };

  /**
   * Set a specific color as featured/main for the product
   */
  const setFeaturedColor = (variantId: string, colorValue: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            colors: v.colors.map((c) => ({
              ...c,
              isFeatured: c.colorValue === colorValue
            }))
          };
        }
        return v;
      })
    }));
  };

  /**
   * Helper functions for price management (deprecated but kept for structure)
   */
  const getPrimaryPrice = () => '';
  const handlePrimaryPriceChange = (_e: any) => {};
  const handlePrimaryPriceBlur = (_e: any) => {};

  const addImageUrl = () => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: [...prev.imageUrls, ''],
    }));
  };

  const removeImageUrl = (index: number) => {
    setFormData((prev) => {
      const newUrls = prev.imageUrls.filter((_, i) => i !== index);
      let featuredIndex = prev.featuredImageIndex;
      if (index === featuredIndex) {
        featuredIndex = 0;
      } else if (index < featuredIndex) {
        featuredIndex = Math.max(0, featuredIndex - 1);
      }
      return {
        ...prev,
        imageUrls: newUrls,
        featuredImageIndex: newUrls.length === 0 ? 0 : Math.min(featuredIndex, newUrls.length - 1),
      };
    });
  };

  const updateImageUrl = (index: number, url: string) => {
    setFormData((prev) => {
      const newUrls = [...prev.imageUrls];
      newUrls[index] = url;
      return { ...prev, imageUrls: newUrls };
    });
  };

  const setFeaturedImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      featuredImageIndex: index,
    }));
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setImageUploadLoading(true);
    setImageUploadError(null);
    try {
      const uploadedImages = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith('image/')) {
            throw new Error(`"${file.name}" is not an image file`);
          }
          const base64 = await fileToBase64(file);
          return base64;
        })
      );

      setFormData((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...uploadedImages],
      }));
    } catch (error: any) {
      setImageUploadError(error?.message || 'Failed to process selected images');
    } finally {
      setImageUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Upload images for a specific color in variant
  const handleUploadColorImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !colorImageTarget) {
      console.log('⚠️ [ADMIN] No files or no color target:', { filesLength: files.length, colorImageTarget });
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Please select image files');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    try {
      setImageUploadLoading(true);
      console.log('📤 [ADMIN] Starting upload for color:', colorImageTarget.colorValue, 'Files:', imageFiles.length);
      
      const uploadedImages = await Promise.all(
        imageFiles.map(async (file) => {
          const base64 = await fileToBase64(file);
          console.log('✅ [ADMIN] Image converted to base64, length:', base64.length);
          return base64;
        })
      );

      console.log('📥 [ADMIN] All images converted, adding to variant:', {
        variantId: colorImageTarget.variantId,
        colorValue: colorImageTarget.colorValue,
        imagesCount: uploadedImages.length
      });
      
      addColorImages(colorImageTarget.variantId, colorImageTarget.colorValue, uploadedImages);
      console.log('✅ [ADMIN] Color images added to state:', uploadedImages.length);
    } catch (error: any) {
      console.error('❌ [ADMIN] Error uploading color images:', error);
      alert(error?.message || 'Failed to process selected images');
    } finally {
      setImageUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
      setColorImageTarget(null);
    }
  };

  // Label management functions
  const addLabel = () => {
    const newLabel: ProductLabel = {
      type: 'text',
      value: '',
      position: 'top-left',
      color: null,
    };
    setFormData((prev) => ({
      ...prev,
      labels: [...prev.labels, newLabel],
    }));
  };

  const removeLabel = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.filter((_, i) => i !== index),
    }));
  };

  const updateLabel = (index: number, field: keyof ProductLabel, value: any) => {
    setFormData((prev) => {
      const newLabels = [...prev.labels];
      newLabels[index] = { ...newLabels[index], [field]: value };
      return { ...prev, labels: newLabels };
    });
  };

  const getColorAttribute = () => attributes.find((attr) => attr.key === 'color');
  const getSizeAttribute = () => attributes.find((attr) => attr.key === 'size');

  // Add new color to color attribute
  const handleAddColor = async () => {
    setColorMessage(null);
    const colorAttribute = getColorAttribute();
    if (!colorAttribute) {
      setColorMessage({ type: 'error', text: 'Color attribute not found' });
      return;
    }

    if (!newColorName.trim()) {
      setColorMessage({ type: 'error', text: 'Color name is required' });
      return;
    }

    try {
      setAddingColor(true);
      const response = await apiClient.post<{ data: Attribute }>(`/api/v1/admin/attributes/${colorAttribute.id}/values`, {
        label: newColorName.trim(),
        locale: 'en',
      });
      
      if (response.data) {
        // Update attributes list
        setAttributes((prev) => 
          prev.map((attr) => 
            attr.id === colorAttribute.id ? response.data : attr
          )
        );
        setColorMessage({ type: 'success', text: `Color "${newColorName.trim()}" added successfully` });
        setNewColorName('');
        // Clear message after 3 seconds
        setTimeout(() => setColorMessage(null), 3000);
      }
    } catch (err: any) {
      setColorMessage({ type: 'error', text: err.message || 'Failed to add color' });
    } finally {
      setAddingColor(false);
    }
  };

  // Add new size to size attribute
  const handleAddSize = async () => {
    setSizeMessage(null);
    const sizeAttribute = getSizeAttribute();
    if (!sizeAttribute) {
      setSizeMessage({ type: 'error', text: 'Size attribute not found' });
      return;
    }

    if (!newSizeName.trim()) {
      setSizeMessage({ type: 'error', text: 'Size name is required' });
      return;
    }

    try {
      setAddingSize(true);
      const response = await apiClient.post<{ data: Attribute }>(`/api/v1/admin/attributes/${sizeAttribute.id}/values`, {
        label: newSizeName.trim(),
        locale: 'en',
      });
      
      if (response.data) {
        // Update attributes list
        setAttributes((prev) => 
          prev.map((attr) => 
            attr.id === sizeAttribute.id ? response.data : attr
          )
        );
        setSizeMessage({ type: 'success', text: `Size "${newSizeName.trim()}" added successfully` });
        setNewSizeName('');
        // Clear message after 3 seconds
        setTimeout(() => setSizeMessage(null), 3000);
      }
    } catch (err: any) {
      setSizeMessage({ type: 'error', text: err.message || 'Failed to add size' });
    } finally {
      setAddingSize(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('📝 [ADMIN] Submitting product form:', formData);

      // Collect success messages for newly created entities (brand/category)
      const creationMessages: string[] = [];

      // Create new brand if provided
      let finalBrandId = formData.brandId;
      if (useNewBrand && newBrandName.trim()) {
        try {
          console.log('🏷️ [ADMIN] Creating new brand:', newBrandName);
          const brandResponse = await apiClient.post<{ data: Brand }>('/api/v1/admin/brands', {
            name: newBrandName.trim(),
            locale: 'en',
          });
          if (brandResponse.data) {
            finalBrandId = brandResponse.data.id;
            // Add to brands list for future use
            setBrands((prev) => [...prev, brandResponse.data]);
            console.log('✅ [ADMIN] Brand created:', brandResponse.data.id);
            creationMessages.push(`Brand "${newBrandName.trim()}" successfully created`);
          }
        } catch (err: any) {
          console.error('❌ [ADMIN] Error creating brand:', err);
          const errorMessage = err?.data?.detail || err?.message || 'Unknown error';
          alert(`Չհաջողվեց ստեղծել brand: ${errorMessage}`);
          setLoading(false);
          return;
        }
      }

      // Create new category if provided
      let finalPrimaryCategoryId = formData.primaryCategoryId;
      if (useNewCategory && newCategoryName.trim()) {
        try {
          console.log('📁 [ADMIN] Creating new category:', newCategoryName, 'requiresSizes:', newCategoryRequiresSizes);
          const categoryResponse = await apiClient.post<{ data: Category }>('/api/v1/admin/categories', {
            title: newCategoryName.trim(),
            locale: 'en',
            requiresSizes: newCategoryRequiresSizes,
          });
          if (categoryResponse.data) {
            finalPrimaryCategoryId = categoryResponse.data.id;
            // Add to categories list for future use
            setCategories((prev) => [...prev, categoryResponse.data]);
            console.log('✅ [ADMIN] Category created:', categoryResponse.data.id, 'requiresSizes:', categoryResponse.data.requiresSizes);
            creationMessages.push(
              `Category "${newCategoryName.trim()}" successfully created${newCategoryRequiresSizes ? ' (sizes required)' : ''}`
            );
          }
        } catch (err: any) {
          console.error('❌ [ADMIN] Error creating category:', err);
          alert(`Չհաջողվեց ստեղծել կատեգորիա: ${err.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }
      }

      // Validate that at least one variant exists
      if (formData.variants.length === 0) {
        alert('Please add at least one product variant');
        setLoading(false);
        return;
      }

      // Validate all variants
      const skuSet = new Set<string>();
      for (const variant of formData.variants) {
        const variantIndex = formData.variants.indexOf(variant) + 1;
        
        // Skip base price validation as we now use color-specific prices
        
        // Validate that at least one color is selected
        if (!variant.colors || variant.colors.length === 0) {
          alert(`Վարիանտ ${variantIndex}: Խնդրում ենք ընտրել առնվազն մեկ գույն`);
          setLoading(false);
          return;
        }
        
        // Validate SKU - must be unique within product
        const variantSku = variant.sku ? variant.sku.trim() : '';
        if (!variantSku || variantSku === '') {
          alert(`Վարիանտ ${variantIndex}: SKU-ն պարտադիր է: Խնդրում ենք մուտքագրել SKU կամ օգտագործել "Գեներացնել" կոճակը`);
          setLoading(false);
          return;
        }
        
        if (skuSet.has(variantSku)) {
          alert(`Վարիանտ ${variantIndex}: SKU "${variantSku}" արդեն օգտագործված է այս ապրանքի մեջ: Ամեն վարիանտի SKU-ն պետք է եզակի լինի`);
          setLoading(false);
          return;
        }
        skuSet.add(variantSku);
        
        // Validate colors, sizes, and stocks
        const categoryRequiresSizes = isClothingCategory();
        const colorData = variant.colors && variant.colors.length > 0 ? variant.colors : [];
        
        if (colorData.length > 0) {
          for (const colorDataItem of colorData) {
            const colorSizes = colorDataItem.sizes || [];
            const colorSizeStocks = colorDataItem.sizeStocks || {};
            
            // Validate price for this color
            const colorPriceValue = parseFloat(colorDataItem.price || '0');
            if (!colorDataItem.price || isNaN(colorPriceValue) || colorPriceValue <= 0) {
              alert(`Վարիանտ ${variantIndex}: Խնդրում ենք մուտքագրել վավեր գին "${colorDataItem.colorLabel}" գույնի համար`);
              setLoading(false);
              return;
            }

            // If category requires sizes, check if color has at least one size
            if (categoryRequiresSizes) {
              if (colorSizes.length === 0) {
                alert(`Վարիանտ ${variantIndex}: Գույն "${colorDataItem.colorLabel}"-ի համար պահանջվում է առնվազն մեկ չափս`);
                setLoading(false);
                return;
              }
              
              // Validate stock for each size of this color
              for (const size of colorSizes) {
                const stock = colorSizeStocks[size];
                if (!stock || stock.trim() === '' || parseInt(stock) < 0) {
                  const sizeLabel = getSizeAttribute()?.values.find((v) => v.value === size)?.label || 
                    colorDataItem.sizeLabels?.[size] || 
                    size.toUpperCase().replace(/-/g, ' ');
                  alert(`Վարիանտ ${variantIndex}: Գույն "${colorDataItem.colorLabel}" - Խնդրում ենք մուտքագրել պահեստ "${sizeLabel}" չափսի համար`);
                  setLoading(false);
                  return;
                }
              }
            } else {
              // If category doesn't require sizes, validate base stock for color
              if (colorSizes.length === 0) {
                if (!colorDataItem.stock || colorDataItem.stock.trim() === '' || parseInt(colorDataItem.stock) < 0) {
                  alert(`Վարիանտ ${variantIndex}: Խնդրում ենք մուտքագրել պահեստ "${colorDataItem.colorLabel}" գույնի համար`);
                  setLoading(false);
                  return;
                }
              }
            }
          }
        }
      }

      // Prepare media array
      const allColorImages: { url: string; isFeatured: boolean }[] = [];
      formData.variants.forEach((v) => {
        v.colors.forEach((c) => {
          if (c.images && c.images.length > 0) {
            c.images.forEach((url, idx) => {
              allColorImages.push({
                url,
                // A color image is "featured" if the color itself is featured AND it's the first image of that color
                isFeatured: !!c.isFeatured && idx === 0
              });
            });
          }
        });
      });

      // Sort allColorImages so that featured images come first
      allColorImages.sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));

      // If no color image is featured, but we have color images, make the first one featured
      const hasFeaturedColorImage = allColorImages.some(img => img.isFeatured);
      if (!hasFeaturedColorImage && allColorImages.length > 0) {
        allColorImages[0].isFeatured = true;
      }

      const media = [
        ...formData.imageUrls.map((url, index) => ({
          url: url.trim(),
          type: 'image',
          position: index,
          isFeatured: index === 0 && allColorImages.length === 0,
        })),
        ...allColorImages.map((img, index) => ({
          url: img.url.trim(),
          type: 'image',
          position: formData.imageUrls.length + index,
          isFeatured: img.isFeatured,
        }))
      ].filter(m => m.url);

      // Prepare variants array
      // Create variants for all combinations of colors and their sizes
      // Each color has its own sizes, images, price, and stock
      const variants: any[] = [];
      
      formData.variants.forEach((variant) => {
        const baseVariantData: any = {
          price: parseFloat(variant.price || '0'),
          published: true,
        };

        if (variant.compareAtPrice) {
          baseVariantData.compareAtPrice = parseFloat(variant.compareAtPrice);
        }

        // Получаем цвета из новой структуры ColorData
        const colorDataArray = variant.colors || [];

        if (colorDataArray.length === 0) {
          console.error('❌ [ADMIN] Variant has no colors:', variant);
          alert(`Variant ${formData.variants.indexOf(variant) + 1}: Please add at least one color`);
          setLoading(false);
          return;
        }

        // Process each color
        colorDataArray.forEach((colorData, colorIndex) => {
          const colorSizes = colorData.sizes || [];
          const colorSizeStocks = colorData.sizeStocks || {};

          // If color has sizes - create variants for each color-size combination
          if (colorSizes.length > 0) {
            colorSizes.forEach((size, sizeIndex) => {
              // Use stock from sizeStocks for this color-size combination
              const stockForVariant = colorSizeStocks[size] || colorData.stock || '0';
              
              const skuSuffix = colorDataArray.length > 1 || colorSizes.length > 1 
                ? `-${colorIndex + 1}-${sizeIndex + 1}` 
                : '';
              
              // Generate SKU if not provided
              let finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
              if (!finalSku || finalSku === '') {
                const baseSlug = formData.slug || 'PROD';
                finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${colorIndex + 1}-${sizeIndex + 1}`;
              }
              
              // Сохраняем все изображения цвета через запятую в imageUrl
              const variantImageUrl = colorData.images && colorData.images.length > 0 
                ? colorData.images.join(',') 
                : undefined;
              
              // Используем цену цвета, если указана, иначе цену варианта
              const finalPrice = colorData.price && colorData.price.trim() !== '' 
                ? parseFloat(colorData.price) 
                : baseVariantData.price;
              
              const finalCompareAtPrice = colorData.compareAtPrice && colorData.compareAtPrice.trim() !== ''
                ? parseFloat(colorData.compareAtPrice)
                : baseVariantData.compareAtPrice;
              
              variants.push({
                ...baseVariantData,
                price: finalPrice,
                compareAtPrice: finalCompareAtPrice,
                color: colorData.colorValue,
                size: size,
                stock: parseInt(stockForVariant) || 0,
                sku: finalSku,
                imageUrl: variantImageUrl,
                isFeatured: !!colorData.isFeatured,
              });
            });
          } 
          // If color has no sizes - create variant with just color
          else {
            const skuSuffix = colorDataArray.length > 1 ? `-${colorIndex + 1}` : '';
            
            // Use base color stock
            const stockForVariant = colorData.stock || '0';
            
            // Generate SKU if not provided
            let finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
            if (!finalSku || finalSku === '') {
              const baseSlug = formData.slug || 'PROD';
              finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${colorIndex + 1}`;
            }

            // Сохраняем все изображения цвета через запятую в imageUrl
            const variantImageUrl = colorData.images && colorData.images.length > 0 
              ? colorData.images.join(',') 
              : undefined;

            // Используем цену цвета, если указана, иначе цену варианта
            const finalPrice = colorData.price && colorData.price.trim() !== '' 
              ? parseFloat(colorData.price) 
              : baseVariantData.price;

            const finalCompareAtPrice = colorData.compareAtPrice && colorData.compareAtPrice.trim() !== ''
              ? parseFloat(colorData.compareAtPrice)
              : baseVariantData.compareAtPrice;

            variants.push({
              ...baseVariantData,
              price: finalPrice,
              compareAtPrice: finalCompareAtPrice,
              color: colorData.colorValue,
              stock: parseInt(stockForVariant) || 0,
              sku: finalSku,
              imageUrl: variantImageUrl,
              isFeatured: !!colorData.isFeatured,
            });
          }
        });
      });

      // Final validation - ensure all SKUs are unique
      const finalSkuSet = new Set<string>();
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        if (!variant.sku || variant.sku.trim() === '') {
          // Generate SKU if still missing
          const baseSlug = formData.slug || 'PROD';
          variant.sku = `${baseSlug.toUpperCase()}-${Date.now()}-${i + 1}`;
        } else {
          variant.sku = variant.sku.trim();
        }
        
        if (finalSkuSet.has(variant.sku)) {
          // Duplicate SKU found, generate new one
          const baseSlug = formData.slug || 'PROD';
          variant.sku = `${baseSlug.toUpperCase()}-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
        }
        finalSkuSet.add(variant.sku);
      }

      // Final validation - check size requirement for categories that require sizes
      const categoryRequiresSizesFinal = isClothingCategory();
      if (categoryRequiresSizesFinal && finalPrimaryCategoryId) {
        const hasSizeInFinalVariants = variants.some(
          (variant) => variant.size && variant.size.trim() !== ""
        );

        if (!hasSizeInFinalVariants) {
          console.error('❌ [VALIDATION] Final size validation failed. Variants:', variants);
          alert('At least one size is required for this product category');
          setLoading(false);
          return;
        }
        console.log('✅ [VALIDATION] Final size validation passed');
      } else {
        console.log('ℹ️ [VALIDATION] Size validation skipped (category does not require sizes)');
      }
      
      // Final validation - ensure all variants have at least one color
      const hasColorInFinalVariants = variants.some(
        (variant) => variant.color && variant.color.trim() !== ""
      );
      
      if (!hasColorInFinalVariants) {
        console.error('❌ [VALIDATION] Final color validation failed. Variants:', variants);
        alert('At least one color is required for product variants');
        setLoading(false);
        return;
      }
      console.log('✅ [VALIDATION] Final color validation passed');

      // Prepare payload
      const payload: any = {
        title: formData.title,
        slug: formData.slug,
        subtitle: formData.subtitle || undefined,
        descriptionHtml: formData.descriptionHtml || undefined,
        brandId: finalBrandId || undefined,
        primaryCategoryId: finalPrimaryCategoryId || undefined,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
        published: formData.published,
      featured: formData.featured,
        locale: 'en',
        variants: variants,
      };

      // Add media if provided
      if (media.length > 0) {
        payload.media = media;
      }

      // Add labels
      payload.labels = (formData.labels || [])
        .filter((label) => label.value && label.value.trim() !== '')
        .map((label) => ({
          type: label.type,
          value: label.value.trim(),
          position: label.position,
          color: label.color || null,
        }));

      console.log('📤 [ADMIN] Sending payload:', JSON.stringify(payload, null, 2));
      
      if (isEditMode && productId) {
        // Update existing product
        const product = await apiClient.put(`/api/v1/admin/products/${productId}`, payload);
        console.log('✅ [ADMIN] Product updated:', product);
        const baseMessage = 'Ապրանքը հաջողությամբ թարմացվեց!';
        const extra = creationMessages.length ? `\n\n${creationMessages.join('\n')}` : '';
        alert(`${baseMessage}${extra}`);
      } else {
        // Create new product
        const product = await apiClient.post('/api/v1/admin/products', payload);
        console.log('✅ [ADMIN] Product created:', product);
        const baseMessage = 'Ապրանքը հաջողությամբ ստեղծվեց!';
        const extra = creationMessages.length ? `\n\n${creationMessages.join('\n')}` : '';
        alert(`${baseMessage}${extra}`);
      }
      
      router.push('/admin/products');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error saving product:', err);
      
      // Extract error message from API response
      let errorMessage = isEditMode ? 'Չհաջողվեց թարմացնել ապրանքը' : 'Չհաջողվեց ստեղծել ապրանքը';
      
      // Try different error response formats
      if (err?.data?.detail) {
        errorMessage = err.data.detail;
      } else if (err?.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err?.message) {
        // If error message contains HTML, try to extract meaningful text
        if (err.message.includes('<!DOCTYPE') || err.message.includes('<html')) {
          // Try to extract MongoDB error from HTML
          const mongoErrorMatch = err.message.match(/MongoServerError[^<]+/);
          if (mongoErrorMatch) {
            errorMessage = `Տվյալների բազայի սխալ: ${mongoErrorMatch[0]}`;
          } else {
            errorMessage = 'Տվյալների բազայի սխալ: SKU-ն արդեն օգտագործված է կամ այլ սխալ:';
          }
        } else {
          errorMessage = err.message;
        }
      }
      
      // Show user-friendly error message
      alert(`Սխալ: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loadingProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{loadingProduct ? 'Loading product...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin Panel
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Product' : 'Add New Product'}</h1>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-14">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <Input
                    type="text"
                    value={formData.title}
                    onChange={handleTitleChange}
                    required
                    placeholder="Product title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug *
                  </label>
                  <Input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    required
                    placeholder="product-slug"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                  </label>
                  <Input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Product subtitle"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                    value={formData.descriptionHtml}
                    onChange={(e) => setFormData((prev) => ({ ...prev, descriptionHtml: e.target.value }))}
                    placeholder="Product description (HTML supported)"
                  />
                </div>
              </div>
            </div>

            {/* Categories & Brand */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Categories & Brand</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Category
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id="select-category"
                        name="category-mode"
                        checked={!useNewCategory}
                        onChange={() => {
                          setUseNewCategory(false);
                          setNewCategoryName('');
                          setNewCategoryRequiresSizes(false);
                          setFormData((prev) => ({ ...prev, primaryCategoryId: '' }));
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="select-category" className="text-sm text-gray-700">
                        Select existing category
                      </label>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id="new-category"
                        name="category-mode"
                        checked={useNewCategory}
                        onChange={() => {
                          setUseNewCategory(true);
                          setNewCategoryRequiresSizes(false);
                          setFormData((prev) => ({ ...prev, primaryCategoryId: '' }));
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="new-category" className="text-sm text-gray-700">
                        Add new category
                      </label>
                    </div>
                    {!useNewCategory ? (
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.primaryCategoryId}
                        onChange={(e) => {
                          const newCategoryId = e.target.value;
                          const selectedCategory = categories.find((cat) => cat.id === newCategoryId);
                          const newIsSizeRequired = selectedCategory
                            ? (selectedCategory.requiresSizes !== undefined 
                                ? selectedCategory.requiresSizes 
                                : (() => {
                                    // Fallback: Check by slug or title
                                    const sizeRequiredSlugs = ['clothing', 'odezhda', 'hagust', 'apparel', 'fashion', 'shoes', 'koshik', 'obuv'];
                                    const sizeRequiredTitles = ['clothing', 'одежда', 'հագուստ', 'apparel', 'fashion', 'shoes', 'կոշիկ', 'обувь'];
                                    return (
                                      sizeRequiredSlugs.some((slug) => selectedCategory.slug.toLowerCase().includes(slug)) ||
                                      sizeRequiredTitles.some((title) => selectedCategory.title.toLowerCase().includes(title))
                                    );
                                  })())
                            : false;
                          
                          setFormData((prev) => {
                            // If switching from size-required category to non-size-required, clear sizes
                            const wasSizeRequired = isClothingCategory();
                            if (wasSizeRequired && !newIsSizeRequired) {
                              return {
                                ...prev,
                                primaryCategoryId: newCategoryId,
                                variants: prev.variants.map((v) => ({
                                  ...v,
                                  sizes: [],
                                  sizeStocks: {},
                                  size: '',
                                })),
                              };
                            }
                            return { ...prev, primaryCategoryId: newCategoryId };
                          });
                        }}
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Enter new category name"
                          className="w-full"
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCategoryRequiresSizes}
                            onChange={(e) => setNewCategoryRequiresSizes(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            This category requires sizes (e.g., clothing, shoes)
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id="select-brand"
                        name="brand-mode"
                        checked={!useNewBrand}
                        onChange={() => {
                          setUseNewBrand(false);
                          setNewBrandName('');
                          setFormData((prev) => ({ ...prev, brandId: '' }));
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="select-brand" className="text-sm text-gray-700">
                        Select existing brand
                      </label>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id="new-brand"
                        name="brand-mode"
                        checked={useNewBrand}
                        onChange={() => {
                          setUseNewBrand(true);
                          setFormData((prev) => ({ ...prev, brandId: '' }));
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="new-brand" className="text-sm text-gray-700">
                        Add new brand
                      </label>
                    </div>
                    {!useNewBrand ? (
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.brandId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, brandId: e.target.value }))}
                      >
                        <option value="">Select brand</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type="text"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        placeholder="Enter new brand name"
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Product Labels */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Product Labels</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLabel}
                >
                  + Add Label
                </Button>
              </div>
              {formData.labels.length === 0 ? (
                <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-2">No labels added yet</p>
                  <p className="text-sm text-gray-400">Add labels like "New Product", "Hot", "Sale" or percentage discounts like "50%"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.labels.map((label, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Label {index + 1}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeLabel(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Label Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type *
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={label.type}
                            onChange={(e) => updateLabel(index, 'type', e.target.value as 'text' | 'percentage')}
                            required
                          >
                            <option value="text">Text (New Product, Hot, Sale, etc.)</option>
                            <option value="percentage">Percentage (50%, 30%, etc.)</option>
                          </select>
                        </div>

                        {/* Label Value */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Value *
                          </label>
                          <Input
                            type="text"
                            value={label.value}
                            onChange={(e) => updateLabel(index, 'value', e.target.value)}
                            placeholder={label.type === 'percentage' ? '50 (will be auto-updated)' : 'New Product'}
                            required
                            className="w-full"
                          />
                          {label.type === 'percentage' && (
                            <p className="mt-1 text-xs text-blue-600 font-medium">
                              ⓘ This value will be automatically updated based on the product's discount percentage. You can enter any number here as a placeholder.
                            </p>
                          )}
                        </div>

                        {/* Label Position */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Position *
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={label.position}
                            onChange={(e) => updateLabel(index, 'position', e.target.value)}
                            required
                          >
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
                          </select>
                        </div>

                        {/* Label Color (Optional) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Color (Optional)
                          </label>
                          <Input
                            type="text"
                            value={label.color || ''}
                            onChange={(e) => updateLabel(index, 'color', e.target.value || null)}
                            placeholder="#FF0000 or leave empty for default"
                            className="w-full"
                          />
                          <p className="mt-1 text-xs text-gray-500">Hex color code (e.g., #FF0000) or leave empty</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product Variants */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Product Variants</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addVariant}
                >
                  + Add Variant
                </Button>
              </div>
              
              {formData.variants.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-4">No variants added yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addVariant}
                  >
                    Add First Variant
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.variants.map((variant, index) => (
                    <div key={variant.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Variant {index + 1}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeVariant(variant.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* SKU */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            SKU *
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={variant.sku}
                              onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                              placeholder="Auto-generated if empty"
                              className="flex-1"
                              required
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                // Generate unique SKU based on product title and variant index
                                const baseSlug = formData.slug || 'PROD';
                                const variantIndex = formData.variants.findIndex(v => v.id === variant.id);
                                const generatedSku = `${baseSlug.toUpperCase()}-${Date.now()}-${variantIndex + 1}`;
                                updateVariant(variant.id, 'sku', generatedSku);
                              }}
                              className="whitespace-nowrap"
                              title="Գեներացնել SKU"
                            >
                              Գեներացնել
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">SKU-ն պետք է եզակի լինի ամեն վարիանտի համար</p>
                        </div>

                        {/* Colors - Unified selection with images and stock per color */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            <strong>Colors *</strong>
                          </label>
                          
                          {/* Add new color manually */}
                          <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                            <p className="text-sm font-medium text-gray-700 mb-3">
                              Add New Color (Manual):
                            </p>
                            <NewColorSizeInput
                              variantId={variant.id}
                              type="color"
                              onAdd={(name) => addNewColorToVariant(variant.id, name)}
                              placeholder="Enter color name (e.g. Red, Blue)"
                            />

                            {/* Quick Selection Palette */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-2">Quick Add (Click to add):</p>
                              <div className="flex flex-wrap gap-2">
                                {['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Grey', 'Pink', 'Purple', 'Orange', 'Brown', 'Beige'].map((colorName) => {
                                  const hex = getColorHex(colorName);
                                  const isAdded = variant.colors.some(c => c.colorLabel.toLowerCase() === colorName.toLowerCase());
                                  return (
                                    <button
                                      key={colorName}
                                      type="button"
                                      onClick={() => addNewColorToVariant(variant.id, colorName)}
                                      disabled={isAdded}
                                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-all ${
                                        isAdded 
                                          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500 hover:shadow-sm'
                                      }`}
                                    >
                                      <span 
                                        className="w-3 h-3 rounded-full border border-gray-200"
                                        style={{ backgroundColor: hex }}
                                      />
                                      {colorName}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          
                          {/* Color Palette - Checkbox selection */}
                          <div className="space-y-3 mb-6">
                            <p className="text-sm font-medium text-gray-700 mb-2">Select Colors (Color Palette):</p>
                            
                            {/* Colors from attributes */}
                            {getColorAttribute() && getColorAttribute()!.values.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4 border-2 border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto shadow-sm">
                                {getColorAttribute()?.values.map((val) => {
                                  const isSelected = variant.colors.some((c) => c.colorValue === val.value);
                                  const colorHex = getColorHex(val.label);
                                  return (
                                    <label
                                      key={val.id}
                                      className={`flex flex-col items-center justify-center cursor-pointer p-3 rounded-lg border-2 transition-all min-h-[100px] ${
                                        isSelected 
                                          ? 'bg-blue-50 border-blue-600 shadow-md ring-1 ring-blue-600' 
                                          : 'bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleVariantColor(variant.id, val.value, val.label)}
                                        className="sr-only"
                                      />
                                      <div className="relative">
                                        <span
                                          className="inline-block w-10 h-10 rounded-full border-2 border-gray-300 mb-2 shadow-inner"
                                          style={{ backgroundColor: colorHex }}
                                        />
                                        {isSelected && (
                                          <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 border border-white">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </div>
                                        )}
                                      </div>
                                      <span className={`text-sm font-semibold text-center mt-1 truncate w-full ${
                                        isSelected ? 'text-blue-900' : 'text-gray-800'
                                      }`}>
                                        {val.label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            
                            {/* Manually added colors */}
                            {variant.colors.length > 0 && (() => {
                              const manuallyAddedColors = variant.colors.filter(colorData => {
                                const colorAttribute = getColorAttribute();
                                if (!colorAttribute) return true;
                                return !colorAttribute.values.some(v => v.value === colorData.colorValue);
                              });
                              
                              if (manuallyAddedColors.length > 0) {
                                return (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4 border-2 border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto shadow-sm">
                                    {manuallyAddedColors.map((colorData) => {
                                      const isSelected = variant.colors.some((c) => c.colorValue === colorData.colorValue);
                                      const colorHex = getColorHex(colorData.colorLabel);
                                      
                                      return (
                                        <label
                                          key={colorData.colorValue}
                                          className={`flex flex-col items-center justify-center cursor-pointer p-3 rounded-lg border-2 transition-all min-h-[100px] ${
                                            isSelected 
                                              ? 'bg-blue-50 border-blue-600 shadow-md ring-1 ring-blue-600' 
                                              : 'bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleVariantColor(variant.id, colorData.colorValue, colorData.colorLabel)}
                                            className="sr-only"
                                          />
                                          <div className="relative">
                                            <span
                                              className="inline-block w-10 h-10 rounded-full border-2 border-gray-300 mb-2 shadow-inner"
                                              style={{ backgroundColor: colorHex }}
                                            />
                                            {isSelected && (
                                              <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 border border-white">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                              </div>
                                            )}
                                          </div>
                                          <span className={`text-sm font-semibold text-center mt-1 truncate w-full ${
                                            isSelected ? 'text-blue-900' : 'text-gray-800'
                                          }`}>
                                            {colorData.colorLabel}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Show message if no colors available */}
                            {(!getColorAttribute() || getColorAttribute()!.values.length === 0) && 
                             variant.colors.length === 0 && (
                              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center text-gray-500 text-sm">
                                No colors available. Add a new color above.
                              </div>
                            )}
                          </div>
                          
                          {/* Selected Colors with Images and Stock */}
                          {variant.colors.length > 0 && (
                            <div className="space-y-4 mt-6">
                              <p className="text-sm font-semibold text-gray-900 mb-3">
                                Configure each color (Images, Stock, Price, Sizes):
                              </p>
                              
                              {variant.colors.map((colorData, colorIndex) => {
                                const colorHex = getColorHex(colorData.colorLabel);
                                
                                return (
                                  <div key={colorData.colorValue} className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 mr-2">
                                          <input
                                            type="checkbox"
                                            id={`featured-${colorData.colorValue}`}
                                            checked={!!colorData.isFeatured}
                                            onChange={() => setFeaturedColor(variant.id, colorData.colorValue)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                          />
                                          <label 
                                            htmlFor={`featured-${colorData.colorValue}`}
                                            className="text-xs text-gray-500 cursor-pointer hover:text-blue-600 transition-colors"
                                          >
                                            Main
                                          </label>
                                        </div>
                                        <span
                                          className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                                          style={{ backgroundColor: colorHex }}
                                        />
                                        <h4 className="text-base font-semibold text-gray-900">
                                          {colorData.colorLabel}
                                        </h4>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleVariantColor(variant.id, colorData.colorValue, colorData.colorLabel)}
                                        className="text-red-600 hover:text-red-700 text-xs"
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Images for this color */}
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Images for {colorData.colorLabel} *
                                          </label>
                                          
                                          {/* Image Upload */}
                                          <div className="mb-3">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                setColorImageTarget({ variantId: variant.id, colorValue: colorData.colorValue });
                                                colorImageFileInputRef.current?.click();
                                              }}
                                              disabled={imageUploadLoading}
                                              className="w-full text-xs"
                                            >
                                              {imageUploadLoading && colorImageTarget?.colorValue === colorData.colorValue
                                                ? 'Uploading...'
                                                : '+ Upload Images'}
                                            </Button>
                                          </div>
                                          
                                          {/* Display uploaded images */}
                                          {colorData.images.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 mt-3">
                                              {colorData.images.map((imageUrl, imgIndex) => (
                                                <div key={imgIndex} className="relative group">
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img
                                                    src={processImageUrl(imageUrl)}
                                                    alt={`${colorData.colorLabel} ${imgIndex + 1}`}
                                                    className="w-full h-20 object-cover rounded border border-gray-300"
                                                    onError={(e) => {
                                                      const target = e.target as HTMLImageElement;
                                                      target.style.display = 'none';
                                                      // Show a placeholder or error label if needed
                                                      const parent = target.parentElement;
                                                      if (parent) {
                                                        const errorDiv = document.createElement('div');
                                                        errorDiv.className = 'w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-red-500 text-center p-1';
                                                        errorDiv.innerText = 'Broken Image';
                                                        parent.appendChild(errorDiv);
                                                      }
                                                    }}
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeColorImage(variant.id, colorData.colorValue, imgIndex)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove image"
                                                  >
                                                    ×
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          
                                          {colorData.images.length === 0 && (
                                            <p className="text-xs text-gray-500 mt-2">
                                              No images uploaded yet. Click "Upload Images" to add.
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* Stock for this color (if no sizes) */}
                                        {(!isClothingCategory() || (colorData.sizes || []).length === 0) && (
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                              Stock for {colorData.colorLabel} *
                                            </label>
                                            <Input
                                              type="number"
                                              value={colorData.stock}
                                              onChange={(e) => updateColorStock(variant.id, colorData.colorValue, e.target.value)}
                                              placeholder="0"
                                              required
                                              className="w-full"
                                              min="0"
                                            />
                                          </div>
                                        )}
                                        
                                        {/* Price and Discount for this color */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                              Price for {colorData.colorLabel} *
                                            </label>
                                            <Input
                                              type="number"
                                              value={colorData.price || ''}
                                              onChange={(e) => updateColorPrice(variant.id, colorData.colorValue, e.target.value)}
                                              placeholder="0.00"
                                              className="w-full"
                                              required
                                              min="0"
                                              step="0.01"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                              Compare at price (Discount)
                                            </label>
                                            <Input
                                              type="number"
                                              value={colorData.compareAtPrice || ''}
                                              onChange={(e) => updateColorCompareAtPrice(variant.id, colorData.colorValue, e.target.value)}
                                              placeholder="0.00"
                                              className="w-full"
                                              min="0"
                                              step="0.01"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              Show a strike-through price (original price)
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Sizes for this color - only if category requires sizes */}
                                      {isClothingCategory() && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                          <label className="block text-sm font-medium text-gray-700 mb-3">
                                            <strong>Sizes for {colorData.colorLabel} {isClothingCategory() ? '*' : ''}</strong>
                                          </label>
                                          
                                          {/* Add new size section */}
                                          <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                                            <p className="text-sm font-medium text-gray-700 mb-2">
                                              Add New Size:
                                            </p>
                                            <NewColorSizeInput
                                              variantId={variant.id}
                                              type="size"
                                              onAdd={(name) => addNewSizeToColor(variant.id, colorData.colorValue, name)}
                                              placeholder="Enter size name (e.g. S, M, L, XL)"
                                            />
                                          </div>
                                          
                                          {/* Checkbox list for selecting sizes */}
                                          <div className="space-y-3 mb-4">
                                            <p className="text-sm font-medium text-gray-700 mb-2">Select Sizes (checkboxes):</p>
                                            
                                            {/* Sizes from attributes */}
                                            {getSizeAttribute() && getSizeAttribute()!.values.length > 0 && (
                                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-2 border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto shadow-sm">
                                                {getSizeAttribute()?.values.map((val) => {
                                                  const isSelected = (colorData.sizes || []).includes(val.value);
                                                  return (
                                                    <label
                                                      key={val.id}
                                                      className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                                        isSelected 
                                                          ? 'bg-gray-100 border-gray-500 shadow-sm' 
                                                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                                      }`}
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleColorSize(variant.id, colorData.colorValue, val.value)}
                                                        className="w-5 h-5 text-gray-600 border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 cursor-pointer"
                                                      />
                                                      <span className={`text-sm font-medium ${
                                                        isSelected ? 'text-gray-900' : 'text-gray-700'
                                                      }`}>
                                                        {val.label}
                                                      </span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            )}
                                            
                                            {/* Manually added sizes */}
                                            {(colorData.sizes || []).length > 0 && (() => {
                                              const manuallyAddedSizes = (colorData.sizes || []).filter(sizeValue => {
                                                const sizeAttribute = getSizeAttribute();
                                                if (!sizeAttribute) return true;
                                                return !sizeAttribute.values.some(v => v.value === sizeValue);
                                              });
                                              
                                              if (manuallyAddedSizes.length > 0) {
                                                return (
                                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-2 border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto shadow-sm">
                                                    {manuallyAddedSizes.map((sizeValue) => {
                                                      const isSelected = (colorData.sizes || []).includes(sizeValue);
                                                      const savedLabel = colorData.sizeLabels?.[sizeValue];
                                                      const sizeLabel = savedLabel || 
                                                        sizeValue.toUpperCase().replace(/-/g, ' ');
                                                      
                                                      return (
                                                        <label
                                                          key={sizeValue}
                                                          className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                                            isSelected 
                                                              ? 'bg-gray-100 border-gray-500 shadow-sm' 
                                                              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                                          }`}
                                                        >
                                                          <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleColorSize(variant.id, colorData.colorValue, sizeValue)}
                                                            className="w-5 h-5 text-gray-600 border-gray-300 rounded focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 cursor-pointer"
                                                          />
                                                          <span className={`text-sm font-medium ${
                                                            isSelected ? 'text-gray-900' : 'text-gray-700'
                                                          }`}>
                                                            {sizeLabel}
                                                          </span>
                                                        </label>
                                                      );
                                                    })}
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                            
                                            {/* Show message if no sizes available */}
                                            {(!getSizeAttribute() || getSizeAttribute()!.values.length === 0) && 
                                             (colorData.sizes || []).length === 0 && (
                                              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center text-gray-500 text-sm">
                                                {isClothingCategory() 
                                                  ? 'No sizes available. Add a new size above.' 
                                                  : 'No sizes available.'}
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Stock inputs for each selected size */}
                                          {(colorData.sizes || []).length > 0 && (
                                            <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-md border border-gray-200">
                                              <p className="text-sm font-medium text-gray-700 mb-3">
                                                Stock for each size:
                                              </p>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(colorData.sizes || []).map((sizeValue) => {
                                                  const sizeFromAttribute = getSizeAttribute()?.values.find(
                                                    (v) => v.value === sizeValue
                                                  );
                                                  const savedLabel = colorData.sizeLabels?.[sizeValue];
                                                  const sizeLabel = sizeFromAttribute?.label || 
                                                    savedLabel || 
                                                    sizeValue.toUpperCase().replace(/-/g, ' ');
                                                  const stockValue = (colorData.sizeStocks || {})[sizeValue] !== undefined && (colorData.sizeStocks || {})[sizeValue] !== null
                                                    ? String((colorData.sizeStocks || {})[sizeValue])
                                                    : '';
                                                  
                                                  return (
                                                    <div key={sizeValue} className="flex items-center gap-2">
                                                      <label className="text-sm text-gray-700 min-w-[80px] font-medium">
                                                        {sizeLabel}:
                                                      </label>
                                                      <Input
                                                        type="number"
                                                        value={stockValue}
                                                        onChange={(e) => updateColorSizeStock(variant.id, colorData.colorValue, sizeValue, e.target.value)}
                                                        placeholder="0"
                                                        required
                                                        className="flex-1"
                                                        min="0"
                                                      />
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Validation message */}
                                          {isClothingCategory() && 
                                           (colorData.sizes || []).length === 0 && (
                                            <p className="mt-2 text-sm text-red-600">
                                              At least one size is required for this category
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Option to add to global attributes */}
                          {getColorAttribute() && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                              <p className="text-xs text-gray-600 mb-2">
                                Or add color to global attributes (for all products):
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  value={newColorName}
                                  onChange={(e) => setNewColorName(e.target.value)}
                                  placeholder="Enter color name"
                                  className="flex-1"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddColor();
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleAddColor}
                                  disabled={addingColor || !newColorName.trim()}
                                  className="whitespace-nowrap text-xs"
                                >
                                  {addingColor ? 'Adding...' : '+ Add to Attributes'}
                                </Button>
                              </div>
                              {colorMessage && (
                                <div className={`mt-2 text-xs px-2 py-1 rounded ${
                                  colorMessage.type === 'success' 
                                    ? 'bg-green-50 text-green-700 border border-green-200' 
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                  {colorMessage.text}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Publishing */}
            <div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={(e) => setFormData((prev) => ({ ...prev, published: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Publish immediately</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData((prev) => ({ ...prev, featured: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <span aria-hidden="true">⭐</span>
                    Mark as Featured (for homepage tab)
                  </span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Product' : 'Create Product')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/admin')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
            {/* Hidden input for color image uploads */}
            <input
              ref={colorImageFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUploadColorImages}
            />
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AddProductPageContent />
    </Suspense>
  );
}

