'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../../lib/api-client';
import { getColorHex, COLOR_MAP } from '../../../../lib/colorMap';
import { useTranslation } from '../../../../lib/i18n-client';

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
  const { t } = useTranslation();
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
        + {t('admin.common.add')}
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
    colors?: string[];
    imageUrl?: string | null;
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
  const { t } = useTranslation();
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
    brandIds: [] as string[], // Changed to array for multi-select
    primaryCategoryId: '',
    categoryIds: [] as string[],
    published: false,
    featured: false,
    imageUrls: [] as string[],
    featuredImageIndex: 0,
    mainProductImage: '' as string, // Main product image (base64)
    variants: [] as Variant[],
    labels: [] as ProductLabel[],
  });
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const colorImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const mainProductImageInputRef = useRef<HTMLInputElement | null>(null);
  const attributesDropdownRef = useRef<HTMLDivElement | null>(null);
  const valueDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [attributesDropdownOpen, setAttributesDropdownOpen] = useState(false);
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
  // Track which attributes have been selected (have values added to them)
  const [selectedAttributesForProduct, setSelectedAttributesForProduct] = useState<Set<string>>(new Set());
  
  // New Multi-Attribute Variant Builder state
  const [selectedAttributesForVariants, setSelectedAttributesForVariants] = useState<Set<string>>(new Set()); // Selected attribute IDs
  const [selectedAttributeValueIds, setSelectedAttributeValueIds] = useState<Record<string, string[]>>({}); // Key: attributeId, Value: array of selected value IDs
  // State for managing open dropdowns in the variants table
  const [openValueDropdown, setOpenValueDropdown] = useState<string | null>(null); // attributeId of the open dropdown
  const [generatedVariants, setGeneratedVariants] = useState<Array<{
      id: string; // Unique ID for this variant
    selectedValueIds: string[]; // Array of selected value IDs from all attributes
    price: string;
    compareAtPrice: string;
    stock: string;
    sku: string;
    image: string | null;
  }>>([]);
  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn || !isAdmin) {
        router.push('/admin');
        return;
      }
    }
  }, [isLoggedIn, isAdmin, isLoading, router]);

  // Close attributes dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attributesDropdownRef.current && !attributesDropdownRef.current.contains(event.target as Node)) {
        setAttributesDropdownOpen(false);
      }
    };

    if (attributesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [attributesDropdownOpen]);

  // Close value dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openValueDropdown) {
        const ref = valueDropdownRefs.current[openValueDropdown];
        if (ref && !ref.contains(event.target as Node)) {
          setOpenValueDropdown(null);
        }
      }
    };

    if (openValueDropdown) {
      // Use setTimeout to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openValueDropdown]);

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
        alert(t('admin.products.add.errorLoadingData').replace('{message}', err.message || t('admin.common.unknownErrorFallback')));
      }
    };
    fetchData();
  }, []);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (categoriesExpanded && !target.closest('[data-category-dropdown]')) {
        setCategoriesExpanded(false);
      }
    };

    if (categoriesExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [categoriesExpanded]);

  // Close brand dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (brandsExpanded && !target.closest('[data-brand-dropdown]')) {
        setBrandsExpanded(false);
      }
    };

    if (brandsExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [brandsExpanded]);

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
            console.log(`🔍 [ADMIN] Processing variant ${index}:`, {
              id: variant.id,
              sku: variant.sku,
              price: variant.price,
              stock: variant.stock,
              color: variant.color,
              size: variant.size,
              options: variant.options,
              imageUrl: variant.imageUrl,
            });
            
            // Try to get color from variant.color (old format) or from variant.options (new format)
            let color = variant.color || '';
            let size = variant.size || '';
            
            // If color is empty, try to get from options
            if (!color && variant.options && Array.isArray(variant.options)) {
              console.log(`🔍 [ADMIN] Searching for color in options:`, variant.options);
              const colorOption = variant.options.find((opt: any) => {
                const matches = opt.attributeKey === 'color' || opt.key === 'color' || opt.attribute === 'color';
                if (matches) {
                  console.log(`✅ [ADMIN] Found color option:`, opt);
                }
                return matches;
              });
              if (colorOption) {
                color = colorOption.value || '';
                console.log(`✅ [ADMIN] Found color from options:`, color);
              } else {
                // Try to find by attributeValue relation
                const colorOptionByValue = variant.options.find((opt: any) => {
                  // Check if option has attributeValue with color attribute
                  if (opt.attributeValue) {
                    const attrValue = opt.attributeValue;
                    // Check if this attributeValue belongs to color attribute
                    return attrValue.attribute?.key === 'color' || attrValue.attributeKey === 'color';
                  }
                  return false;
                });
                if (colorOptionByValue && colorOptionByValue.attributeValue) {
                  color = colorOptionByValue.attributeValue.value || '';
                  console.log(`✅ [ADMIN] Found color from attributeValue:`, color);
                }
              }
            }
            
            // If size is empty, try to get from options
            if (!size && variant.options && Array.isArray(variant.options)) {
              console.log(`🔍 [ADMIN] Searching for size in options:`, variant.options);
              const sizeOption = variant.options.find((opt: any) => {
                const matches = opt.attributeKey === 'size' || opt.key === 'size' || opt.attribute === 'size';
                if (matches) {
                  console.log(`✅ [ADMIN] Found size option:`, opt);
                }
                return matches;
              });
              if (sizeOption) {
                size = sizeOption.value || '';
                console.log(`✅ [ADMIN] Found size from options:`, size);
              } else {
                // Try to find by attributeValue relation
                const sizeOptionByValue = variant.options.find((opt: any) => {
                  // Check if option has attributeValue with size attribute
                  if (opt.attributeValue) {
                    const attrValue = opt.attributeValue;
                    // Check if this attributeValue belongs to size attribute
                    return attrValue.attribute?.key === 'size' || attrValue.attributeKey === 'size';
                  }
                  return false;
                });
                if (sizeOptionByValue && sizeOptionByValue.attributeValue) {
                  size = sizeOptionByValue.attributeValue.value || '';
                  console.log(`✅ [ADMIN] Found size from attributeValue:`, size);
                }
              }
            }
            
            // If still no color/size, try to extract from SKU as fallback
            if (!color && variant.sku) {
              const skuParts = variant.sku.split('-');
              // Common patterns: "15-blue-17.2", "15-red-18"
              if (skuParts.length >= 2) {
                const possibleColor = skuParts[1]; // "blue", "red"
                // Check if this looks like a color
                if (possibleColor && possibleColor.length > 0 && !/^\d+$/.test(possibleColor)) {
                  color = possibleColor;
                  console.log(`✅ [ADMIN] Extracted color from SKU:`, color);
                }
              }
            }
            
            if (!size && variant.sku) {
              const skuParts = variant.sku.split('-');
              // Common patterns: "15-blue-17.2", "15-red-18"
              if (skuParts.length >= 3) {
                const possibleSize = skuParts[2]; // "17.2", "18", "19"
                if (possibleSize) {
                  size = possibleSize;
                  console.log(`✅ [ADMIN] Extracted size from SKU:`, size);
                }
              }
            }
            
            console.log(`📊 [ADMIN] Extracted from variant ${index}:`, { color, size });
            
            // Convert stock to string, handling 0 correctly
            const stockValue = variant.stock !== undefined && variant.stock !== null 
              ? String(variant.stock) 
              : '';
            
            // Collect colors with their images, sizes, and stocks
            // If no color, create a default color entry for variants without colors
            if (!color) {
              // Create a default color entry for variants without colors
              const defaultColor = 'default';
              const defaultColorLabel = t('admin.products.add.defaultColor');
              
              if (!colorDataMap.has(defaultColor)) {
                const colorData: ColorData = {
                  colorValue: defaultColor,
                  colorLabel: defaultColorLabel,
                  images: smartSplitUrls(variant.imageUrl),
                  stock: size ? '' : stockValue,
                  price: variant.price !== undefined && variant.price !== null ? String(variant.price) : '',
                  compareAtPrice: variant.compareAtPrice !== undefined && variant.compareAtPrice !== null ? String(variant.compareAtPrice) : '',
                  sizes: [],
                  sizeStocks: {},
                  sizePrices: {},
                  sizeCompareAtPrices: {},
                  sizeLabels: {},
                  isFeatured: !!variant.isFeatured,
                };
                
                if (size) {
                  colorData.sizes = [size];
                  colorData.sizeStocks = { [size]: stockValue };
                  if (variant.price !== undefined && variant.price !== null) {
                    colorData.sizePrices![size] = String(variant.price);
                  }
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    colorData.sizeCompareAtPrices![size] = String(variant.compareAtPrice);
                  }
                }
                
                colorDataMap.set(defaultColor, colorData);
              } else {
                const existingColorData = colorDataMap.get(defaultColor)!;
                if (variant.imageUrl) {
                  const imageUrls = smartSplitUrls(variant.imageUrl);
                  imageUrls.forEach((url: string) => {
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
                
                if (size) {
                  if (!existingColorData.sizes.includes(size)) {
                    existingColorData.sizes.push(size);
                  }
                  existingColorData.sizeStocks[size] = stockValue;
                  if (!existingColorData.sizePrices) existingColorData.sizePrices = {};
                  if (variant.price !== undefined && variant.price !== null) {
                    existingColorData.sizePrices[size] = String(variant.price);
                  }
                  if (!existingColorData.sizeCompareAtPrices) existingColorData.sizeCompareAtPrices = {};
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    existingColorData.sizeCompareAtPrices[size] = String(variant.compareAtPrice);
                  }
                } else {
                  const currentStockNum = parseInt(existingColorData.stock) || 0;
                  const variantStockNum = parseInt(stockValue) || 0;
                  existingColorData.stock = String(currentStockNum + variantStockNum);
                }
              }
            } else if (color) {
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
                  sizePrices: {},
                  sizeCompareAtPrices: {},
                  sizeLabels: {},
                  isFeatured: !!variant.isFeatured,
                };
                
                // If variant has size, add it to color's sizes
                if (size) {
                  colorData.sizes = [size];
                  colorData.sizeStocks = { [size]: stockValue };
                  // Store size-specific price
                  if (variant.price !== undefined && variant.price !== null) {
                    colorData.sizePrices![size] = String(variant.price);
                  }
                  // Store size-specific compareAtPrice
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    colorData.sizeCompareAtPrices![size] = String(variant.compareAtPrice);
                  }
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
                  // Store size-specific price
                  if (!existingColorData.sizePrices) existingColorData.sizePrices = {};
                  if (variant.price !== undefined && variant.price !== null) {
                    existingColorData.sizePrices[size] = String(variant.price);
                  }
                  // Store size-specific compareAtPrice
                  if (!existingColorData.sizeCompareAtPrices) existingColorData.sizeCompareAtPrices = {};
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    existingColorData.sizeCompareAtPrices[size] = String(variant.compareAtPrice);
                  }
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

          // Extract main product image (first image in media that's not in variants, or from mainProductImage field)
          const mainProductImage = (product as any).mainProductImage 
            || (normalizedMedia.length > 0 ? normalizedMedia[0] : '');

          // Extract brandIds - convert single brandId to array for multi-select UI
          // Note: Database currently supports single brandId, but UI allows multi-select
          // We use the first brand for now, but UI is ready for future multi-brand support
          const brandIds = product.brandId ? [product.brandId] : [];

          setFormData({
            title: product.title || '',
            slug: product.slug || '',
            descriptionHtml: product.descriptionHtml || '',
            brandIds: brandIds,
            primaryCategoryId: product.primaryCategoryId || '',
            categoryIds: product.categoryIds || [],
            published: product.published || false,
            featured: product.featured || false,
            imageUrls: normalizedMedia,
            featuredImageIndex:
              featuredIndexFromApi >= 0 && featuredIndexFromApi < normalizedMedia.length
                ? featuredIndexFromApi
                : 0,
            mainProductImage: mainProductImage || '',
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
          alert(t('admin.products.add.errorLoadingProduct').replace('{message}', err.message || t('admin.common.unknownErrorFallback')));
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

  // Generate all combinations of selected attribute values
  const generateAttributeCombinations = (attributeValueGroups: string[][]): string[][] => {
    if (attributeValueGroups.length === 0) {
      return [[]];
    }
    if (attributeValueGroups.length === 1) {
      return attributeValueGroups[0].map((value) => [value]);
    }
    const [firstGroup, ...restGroups] = attributeValueGroups;
    const restCombinations = generateAttributeCombinations(restGroups);
    const result: string[][] = [];
    for (const value of firstGroup) {
      for (const combination of restCombinations) {
        result.push([value, ...combination]);
      }
    }
    return result;
  };

  // Generate variants from selected attributes
  // NEW LOGIC: One variant with all selected attributes
  const generateVariantsFromAttributes = () => {
    console.log('🚀 [VARIANT BUILDER] Generating single variant with all attributes...');
    
    const selectedAttrs = Array.from(selectedAttributesForVariants);
    if (selectedAttrs.length === 0) {
      console.log('⚠️ [VARIANT BUILDER] No attributes selected');
      setGeneratedVariants([]);
      return;
    }

    // Preserve existing variant's data (price, stock, etc.) when regenerating
    setGeneratedVariants(prev => {
      const existingVariant = prev.length > 0 ? prev[0] : null;
      const variantId = 'variant-all'; // Single variant ID
      
      // Collect all selected value IDs from all attributes
      const allSelectedValueIds: string[] = [];
      selectedAttrs.forEach((attributeId) => {
        const selectedIds = selectedAttributeValueIds[attributeId] || [];
        allSelectedValueIds.push(...selectedIds);
      });
      
      // Generate SKU based on all selected values
      const baseSlug = formData.slug || generateSlug(formData.title) || 'PROD';
      let sku = `${baseSlug}`;
      
      // Add selected values to SKU
      if (allSelectedValueIds.length > 0) {
        const valueParts: string[] = [];
        selectedAttrs.forEach((attributeId) => {
          const attribute = attributes.find(a => a.id === attributeId);
          if (!attribute) return;
          
          const selectedIds = selectedAttributeValueIds[attributeId] || [];
          selectedIds.forEach(valueId => {
            const value = attribute.values.find(v => v.id === valueId);
            if (value) {
              valueParts.push(value.value.toUpperCase().replace(/\s+/g, '-'));
            }
          });
        });
        
        if (valueParts.length > 0) {
          sku = `${baseSlug}-${valueParts.join('-')}`;
        }
      }

      // Create single variant with all attributes
      const variant = {
        id: variantId,
        selectedValueIds: allSelectedValueIds, // All selected values from all attributes
        price: existingVariant?.price || '',
        compareAtPrice: existingVariant?.compareAtPrice || '',
        stock: existingVariant?.stock || '',
        sku: existingVariant?.sku || sku, // Preserve existing SKU if set, otherwise use generated
        image: existingVariant?.image || null,
      };

      return [variant];
    });
    
    console.log('✅ [VARIANT BUILDER] Single variant generated with', selectedAttrs.length, 'attributes');
  };

  // Update variants when attributes or values change
  // NEW LOGIC: Generate variants when at least one attribute is selected (even without values)
  useEffect(() => {
    if (selectedAttributesForVariants.size > 0) {
      // Generate variants for all selected attributes, even if no values selected yet
      generateVariantsFromAttributes();
    } else {
      setGeneratedVariants([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttributesForVariants, selectedAttributeValueIds, attributes, formData.slug, formData.title]);

  // Apply value to all variants
  const applyToAllVariants = (field: 'price' | 'compareAtPrice' | 'stock' | 'sku', value: string) => {
    setGeneratedVariants(prev => prev.map(variant => ({
      ...variant,
      [field]: value,
    })));
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
      setImageUploadError(error?.message || t('admin.products.add.failedToProcessImages'));
    } finally {
      setImageUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Upload main product image
  const handleUploadMainProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const file = files[0]; // Only take the first file
    if (!file.type.startsWith('image/')) {
      setImageUploadError(`"${file.name}" is not an image file`);
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    setImageUploadLoading(true);
    setImageUploadError(null);
    try {
      const base64 = await fileToBase64(file);
      setFormData((prev) => ({
        ...prev,
        mainProductImage: base64,
      }));
    } catch (error: any) {
      setImageUploadError(error?.message || t('admin.products.add.failedToProcessImage'));
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
      alert(error?.message || t('admin.products.add.failedToProcessImages'));
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
      setColorMessage({ type: 'error', text: t('admin.products.add.colorAttributeNotFound') });
      return;
    }

    if (!newColorName.trim()) {
      setColorMessage({ type: 'error', text: t('admin.products.add.colorNameRequired') });
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
        setColorMessage({ type: 'success', text: t('admin.products.add.colorAddedSuccess').replace('{name}', newColorName.trim()) });
        setNewColorName('');
        // Clear message after 3 seconds
        setTimeout(() => setColorMessage(null), 3000);
      }
    } catch (err: any) {
      setColorMessage({ type: 'error', text: err.message || t('admin.products.add.failedToAddColor') });
    } finally {
      setAddingColor(false);
    }
  };

  // Add new size to size attribute
  const handleAddSize = async () => {
    setSizeMessage(null);
    const sizeAttribute = getSizeAttribute();
    if (!sizeAttribute) {
      setSizeMessage({ type: 'error', text: t('admin.products.add.sizeAttributeNotFound') });
      return;
    }

    if (!newSizeName.trim()) {
      setSizeMessage({ type: 'error', text: t('admin.products.add.sizeNameRequired') });
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
        setSizeMessage({ type: 'success', text: t('admin.products.add.sizeAddedSuccess').replace('{name}', newSizeName.trim()) });
        setNewSizeName('');
        // Clear message after 3 seconds
        setTimeout(() => setSizeMessage(null), 3000);
      }
    } catch (err: any) {
      setSizeMessage({ type: 'error', text: err.message || t('admin.products.add.failedToAddSize') });
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

      // Create new brand if provided and add to brandIds
      let finalBrandIds = [...formData.brandIds];
      if (useNewBrand && newBrandName.trim()) {
        try {
          console.log('🏷️ [ADMIN] Creating new brand:', newBrandName);
          const brandResponse = await apiClient.post<{ data: Brand }>('/api/v1/admin/brands', {
            name: newBrandName.trim(),
            locale: 'en',
          });
          if (brandResponse.data) {
            // Add new brand to brandIds if not already present
            if (!finalBrandIds.includes(brandResponse.data.id)) {
              finalBrandIds.push(brandResponse.data.id);
            }
            // Add to brands list for future use
            setBrands((prev) => [...prev, brandResponse.data]);
            console.log('✅ [ADMIN] Brand created:', brandResponse.data.id);
            creationMessages.push(t('admin.products.add.brandCreatedSuccess').replace('{name}', newBrandName.trim()));
          }
        } catch (err: any) {
          console.error('❌ [ADMIN] Error creating brand:', err);
          const errorMessage = err?.data?.detail || err?.message || t('admin.common.unknownErrorFallback');
          alert(t('admin.products.add.errorCreatingBrand').replace('{message}', errorMessage));
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
              newCategoryRequiresSizes 
                ? t('admin.products.add.categoryCreatedSuccessSizes').replace('{name}', newCategoryName.trim())
                : t('admin.products.add.categoryCreatedSuccess').replace('{name}', newCategoryName.trim())
            );
          }
        } catch (err: any) {
          console.error('❌ [ADMIN] Error creating category:', err);
          alert(t('admin.products.add.errorCreatingCategory').replace('{message}', err.message || t('admin.common.unknownErrorFallback')));
          setLoading(false);
          return;
        }
      }

      // Convert new variant builder variants to formData.variants if attributes are selected
      // NEW LOGIC: Single variant with all attributes
      if (selectedAttributesForVariants.size > 0 && generatedVariants.length > 0) {
        console.log('🔄 [ADMIN] Converting new variant builder variants to formData format...');
        
        const variant = generatedVariants[0]; // Single variant with all attributes
        const colorAttribute = attributes.find(a => a.key === 'color');
        const sizeAttribute = attributes.find(a => a.key === 'size');
        
        // Get selected color and size values from variant
        const selectedColorValueIds = colorAttribute 
          ? variant.selectedValueIds.filter(id => colorAttribute.values.some(v => v.id === id))
          : [];
        const selectedSizeValueIds = sizeAttribute 
          ? variant.selectedValueIds.filter(id => sizeAttribute.values.some(v => v.id === id))
          : [];
        
        // Create colors from selected color values
        const colors: ColorData[] = [];
        
        if (colorAttribute && selectedColorValueIds.length > 0) {
          // Create one ColorData per selected color value
          selectedColorValueIds.forEach((valueId) => {
            const value = colorAttribute.values.find(v => v.id === valueId);
            if (value) {
              const colorData: ColorData = {
                colorValue: value.value,
                colorLabel: value.label,
                images: [],
                stock: variant.stock || '0',
                sizes: [],
                sizeStocks: {},
              };
              
              // Add price if set
              if (variant.price) {
                colorData.price = variant.price;
              }
              if (variant.compareAtPrice) {
                colorData.compareAtPrice = variant.compareAtPrice;
              }
              
              // Add sizes from selected size values
              if (sizeAttribute && selectedSizeValueIds.length > 0) {
                selectedSizeValueIds.forEach((sizeValueId) => {
                  const sizeValue = sizeAttribute.values.find(v => v.id === sizeValueId);
                  if (sizeValue) {
                    colorData.sizes.push(sizeValue.value);
                    colorData.sizeStocks[sizeValue.value] = variant.stock || '0';
                    if (!colorData.sizePrices) colorData.sizePrices = {};
                    colorData.sizePrices[sizeValue.value] = variant.price || '0';
                  }
                });
              }
              
              colors.push(colorData);
            }
          });
        } else if (sizeAttribute && selectedSizeValueIds.length > 0) {
          // No color, but has size - create variant with empty colors but sizes
          const colorData: ColorData = {
            colorValue: '',
            colorLabel: '',
            images: [],
            stock: variant.stock || '0',
            sizes: [],
            sizeStocks: {},
          };
          
          selectedSizeValueIds.forEach((sizeValueId) => {
            const sizeValue = sizeAttribute.values.find(v => v.id === sizeValueId);
            if (sizeValue) {
              colorData.sizes.push(sizeValue.value);
              colorData.sizeStocks[sizeValue.value] = variant.stock || '0';
              if (!colorData.sizePrices) colorData.sizePrices = {};
              colorData.sizePrices[sizeValue.value] = variant.price || '0';
            }
          });
          
          colors.push(colorData);
        }
        
        // Create variant
        const newVariants: Variant[] = [{
          id: `variant-${Date.now()}-${Math.random()}`,
          price: variant.price || '0',
          compareAtPrice: variant.compareAtPrice || '',
          sku: variant.sku || '',
          colors: colors.length > 0 ? colors : [],
        }];
        
        formData.variants = newVariants;
        console.log('✅ [ADMIN] Converted variants:', formData.variants.length);
      }

      // Validate that at least one variant exists
      console.log('🔍 [ADMIN] Validating variants before submit:', {
        variantsCount: formData.variants.length,
        variants: formData.variants,
        selectedAttributesCount: selectedAttributesForVariants.size,
      });
      
      if (formData.variants.length === 0) {
        if (selectedAttributesForVariants.size > 0) {
          alert(t('admin.products.add.pleaseGenerateVariants') || 'Please generate variants using the variant builder');
        } else {
          alert(t('admin.products.add.pleaseAddAtLeastOneVariant'));
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
          alert(t('admin.products.add.variantColorRequired').replace('{index}', variantIndex.toString()));
          setLoading(false);
          return;
        }
        
        // Validate SKU - must be unique within product
        const variantSku = variant.sku ? variant.sku.trim() : '';
        if (!variantSku || variantSku === '') {
          alert(t('admin.products.add.variantSkuRequired').replace('{index}', variantIndex.toString()));
          setLoading(false);
          return;
        }
        
        if (skuSet.has(variantSku)) {
          alert(t('admin.products.add.variantSkuDuplicate').replace('{index}', variantIndex.toString()).replace('{sku}', variantSku));
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
              alert(t('admin.products.add.variantPriceRequired').replace('{index}', variantIndex.toString()).replace('{color}', colorDataItem.colorLabel));
              setLoading(false);
              return;
            }

            // If category requires sizes, check if color has at least one size
            if (categoryRequiresSizes) {
              if (colorSizes.length === 0) {
                alert(t('admin.products.add.variantSizeRequired').replace('{index}', variantIndex.toString()).replace('{color}', colorDataItem.colorLabel));
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
                  alert(t('admin.products.add.variantStockRequired').replace('{index}', variantIndex.toString()).replace('{color}', colorDataItem.colorLabel).replace('{size}', sizeLabel));
                  setLoading(false);
                  return;
                }
              }
            } else {
              // If category doesn't require sizes, validate base stock for color
              if (colorSizes.length === 0) {
                if (!colorDataItem.stock || colorDataItem.stock.trim() === '' || parseInt(colorDataItem.stock) < 0) {
                  alert(t('admin.products.add.variantColorStockRequired').replace('{index}', variantIndex.toString()).replace('{color}', colorDataItem.colorLabel));
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
      // Note: Database supports single brandId, so we use the first selected brand
      // For multiple brands, we would need to update the schema to support brandIds array
      const payload: any = {
        title: formData.title,
        slug: formData.slug,
        descriptionHtml: formData.descriptionHtml || undefined,
        brandId: finalBrandIds.length > 0 ? finalBrandIds[0] : undefined,
        primaryCategoryId: finalPrimaryCategoryId || undefined,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
        // При создании нового продукта автоматически публикуем его
        // При редактировании используем значение из формы
        published: isEditMode ? formData.published : true,
        featured: formData.featured,
        locale: 'en',
        variants: variants,
        attributeIds: attributeIds.length > 0 ? attributeIds : undefined,
      };

      // Add main product image and media
      const finalMedia: string[] = [];
      
      // Add main product image first if provided
      if (formData.mainProductImage) {
        finalMedia.push(formData.mainProductImage);
      }
      
      // Add other media (extract URLs from media objects)
      if (media.length > 0) {
        finalMedia.push(...media.map(m => m.url));
      }
      
      if (finalMedia.length > 0) {
        payload.media = finalMedia;
      }
      
      // Also add mainProductImage as separate field for easier access
      if (formData.mainProductImage) {
        payload.mainProductImage = formData.mainProductImage;
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
          <p className="text-gray-600">{loadingProduct ? t('admin.products.add.loadingProduct') : t('admin.products.add.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null;
  }


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
                {t('admin.products.add.backToAdmin')}
              </button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? t('admin.products.add.editProduct') : t('admin.products.add.addNewProduct')}</h1>
          </div>

          <Card className="p-6 pb-24 sm:pb-24">
          <form onSubmit={handleSubmit} className="space-y-14">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.basicInformation')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.products.add.title')} *
                  </label>
                  <Input
                    type="text"
                    value={formData.title}
                    onChange={handleTitleChange}
                    required
                    placeholder={t('admin.products.add.productTitlePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.products.add.slug')} *
                  </label>
                  <Input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    required
                    placeholder={t('admin.products.add.productSlugPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.products.add.description')}
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                    value={formData.descriptionHtml}
                    onChange={(e) => setFormData((prev) => ({ ...prev, descriptionHtml: e.target.value }))}
                    placeholder={t('admin.products.add.productDescriptionPlaceholder')}
                  />
                </div>
              </div>
            </div>

            {/* Main Product Image */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.mainProductImage')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.products.add.mainProductImage')}
                    <span className="text-xs text-gray-500 ml-2">({t('admin.products.add.mainProductImageDescription')})</span>
                  </label>
                  
                  {formData.mainProductImage ? (
                    <div className="space-y-3">
                      <div className="relative inline-block">
                        <img
                          src={formData.mainProductImage}
                          alt="Main product image"
                          className="max-w-xs max-h-64 object-contain border border-gray-300 rounded-md p-2 bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, mainProductImage: '' }));
                            if (mainProductImageInputRef.current) {
                              mainProductImageInputRef.current.value = '';
                            }
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          title={t('admin.products.add.removeImage')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => mainProductImageInputRef.current?.click()}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {t('admin.products.add.changeImage')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => mainProductImageInputRef.current?.click()}
                        disabled={imageUploadLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {imageUploadLoading ? t('admin.products.add.uploading') : t('admin.products.add.uploadMainProductImage')}
                      </button>
                    </div>
                  )}
                  
                  <input
                    ref={mainProductImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadMainProductImage}
                    className="hidden"
                  />
                  
                  {imageUploadError && (
                    <div className="mt-2 text-sm text-red-600">
                      {imageUploadError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Categories & Brands */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.categoriesAndBrands')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Categories - Multi-select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.products.add.categories')} <span className="text-gray-500 font-normal">{t('admin.products.add.selectMultiple')}</span>
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
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="select-category" className="text-sm text-gray-700">
                        {t('admin.products.add.selectExistingCategories')}
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
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="new-category" className="text-sm text-gray-700">
                        {t('admin.products.add.addNewCategory')}
                      </label>
                    </div>
                    {!useNewCategory ? (
                      <div className="relative" data-category-dropdown>
                        <button
                          type="button"
                          onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                          className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm flex items-center justify-between"
                        >
                          <span className="text-gray-700">
                            {formData.categoryIds.length === 0
                              ? t('admin.products.add.selectCategories')
                              : formData.categoryIds.length === 1 
                                ? t('admin.products.add.categorySelected').replace('{count}', formData.categoryIds.length.toString())
                                : t('admin.products.add.categoriesSelected').replace('{count}', formData.categoryIds.length.toString())}
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                              categoriesExpanded ? 'transform rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {categoriesExpanded && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <div className="space-y-1">
                                {categories.map((category) => (
                                  <label
                                    key={category.id}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.categoryIds.includes(category.id)}
                                      onChange={(e) => {
                                        const newCategoryIds = e.target.checked
                                          ? [...formData.categoryIds, category.id]
                                          : formData.categoryIds.filter((id) => id !== category.id);
                                        
                                        // Set primary category if it's the first one
                                        const newPrimaryCategoryId = newCategoryIds.length > 0 ? newCategoryIds[0] : '';
                                        
                                        const selectedCategory = categories.find((cat) => cat.id === category.id);
                                        const newIsSizeRequired = selectedCategory
                                          ? (selectedCategory.requiresSizes !== undefined 
                                              ? selectedCategory.requiresSizes 
                                              : (() => {
                                                  const sizeRequiredSlugs = ['clothing', 'odezhda', 'hagust', 'apparel', 'fashion', 'shoes', 'koshik', 'obuv'];
                                                  const sizeRequiredTitles = ['clothing', 'одежда', 'հագուստ', 'apparel', 'fashion', 'shoes', 'կոշիկ', 'обувь'];
                                                  return (
                                                    sizeRequiredSlugs.some((slug) => selectedCategory.slug.toLowerCase().includes(slug)) ||
                                                    sizeRequiredTitles.some((title) => selectedCategory.title.toLowerCase().includes(title))
                                                  );
                                                })())
                                          : false;
                                        
                                        setFormData((prev) => {
                                          const wasSizeRequired = isClothingCategory();
                                          if (wasSizeRequired && !newIsSizeRequired && newCategoryIds.length === 0) {
                                            return {
                                              ...prev,
                                              categoryIds: newCategoryIds,
                                              primaryCategoryId: newPrimaryCategoryId,
                                              variants: prev.variants.map((v) => ({
                                                ...v,
                                                sizes: [],
                                                sizeStocks: {},
                                                size: '',
                                              })),
                                            };
                                          }
                                          return {
                                            ...prev,
                                            categoryIds: newCategoryIds,
                                            primaryCategoryId: newPrimaryCategoryId,
                                          };
                                        });
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{category.title}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={t('admin.products.add.enterNewCategoryName')}
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
                            {t('admin.products.add.categoryRequiresSizes')}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Brands - Multi-select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.products.add.brands')} <span className="text-gray-500 font-normal">{t('admin.products.add.selectMultiple')}</span>
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
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="select-brand" className="text-sm text-gray-700">
                        {t('admin.products.add.selectExistingBrands')}
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
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="new-brand" className="text-sm text-gray-700">
                        {t('admin.products.add.addNewBrand')}
                      </label>
                    </div>
                    {!useNewBrand ? (
                      <div className="relative" data-brand-dropdown>
                        <button
                          type="button"
                          onClick={() => setBrandsExpanded(!brandsExpanded)}
                          className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm flex items-center justify-between"
                        >
                          <span className="text-gray-700">
                            {formData.brandIds.length === 0
                              ? t('admin.products.add.selectBrands')
                              : formData.brandIds.length === 1 
                                ? t('admin.products.add.brandSelected').replace('{count}', formData.brandIds.length.toString())
                                : t('admin.products.add.brandsSelected').replace('{count}', formData.brandIds.length.toString())}
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                              brandsExpanded ? 'transform rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {brandsExpanded && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <div className="space-y-1">
                                {brands.map((brand) => (
                                  <label
                                    key={brand.id}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.brandIds.includes(brand.id)}
                                      onChange={(e) => {
                                        const newBrandIds = e.target.checked
                                          ? [...formData.brandIds, brand.id]
                                          : formData.brandIds.filter((id) => id !== brand.id);
                                        setFormData((prev) => ({ ...prev, brandIds: newBrandIds }));
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{brand.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        type="text"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        placeholder={t('admin.products.add.enterNewBrandName')}
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
                <h2 className="text-xl font-semibold text-gray-900">{t('admin.products.add.productLabels')}</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLabel}
                >
                  {t('admin.products.add.addLabel')}
                </Button>
              </div>
              {formData.labels.length === 0 ? (
                <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-2">{t('admin.products.add.noLabelsAdded')}</p>
                  <p className="text-sm text-gray-400">{t('admin.products.add.addLabelsHint')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.labels.map((label, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">{t('admin.products.add.label').replace('{index}', (index + 1).toString())}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeLabel(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          {t('admin.products.add.remove')}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Label Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin.products.add.type')} *
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={label.type}
                            onChange={(e) => updateLabel(index, 'type', e.target.value as 'text' | 'percentage')}
                            required
                          >
                            <option value="text">{t('admin.products.add.textType')}</option>
                            <option value="percentage">{t('admin.products.add.percentageType')}</option>
                          </select>
                        </div>

                        {/* Label Value */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin.products.add.value')} *
                          </label>
                          <Input
                            type="text"
                            value={label.value}
                            onChange={(e) => updateLabel(index, 'value', e.target.value)}
                            placeholder={label.type === 'percentage' ? t('admin.products.add.percentagePlaceholder') : t('admin.products.add.newProductLabel')}
                            required
                            className="w-full"
                          />
                          {label.type === 'percentage' && (
                            <p className="mt-1 text-xs text-blue-600 font-medium">
                              {t('admin.products.add.percentageAutoUpdateHint')}
                            </p>
                          )}
                        </div>

                        {/* Label Position */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin.products.add.position')} *
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={label.position}
                            onChange={(e) => updateLabel(index, 'position', e.target.value)}
                            required
                          >
                            <option value="top-left">{t('admin.products.add.topLeft')}</option>
                            <option value="top-right">{t('admin.products.add.topRight')}</option>
                            <option value="bottom-left">{t('admin.products.add.bottomLeft')}</option>
                            <option value="bottom-right">{t('admin.products.add.bottomRight')}</option>
                          </select>
                        </div>

                        {/* Label Color (Optional) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin.products.add.colorOptional')}
                          </label>
                          <Input
                            type="text"
                            value={label.color || ''}
                            onChange={(e) => updateLabel(index, 'color', e.target.value || null)}
                            placeholder={t('admin.products.add.colorHexPlaceholder')}
                            className="w-full"
                          />
                          <p className="mt-1 text-xs text-gray-500">{t('admin.products.add.hexColorHint')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product Variants Display */}
            {formData.variants.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{t('admin.products.add.productVariants')}</h2>
                  <span className="text-sm text-gray-500">
                    {t('admin.products.add.variantsCreated').replace('{count}', formData.variants.length.toString())}
                  </span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
                  {formData.variants.map((variant, variantIndex) => (
                    <div key={variant.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          {t('admin.products.add.variantNumber').replace('{index}', (variantIndex + 1).toString())}
                        </h3>
                        <div className="text-sm text-gray-600">
                          {variant.sku && <span>{t('admin.products.add.sku')} {variant.sku}</span>}
                        </div>
                      </div>
                      {variant.colors && variant.colors.length > 0 ? (
                        <div className="space-y-4">
                          {variant.colors.map((colorData, colorIndex) => {
                            // Get color attribute value to access colors array
                            const colorAttributeValue = getColorAttribute()?.values.find(v => v.value === colorData.colorValue);
                            const attributeColors = colorAttributeValue?.colors || [];
                            
                            // Use first color from attribute colors array if available, otherwise use colorHex from label
                            const primaryColorHex = attributeColors.length > 0 
                              ? attributeColors[0] 
                              : getColorHex(colorData.colorLabel);
                            
                            return (
                              <div key={colorIndex} className="border border-gray-200 rounded-lg p-4 bg-white">
                                <div className="flex items-center gap-3 mb-3">
                                  {/* Show color swatches from attribute value if available */}
                                  {attributeColors.length > 0 ? (
                                    <div className="flex items-center gap-1">
                                      {attributeColors.map((colorHex, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                                          style={{ backgroundColor: colorHex }}
                                          title={colorHex}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <span
                                      className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                                      style={{ backgroundColor: primaryColorHex }}
                                    />
                                  )}
                                  <span className="text-base font-semibold text-gray-900">
                                    {colorData.colorLabel}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                  {colorData.price && (
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">{t('admin.products.add.price')}</label>
                                      <div className="text-sm font-medium text-gray-900">{colorData.price}</div>
                                    </div>
                                  )}
                                  {colorData.stock && (
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">{t('admin.products.add.stock')}</label>
                                      <div className="text-sm font-medium text-gray-900">{colorData.stock}</div>
                                    </div>
                                  )}
                                </div>
                                {colorData.sizes && colorData.sizes.length > 0 && (
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-2">{t('admin.products.add.sizesAndStock')}</label>
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
                                {(() => {
                                  // Get attribute value imageUrl if not already in images
                                  const attributeImageUrl = colorAttributeValue?.imageUrl;
                                  const allImages = [...(colorData.images || [])];
                                  if (attributeImageUrl && !allImages.includes(attributeImageUrl)) {
                                    allImages.unshift(attributeImageUrl); // Add attribute image first
                                  }
                                  
                                  return allImages.length > 0 ? (
                                    <div className="mt-3">
                                      <label className="block text-xs text-gray-500 mb-2">{t('admin.products.add.images')}</label>
                                      <div className="flex gap-2 flex-wrap">
                                        {allImages.map((img, imgIndex) => (
                                          <img
                                            key={imgIndex}
                                            src={img}
                                            alt={`${colorData.colorLabel} ${imgIndex + 1}`}
                                            className="w-20 h-20 object-cover rounded border border-gray-300"
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">{t('admin.products.add.noColorsAdded')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Select Attributes for Variants */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.selectAttributesForVariants')}</h2>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('admin.products.add.attributes')} <span className="text-gray-500 font-normal">{t('admin.products.add.selectMultiple')}</span>
                </label>
                <div className="relative" ref={attributesDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAttributesDropdownOpen(!attributesDropdownOpen)}
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm flex items-center justify-between"
                  >
                    <span className="text-gray-700">
                      {selectedAttributesForVariants.size === 0
                        ? t('admin.products.add.selectAttributes')
                        : selectedAttributesForVariants.size === 1
                          ? t('admin.products.add.attributeSelected').replace('{count}', '1')
                          : t('admin.products.add.attributesSelected').replace('{count}', selectedAttributesForVariants.size.toString())}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                        attributesDropdownOpen ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {attributesDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                      <div className="p-4">
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {t('admin.products.add.selectAttributes')}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('admin.products.add.selectAttributesDescription')}
                          </p>
                        </div>
                        {attributes.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {t('admin.products.add.noAttributesAvailable')}
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {attributes.map((attribute) => (
                              <label
                                key={attribute.id}
                                className={`flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border transition-colors ${
                                  selectedAttributesForVariants.has(attribute.id)
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAttributesForVariants.has(attribute.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedAttributesForVariants);
                                    if (e.target.checked) {
                                      newSet.add(attribute.id);
                                    } else {
                                      newSet.delete(attribute.id);
                                      // Remove selected values for this attribute
                                      const newValueIds = { ...selectedAttributeValueIds };
                                      delete newValueIds[attribute.id];
                                      setSelectedAttributeValueIds(newValueIds);
                                    }
                                    setSelectedAttributesForVariants(newSet);
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-900">{attribute.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedAttributesForVariants.size > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedAttributesForVariants).map((attributeId) => {
                        const attribute = attributes.find(a => a.id === attributeId);
                        if (!attribute) return null;
                        return (
                          <span
                            key={attributeId}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200"
                          >
                            {attribute.name}
                            <button
                              type="button"
                              onClick={() => {
                                const newSet = new Set(selectedAttributesForVariants);
                                newSet.delete(attributeId);
                                const newValueIds = { ...selectedAttributeValueIds };
                                delete newValueIds[attributeId];
                                setSelectedAttributeValueIds(newValueIds);
                                setSelectedAttributesForVariants(newSet);
                              }}
                              className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* New Multi-Attribute Variant Builder */}
            {selectedAttributesForVariants.size > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.variantBuilder') || 'Տարբերակների կառուցիչ'}</h2>
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">

                  {/* Generated Variants Table */}
                  {generatedVariants.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {t('admin.products.add.generatedVariants') || 'Generated Variants'} ({generatedVariants.length.toString()})
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const price = prompt(t('admin.products.add.enterDefaultPrice') || 'Enter default price:');
                              if (price !== null) {
                                applyToAllVariants('price', price);
                              }
                            }}
                          >
                            {t('admin.products.add.applyPriceToAll') || 'Apply Price to All'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const stock = prompt(t('admin.products.add.enterDefaultStock') || 'Enter default stock:');
                              if (stock !== null) {
                                applyToAllVariants('stock', stock);
                              }
                            }}
                          >
                            {t('admin.products.add.applyStockToAll') || 'Apply Stock to All'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const skuPrefix = prompt(t('admin.products.add.enterSkuPrefix') || 'Enter SKU prefix:');
                              if (skuPrefix !== null) {
                                const baseSlug = skuPrefix || formData.slug || generateSlug(formData.title) || 'PROD';
                                setGeneratedVariants(prev => prev.map((variant) => {
                                  // Collect all selected values from all attributes
                                  const valueParts: string[] = [];
                                  Array.from(selectedAttributesForVariants).forEach((attributeId) => {
                                    const attribute = attributes.find(a => a.id === attributeId);
                                    if (!attribute) return;
                                    
                                    const selectedIds = variant.selectedValueIds.filter(id => 
                                      attribute.values.some(v => v.id === id)
                                    );
                                    
                                    selectedIds.forEach(valueId => {
                                      const value = attribute.values.find(v => v.id === valueId);
                                      if (value) {
                                        valueParts.push(value.value.toUpperCase().replace(/\s+/g, '-'));
                                      }
                                    });
                                  });
                                  
                                  const sku = valueParts.length > 0 
                                    ? `${baseSlug.toUpperCase()}-${valueParts.join('-')}`
                                    : `${baseSlug.toUpperCase()}`;
                                  
                                  return { ...variant, sku };
                                }));
                              }
                            }}
                          >
                            {t('admin.products.add.applySkuToAll') || 'Apply SKU Pattern to All'}
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-gray-300 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 bg-white">
                          <thead className="bg-gray-50">
                            <tr>
                              {Array.from(selectedAttributesForVariants).map((attributeId) => {
                                const attribute = attributes.find(a => a.id === attributeId);
                                return attribute ? (
                                  <th key={attributeId} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {attribute.name}
                                  </th>
                                ) : null;
                              })}
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.price')}
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.compareAtPrice')}
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.stock')}
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.sku')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {generatedVariants.length > 0 && generatedVariants.map((variant) => (
                              <tr key={variant.id} className="hover:bg-gray-50">
                                {Array.from(selectedAttributesForVariants).map((attributeId) => {
                                  const attribute = attributes.find(a => a.id === attributeId);
                                  if (!attribute) return null;
                                  
                                  const isColor = attribute.key === 'color';
                                  // Get selected values for this attribute in this variant
                                  const selectedValueIds = variant.selectedValueIds.filter(id => {
                                    return attribute.values.some(v => v.id === id);
                                  });
                                  const selectedValues = selectedValueIds.map(valueId => {
                                    const value = attribute.values.find(v => v.id === valueId);
                                    return value ? {
                                      id: value.id,
                                      label: value.label,
                                      value: value.value,
                                      colorHex: isColor ? (value.colors?.[0] || getColorHex(value.label)) : null,
                                    } : null;
                                  }).filter((v): v is NonNullable<typeof v> => v !== null);
                                  
                                  // Create unique key for this cell's dropdown
                                  const cellDropdownKey = `${variant.id}-${attributeId}`;
                                  
                                  return (
                                    <td key={attributeId} className="px-4 py-3 whitespace-nowrap">
                                      <div className="relative" ref={(el) => { valueDropdownRefs.current[cellDropdownKey] = el; }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenValueDropdown(openValueDropdown === cellDropdownKey ? null : cellDropdownKey);
                                          }}
                                          className="w-full text-left flex items-center gap-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          <div className="flex-1 flex flex-wrap items-center gap-1 min-w-0">
                                            {selectedValues.length > 0 ? (
                                              selectedValues.map((val) => (
                                                <span
                                                  key={val.id}
                                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                                                >
                                                  {isColor && val.colorHex && (
                                                    <span
                                                      className="inline-block w-4 h-4 rounded-full border border-gray-300"
                                                      style={{ backgroundColor: val.colorHex }}
                                                    />
                                                  )}
                                                  {val.label}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-sm text-gray-500">Click to select values</span>
                                            )}
                                          </div>
                                          <svg
                                            className={`w-4 h-4 text-gray-400 transition-transform ${openValueDropdown === cellDropdownKey ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                        
                                        {openValueDropdown === cellDropdownKey && attribute && (
                                          <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                                            <div className="p-2">
                                              {/* "All" option */}
                                              <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
                                                <input
                                                  type="checkbox"
                                                  checked={attribute.values.length > 0 && selectedValueIds.length === attribute.values.length}
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      // Select all values
                                                      const allValueIds = attribute.values.map(v => v.id);
                                                      // Add to variant's selectedValueIds (merge with existing)
                                                      const currentIds = variant.selectedValueIds;
                                                      const newIds = [...new Set([...currentIds, ...allValueIds])];
                                                      
                                                      setSelectedAttributeValueIds(prev => ({
                                                        ...prev,
                                                        [attributeId]: allValueIds,
                                                      }));
                                                      
                                                      // Update variant - merge with existing selectedValueIds
                                                      setGeneratedVariants(prev => prev.map(v => 
                                                        v.id === variant.id ? { ...v, selectedValueIds: newIds } : v
                                                      ));
                                                    } else {
                                                      // Deselect all values for this attribute
                                                      const valueIdsToRemove = attribute.values.map(v => v.id);
                                                      const newIds = variant.selectedValueIds.filter(id => !valueIdsToRemove.includes(id));
                                                      
                                                      setSelectedAttributeValueIds(prev => ({
                                                        ...prev,
                                                        [attributeId]: [],
                                                      }));
                                                      
                                                      setGeneratedVariants(prev => prev.map(v => 
                                                        v.id === variant.id ? { ...v, selectedValueIds: newIds } : v
                                                      ));
                                                    }
                                                  }}
                                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-900">All</span>
                                              </label>
                                              
                                              <div className="border-t border-gray-200 my-1"></div>
                                              
                                              {/* Individual value checkboxes */}
                                              {attribute.values.map((value) => {
                                                const isSelected = variant.selectedValueIds.includes(value.id);
                                                const valueColorHex = isColor && value.colors && value.colors.length > 0 
                                                  ? value.colors[0] 
                                                  : isColor 
                                                    ? getColorHex(value.label) 
                                                    : null;
                                                
                                                return (
                                                  <label
                                                    key={value.id}
                                                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                                      isSelected
                                                        ? 'bg-blue-50 border-2 border-blue-600'
                                                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                    }`}
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={isSelected}
                                                      onChange={(e) => {
                                                        const currentIds = variant.selectedValueIds;
                                                        let newIds: string[];
                                                        
                                                        if (e.target.checked) {
                                                          // Add value if not already selected
                                                          newIds = [...currentIds, value.id];
                                                        } else {
                                                          // Remove value
                                                          newIds = currentIds.filter(id => id !== value.id);
                                                        }
                                                        
                                                        // Update selectedAttributeValueIds for this attribute
                                                        const currentAttrIds = selectedAttributeValueIds[attributeId] || [];
                                                        let newAttrIds: string[];
                                                        if (e.target.checked) {
                                                          newAttrIds = [...currentAttrIds, value.id];
                                                        } else {
                                                          newAttrIds = currentAttrIds.filter(id => id !== value.id);
                                                        }
                                                        
                                                        // Update variant first (to preserve dropdown state)
                                                        setGeneratedVariants(prev => prev.map(v => 
                                                          v.id === variant.id ? { ...v, selectedValueIds: newIds } : v
                                                        ));
                                                        
                                                        // Then update selectedAttributeValueIds (this will trigger useEffect but variant is already updated)
                                                        setSelectedAttributeValueIds(prev => ({
                                                          ...prev,
                                                          [attributeId]: newAttrIds,
                                                        }));
                                                      }}
                                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    {isColor && valueColorHex && (
                                                      <span
                                                        className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0"
                                                        style={{ backgroundColor: valueColorHex }}
                                                      />
                                                    )}
                                                    <span className="text-sm text-gray-900 flex-1">{value.label}</span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Input
                                    type="number"
                                    value={variant.price}
                                    onChange={(e) => {
                                      setGeneratedVariants(prev => prev.map(v => 
                                        v.id === variant.id ? { ...v, price: e.target.value } : v
                                      ));
                                    }}
                                    placeholder="0.00"
                                    className="w-24 text-sm"
                                    min="0"
                                    step="0.01"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Input
                                    type="number"
                                    value={variant.compareAtPrice}
                                    onChange={(e) => {
                                      setGeneratedVariants(prev => prev.map(v => 
                                        v.id === variant.id ? { ...v, compareAtPrice: e.target.value } : v
                                      ));
                                    }}
                                    placeholder="0.00"
                                    className="w-24 text-sm"
                                    min="0"
                                    step="0.01"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Input
                                    type="number"
                                    value={variant.stock}
                                    onChange={(e) => {
                                      setGeneratedVariants(prev => prev.map(v => 
                                        v.id === variant.id ? { ...v, stock: e.target.value } : v
                                      ));
                                    }}
                                    placeholder="0"
                                    className="w-24 text-sm"
                                    min="0"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Input
                                    type="text"
                                    value={variant.sku}
                                    onChange={(e) => {
                                      setGeneratedVariants(prev => prev.map(v => 
                                        v.id === variant.id ? { ...v, sku: e.target.value } : v
                                      ));
                                    }}
                                    placeholder="Auto-generated"
                                    className="w-32 text-sm"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            // Add new empty variant
                            const newVariant = {
                              id: `variant-${Date.now()}-${Math.random()}`,
                              selectedValueIds: [],
                              price: "0.00",
                              compareAtPrice: "0.00",
                              stock: "0",
                              sku: "PROD",
                              image: null,
                            };
                            setGeneratedVariants(prev => [...prev, newVariant]);
                            console.log('✅ [VARIANT BUILDER] New variant added:', newVariant);
                          }}
                        >
                          {t('admin.products.add.addVariant') || 'Add'}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            // Convert generated variants to formData.variants structure
                            // This will be handled in handleSubmit
                            console.log('✅ [VARIANT BUILDER] Variants ready for submission:', generatedVariants);
                            alert(t('admin.products.add.variantsReady') || `Ready to submit ${generatedVariants.length.toString()} variants!`);
                          }}
                        >
                          {t('admin.products.add.variantsReady') || 'Variants Ready'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Publishing */}
            <div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData((prev) => ({ ...prev, featured: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <span aria-hidden="true">⭐</span>
                    {t('admin.products.add.markAsFeatured')}
                  </span>
                </label>
              </div>
            </div>

            {/* Actions - Sticky */}
            <div className="sticky bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg -mx-6 -mb-6 px-6 py-4 mt-8 backdrop-blur-sm bg-white/95">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-full">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="flex-1 w-full sm:w-auto order-2 sm:order-1"
                >
                  {loading ? (isEditMode ? t('admin.products.add.updating') : t('admin.products.add.creating')) : (isEditMode ? t('admin.products.add.updateProduct') : t('admin.products.add.createProduct'))}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/products')}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {t('admin.common.cancel')}
                </Button>
              </div>
            </div>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AddProductPageContent />
    </Suspense>
  );
}
