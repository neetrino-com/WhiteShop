'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
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
  sizePrices?: Record<string, string>; // Price для каждого размера этого цвета: { "S": "100", "M": "120" }
  sizeCompareAtPrices?: Record<string, string>; // CompareAtPrice для каждого размера: { "S": "150", "M": "180" }
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
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [addingAttributeValue, setAddingAttributeValue] = useState(false);
  const [deletingAttribute, setDeletingAttribute] = useState<string | null>(null);
  const [deletingAttributeValue, setDeletingAttributeValue] = useState<string | null>(null);
  
  // Matrix Variant Builder state
  const [matrixSelectedColors, setMatrixSelectedColors] = useState<string[]>([]); // Array of color values
  const [matrixSelectedSizes, setMatrixSelectedSizes] = useState<string[]>([]); // Array of size values
  const [matrixVariants, setMatrixVariants] = useState<Record<string, {
    price: string;
    compareAtPrice: string;
    stock: string;
    sku: string;
    image: string | null; // Single image for this matrix cell
  }>>({}); // Key: "colorValue-sizeValue", Value: variant data
  const [useMatrixBuilder, setUseMatrixBuilder] = useState(false);
  const matrixImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [matrixImageTarget, setMatrixImageTarget] = useState<string | null>(null); // Key of the matrix cell

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
        // Debug: Log attributes details
        if (attributesRes.data && attributesRes.data.length > 0) {
          console.log('📋 [ADMIN] Attributes loaded:', attributesRes.data.map(attr => ({
            id: attr.id,
            key: attr.key,
            name: attr.name,
            valuesCount: attr.values?.length || 0,
            values: attr.values?.map(v => ({ value: v.value, label: v.label })) || []
          })));
          const colorAttr = attributesRes.data.find(a => a.key === 'color');
          const sizeAttr = attributesRes.data.find(a => a.key === 'size');
          if (!colorAttr) {
            console.warn('⚠️ [ADMIN] Color attribute not found in loaded attributes!');
          } else {
            console.log('✅ [ADMIN] Color attribute found:', { id: colorAttr.id, valuesCount: colorAttr.values?.length || 0 });
          }
          if (!sizeAttr) {
            console.warn('⚠️ [ADMIN] Size attribute not found in loaded attributes!');
          } else {
            console.log('✅ [ADMIN] Size attribute found:', { id: sizeAttr.id, valuesCount: sizeAttr.values?.length || 0 });
          }
        } else {
          console.warn('⚠️ [ADMIN] No attributes loaded! This may cause issues with variant builder.');
        }
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
            // Try to get color from variant.color (old format) or from variant.options (new format)
            let color = variant.color || '';
            let size = variant.size || '';
            
            // If color is empty, try to get from options
            if (!color && variant.options && Array.isArray(variant.options)) {
              const colorOption = variant.options.find((opt: any) => 
                opt.attributeKey === 'color' || opt.key === 'color' || opt.attribute === 'color'
              );
              if (colorOption) {
                color = colorOption.value || '';
              }
            }
            
            // If size is empty, try to get from options
            if (!size && variant.options && Array.isArray(variant.options)) {
              const sizeOption = variant.options.find((opt: any) => 
                opt.attributeKey === 'size' || opt.key === 'size' || opt.attribute === 'size'
              );
              if (sizeOption) {
                size = sizeOption.value || '';
              }
            }
            
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

  // Upload image for a specific matrix cell (single image only)
  const handleUploadMatrixImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !matrixImageTarget) {
      console.log('⚠️ [ADMIN] No files or no matrix target:', { filesLength: files.length, matrixImageTarget });
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    const imageFile = files.find((file) => file.type.startsWith('image/'));
    if (!imageFile) {
      alert('Please select an image file');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    try {
      setImageUploadLoading(true);
      console.log('📤 [ADMIN] Starting upload for matrix cell:', matrixImageTarget);
      
      const uploadedImage = await fileToBase64(imageFile);
      console.log('✅ [ADMIN] Image converted to base64, length:', uploadedImage.length);

      console.log('📥 [ADMIN] Image converted, adding to matrix cell:', {
        cellKey: matrixImageTarget
      });
      
      setMatrixVariants((prev) => {
        // When colors and sizes both exist, store image with colorValue key (row-based)
        // Otherwise, store with the provided key (cell-based or single)
        const currentVariant = prev[matrixImageTarget] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
        
        return {
          ...prev,
          [matrixImageTarget]: {
            ...currentVariant,
            image: uploadedImage
          }
        };
      });
      
      console.log('✅ [ADMIN] Matrix image added to state');
    } catch (error: any) {
      console.error('❌ [ADMIN] Error uploading matrix image:', error);
      alert(error?.message || 'Failed to process selected image');
    } finally {
      setImageUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
      setMatrixImageTarget(null);
    }
  };

  // Remove image from a specific matrix cell
  const removeMatrixImage = (cellKey: string) => {
    setMatrixVariants((prev) => {
      const currentVariant = prev[cellKey] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
      
      return {
        ...prev,
        [cellKey]: {
          ...currentVariant,
          image: null
        }
      };
    });
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

  // Memoize color and size attributes to avoid unnecessary recalculations
  const colorAttribute = useMemo(() => {
    if (!attributes || attributes.length === 0) {
      return undefined;
    }
    const colorAttr = attributes.find((attr) => attr.key === 'color');
    if (!colorAttr) {
      console.log('⚠️ [ADMIN] Color attribute not found. Available attributes:', attributes.map(a => ({ key: a.key, name: a.name })));
    } else {
      console.log('✅ [ADMIN] Color attribute found:', { id: colorAttr.id, key: colorAttr.key, valuesCount: colorAttr.values?.length || 0 });
    }
    return colorAttr;
  }, [attributes]);

  const sizeAttribute = useMemo(() => {
    if (!attributes || attributes.length === 0) {
      return undefined;
    }
    const sizeAttr = attributes.find((attr) => attr.key === 'size');
    if (!sizeAttr) {
      console.log('⚠️ [ADMIN] Size attribute not found. Available attributes:', attributes.map(a => ({ key: a.key, name: a.name })));
    } else {
      console.log('✅ [ADMIN] Size attribute found:', { id: sizeAttr.id, key: sizeAttr.key, valuesCount: sizeAttr.values?.length || 0 });
    }
    return sizeAttr;
  }, [attributes]);

  // Keep getColorAttribute and getSizeAttribute for backward compatibility
  const getColorAttribute = () => colorAttribute;
  const getSizeAttribute = () => sizeAttribute;

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
      console.log('🔍 [ADMIN] Validating variants before submit:', {
        variantsCount: formData.variants.length,
        variants: formData.variants,
        useMatrixBuilder,
      });
      
      if (formData.variants.length === 0) {
        if (useMatrixBuilder) {
          alert('Please use "Generate Variants from Matrix" button to create variants from the matrix builder.');
        } else {
          alert('Please add at least one product variant. You can use the Matrix Builder (recommended) or add variants manually.');
        }
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
              // First check if there's a specific SKU for this size in sizeLabels (from Matrix)
              let finalSku = colorData.sizeLabels?.[size] || undefined;
              
              // If no specific SKU, use variant base SKU with suffix
              if (!finalSku || finalSku === '') {
                finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
              }
              
              // If still no SKU, generate one
              if (!finalSku || finalSku === '') {
                const baseSlug = formData.slug || 'PROD';
                finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${colorIndex + 1}-${sizeIndex + 1}`;
              }
              
              // Сохраняем все изображения цвета через запятую в imageUrl
              const variantImageUrl = colorData.images && colorData.images.length > 0 
                ? colorData.images.join(',') 
                : undefined;
              
              // Используем цену размера, если указана, иначе цену цвета, иначе цену варианта
              const sizePrice = colorData.sizePrices?.[size];
              const finalPrice = sizePrice && sizePrice.trim() !== ''
                ? parseFloat(sizePrice)
                : (colorData.price && colorData.price.trim() !== '' 
                  ? parseFloat(colorData.price) 
                  : baseVariantData.price);
              
              // Используем compareAtPrice размера, если указана, иначе compareAtPrice цвета, иначе compareAtPrice варианта
              const sizeCompareAtPrice = colorData.sizeCompareAtPrices?.[size];
              const finalCompareAtPrice = sizeCompareAtPrice && sizeCompareAtPrice.trim() !== ''
                ? parseFloat(sizeCompareAtPrice)
                : (colorData.compareAtPrice && colorData.compareAtPrice.trim() !== ''
                  ? parseFloat(colorData.compareAtPrice)
                  : baseVariantData.compareAtPrice);
              
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

      // Collect attribute IDs from variants (color and size attributes)
      const attributeIdsSet = new Set<string>();
      const colorAttribute = getColorAttribute();
      const sizeAttribute = getSizeAttribute();
      if (colorAttribute) {
        attributeIdsSet.add(colorAttribute.id);
      }
      if (sizeAttribute) {
        attributeIdsSet.add(sizeAttribute.id);
      }
      const attributeIds = Array.from(attributeIdsSet);

      // Prepare payload
      const payload: any = {
        title: formData.title,
        slug: formData.slug,
        descriptionHtml: formData.descriptionHtml || undefined,
        brandId: finalBrandId || undefined,
        primaryCategoryId: finalPrimaryCategoryId || undefined,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
        published: formData.published,
        featured: formData.featured,
        locale: 'en',
        variants: variants,
        attributeIds: attributeIds.length > 0 ? attributeIds : undefined,
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


  // Create new attribute
  const handleCreateAttribute = async () => {
    if (!newAttributeName.trim()) {
      alert('Attribute name is required');
      return;
    }

    // Auto-generate key from name (lowercase, replace spaces with hyphens)
    const autoKey = newAttributeName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    try {
      setAddingAttribute(true);
      const response = await apiClient.post<{ data: Attribute }>('/api/v1/admin/attributes', {
        name: newAttributeName.trim(),
        key: autoKey,
        type: 'select',
        filterable: true,
        locale: 'en',
      });

      if (response.data) {
        setAttributes((prev) => [...prev, response.data]);
        setNewAttributeName('');
        setSelectedAttributeId(response.data.id);
        setAddingAttribute(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create attribute');
      setAddingAttribute(false);
    }
  };

  // Add attribute value
  const handleAddAttributeValue = async () => {
    if (!selectedAttributeId || !newAttributeValue.trim()) {
      alert('Please select an attribute and enter a value');
      return;
    }

    try {
      setAddingAttributeValue(true);
      const response = await apiClient.post<{ data: Attribute }>(
        `/api/v1/admin/attributes/${selectedAttributeId}/values`,
        {
          label: newAttributeValue.trim(),
          locale: 'en',
        }
      );

      if (response.data) {
        setAttributes((prev) =>
          prev.map((attr) => (attr.id === selectedAttributeId ? response.data : attr))
        );
        setNewAttributeValue('');
        setAddingAttributeValue(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add attribute value');
      setAddingAttributeValue(false);
    }
  };

  // Delete attribute
  const handleDeleteAttribute = async (attributeId: string) => {
    if (!confirm('Are you sure you want to delete this attribute? This will also delete all its values.')) {
      return;
    }

    try {
      setDeletingAttribute(attributeId);
      await apiClient.delete(`/api/v1/admin/attributes/${attributeId}`);
      setAttributes((prev) => prev.filter((attr) => attr.id !== attributeId));
      if (selectedAttributeId === attributeId) {
        setSelectedAttributeId(null);
      }
      setDeletingAttribute(null);
    } catch (err: any) {
      alert(err?.data?.detail || err.message || 'Failed to delete attribute');
      setDeletingAttribute(null);
    }
  };

  // Delete attribute value
  const handleDeleteAttributeValue = async (valueId: string) => {
    if (!selectedAttributeId) return;

    if (!confirm('Are you sure you want to delete this value?')) {
      return;
    }

    try {
      setDeletingAttributeValue(valueId);
      const response = await apiClient.delete<{ data: Attribute }>(
        `/api/v1/admin/attributes/${selectedAttributeId}/values/${valueId}`
      );

      if (response.data) {
        setAttributes((prev) =>
          prev.map((attr) => (attr.id === selectedAttributeId ? response.data : attr))
        );
        setDeletingAttributeValue(null);
      }
    } catch (err: any) {
      alert(err?.data?.detail || err.message || 'Failed to delete attribute value');
      setDeletingAttributeValue(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content */}
        <div>
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push('/admin')}
                className="text-gray-600 hover:text-gray-900 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Admin Panel
              </button>
            </div>
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

            {/* Attributes Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Attributes</h2>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                {/* Select/Create Attribute */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Select Attribute:</label>
                  <select
                    value={selectedAttributeId || ''}
                    onChange={(e) => setSelectedAttributeId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Attribute --</option>
                    {attributes.map((attr) => (
                      <option key={attr.id} value={attr.id}>
                        {attr.name}
                      </option>
                    ))}
                  </select>

                  {/* Create New Attribute */}
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium text-gray-700">Create New Attribute:</label>
                    <Input
                      type="text"
                      value={newAttributeName}
                      onChange={(e) => setNewAttributeName(e.target.value)}
                      placeholder="Attribute Name (e.g., Color, Size, Material)"
                      className="w-full"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateAttribute();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCreateAttribute}
                      disabled={addingAttribute || !newAttributeName.trim()}
                      className="w-full"
                    >
                      {addingAttribute ? 'Creating...' : 'Create Attribute'}
                    </Button>
                    {newAttributeName.trim() && (
                      <p className="text-xs text-gray-500">
                        Key will be auto-generated: <span className="font-mono">{newAttributeName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span>
                      </p>
                    )}
                  </div>

                  {/* Add Attribute Value */}
                  {selectedAttributeId && (
                    <div className="space-y-2 pt-2 border-t">
                      <label className="text-sm font-medium text-gray-700">
                        Add Value to "{attributes.find((a) => a.id === selectedAttributeId)?.name}":
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={newAttributeValue}
                          onChange={(e) => setNewAttributeValue(e.target.value)}
                          placeholder="Value (e.g., Red)"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAttributeValue();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddAttributeValue}
                          disabled={addingAttributeValue || !newAttributeValue.trim()}
                        >
                          {addingAttributeValue ? '...' : '+'}
                        </Button>
                      </div>

                      {/* Show existing values */}
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {attributes
                          .find((a) => a.id === selectedAttributeId)
                          ?.values.map((val) => (
                            <div
                              key={val.id}
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md group"
                            >
                              <span className="text-sm text-gray-700">{val.label}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAttributeValue(val.id)}
                                disabled={deletingAttributeValue === val.id}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete value"
                              >
                                {deletingAttributeValue === val.id ? (
                                  <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Product Variants Display */}
            {!useMatrixBuilder && formData.variants.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Product Variants</h2>
                  <span className="text-sm text-gray-500">
                    {formData.variants.length} variant(s) created
                  </span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
                  {formData.variants.map((variant, variantIndex) => (
                    <div key={variant.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          Variant {variantIndex + 1}
                        </h3>
                        <div className="text-sm text-gray-600">
                          {variant.sku && <span>SKU: {variant.sku}</span>}
                        </div>
                      </div>
                      {variant.colors && variant.colors.length > 0 ? (
                        <div className="space-y-4">
                          {variant.colors.map((colorData, colorIndex) => {
                            const colorHex = getColorHex(colorData.colorLabel);
                            return (
                              <div key={colorIndex} className="border border-gray-200 rounded-lg p-4 bg-white">
                                <div className="flex items-center gap-3 mb-3">
                                  <span
                                    className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                                    style={{ backgroundColor: colorHex }}
                                  />
                                  <span className="text-base font-semibold text-gray-900">
                                    {colorData.colorLabel}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                  {colorData.price && (
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Price</label>
                                      <div className="text-sm font-medium text-gray-900">{colorData.price}</div>
                                    </div>
                                  )}
                                  {colorData.stock && (
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Stock</label>
                                      <div className="text-sm font-medium text-gray-900">{colorData.stock}</div>
                                    </div>
                                  )}
                                </div>
                                {colorData.sizes && colorData.sizes.length > 0 && (
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-2">Sizes & Stock</label>
                                    <div className="flex flex-wrap gap-2">
                                      {colorData.sizes.map((sizeValue) => {
                                        const sizeLabel = getSizeAttribute()?.values.find(v => v.value === sizeValue)?.label || sizeValue;
                                        const sizeStock = colorData.sizeStocks?.[sizeValue] || '0';
                                        return (
                                          <div key={sizeValue} className="px-3 py-1 bg-blue-50 border border-blue-200 rounded text-sm">
                                            <span className="font-medium text-gray-900">{sizeLabel}</span>
                                            {sizeStock && <span className="text-gray-600 ml-2">({sizeStock})</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {colorData.images && colorData.images.length > 0 && (
                                  <div className="mt-3">
                                    <label className="block text-xs text-gray-500 mb-2">Images</label>
                                    <div className="flex gap-2 flex-wrap">
                                      {colorData.images.map((img, imgIndex) => (
                                        <img
                                          key={imgIndex}
                                          src={img}
                                          alt={`${colorData.colorLabel} ${imgIndex + 1}`}
                                          className="w-20 h-20 object-cover rounded border border-gray-300"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No colors added</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matrix Variant Builder */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Variant Builder</h2>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMatrixBuilder}
                      onChange={(e) => {
                        setUseMatrixBuilder(e.target.checked);
                        if (!e.target.checked) {
                          // Clear matrix data when disabling
                          setMatrixSelectedColors([]);
                          setMatrixSelectedSizes([]);
                          setMatrixVariants({});
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Use Matrix Builder (Recommended)</span>
                  </label>
                </div>
              </div>

              {useMatrixBuilder ? (
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
                  {/* Select Colors and Sizes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Colors Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Colors (Optional)
                      </label>
                      {colorAttribute && colorAttribute.values && colorAttribute.values.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4 border-2 border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto">
                          {colorAttribute.values.map((val) => {
                            const isSelected = matrixSelectedColors.includes(val.value);
                            const colorHex = getColorHex(val.label);
                            return (
                              <label
                                key={val.id}
                                className={`flex flex-col items-center justify-center cursor-pointer p-2 rounded-lg border-2 transition-all ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-600 shadow-md' 
                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setMatrixSelectedColors([...matrixSelectedColors, val.value]);
                                    } else {
                                      setMatrixSelectedColors(matrixSelectedColors.filter(c => c !== val.value));
                                      // Remove variants for this color
                                      const newMatrixVariants = { ...matrixVariants };
                                      matrixSelectedSizes.forEach(size => {
                                        delete newMatrixVariants[`${val.value}-${size}`];
                                      });
                                      setMatrixVariants(newMatrixVariants);
                                    }
                                  }}
                                  className="sr-only"
                                />
                                <span
                                  className="inline-block w-8 h-8 rounded-full border-2 border-gray-300 mb-1 shadow-inner"
                                  style={{ backgroundColor: colorHex }}
                                />
                                <span className={`text-xs font-medium text-center truncate w-full ${
                                  isSelected ? 'text-blue-900' : 'text-gray-800'
                                }`}>
                                  {val.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center text-gray-500 text-sm">
                          No colors available. Add colors in Attributes section above.
                        </div>
                      )}
                    </div>

                    {/* Sizes Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Sizes {isClothingCategory() ? '*' : '(Optional)'}
                      </label>
                      {sizeAttribute && sizeAttribute.values && sizeAttribute.values.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4 border-2 border-gray-300 rounded-lg bg-white max-h-64 overflow-y-auto">
                          {sizeAttribute.values.map((val) => {
                            const isSelected = matrixSelectedSizes.includes(val.value);
                            return (
                              <label
                                key={val.id}
                                className={`flex items-center justify-center cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-600 shadow-md' 
                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setMatrixSelectedSizes([...matrixSelectedSizes, val.value]);
                                    } else {
                                      setMatrixSelectedSizes(matrixSelectedSizes.filter(s => s !== val.value));
                                      // Remove variants for this size
                                      const newMatrixVariants = { ...matrixVariants };
                                      matrixSelectedColors.forEach(color => {
                                        delete newMatrixVariants[`${color}-${val.value}`];
                                      });
                                      setMatrixVariants(newMatrixVariants);
                                    }
                                  }}
                                  className="sr-only"
                                />
                                <span className={`text-sm font-semibold ${
                                  isSelected ? 'text-blue-900' : 'text-gray-800'
                                }`}>
                                  {val.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center text-gray-500 text-sm">
                          {isClothingCategory() 
                            ? 'No sizes available. Add sizes in Attributes section above.' 
                            : 'No sizes available. Sizes are optional for this category.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Matrix Table */}
                  {((matrixSelectedColors.length > 0 || matrixSelectedSizes.length > 0) || (!isClothingCategory() && matrixSelectedColors.length === 0 && matrixSelectedSizes.length === 0)) ? (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Variant Matrix {
                            matrixSelectedColors.length > 0 && matrixSelectedSizes.length > 0
                              ? `(${matrixSelectedColors.length} colors × ${matrixSelectedSizes.length} sizes)`
                              : matrixSelectedColors.length > 0
                              ? `(${matrixSelectedColors.length} colors)`
                              : matrixSelectedSizes.length > 0
                              ? `(${matrixSelectedSizes.length} sizes)`
                              : '(Single variant)'
                          }
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Generate SKU for all variants
                              const baseSlug = formData.slug || generateSlug(formData.title) || 'PROD';
                              const newMatrixVariants = { ...matrixVariants };
                              
                              if (matrixSelectedColors.length > 0) {
                                matrixSelectedColors.forEach((colorValue) => {
                                  if (matrixSelectedSizes.length > 0) {
                                    matrixSelectedSizes.forEach((sizeValue) => {
                                      const key = `${colorValue}-${sizeValue}`;
                                      const currentVariant = newMatrixVariants[key] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
                                      newMatrixVariants[key] = {
                                        ...currentVariant,
                                        sku: `${baseSlug.toUpperCase()}-${colorValue.toUpperCase()}-${sizeValue.toUpperCase()}`,
                                      };
                                    });
                                  } else {
                                    const key = colorValue;
                                    const currentVariant = newMatrixVariants[key] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
                                    newMatrixVariants[key] = {
                                      ...currentVariant,
                                      sku: `${baseSlug.toUpperCase()}-${colorValue.toUpperCase()}`,
                                    };
                                  }
                                });
                              } else if (matrixSelectedSizes.length > 0) {
                                // Only sizes, no colors
                                matrixSelectedSizes.forEach((sizeValue) => {
                                  const key = sizeValue;
                                  const currentVariant = newMatrixVariants[key] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
                                  newMatrixVariants[key] = {
                                    ...currentVariant,
                                    sku: `${baseSlug.toUpperCase()}-${sizeValue.toUpperCase()}`,
                                  };
                                });
                              } else {
                                // Single variant
                                const currentVariant = newMatrixVariants['single'] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
                                newMatrixVariants['single'] = {
                                  ...currentVariant,
                                  sku: baseSlug.toUpperCase(),
                                };
                              }
                              setMatrixVariants(newMatrixVariants);
                            }}
                          >
                            Generate SKU
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                            // Bulk fill all variants with same values
                            const defaultPrice = prompt('Enter default price for all variants:') || '';
                            const defaultStock = prompt('Enter default stock for all variants:') || '';
                            const defaultSku = prompt('Enter SKU prefix (will add -color-size if applicable):') || '';
                            
                            if (defaultPrice || defaultStock || defaultSku) {
                              const newMatrixVariants = { ...matrixVariants };
                              
                              if (matrixSelectedColors.length > 0) {
                                matrixSelectedColors.forEach((colorValue) => {
                                  if (matrixSelectedSizes.length > 0) {
                                    matrixSelectedSizes.forEach((sizeValue) => {
                                      const key = `${colorValue}-${sizeValue}`;
                                      newMatrixVariants[key] = {
                                        price: defaultPrice || newMatrixVariants[key]?.price || '',
                                        compareAtPrice: newMatrixVariants[key]?.compareAtPrice || '',
                                        stock: defaultStock || newMatrixVariants[key]?.stock || '',
                                        sku: defaultSku ? `${defaultSku}-${colorValue}-${sizeValue}` : (newMatrixVariants[key]?.sku || ''),
                                        image: newMatrixVariants[key]?.image || null,
                                      };
                                    });
                                  } else {
                                    const key = colorValue;
                                    newMatrixVariants[key] = {
                                      price: defaultPrice || newMatrixVariants[key]?.price || '',
                                      compareAtPrice: newMatrixVariants[key]?.compareAtPrice || '',
                                      stock: defaultStock || newMatrixVariants[key]?.stock || '',
                                      sku: defaultSku ? `${defaultSku}-${colorValue}` : (newMatrixVariants[key]?.sku || ''),
                                      image: newMatrixVariants[key]?.image || null,
                                    };
                                  }
                                });
                              } else if (matrixSelectedSizes.length > 0) {
                                // Only sizes, no colors
                                matrixSelectedSizes.forEach((sizeValue) => {
                                  const key = sizeValue;
                                  newMatrixVariants[key] = {
                                    price: defaultPrice || newMatrixVariants[key]?.price || '',
                                    compareAtPrice: newMatrixVariants[key]?.compareAtPrice || '',
                                    stock: defaultStock || newMatrixVariants[key]?.stock || '',
                                    sku: defaultSku ? `${defaultSku}-${sizeValue}` : (newMatrixVariants[key]?.sku || ''),
                                    image: newMatrixVariants[key]?.image || null,
                                  };
                                });
                              } else {
                                // Single variant
                                newMatrixVariants['single'] = {
                                  price: defaultPrice || newMatrixVariants['single']?.price || '',
                                  compareAtPrice: newMatrixVariants['single']?.compareAtPrice || '',
                                  stock: defaultStock || newMatrixVariants['single']?.stock || '',
                                  sku: defaultSku || (newMatrixVariants['single']?.sku || ''),
                                  image: newMatrixVariants['single']?.image || null,
                                };
                              }
                              setMatrixVariants(newMatrixVariants);
                            }
                          }}
                        >
                          Bulk Fill
                        </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-gray-300 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 bg-white">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">
                                {matrixSelectedColors.length > 0 ? 'Color / Size' : matrixSelectedSizes.length > 0 ? 'Size' : 'Variant'}
                              </th>
                              {matrixSelectedSizes.length > 0 ? (
                                matrixSelectedSizes.map((sizeValue) => {
                                  const sizeLabel = getSizeAttribute()?.values.find(v => v.value === sizeValue)?.label || sizeValue;
                                  return (
                                    <th key={sizeValue} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r last:border-r-0">
                                      {sizeLabel}
                                    </th>
                                  );
                                })
                              ) : (
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Variant
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {matrixSelectedColors.length > 0 ? (
                              matrixSelectedColors.map((colorValue) => {
                              const colorLabel = getColorAttribute()?.values.find(v => v.value === colorValue)?.label || colorValue;
                              const colorHex = getColorHex(colorLabel);
                              
                              return (
                                <tr key={colorValue} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                                          style={{ backgroundColor: colorHex }}
                                        />
                                        <span className="text-sm font-medium text-gray-900">{colorLabel}</span>
                                      </div>
                                      {/* Image Upload Section - Per Row */}
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">Image</label>
                                        <div className="space-y-2">
                                          {/* Preview existing image */}
                                          {matrixVariants[colorValue]?.image && (
                                            <div className="relative group mb-2">
                                              <img
                                                src={matrixVariants[colorValue].image || ''}
                                                alt="Preview"
                                                className="w-full h-24 object-cover rounded border border-gray-300"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => removeMatrixImage(colorValue)}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Remove image"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          )}
                                          {/* Upload button */}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setMatrixImageTarget(colorValue);
                                              matrixImageFileInputRef.current?.click();
                                            }}
                                            disabled={imageUploadLoading}
                                            className="w-full text-xs"
                                          >
                                            {imageUploadLoading && matrixImageTarget === colorValue ? 'Uploading...' : matrixVariants[colorValue]?.image ? 'Change Image' : '+ Add Image'}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  {matrixSelectedSizes.length > 0 ? (
                                    matrixSelectedSizes.map((sizeValue) => {
                                      const sizeLabel = getSizeAttribute()?.values.find(v => v.value === sizeValue)?.label || sizeValue;
                                      const key = `${colorValue}-${sizeValue}`;
                                      const variant = matrixVariants[key] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
                                      
                                      return (
                                        <td key={sizeValue} className="px-4 py-3 border-r last:border-r-0">
                                          <div className="space-y-2 min-w-[200px]">
                                            <div>
                                              <label className="block text-xs text-gray-500 mb-1">Price *</label>
                                              <Input
                                                type="number"
                                                value={variant.price}
                                                onChange={(e) => {
                                                  setMatrixVariants({
                                                    ...matrixVariants,
                                                    [key]: { ...variant, price: e.target.value }
                                                  });
                                                }}
                                                placeholder="0.00"
                                                className="w-full text-sm"
                                                min="0"
                                                step="0.01"
                                                required
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-500 mb-1">Compare At Price</label>
                                              <Input
                                                type="number"
                                                value={variant.compareAtPrice}
                                                onChange={(e) => {
                                                  setMatrixVariants({
                                                    ...matrixVariants,
                                                    [key]: { ...variant, compareAtPrice: e.target.value }
                                                  });
                                                }}
                                                placeholder="0.00"
                                                className="w-full text-sm"
                                                min="0"
                                                step="0.01"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-500 mb-1">Stock *</label>
                                              <Input
                                                type="number"
                                                value={variant.stock}
                                                onChange={(e) => {
                                                  setMatrixVariants({
                                                    ...matrixVariants,
                                                    [key]: { ...variant, stock: e.target.value }
                                                  });
                                                }}
                                                placeholder="0"
                                                className="w-full text-sm"
                                                min="0"
                                                required
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                              <Input
                                                type="text"
                                                value={variant.sku}
                                                onChange={(e) => {
                                                  setMatrixVariants({
                                                    ...matrixVariants,
                                                    [key]: { ...variant, sku: e.target.value }
                                                  });
                                                }}
                                                placeholder="Auto-generated"
                                                className="w-full text-sm"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    })
                                  ) : (
                                    <td className="px-4 py-3">
                                      <div className="space-y-2 min-w-[200px]">
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Price *</label>
                                          <Input
                                            type="number"
                                            value={matrixVariants[colorValue]?.price || ''}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [colorValue]: { 
                                                  ...(matrixVariants[colorValue] || { compareAtPrice: '', stock: '', sku: '', image: null }), 
                                                  price: e.target.value 
                                                }
                                              });
                                            }}
                                            placeholder="0.00"
                                            className="w-full text-sm"
                                            min="0"
                                            step="0.01"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Compare At Price</label>
                                          <Input
                                            type="number"
                                            value={matrixVariants[colorValue]?.compareAtPrice || ''}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [colorValue]: { 
                                                  ...(matrixVariants[colorValue] || { price: '', stock: '', sku: '', image: null }), 
                                                  compareAtPrice: e.target.value 
                                                }
                                              });
                                            }}
                                            placeholder="0.00"
                                            className="w-full text-sm"
                                            min="0"
                                            step="0.01"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Stock *</label>
                                          <Input
                                            type="number"
                                            value={matrixVariants[colorValue]?.stock || ''}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [colorValue]: { 
                                                  ...(matrixVariants[colorValue] || { price: '', compareAtPrice: '', sku: '', image: null }), 
                                                  stock: e.target.value 
                                                }
                                              });
                                            }}
                                            placeholder="0"
                                            className="w-full text-sm"
                                            min="0"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                          <Input
                                            type="text"
                                            value={matrixVariants[colorValue]?.sku || ''}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [colorValue]: { 
                                                  ...(matrixVariants[colorValue] || { price: '', compareAtPrice: '', stock: '', image: null }), 
                                                  sku: e.target.value 
                                                }
                                              });
                                            }}
                                            placeholder="Auto-generated"
                                            className="w-full text-sm"
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                            ) : matrixSelectedSizes.length > 0 ? (
                              // Only sizes, no colors
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r">
                                  <span className="text-sm font-medium text-gray-900">Sizes</span>
                                </td>
                                {matrixSelectedSizes.map((sizeValue) => {
                                  const sizeLabel = getSizeAttribute()?.values.find(v => v.value === sizeValue)?.label || sizeValue;
                                  const key = sizeValue;
                                  const variant = matrixVariants[key] || { price: '', compareAtPrice: '', stock: '', sku: '', image: null };
                                  
                                  return (
                                    <td key={sizeValue} className="px-4 py-3 border-r last:border-r-0">
                                      <div className="space-y-2 min-w-[200px]">
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Price *</label>
                                          <Input
                                            type="number"
                                            value={variant.price}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [key]: { ...variant, price: e.target.value }
                                              });
                                            }}
                                            placeholder="0.00"
                                            className="w-full text-sm"
                                            min="0"
                                            step="0.01"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Compare At Price</label>
                                          <Input
                                            type="number"
                                            value={variant.compareAtPrice}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [key]: { ...variant, compareAtPrice: e.target.value }
                                              });
                                            }}
                                            placeholder="0.00"
                                            className="w-full text-sm"
                                            min="0"
                                            step="0.01"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">Stock *</label>
                                          <Input
                                            type="number"
                                            value={variant.stock}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [key]: { ...variant, stock: e.target.value }
                                              });
                                            }}
                                            placeholder="0"
                                            className="w-full text-sm"
                                            min="0"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                          <Input
                                            type="text"
                                            value={variant.sku}
                                            onChange={(e) => {
                                              setMatrixVariants({
                                                ...matrixVariants,
                                                [key]: { ...variant, sku: e.target.value }
                                              });
                                            }}
                                            placeholder="Auto-generated"
                                            className="w-full text-sm"
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ) : (
                              // No colors, no sizes - single variant
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r">
                                  <span className="text-sm font-medium text-gray-900">Single Variant</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-2 min-w-[200px]">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Price *</label>
                                      <Input
                                        type="number"
                                        value={matrixVariants['single']?.price || ''}
                                        onChange={(e) => {
                                          setMatrixVariants({
                                            ...matrixVariants,
                                            'single': { 
                                              ...(matrixVariants['single'] || { compareAtPrice: '', stock: '', sku: '' }), 
                                              price: e.target.value 
                                            }
                                          });
                                        }}
                                        placeholder="0.00"
                                        className="w-full text-sm"
                                        min="0"
                                        step="0.01"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Compare At Price</label>
                                      <Input
                                        type="number"
                                        value={matrixVariants['single']?.compareAtPrice || ''}
                                        onChange={(e) => {
                                          setMatrixVariants({
                                            ...matrixVariants,
                                            'single': { 
                                              ...(matrixVariants['single'] || { price: '', stock: '', sku: '' }), 
                                              compareAtPrice: e.target.value 
                                            }
                                          });
                                        }}
                                        placeholder="0.00"
                                        className="w-full text-sm"
                                        min="0"
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Stock *</label>
                                      <Input
                                        type="number"
                                        value={matrixVariants['single']?.stock || ''}
                                        onChange={(e) => {
                                          setMatrixVariants({
                                            ...matrixVariants,
                                            'single': { 
                                              ...(matrixVariants['single'] || { price: '', compareAtPrice: '', sku: '', images: [] }), 
                                              stock: e.target.value 
                                            }
                                          });
                                        }}
                                        placeholder="0"
                                        className="w-full text-sm"
                                        min="0"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                      <Input
                                        type="text"
                                        value={matrixVariants['single']?.sku || ''}
                                        onChange={(e) => {
                                          setMatrixVariants({
                                            ...matrixVariants,
                                            'single': { 
                                              ...(matrixVariants['single'] || { price: '', compareAtPrice: '', stock: '', images: [] }), 
                                              sku: e.target.value 
                                            }
                                          });
                                        }}
                                        placeholder="Auto-generated"
                                        className="w-full text-sm"
                                      />
                                    </div>
                                    {/* Image Upload Section */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Image</label>
                                      <div className="space-y-2">
                                        {/* Preview existing image */}
                                        {matrixVariants['single']?.image && (
                                          <div className="relative group mb-2">
                                            <img
                                              src={matrixVariants['single'].image}
                                              alt="Preview"
                                              className="w-full h-24 object-cover rounded border border-gray-300"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => removeMatrixImage('single')}
                                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Remove image"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        )}
                                        {/* Upload button */}
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setMatrixImageTarget('single');
                                            matrixImageFileInputRef.current?.click();
                                          }}
                                          disabled={imageUploadLoading}
                                          className="w-full text-xs"
                                        >
                                          {imageUploadLoading && matrixImageTarget === 'single' ? 'Uploading...' : matrixVariants['single']?.image ? 'Change Image' : '+ Add Image'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          onClick={() => {
                            // Convert matrix variants to formData.variants structure
                            // Create variants from matrix
                            const newVariants: Variant[] = [];
                            
                            if (matrixSelectedColors.length > 0) {
                              // Group by color (one variant per color with all its sizes)
                              matrixSelectedColors.forEach((colorValue) => {
                              const colorLabel = getColorAttribute()?.values.find(v => v.value === colorValue)?.label || colorValue;
                              
                              const variant: Variant = {
                                id: `variant-${Date.now()}-${colorValue}`,
                                price: '', // Will be set per color
                                compareAtPrice: '',
                                sku: '',
                                colors: [{
                                  colorValue,
                                  colorLabel,
                                  images: [],
                                  stock: matrixSelectedSizes.length === 0 ? (matrixVariants[colorValue]?.stock || '') : '',
                                  price: matrixSelectedSizes.length === 0 ? (matrixVariants[colorValue]?.price || '') : undefined,
                                  compareAtPrice: matrixSelectedSizes.length === 0 ? (matrixVariants[colorValue]?.compareAtPrice || '') : undefined,
                                  sizes: matrixSelectedSizes,
                                  sizeStocks: {},
                                  sizeLabels: {},
                                }],
                              };

                              // If sizes exist, add size stocks, prices, SKUs, and images
                              if (matrixSelectedSizes.length > 0) {
                                // Use first size's price as base price (or average if needed)
                                const firstSizeKey = `${colorValue}-${matrixSelectedSizes[0]}`;
                                const firstSizeVariant = matrixVariants[firstSizeKey];
                                if (firstSizeVariant) {
                                  variant.colors[0].price = firstSizeVariant.price;
                                  variant.colors[0].compareAtPrice = firstSizeVariant.compareAtPrice;
                                  // Use first size's SKU as base SKU for validation
                                  variant.sku = firstSizeVariant.sku || '';
                                }
                                
                                // Use image from color row (stored with colorValue key)
                                const colorRowImage = matrixVariants[colorValue]?.image;
                                if (colorRowImage) {
                                  variant.colors[0].images = [colorRowImage];
                                }
                                
                                matrixSelectedSizes.forEach((sizeValue) => {
                                  const key = `${colorValue}-${sizeValue}`;
                                  const matrixVariant = matrixVariants[key];
                                  if (matrixVariant) {
                                    variant.colors[0].sizeStocks![sizeValue] = matrixVariant.stock;
                                    // Store price per size in sizePrices
                                    if (!variant.colors[0].sizePrices) {
                                      variant.colors[0].sizePrices = {};
                                    }
                                    if (matrixVariant.price) {
                                      variant.colors[0].sizePrices![sizeValue] = matrixVariant.price;
                                    }
                                    // Store compareAtPrice per size in sizeCompareAtPrices
                                    if (!variant.colors[0].sizeCompareAtPrices) {
                                      variant.colors[0].sizeCompareAtPrices = {};
                                    }
                                    if (matrixVariant.compareAtPrice) {
                                      variant.colors[0].sizeCompareAtPrices![sizeValue] = matrixVariant.compareAtPrice;
                                    }
                                    // Store SKU per size in sizeLabels for later use
                                    if (!variant.colors[0].sizeLabels) {
                                      variant.colors[0].sizeLabels = {};
                                    }
                                    if (matrixVariant.sku) {
                                      variant.colors[0].sizeLabels![sizeValue] = matrixVariant.sku;
                                      // If variant.sku is empty, use first size's SKU
                                      if (!variant.sku || variant.sku === '') {
                                        variant.sku = matrixVariant.sku;
                                      }
                                    }
                                  }
                                });
                              } else {
                                // No sizes - use color's price, SKU, and image directly
                                const colorVariant = matrixVariants[colorValue];
                                if (colorVariant) {
                                  variant.colors[0].price = colorVariant.price;
                                  variant.colors[0].compareAtPrice = colorVariant.compareAtPrice;
                                  variant.sku = colorVariant.sku || '';
                                  // Add color's image
                                  if (colorVariant.image) {
                                    variant.colors[0].images = [colorVariant.image];
                                  }
                                }
                              }

                              newVariants.push(variant);
                            });
                            } else if (matrixSelectedSizes.length > 0) {
                              // Only sizes, no colors
                              const variant: Variant = {
                                id: `variant-${Date.now()}-sizes`,
                                price: '',
                                compareAtPrice: '',
                                sku: '',
                                colors: [{
                                  colorValue: '',
                                  colorLabel: 'Default',
                                  images: [],
                                  stock: '',
                                  sizes: matrixSelectedSizes,
                                  sizeStocks: {},
                                  sizeLabels: {},
                                }],
                              };

                              // Use first size's price (sizes are stored individually)
                              const firstSizeKey = matrixSelectedSizes[0];
                              const firstSizeVariant = matrixVariants[firstSizeKey];
                              if (firstSizeVariant) {
                                variant.colors[0].price = firstSizeVariant.price;
                                variant.colors[0].compareAtPrice = firstSizeVariant.compareAtPrice;
                                // Use first size's SKU as base SKU for validation
                                variant.sku = firstSizeVariant.sku || '';
                              }
                              
                              // Add size stocks, prices, and SKUs
                              matrixSelectedSizes.forEach((sizeValue) => {
                                const key = sizeValue;
                                const matrixVariant = matrixVariants[key]
                                if (matrixVariant) {
                                  variant.colors[0].sizeStocks![sizeValue] = matrixVariant.stock;
                                  // Store price per size in sizePrices
                                  if (!variant.colors[0].sizePrices) {
                                    variant.colors[0].sizePrices = {};
                                  }
                                  if (matrixVariant.price) {
                                    variant.colors[0].sizePrices![sizeValue] = matrixVariant.price;
                                  }
                                  // Store compareAtPrice per size in sizeCompareAtPrices
                                  if (!variant.colors[0].sizeCompareAtPrices) {
                                    variant.colors[0].sizeCompareAtPrices = {};
                                  }
                                  if (matrixVariant.compareAtPrice) {
                                    variant.colors[0].sizeCompareAtPrices![sizeValue] = matrixVariant.compareAtPrice;
                                  }
                                  if (matrixVariant.sku) {
                                    variant.colors[0].sizeLabels![sizeValue] = matrixVariant.sku;
                                    // If variant.sku is empty, use first size's SKU
                                    if (!variant.sku || variant.sku === '') {
                                      variant.sku = matrixVariant.sku;
                                    }
                                  }
                                  // Use image from size row (stored with sizeValue key)
                                  if (matrixVariant.image && !variant.colors[0].images.length) {
                                    variant.colors[0].images = [matrixVariant.image];
                                  }
                                }
                              });

                              newVariants.push(variant);
                            } else {
                              // Single variant - no colors, no sizes
                              const singleVariant = matrixVariants['single'];
                              const variant: Variant = {
                                id: `variant-${Date.now()}-single`,
                                price: singleVariant?.price || '',
                                compareAtPrice: singleVariant?.compareAtPrice || '',
                                sku: singleVariant?.sku || '',
                                colors: [{
                                  colorValue: '',
                                  colorLabel: 'Default',
                                  images: singleVariant?.image ? [singleVariant.image] : [],
                                  stock: singleVariant?.stock || '',
                                  price: singleVariant?.price || undefined,
                                  compareAtPrice: singleVariant?.compareAtPrice || undefined,
                                  sizes: [],
                                  sizeStocks: {},
                                  sizeLabels: {},
                                }],
                              };
                              newVariants.push(variant);
                            }

                            // Validate that variants were created
                            if (newVariants.length === 0) {
                              alert('No variants were created. Please select at least one color or size.');
                              return;
                            }

                            console.log('✅ [ADMIN] Generated variants:', newVariants.length, newVariants);

                            // Update formData with new variants
                            setFormData((prev) => {
                              const updated = {
                                ...prev,
                                variants: newVariants,
                              };
                              console.log('✅ [ADMIN] Updated formData.variants:', updated.variants.length);
                              return updated;
                            });

                            // Disable matrix builder and show success
                            setUseMatrixBuilder(false);
                            const variantCount = newVariants.length;
                            const colorCount = matrixSelectedColors.length;
                            const sizeCount = matrixSelectedSizes.length;
                            let message = `Successfully created ${variantCount} variant(s)!`;
                            if (colorCount > 0) message += ` (${colorCount} color(s))`;
                            if (sizeCount > 0) message += ` (${sizeCount} size(s))`;
                            alert(message);
                          }}
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Generate Variants from Matrix
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                      <p className="text-gray-500">
                        {isClothingCategory() && matrixSelectedSizes.length === 0 && matrixSelectedColors.length === 0
                          ? 'Please select at least one size or color to create variants'
                          : 'Select colors and/or sizes to create variant matrix'}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
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
            {/* Hidden input for matrix image uploads */}
            <input
              ref={matrixImageFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUploadMatrixImages}
            />
          </form>
          </Card>
        </div>
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

