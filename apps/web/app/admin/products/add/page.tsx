'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../../lib/api-client';
import { getColorHex } from '../../../../lib/colorMap';
import { useTranslation } from '../../../../lib/i18n-client';
import { convertPrice, CURRENCIES, type CurrencyCode } from '../../../../lib/currency';
import {
  smartSplitUrls,
  cleanImageUrls,
  separateMainAndVariantImages,
  processImageFile,
} from '../../../../lib/utils/image-utils';

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
  attributeIds?: string[]; // All attribute IDs that this product has
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
  const variantImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const attributesDropdownRef = useRef<HTMLDivElement | null>(null);
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
  // Default currency from settings
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>('AMD');
  
  // Product Type: 'simple' or 'variable' (default: 'variable')
  const [productType, setProductType] = useState<'simple' | 'variable'>('variable');
  // Simple product fields (only used when productType === 'simple')
  const [simpleProductData, setSimpleProductData] = useState({
    price: '',
    compareAtPrice: '',
    sku: '',
    quantity: '',
  });
  // New Multi-Attribute Variant Builder state
  const [selectedAttributesForVariants, setSelectedAttributesForVariants] = useState<Set<string>>(new Set()); // Selected attribute IDs
  const [selectedAttributeValueIds, setSelectedAttributeValueIds] = useState<Record<string, string[]>>({}); // Key: attributeId, Value: array of selected value IDs
  // State for managing value selection modal
  const [openValueModal, setOpenValueModal] = useState<{ variantId: string; attributeId: string } | null>(null);
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


  // Load default currency from settings
  useEffect(() => {
    const loadDefaultCurrency = async () => {
      try {
        const settingsRes = await apiClient.get<{ defaultCurrency?: string }>('/api/v1/admin/settings');
        const currency = (settingsRes.defaultCurrency || 'AMD') as CurrencyCode;
        if (currency in CURRENCIES) {
          setDefaultCurrency(currency);
          console.log('✅ [ADMIN] Default currency loaded:', currency);
        }
      } catch (err) {
        console.error('❌ [ADMIN] Error loading default currency:', err);
        // Use AMD as default
        setDefaultCurrency('AMD');
      }
    };
    
    if (isLoggedIn && isAdmin) {
      loadDefaultCurrency();
    }
  }, [isLoggedIn, isAdmin]);

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
            values: attr.values?.map(v => ({ 
              value: v.value, 
              label: v.label,
              colors: v.colors,
              colorsType: typeof v.colors,
              colorsIsArray: Array.isArray(v.colors),
              colorsLength: v.colors?.length,
              imageUrl: v.imageUrl 
            })) || []
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
            
            // Try to get color from variant.options
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
                // Convert prices from USD (database) to defaultCurrency (display)
                const priceInDefaultCurrency = variant.price !== undefined && variant.price !== null 
                  ? convertPrice(variant.price, 'USD', defaultCurrency) 
                  : 0;
                const compareAtPriceInDefaultCurrency = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null 
                  ? convertPrice(variant.compareAtPrice, 'USD', defaultCurrency) 
                  : 0;
                
                const colorData: ColorData = {
                  colorValue: defaultColor,
                  colorLabel: defaultColorLabel,
                  images: smartSplitUrls(variant.imageUrl),
                  stock: size ? '' : stockValue,
                  price: variant.price !== undefined && variant.price !== null ? String(priceInDefaultCurrency) : '',
                  compareAtPrice: variant.compareAtPrice !== undefined && variant.compareAtPrice !== null ? String(compareAtPriceInDefaultCurrency) : '',
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
                    colorData.sizePrices![size] = String(priceInDefaultCurrency);
                  }
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    colorData.sizeCompareAtPrices![size] = String(compareAtPriceInDefaultCurrency);
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
                    const priceInDefaultCurrency = convertPrice(variant.price, 'USD', defaultCurrency);
                    existingColorData.sizePrices[size] = String(priceInDefaultCurrency);
                  }
                  if (!existingColorData.sizeCompareAtPrices) existingColorData.sizeCompareAtPrices = {};
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    const compareAtPriceInDefaultCurrency = convertPrice(variant.compareAtPrice, 'USD', defaultCurrency);
                    existingColorData.sizeCompareAtPrices[size] = String(compareAtPriceInDefaultCurrency);
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
                // Convert prices from USD (database) to defaultCurrency (display)
                const priceInDefaultCurrency = variant.price !== undefined && variant.price !== null 
                  ? convertPrice(variant.price, 'USD', defaultCurrency) 
                  : 0;
                const compareAtPriceInDefaultCurrency = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null 
                  ? convertPrice(variant.compareAtPrice, 'USD', defaultCurrency) 
                  : 0;
                
                const colorData: ColorData = {
                  colorValue: color,
                  colorLabel: colorLabel,
                  images: smartSplitUrls(variant.imageUrl),
                  stock: size ? '' : stockValue, // Base stock only if no size
                  price: variant.price !== undefined && variant.price !== null ? String(priceInDefaultCurrency) : '',
                  compareAtPrice: variant.compareAtPrice !== undefined && variant.compareAtPrice !== null ? String(compareAtPriceInDefaultCurrency) : '',
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
                  // Store size-specific price (converted to defaultCurrency)
                  if (variant.price !== undefined && variant.price !== null) {
                    colorData.sizePrices![size] = String(priceInDefaultCurrency);
                  }
                  // Store size-specific compareAtPrice (converted to defaultCurrency)
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    colorData.sizeCompareAtPrices![size] = String(compareAtPriceInDefaultCurrency);
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
                  // Store size-specific price (converted to defaultCurrency)
                  if (!existingColorData.sizePrices) existingColorData.sizePrices = {};
                  if (variant.price !== undefined && variant.price !== null) {
                    const priceInDefaultCurrency = convertPrice(variant.price, 'USD', defaultCurrency);
                    existingColorData.sizePrices[size] = String(priceInDefaultCurrency);
                  }
                  // Store size-specific compareAtPrice (converted to defaultCurrency)
                  if (!existingColorData.sizeCompareAtPrices) existingColorData.sizeCompareAtPrices = {};
                  if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
                    const compareAtPriceInDefaultCurrency = convertPrice(variant.compareAtPrice, 'USD', defaultCurrency);
                    existingColorData.sizeCompareAtPrices[size] = String(compareAtPriceInDefaultCurrency);
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
            
            // Use first variant's price, compareAtPrice, sku as defaults (converted to defaultCurrency)
            if (index === 0) {
              const firstPriceUSD = variant.price !== undefined && variant.price !== null ? variant.price : 0;
              const firstCompareAtPriceUSD = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null ? variant.compareAtPrice : 0;
              firstPrice = firstPriceUSD > 0 ? String(convertPrice(firstPriceUSD, 'USD', defaultCurrency)) : '';
              firstCompareAtPrice = firstCompareAtPriceUSD > 0 ? String(convertPrice(firstCompareAtPriceUSD, 'USD', defaultCurrency)) : '';
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
          // IMPORTANT: Also collect variant images directly from variant.imageUrl (new format)
          const variantImages = new Set<string>();
          
          // Collect images from mergedVariant.colors
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
          
          // Also collect images directly from variant.imageUrl (new format - for generatedVariants)
          console.log('🖼️ [ADMIN] Collecting variant images from product.variants...');
          (product.variants || []).forEach((variant: any, idx: number) => {
            if (variant.imageUrl) {
              // For base64 images, don't split by comma (base64 strings can contain commas)
              // Only split if it's not a base64 string
              if (typeof variant.imageUrl === 'string' && variant.imageUrl.startsWith('data:')) {
                // Base64 image - use full string, don't split
                variantImages.add(variant.imageUrl);
                console.log(`  ✅ Added variant base64 image (length: ${variant.imageUrl.length})`);
              } else {
                // Regular URL - can be comma-separated
                const imageUrls = typeof variant.imageUrl === 'string' 
                  ? variant.imageUrl.split(',').map((url: string) => url.trim()).filter(Boolean)
                  : [];
                imageUrls.forEach((url: string) => {
                  if (url) {
                    // Regular URL - normalize
                    variantImages.add(url);
                    const normalizedWithSlash = url.startsWith('/') ? url : `/${url}`;
                    const normalizedWithoutSlash = url.startsWith('/') ? url.substring(1) : url;
                    variantImages.add(normalizedWithSlash);
                    variantImages.add(normalizedWithoutSlash);
                    const urlWithoutQuery = url.split('?')[0];
                    if (urlWithoutQuery !== url) {
                      variantImages.add(urlWithoutQuery);
                      const normalizedWithoutQuery = urlWithoutQuery.startsWith('/') ? urlWithoutQuery : `/${urlWithoutQuery}`;
                      variantImages.add(normalizedWithoutQuery);
                    }
                    console.log(`  ✅ Added variant URL: ${url.substring(0, 50)}...`);
                  }
                });
              }
            } else {
              console.log(`🖼️ [ADMIN] Variant ${idx} has no imageUrl`);
            }
          });
          console.log(`🖼️ [ADMIN] Total variant images collected: ${variantImages.size}`);

          // Helper function to normalize URL for comparison
          const normalizeUrlForComparison = (url: string): string[] => {
            if (!url) return [];
            // For base64 images, use the full string for comparison
            if (url.startsWith('data:')) {
              return [url];
            }
            // For regular URLs, normalize them
            const normalized = url.trim();
            const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
            const withoutSlash = normalized.startsWith('/') ? normalized.substring(1) : normalized;
            const withoutQuery = normalized.split('?')[0];
            const withoutQueryWithSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
            return [normalized, withSlash, withoutSlash, withoutQuery, withoutQueryWithSlash];
          };

          const mediaList = product.media || [];
          console.log('🖼️ [ADMIN] Loading main media images. Total media:', mediaList.length);
          
          // Use unified utilities to properly separate and clean images
          // In edit mode, we show main images separately from variant images
          // product.media is already cleaned in findBySlug, but we ensure proper separation here
          const { main } = separateMainAndVariantImages(
            Array.isArray(mediaList) ? mediaList : [],
            variantImages.size > 0 ? Array.from(variantImages) : []
          );
          
          const normalizedMedia = cleanImageUrls(main);
          console.log(`🖼️ [ADMIN] Main media loaded: ${normalizedMedia.length} images (after separation from ${variantImages.size} variant images)`);
          
          // Find featured image index from original mediaList (before filtering)
          const featuredIndexFromApi = Array.isArray(mediaList)
            ? mediaList.findIndex((item: any) => {
                const url = typeof item === 'string' ? item : item?.url || '';
                if (!url) return false;
                // Check if this item is marked as featured
                return typeof item === 'object' && item?.isFeatured === true;
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
            // Sync mainProductImage with featured image from imageUrls
            mainProductImage: normalizedMedia.length > 0 && normalizedMedia[featuredIndexFromApi >= 0 && featuredIndexFromApi < normalizedMedia.length ? featuredIndexFromApi : 0]
              ? normalizedMedia[featuredIndexFromApi >= 0 && featuredIndexFromApi < normalizedMedia.length ? featuredIndexFromApi : 0]
              : mainProductImage || '',
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
          
          // Store product variants temporarily to convert after attributes are loaded
          // We'll convert them in a separate useEffect that waits for attributes
          if (product.variants && product.variants.length > 0) {
            // Store product data for later conversion
            (window as any).__productVariantsToConvert = product.variants;
          }
          
          // Store product's attributeIds to show all attributes, not just ones used in variants
          if (product.attributeIds && product.attributeIds.length > 0) {
            (window as any).__productAttributeIds = product.attributeIds;
            console.log('📋 [ADMIN] Product attributeIds loaded:', product.attributeIds);
          }
          
          // Check if product has variants with attributes
          // IMPORTANT: A product is "simple" if variants don't have attributes (color, size, etc.)
          // Even if product has attributeIds, if variants don't use them, it's still simple
          const variants = product.variants || [];
          const hasVariants = variants.length > 0;
          const hasVariantsWithAttributes = hasVariants && 
            variants.some((variant: any) => {
              // Check if variant has attributes in JSONB column
              if (variant.attributes && typeof variant.attributes === 'object' && Object.keys(variant.attributes).length > 0) {
                return true;
              }
              // Check if variant has options
              if (variant.options && Array.isArray(variant.options) && variant.options.length > 0) {
                return true;
              }
              return false;
            });
          
          // Log for debugging
          console.log('📦 [ADMIN] Product type check:', {
            hasVariants,
            variantsCount: variants.length,
            hasVariantsWithAttributes,
            firstVariant: hasVariants && variants.length > 0 ? {
              hasAttributes: !!(variants[0] && (variants[0] as any).attributes && typeof (variants[0] as any).attributes === 'object' && Object.keys((variants[0] as any).attributes).length > 0),
              hasOptions: !!((variants[0] as any).options && Array.isArray((variants[0] as any).options) && (variants[0] as any).options.length > 0),
              attributes: (variants[0] as any).attributes,
              optionsCount: ((variants[0] as any).options?.length || 0),
            } : null,
          });
          
          // If variants don't have attributes, set to simple (even if product has attributeIds)
          if (!hasVariantsWithAttributes) {
            console.log('📦 [ADMIN] Product variants have no attributes, setting productType to "simple"');
            setProductType('simple');
            
            // Also set simple product data from first variant if available
            if (hasVariants && variants.length > 0) {
              const firstVariant = variants[0] as any;
              setSimpleProductData({
                price: firstVariant.price ? String(convertPrice(typeof firstVariant.price === 'number' ? firstVariant.price : parseFloat(String(firstVariant.price || '0')), 'USD', defaultCurrency)) : '',
                compareAtPrice: firstVariant.compareAtPrice ? String(convertPrice(typeof firstVariant.compareAtPrice === 'number' ? firstVariant.compareAtPrice : parseFloat(String(firstVariant.compareAtPrice || '0')), 'USD', defaultCurrency)) : '',
                sku: firstVariant.sku || '',
                quantity: String(firstVariant.stock || 0),
              });
            } else {
              // No variants at all, set empty simple product data
              setSimpleProductData({
                price: '',
                compareAtPrice: '',
                sku: '',
                quantity: '0',
              });
            }
          } else {
            // Variants have attributes, keep it as variable
            console.log('📦 [ADMIN] Product variants have attributes, keeping productType as "variable"');
            setProductType('variable');
          }
          
          console.log('✅ [ADMIN] Product loaded for edit');
        } catch (err: any) {
          console.error('❌ [ADMIN] Error loading product:', err);
          router.push('/admin/products');
        } finally {
          setLoadingProduct(false);
        }
      };
      
      loadProduct();
    }
  }, [productId, isLoggedIn, isAdmin, router, attributes]);

  // Convert product variants to generatedVariants format after attributes are loaded
  useEffect(() => {
    if (productId && attributes.length > 0 && (window as any).__productVariantsToConvert) {
      const productVariants = (window as any).__productVariantsToConvert;
      console.log('🔄 [ADMIN] Converting product variants to generatedVariants format:', {
        variantsCount: productVariants.length,
        attributesCount: attributes.length,
        firstVariant: productVariants[0],
      });
      
      // Collect all unique attribute IDs and value IDs from all variants
      const attributeIdsSet = new Set<string>();
      const attributeValueIdsMap: Record<string, string[]> = {};
      
      // First pass: collect all attributes and their values from all variants
      productVariants.forEach((variant: any) => {
        if (variant.options && Array.isArray(variant.options)) {
          variant.options.forEach((opt: any) => {
            // Try to get attributeId and valueId directly or from attributeValue relation
            let attributeId = opt.attributeId;
            let valueId = opt.valueId;
            
            // If not directly available, try to get from attributeValue relation
            if (!attributeId && opt.attributeValue) {
              attributeId = opt.attributeValue.attributeId || opt.attributeValue.attribute?.id;
            }
            if (!valueId && opt.attributeValue) {
              valueId = opt.attributeValue.id;
            }
            
            if (attributeId && valueId) {
              attributeIdsSet.add(attributeId);
              
              if (!attributeValueIdsMap[attributeId]) {
                attributeValueIdsMap[attributeId] = [];
              }
              if (!attributeValueIdsMap[attributeId].includes(valueId)) {
                attributeValueIdsMap[attributeId].push(valueId);
              }
            }
          });
        }
      });
      
      // Also include product's attributeIds (all attributes that the product has, not just ones used in variants)
      const productAttributeIds = (window as any).__productAttributeIds || [];
      if (productAttributeIds.length > 0) {
        console.log('📋 [ADMIN] Adding product attributeIds to selected attributes:', productAttributeIds);
        productAttributeIds.forEach((attrId: string) => {
          attributeIdsSet.add(attrId);
        });
      }
      
      // Set selected attributes for variants (includes both variant attributes and product attributes)
      if (attributeIdsSet.size > 0) {
        console.log('📋 [ADMIN] Setting selectedAttributesForVariants with all attributes:', Array.from(attributeIdsSet));
        setSelectedAttributesForVariants(attributeIdsSet);
      }
      
      // Set selected attribute value IDs (all unique values from all variants)
      // This ensures all values are available for selection in the UI
      if (Object.keys(attributeValueIdsMap).length > 0) {
        setSelectedAttributeValueIds(attributeValueIdsMap);
      }
      
      // Convert each variant to generatedVariants format
      // NEW LOGIC: Group variants by their attribute values, price, compareAtPrice, and stock
      // This matches the Add New Product UI where one variant row shows all values
      // Extract attribute values from JSONB attributes column or from options
      
      // First, collect all variant data with their attribute values
      interface VariantData {
        id: string;
        selectedValueIds: string[];
        price: number;
        compareAtPrice: number | null;
        stock: number;
        sku: string;
        image: string | null;
        originalVariantIds: string[]; // Keep track of original variant IDs for reference
      }
      
      const variantDataList: VariantData[] = [];
      
      productVariants.forEach((variant: any, variantIndex: number) => {
        const selectedValueIds: string[] = [];
        
        // First, try to get attribute values from JSONB attributes column
        if (variant.attributes && typeof variant.attributes === 'object') {
          console.log(`🔍 [ADMIN] Variant ${variantIndex} has attributes JSONB:`, variant.attributes);
          
          // Iterate through all attributes in JSONB
          Object.keys(variant.attributes).forEach((attributeKey) => {
            const attribute = attributes.find(a => a.key === attributeKey);
            if (!attribute) {
              console.warn(`⚠️ [ADMIN] Attribute not found for key: ${attributeKey}`);
              return;
            }
            
            const attributeValues = variant.attributes[attributeKey];
            if (Array.isArray(attributeValues)) {
              attributeValues.forEach((attrValue: any) => {
                // Support both formats: {valueId, value, attributeKey} or just value string
                const valueId = attrValue.valueId || attrValue.id;
                const value = attrValue.value || attrValue;
                
                if (valueId) {
                  // If we have valueId, use it directly
                  if (!selectedValueIds.includes(valueId)) {
                    selectedValueIds.push(valueId);
                  }
                } else if (value) {
                  // If we only have value string, find the corresponding valueId
                  const foundValue = attribute.values.find(v => 
                    v.value === value || v.label === value
                  );
                  if (foundValue && !selectedValueIds.includes(foundValue.id)) {
                    selectedValueIds.push(foundValue.id);
                  }
                }
              });
            }
          });
        }
        
        // Fallback: collect valueIds from variant options if JSONB is empty
        if (selectedValueIds.length === 0 && variant.options && Array.isArray(variant.options)) {
          console.log(`🔍 [ADMIN] Variant ${variantIndex} using options fallback:`, variant.options);
          
          // Group options by attribute to collect all values for each attribute
          const attributeValueMap: Record<string, Set<string>> = {};
          
          variant.options.forEach((opt: any) => {
            // Try to get attributeId and valueId directly or from attributeValue relation
            let attributeId = opt.attributeId;
            let valueId = opt.valueId;
            let attributeKey = opt.attributeKey;
            
            // If not directly available, try to get from attributeValue relation
            if (!attributeId && opt.attributeValue) {
              attributeId = opt.attributeValue.attributeId || opt.attributeValue.attribute?.id || opt.attributeValue.attributeId;
              attributeKey = opt.attributeValue.attribute?.key || opt.attributeValue.attributeKey;
            }
            if (!valueId && opt.attributeValue) {
              valueId = opt.attributeValue.id || opt.attributeValue.valueId;
            }
            
            // Additional fallback: try to find attribute by key in attributes array
            if (!attributeId && opt.attributeKey) {
              const foundAttr = attributes.find(a => a.key === opt.attributeKey);
              if (foundAttr) {
                attributeId = foundAttr.id;
                attributeKey = foundAttr.key;
              }
            }
            
            // Additional fallback: try to find value by value string in attributes
            if (attributeId && !valueId && opt.value) {
              const foundAttr = attributes.find(a => a.id === attributeId);
              if (foundAttr) {
                const foundValue = foundAttr.values.find(v => v.value === opt.value || v.label === opt.value);
                if (foundValue) {
                  valueId = foundValue.id;
                }
              }
            }
            
            // Group by attribute key to collect all values for this variant
            if (attributeKey && valueId) {
              if (!attributeValueMap[attributeKey]) {
                attributeValueMap[attributeKey] = new Set();
              }
              attributeValueMap[attributeKey].add(valueId);
            }
          });
          
          // Collect all valueIds from all attributes for this variant
          Object.values(attributeValueMap).forEach((valueIdSet) => {
            valueIdSet.forEach((valueId) => {
              if (!selectedValueIds.includes(valueId)) {
                selectedValueIds.push(valueId);
              }
            });
          });
        }
        
        // Extract image URL from variant.imageUrl (can be comma-separated)
        let variantImage: string | null = null;
        if (variant.imageUrl) {
          // For base64 images, don't split by comma (base64 strings can contain commas)
          // Only split if it's not a base64 string
          if (typeof variant.imageUrl === 'string' && variant.imageUrl.startsWith('data:')) {
            // Base64 image - use full string, don't split
            variantImage = variant.imageUrl;
            console.log(`🖼️ [ADMIN] Variant ${variantIndex} base64 image length:`, variantImage?.length || 0);
          } else {
            // Regular URL - can be comma-separated
            const imageUrls = typeof variant.imageUrl === 'string' 
              ? variant.imageUrl.split(',').map((url: string) => url.trim()).filter(Boolean)
              : [];
            variantImage = imageUrls.length > 0 ? imageUrls[0] : null;
            console.log(`🖼️ [ADMIN] Variant ${variantIndex} imageUrl length:`, variant.imageUrl?.length || 0, '→ extracted image length:', variantImage?.length || 0);
          }
        } else {
          console.log(`🖼️ [ADMIN] Variant ${variantIndex} has no imageUrl`);
        }
        
        // Convert prices from USD to defaultCurrency for display
        const priceInDefaultCurrency = variant.price !== undefined && variant.price !== null 
          ? convertPrice(variant.price, 'USD', defaultCurrency)
          : 0;
        const compareAtPriceInDefaultCurrency = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null 
          ? convertPrice(variant.compareAtPrice, 'USD', defaultCurrency)
          : null;
        
        variantDataList.push({
          id: variant.id || `variant-${Date.now()}-${variantIndex}-${Math.random()}`,
          selectedValueIds: selectedValueIds.sort(), // Sort for consistent grouping
          price: priceInDefaultCurrency,
          compareAtPrice: compareAtPriceInDefaultCurrency,
          stock: variant.stock !== undefined && variant.stock !== null ? variant.stock : 0,
          sku: variant.sku || '',
          image: variantImage,
          originalVariantIds: [variant.id || `variant-${variantIndex}`],
        });
      });
      
      // Group variants by their attribute values, price, compareAtPrice, and stock
      // Variants with the same combination of these should be grouped together
      const variantGroups = new Map<string, VariantData[]>();
      
      variantDataList.forEach((variantData) => {
        // Create a unique key for grouping based on:
        // 1. Sorted attribute value IDs (same values = same group)
        // 2. Price
        // 3. CompareAtPrice
        // 4. Stock (if all variants have the same stock, they can be grouped)
        const valueIdsKey = variantData.selectedValueIds.join(',');
        const priceKey = variantData.price.toString();
        const compareAtPriceKey = variantData.compareAtPrice !== null ? variantData.compareAtPrice.toString() : 'null';
        const stockKey = variantData.stock.toString();
        
        // Group key: combine all factors
        // Note: We group by valueIds, price, and compareAtPrice
        // Stock can vary per combination, so we don't include it in the group key
        // Instead, we'll use the first variant's stock as the default
        const groupKey = `${valueIdsKey}|${priceKey}|${compareAtPriceKey}`;
        
        if (!variantGroups.has(groupKey)) {
          variantGroups.set(groupKey, []);
        }
        variantGroups.get(groupKey)!.push(variantData);
      });
      
      // Convert grouped variants to generatedVariants format
      // Each group becomes one variant row with all value IDs combined
      const convertedVariants: Array<{
        id: string;
        selectedValueIds: string[];
        price: string;
        compareAtPrice: string;
        stock: string;
        sku: string;
        image: string | null;
      }> = [];
      
      variantGroups.forEach((group, groupKey) => {
        // Combine all value IDs from all variants in this group
        const allValueIds = new Set<string>();
        group.forEach(variantData => {
          variantData.selectedValueIds.forEach(valueId => {
            allValueIds.add(valueId);
          });
        });
        
        // Use the first variant's data as the base (price, compareAtPrice, stock, sku, image)
        const firstVariant = group[0];
        
        // For stock, if all variants in the group have the same stock, use that
        // Otherwise, use the first variant's stock (or sum if needed)
        const allStocksSame = group.every(v => v.stock === firstVariant.stock);
        const stockValue = allStocksSame ? firstVariant.stock : firstVariant.stock;
        
        // Combine SKUs if multiple variants (for reference)
        const combinedSku = group.length === 1 
          ? firstVariant.sku 
          : group.map(v => v.sku).filter(Boolean).join(', ');
        
        // Use first variant's image, or combine if multiple
        const combinedImage = firstVariant.image;
        
        convertedVariants.push({
          id: `variant-group-${Date.now()}-${Math.random()}`, // New ID for grouped variant
          selectedValueIds: Array.from(allValueIds).sort(), // All unique value IDs from the group
          price: firstVariant.price.toString(),
          compareAtPrice: firstVariant.compareAtPrice !== null ? firstVariant.compareAtPrice.toString() : '',
          stock: stockValue.toString(),
          sku: combinedSku,
          image: combinedImage,
        });
        
        console.log(`✅ [ADMIN] Grouped ${group.length} variants into 1 row:`, {
          groupKey,
          valueIds: Array.from(allValueIds),
          price: firstVariant.price,
          stock: stockValue,
          originalVariantIds: group.flatMap(v => v.originalVariantIds),
        });
      });
      
      if (convertedVariants.length > 0) {
        setGeneratedVariants(convertedVariants);
        console.log('✅ [ADMIN] Converted product variants to generatedVariants:', {
          totalVariants: convertedVariants.length,
          totalOriginalVariants: productVariants.length,
          attributeValueIdsMap,
          convertedVariants: convertedVariants.map(v => ({
            id: v.id,
            valueIdsCount: v.selectedValueIds.length,
            price: v.price,
            stock: v.stock,
            sku: v.sku,
          })),
        });
        // Clear the temporary storage
        delete (window as any).__productVariantsToConvert;
      } else {
        console.warn('⚠️ [ADMIN] No variants converted. Check variant options structure:', {
          variantsCount: productVariants.length,
          firstVariantOptions: productVariants[0]?.options,
        });
      }
    } else if (productId && attributes.length > 0) {
      console.log('ℹ️ [ADMIN] Waiting for variants to convert. Attributes loaded:', attributes.length);
    }
  }, [productId, attributes]);

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
  // FIXED: Preserves manually added variants (those with ID !== 'variant-all')
  const generateVariantsFromAttributes = () => {
    console.log('🚀 [VARIANT BUILDER] Generating single variant with all attributes...');
    
    const selectedAttrs = Array.from(selectedAttributesForVariants);
    if (selectedAttrs.length === 0) {
      console.log('⚠️ [VARIANT BUILDER] No attributes selected');
      setGeneratedVariants([]);
      return;
    }

    // Preserve existing variant's data (price, stock, etc.) when regenerating
    // IMPORTANT: Preserve manually added variants (those with ID !== 'variant-all')
    setGeneratedVariants(prev => {
      // Separate manually added variants from auto-generated variant
      const manuallyAddedVariants = prev.filter(v => v.id !== 'variant-all');
      const existingAutoVariant = prev.find(v => v.id === 'variant-all');
      
      // If there are manually added variants, don't create auto-generated variant
      // Only create auto-generated variant if there are no manual variants
      if (manuallyAddedVariants.length > 0) {
        console.log('✅ [VARIANT BUILDER] Manual variants exist, skipping auto-generated variant');
        return manuallyAddedVariants;
      }
      
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

      // Create/update auto-generated variant with all attributes
      const autoVariant = {
        id: variantId,
        selectedValueIds: allSelectedValueIds, // All selected values from all attributes
        price: existingAutoVariant?.price || '',
        compareAtPrice: existingAutoVariant?.compareAtPrice || '',
        stock: existingAutoVariant?.stock || '',
        sku: existingAutoVariant?.sku || sku, // Preserve existing SKU if set, otherwise use generated
        image: existingAutoVariant?.image || null,
      };

      // Return only auto-generated variant (no manual variants)
      const result = [autoVariant];
      console.log('✅ [VARIANT BUILDER] Variants updated:', {
        manuallyAdded: 0,
        autoGenerated: 1,
        total: result.length
      });
      return result;
    });
    
    console.log('✅ [VARIANT BUILDER] Single variant generated with', selectedAttrs.length, 'attributes');
  };

  // Update variants when attributes or values change
  // NEW LOGIC: Generate variants when at least one attribute is selected (even without values)
  useEffect(() => {
    // In edit mode, don't auto-generate variants if we're still loading or have already loaded variants
    // This prevents clearing variants that were loaded from the product
    if (isEditMode && productId && (window as any).__productVariantsToConvert) {
      // Still loading variants, don't generate yet
      return;
    }
    
    if (selectedAttributesForVariants.size > 0) {
      // Generate variants for all selected attributes, even if no values selected yet
      generateVariantsFromAttributes();
    } else {
      // Only clear variants if not in edit mode (to preserve loaded variants)
      if (!isEditMode) {
        setGeneratedVariants([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttributesForVariants, selectedAttributeValueIds, attributes, formData.slug, formData.title, isEditMode, productId]);

  // Apply value to all variants
  const applyToAllVariants = (field: 'price' | 'compareAtPrice' | 'stock' | 'sku', value: string) => {
    setGeneratedVariants(prev => prev.map(variant => ({
      ...variant,
      [field]: value,
    })));
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
      const finalFeaturedIndex = newUrls.length === 0 ? 0 : Math.min(featuredIndex, newUrls.length - 1);
      const mainImage = newUrls.length > 0 && newUrls[finalFeaturedIndex] ? newUrls[finalFeaturedIndex] : '';
      return {
        ...prev,
        imageUrls: newUrls,
        featuredImageIndex: finalFeaturedIndex,
        mainProductImage: mainImage, // Sync mainProductImage with featured image
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
    setFormData((prev) => {
      if (index < 0 || index >= prev.imageUrls.length) {
        return prev; // Invalid index, don't update
      }
      const mainImage = prev.imageUrls[index] || '';
      return {
        ...prev,
        featuredImageIndex: index,
        mainProductImage: mainImage, // Sync mainProductImage with featured image
      };
    });
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

    console.log('📸 [UPLOAD] Starting upload of', files.length, 'image(s)');
    setImageUploadLoading(true);
    setImageUploadError(null);
    try {
      // Process all files in parallel using Promise.allSettled to handle errors gracefully
      // This ensures all files are processed and prevents off-by-one errors
      const uploadedImages: string[] = [];
      const errors: string[] = [];
      
      // Create promises for all files to process them in parallel
      const filePromises = files.map(async (file, index) => {
        try {
          if (!file.type.startsWith('image/')) {
            const errorMsg = `"${file.name}" is not an image file`;
            console.warn(`⚠️ [UPLOAD] Skipping non-image file ${index + 1}/${files.length}:`, file.name);
            return { success: false, error: errorMsg, index };
          }
          
          console.log(`📸 [UPLOAD] Processing file ${index + 1}/${files.length}:`, file.name, `(${Math.round(file.size / 1024)}KB)`);
          
          // Process image with compression, EXIF orientation correction, and resize
          const base64 = await processImageFile(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/jpeg',
            initialQuality: 0.8
          });
          
          if (base64 && base64.trim()) {
            console.log(`✅ [UPLOAD] Successfully processed file ${index + 1}/${files.length}:`, file.name);
            return { success: true, base64, index };
          } else {
            const errorMsg = `Failed to convert "${file.name}" to base64`;
            console.error(`❌ [UPLOAD] Empty base64 result for file ${index + 1}/${files.length}:`, file.name);
            return { success: false, error: errorMsg, index };
          }
        } catch (error: any) {
          const errorMsg = `Error processing "${file.name}": ${error?.message || 'Unknown error'}`;
          console.error(`❌ [UPLOAD] Error processing file ${index + 1}/${files.length}:`, file.name, error);
          return { success: false, error: errorMsg, index };
        }
      });

      // Wait for all files to be processed (both successful and failed)
      const results = await Promise.allSettled(filePromises);
      
      // Process results in order to maintain file order
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const fileResult = result.value;
          if (fileResult.success && fileResult.base64) {
            uploadedImages.push(fileResult.base64);
          } else if (!fileResult.success && fileResult.error) {
            errors.push(fileResult.error);
          }
        } else {
          const errorMsg = `Failed to process file ${index + 1}: ${result.reason?.message || 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ [UPLOAD] Promise rejected for file ${index + 1}:`, result.reason);
        }
      });

      console.log('📸 [UPLOAD] Upload complete. Processed:', uploadedImages.length, 'of', files.length, 'files');
      if (errors.length > 0) {
        console.warn('⚠️ [UPLOAD] Errors during upload:', errors);
        setImageUploadError(errors.join('; '));
      }

      if (uploadedImages.length === 0) {
        setImageUploadError(t('admin.products.add.failedToProcessImages') || 'Failed to process images');
        return;
      }

      setFormData((prev) => {
        const newImageUrls = [...prev.imageUrls, ...uploadedImages];
        console.log('📸 [UPLOAD] Total images after upload:', newImageUrls.length, '(was', prev.imageUrls.length, ', added', uploadedImages.length, ')');
        // If this is the first image, set it as main automatically
        const newFeaturedIndex = prev.imageUrls.length === 0 ? 0 : prev.featuredImageIndex;
        return {
          ...prev,
          imageUrls: newImageUrls,
          featuredImageIndex: newFeaturedIndex,
          // Sync mainProductImage with featured image if it's the first one
          mainProductImage: newImageUrls.length > 0 && prev.imageUrls.length === 0 ? newImageUrls[0] : prev.mainProductImage,
        };
      });
    } catch (error: any) {
      console.error('❌ [UPLOAD] Fatal error during upload:', error);
      setImageUploadError(error?.message || t('admin.products.add.failedToProcessImages'));
    } finally {
      setImageUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Upload image for a specific variant
  const handleUploadVariantImage = async (variantId: string, event: ChangeEvent<HTMLInputElement>) => {
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
      console.log('🖼️ [VARIANT IMAGE] Processing variant image:', {
        variantId,
        fileName: file.name,
        originalSize: `${Math.round(file.size / 1024)}KB`
      });

      // Process image with compression, EXIF orientation correction, and resize
      const base64 = await processImageFile(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.8
      });

      setGeneratedVariants(prev => prev.map(v => 
        v.id === variantId ? { ...v, image: base64 } : v
      ));
      console.log('✅ [VARIANT BUILDER] Variant image uploaded and processed for variant:', variantId);
    } catch (error: any) {
      console.error('❌ [VARIANT IMAGE] Error processing variant image:', error);
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
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    try {
      setImageUploadLoading(true);
      console.log('📤 [ADMIN] Starting upload for color:', colorImageTarget.colorValue, 'Files:', imageFiles.length);
      
      const uploadedImages = await Promise.all(
        imageFiles.map(async (file, index) => {
          console.log(`🖼️ [COLOR IMAGE] Processing image ${index + 1}/${imageFiles.length}:`, {
            fileName: file.name,
            originalSize: `${Math.round(file.size / 1024)}KB`
          });

          // Process image with compression, EXIF orientation correction, and resize
          const base64 = await processImageFile(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/jpeg',
            initialQuality: 0.8
          });

          console.log(`✅ [COLOR IMAGE] Image ${index + 1}/${imageFiles.length} processed, base64 length:`, base64.length);
          return base64;
        })
      );

      console.log('📥 [ADMIN] All images processed, adding to variant:', {
        variantId: colorImageTarget.variantId,
        colorValue: colorImageTarget.colorValue,
        imagesCount: uploadedImages.length
      });
      
      addColorImages(colorImageTarget.variantId, colorImageTarget.colorValue, uploadedImages);
      console.log('✅ [ADMIN] Color images added to state:', uploadedImages.length);
    } catch (error: any) {
      console.error('❌ [ADMIN] Error uploading color images:', error);
      setImageUploadError(error?.message || t('admin.products.add.failedToProcessImages'));
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
          setLoading(false);
          return;
        }
      }

      // Convert new variant builder variants to formData.variants if attributes are selected
      // NEW LOGIC: Process all variants (both auto-generated and manually added)
      // Skip this for simple products
      if (productType === 'variable' && selectedAttributesForVariants.size > 0 && generatedVariants.length > 0) {
        console.log('🔄 [ADMIN] Converting new variant builder variants to formData format...');
        console.log('📊 [ADMIN] Total generated variants to convert:', generatedVariants.length);
        
        // Process all variants, not just the first one
        const allNewVariants: Variant[] = [];
        const skuSetForConversion = new Set<string>();
        
        generatedVariants.forEach((variant, variantIndex) => {
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
                
                // Add attribute value's imageUrl to color images if it exists
                if (value.imageUrl) {
                  colorData.images.push(value.imageUrl);
                  console.log('✅ [ADMIN] Added attribute value imageUrl to color:', value.imageUrl);
                }
                
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
                
                // Add size attribute value's imageUrl if it exists
                if (sizeValue.imageUrl) {
                  colorData.images.push(sizeValue.imageUrl);
                  console.log('✅ [ADMIN] Added size attribute value imageUrl:', sizeValue.imageUrl);
                }
              }
            });
            
            // Add variant image if exists
            if (variant.image) {
              colorData.images.push(variant.image);
            }
            
            colors.push(colorData);
          } else {
            // Handle non-color, non-size attributes (e.g., material)
            // Collect all selected attribute values from other attributes
            const otherAttributeIds = Array.from(selectedAttributesForVariants).filter(
              attrId => attrId !== colorAttribute?.id && attrId !== sizeAttribute?.id
            );
            
            if (otherAttributeIds.length > 0) {
              const colorData: ColorData = {
                colorValue: '',
                colorLabel: '',
                images: [],
                stock: variant.stock || '0',
                sizes: [],
                sizeStocks: {},
              };
              
              // Collect images from all selected attribute values
              otherAttributeIds.forEach((attributeId) => {
                const attribute = attributes.find(a => a.id === attributeId);
                if (!attribute) return;
                
                const selectedValueIds = variant.selectedValueIds.filter(id => 
                  attribute.values.some(v => v.id === id)
                );
                
                selectedValueIds.forEach((valueId) => {
                  const value = attribute.values.find(v => v.id === valueId);
                  if (value && value.imageUrl) {
                    colorData.images.push(value.imageUrl);
                    console.log('✅ [ADMIN] Added attribute value imageUrl from', attribute.key, ':', value.imageUrl);
                  }
                });
              });
              
              // Add variant image if exists
              if (variant.image) {
                colorData.images.push(variant.image);
              }
              
              if (colorData.images.length > 0 || variant.stock) {
                colors.push(colorData);
              }
            }
          }
          
          // Add variant image to first color's images if variant has image and not already added
          if (variant.image && colors.length > 0) {
            const firstColor = colors[0];
            if (!firstColor.images.includes(variant.image)) {
              firstColor.images.push(variant.image);
            }
          }
          
          // Generate unique SKU for this variant
          let variantSku = variant.sku ? variant.sku.trim() : '';
          if (!variantSku || variantSku === '') {
            const baseSlug = formData.slug || 'PROD';
            variantSku = `${baseSlug.toUpperCase()}-${Date.now()}-${variantIndex + 1}`;
          }
          
          // Ensure SKU is unique
          let finalSku = variantSku;
          let skuCounter = 1;
          while (skuSetForConversion.has(finalSku)) {
            finalSku = `${variantSku}-${skuCounter}`;
            skuCounter++;
          }
          skuSetForConversion.add(finalSku);
          
          // Create variant - preserve original ID if it exists (for edit mode)
          allNewVariants.push({
            id: variant.id || `variant-${Date.now()}-${variantIndex}-${Math.random()}`,
            price: variant.price || '0',
            compareAtPrice: variant.compareAtPrice || '',
            sku: finalSku,
            colors: colors.length > 0 ? colors : [],
          });
        });
        
        formData.variants = allNewVariants;
        console.log('✅ [ADMIN] Converted variants:', formData.variants.length, 'with unique SKUs');
      }

      // Validate that at least one variant exists
      console.log('🔍 [ADMIN] Validating variants before submit:', {
        variantsCount: formData.variants.length,
        variants: formData.variants,
        selectedAttributesCount: selectedAttributesForVariants.size,
        productType: productType,
      });
      
      // Skip variant validation for Simple products - they create variants later in the process
      if (productType === 'variable' && formData.variants.length === 0) {
        setLoading(false);
        return;
      }

      // Validate all variants (skip for simple products - validation is done in variant creation)
      if (productType === 'variable') {
      const skuSet = new Set<string>();
      for (const variant of formData.variants) {
        const variantIndex = formData.variants.indexOf(variant) + 1;
        
        // Skip base price validation as we now use color-specific prices
        
        // Validate SKU - must be unique within product
        const variantSku = variant.sku ? variant.sku.trim() : '';
        if (!variantSku || variantSku === '') {
          setLoading(false);
          return;
        }
        
        if (skuSet.has(variantSku)) {
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
            
            // Skip price validation for empty colors (non-color attributes)
            // If colorValue is empty, use variant base price instead
            const hasColor = colorDataItem.colorValue && colorDataItem.colorValue.trim() !== '';
            
            // Validate price for this color only if it has a color value
            // For non-color attributes, use variant base price
            if (hasColor) {
              const colorPriceValue = parseFloat(colorDataItem.price || '0');
              if (!colorDataItem.price || isNaN(colorPriceValue) || colorPriceValue <= 0) {
                setLoading(false);
                return;
              }
            } else {
              // For non-color attributes, validate variant base price
              // But only if this is the first colorDataItem (to avoid duplicate validation)
              if (colorData.indexOf(colorDataItem) === 0) {
                const variantPriceValue = parseFloat(variant.price || '0');
                if (!variant.price || isNaN(variantPriceValue) || variantPriceValue <= 0) {
                  setLoading(false);
                  return;
                }
              }
            }

            // Size validation removed - attributes can work independently
            // Validate stock for each size of this color (if sizes exist)
            if (colorSizes.length > 0) {
              for (const size of colorSizes) {
                const stock = colorSizeStocks[size];
                if (!stock || stock.trim() === '' || parseInt(stock) < 0) {
                  setLoading(false);
                  return;
                }
              }
            } else {
              // If no sizes, validate base stock for color
              if (!colorDataItem.stock || colorDataItem.stock.trim() === '' || parseInt(colorDataItem.stock) < 0) {
                setLoading(false);
                return;
              }
            }
          }
        }
        // No validation for variants without colors - attributes can work independently
      }
      } // End of variable products validation

      // Prepare media array
      // STRICT: Main media should ONLY contain formData.imageUrls (main product images)
      // Color images should NOT be added to main media - they belong only in variant.imageUrl
      const media = formData.imageUrls
        .map((url, index) => ({
          url: url.trim(),
          type: 'image',
          position: index,
          isFeatured: index === 0, // First image is featured
        }))
        .filter(m => m.url);
      
      console.log('📸 [ADMIN] Main media images count:', media.length);
      console.log('📸 [ADMIN] Main media (first 3):', media.slice(0, 3).map(m => m.url.substring(0, 50)));
      console.log('📸 [ADMIN] Color images will be stored ONLY in variant.imageUrl, NOT in main media');

      // Prepare variants array
      // Use generatedVariants if available (new format with attributes JSONB)
      // Otherwise fallback to formData.variants (legacy support)
      const variants: any[] = [];
      const variantSkuSet = new Set<string>(); // Track SKUs during variant creation
      
      // Handle Simple Products - create a single variant without attributes
      if (productType === 'simple') {
        console.log('📦 [ADMIN] Processing Simple Product');
        
        // Validate simple product fields
        if (!simpleProductData.price || simpleProductData.price.trim() === '') {
          setLoading(false);
          return;
        }
        if (!simpleProductData.sku || simpleProductData.sku.trim() === '') {
          setLoading(false);
          return;
        }
        if (!simpleProductData.quantity || simpleProductData.quantity.trim() === '') {
          setLoading(false);
          return;
        }
        
        // Convert prices from defaultCurrency to USD
        const priceUSD = convertPrice(parseFloat(simpleProductData.price), defaultCurrency, 'USD');
        const compareAtPriceUSD = simpleProductData.compareAtPrice && simpleProductData.compareAtPrice.trim() !== ''
          ? convertPrice(parseFloat(simpleProductData.compareAtPrice), defaultCurrency, 'USD')
          : undefined;
        
        // Create a single variant without attributes
        const simpleVariant: any = {
          price: priceUSD,
          stock: parseInt(simpleProductData.quantity) || 0,
          sku: simpleProductData.sku.trim(),
          published: true,
        };
        
        if (compareAtPriceUSD) {
          simpleVariant.compareAtPrice = compareAtPriceUSD;
        }
        
        // No attributes for simple products - options array is empty/undefined
        variants.push(simpleVariant);
        variantSkuSet.add(simpleProductData.sku.trim());
        
        console.log('✅ [ADMIN] Simple product variant created:', simpleVariant);
      } else {
        // Variable products - process variants normally
        // Check if we should use generatedVariants (new format)
        const useGeneratedVariants = generatedVariants.length > 0 && selectedAttributesForVariants.size > 0;
      
      if (useGeneratedVariants) {
        // NEW FORMAT: Create variants from generatedVariants (each variant has all attribute values)
        console.log('📦 [ADMIN] Using generatedVariants format:', generatedVariants.length, 'variants');
        console.log('🔍 [ADMIN] Selected attributes for variants:', Array.from(selectedAttributesForVariants));
        const sizeAttribute = getSizeAttribute();
        console.log('🔍 [ADMIN] Size attribute:', sizeAttribute ? { id: sizeAttribute.id, key: sizeAttribute.key } : 'not found');
        
        generatedVariants.forEach((genVariant, variantIndex) => {
          // Convert prices from defaultCurrency to USD (database stores prices in USD)
          const variantPriceUSD = convertPrice(parseFloat(genVariant.price || '0'), defaultCurrency, 'USD');
          const variantCompareAtPriceUSD = genVariant.compareAtPrice 
            ? convertPrice(parseFloat(genVariant.compareAtPrice), defaultCurrency, 'USD')
            : undefined;
          
          // Group valueIds by attribute
          const attributeValueMap: Record<string, Array<{ valueId: string; value: string }>> = {};
          
          console.log(`🔍 [ADMIN] Variant ${variantIndex + 1} selectedValueIds:`, genVariant.selectedValueIds);
          
          genVariant.selectedValueIds.forEach((valueId) => {
            // Find which attribute this valueId belongs to
            const attribute = attributes.find(a => 
              a.values.some(v => v.id === valueId)
            );
            
            if (attribute) {
              const value = attribute.values.find(v => v.id === valueId);
              if (value) {
                console.log(`  ✅ Found attribute: ${attribute.key}, value: ${value.value}`);
                if (!attributeValueMap[attribute.key]) {
                  attributeValueMap[attribute.key] = [];
                }
                attributeValueMap[attribute.key].push({
                  valueId: value.id,
                  value: value.value,
                });
              }
            } else {
              console.warn(`  ⚠️ ValueId ${valueId} not found in any attribute`);
            }
          });
          
          // Generate all combinations of attribute values
          // Example: If we have color: [Red, Green] and size: [S, M]
          // We need to create: Red+S, Red+M, Green+S, Green+M
          const attributeKeys = Object.keys(attributeValueMap);
          if (attributeKeys.length === 0) {
            // No attributes, create single variant
            const finalSku = genVariant.sku || `${formData.slug || 'PROD'}-${Date.now()}-${variantIndex + 1}`;
            let uniqueSku = finalSku;
            let skuCounter = 1;
            while (variantSkuSet.has(uniqueSku)) {
              uniqueSku = `${finalSku}-${skuCounter}`;
              skuCounter++;
            }
            variantSkuSet.add(uniqueSku);
            
            variants.push({
              price: variantPriceUSD,
              compareAtPrice: variantCompareAtPriceUSD,
              stock: parseInt(genVariant.stock || '0') || 0,
              sku: uniqueSku,
              imageUrl: genVariant.image || undefined,
              published: true,
            });
          } else {
            // Generate all combinations
            const attributeValueGroups = attributeKeys.map(key => 
              attributeValueMap[key].map(v => v.valueId)
            );
            
            // Generate combinations using the same logic as generateAttributeCombinations
            const generateCombinations = (groups: string[][]): string[][] => {
              if (groups.length === 0) return [[]];
              if (groups.length === 1) return groups[0].map(v => [v]);
              
              const [firstGroup, ...restGroups] = groups;
              const restCombinations = generateCombinations(restGroups);
              const result: string[][] = [];
              
              for (const value of firstGroup) {
                for (const combination of restCombinations) {
                  result.push([value, ...combination]);
                }
              }
              
              return result;
            };
            
            const combinations = generateCombinations(attributeValueGroups);
            console.log(`📦 [ADMIN] Variant ${variantIndex + 1} will expand to ${combinations.length} combinations:`, combinations);
            
            // Create a variant for each combination
            combinations.forEach((combination, comboIndex) => {
              // Build options for this combination
              const variantOptions: Array<{ attributeKey: string; value: string; valueId?: string }> = [];
              
              combination.forEach((valueId) => {
                // Find which attribute this valueId belongs to
                const attribute = attributes.find(a => 
                  a.values.some(v => v.id === valueId)
                );
                
                if (attribute) {
                  const value = attribute.values.find(v => v.id === valueId);
                  if (value) {
                    variantOptions.push({
                      attributeKey: attribute.key,
                      value: value.value,
                      valueId: value.id,
                    });
                  }
                }
              });
              
              // Generate SKU for this combination
              const baseSlug = formData.slug || 'PROD';
              const valueParts = variantOptions.map(opt => opt.value.toUpperCase().replace(/\s+/g, '-'));
              const skuSuffix = valueParts.length > 0 ? `-${valueParts.join('-')}` : '';
              const finalSku = genVariant.sku 
                ? `${genVariant.sku}${skuSuffix}`
                : `${baseSlug.toUpperCase()}-${Date.now()}-${variantIndex + 1}-${comboIndex + 1}${skuSuffix}`;
              
              // Ensure SKU is unique
              let uniqueSku = finalSku;
              let skuCounter = 1;
              while (variantSkuSet.has(uniqueSku)) {
                uniqueSku = `${finalSku}-${skuCounter}`;
                skuCounter++;
              }
              variantSkuSet.add(uniqueSku);
              
              console.log(`  ✅ Creating variant combination ${comboIndex + 1}/${combinations.length}:`, {
                options: variantOptions.map(o => `${o.attributeKey}=${o.value}`).join(', '),
                sku: uniqueSku,
                price: variantPriceUSD,
                stock: genVariant.stock,
              });
              
              variants.push({
                price: variantPriceUSD,
                compareAtPrice: variantCompareAtPriceUSD,
                stock: parseInt(genVariant.stock || '0') || 0,
                sku: uniqueSku,
                imageUrl: genVariant.image || undefined,
                published: true,
                options: variantOptions.length > 0 ? variantOptions : undefined,
              });
            });
          }
        });
      } else {
        // Create variants from formData.variants (legacy support)
        console.log('📦 [ADMIN] Using formData.variants format (legacy)');
        console.log('🔍 [ADMIN] formData.variants count:', formData.variants.length);
        const sizeAttribute = getSizeAttribute();
        console.log('🔍 [ADMIN] Size attribute:', sizeAttribute ? { id: sizeAttribute.id, key: sizeAttribute.key } : 'not found');
        
        formData.variants.forEach((variant, variantIndex) => {
        // Convert prices from defaultCurrency to USD (database stores prices in USD)
        const variantPriceUSD = convertPrice(parseFloat(variant.price || '0'), defaultCurrency, 'USD');
        const baseVariantData: any = {
          price: variantPriceUSD,
          published: true,
        };

        if (variant.compareAtPrice) {
          baseVariantData.compareAtPrice = convertPrice(parseFloat(variant.compareAtPrice), defaultCurrency, 'USD');
        }

        // Получаем цвета из новой структуры ColorData
        const colorDataArray = variant.colors || [];

        // Process each color (colors are optional now)
        if (colorDataArray.length > 0) {
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
              // First check if there's a specific SKU for this size in sizeLabels
              let finalSku = colorData.sizeLabels?.[size] || undefined;
              
              // If no specific SKU, use variant base SKU with suffix
              if (!finalSku || finalSku === '') {
                finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
              }
              
              // If still no SKU, generate one
              if (!finalSku || finalSku === '') {
                const baseSlug = formData.slug || 'PROD';
                finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${variantIndex + 1}-${colorIndex + 1}-${sizeIndex + 1}`;
              }
              
              // Ensure SKU is unique during creation
              let uniqueSku = finalSku;
              let skuCounter = 1;
              while (variantSkuSet.has(uniqueSku)) {
                uniqueSku = `${finalSku}-${skuCounter}`;
                skuCounter++;
              }
              variantSkuSet.add(uniqueSku);
              finalSku = uniqueSku;
              
              // Сохраняем все изображения цвета через запятую в imageUrl
              const variantImageUrl = colorData.images && colorData.images.length > 0 
                ? colorData.images.join(',') 
                : undefined;
              
              // Используем цену размера, если указана, иначе цену цвета, иначе цену варианта
              // Convert from defaultCurrency to USD
              const sizePrice = colorData.sizePrices?.[size];
              const finalPriceRaw = sizePrice && sizePrice.trim() !== ''
                ? parseFloat(sizePrice)
                : (colorData.price && colorData.price.trim() !== '' 
                  ? parseFloat(colorData.price) 
                  : baseVariantData.price);
              const finalPrice = convertPrice(finalPriceRaw, defaultCurrency, 'USD');
              
              // Используем compareAtPrice размера, если указана, иначе compareAtPrice цвета, иначе compareAtPrice варианта
              // Convert from defaultCurrency to USD
              const sizeCompareAtPrice = colorData.sizeCompareAtPrices?.[size];
              const finalCompareAtPriceRaw = sizeCompareAtPrice && sizeCompareAtPrice.trim() !== ''
                ? parseFloat(sizeCompareAtPrice)
                : (colorData.compareAtPrice && colorData.compareAtPrice.trim() !== ''
                  ? parseFloat(colorData.compareAtPrice)
                  : baseVariantData.compareAtPrice);
              const finalCompareAtPrice = finalCompareAtPriceRaw ? convertPrice(finalCompareAtPriceRaw, defaultCurrency, 'USD') : undefined;
              
              // Collect all attribute options for this variant
              const variantOptions: Array<{ attributeKey: string; value: string; valueId?: string }> = [];
              
              // Add color option if exists
              if (colorData.colorValue && colorData.colorValue.trim() !== '') {
                const colorAttr = attributes.find(a => a.key === 'color');
                const colorValue = colorAttr?.values.find(v => v.value === colorData.colorValue);
                if (colorValue) {
                  variantOptions.push({ attributeKey: 'color', value: colorData.colorValue, valueId: colorValue.id });
                } else {
                  variantOptions.push({ attributeKey: 'color', value: colorData.colorValue });
                }
              }
              
              // Add size option if exists
              if (size && size.trim() !== '') {
                const sizeAttr = attributes.find(a => a.key === 'size');
                const sizeValue = sizeAttr?.values.find(v => v.value === size);
                if (sizeValue) {
                  variantOptions.push({ attributeKey: 'size', value: size, valueId: sizeValue.id });
                } else {
                  variantOptions.push({ attributeKey: 'size', value: size });
                }
              }
              
              // Add other attribute options from selectedAttributesForVariants (excluding color and size as they're already added)
              if (selectedAttributesForVariants.size > 0 && generatedVariants.length > 0) {
                const variant = generatedVariants[0];
                Array.from(selectedAttributesForVariants).forEach((attributeId) => {
                  const attribute = attributes.find(a => a.id === attributeId);
                  if (!attribute || attribute.key === 'color' || attribute.key === 'size') return;
                  
                  const selectedValueIds = variant.selectedValueIds.filter(id => 
                    attribute.values.some(v => v.id === id)
                  );
                  
                  selectedValueIds.forEach((valueId) => {
                    const value = attribute.values.find(v => v.id === valueId);
                    if (value) {
                      variantOptions.push({ attributeKey: attribute.key, value: value.value, valueId: value.id });
                    }
                  });
                });
              }
              
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
                options: variantOptions.length > 0 ? variantOptions : undefined,
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
              finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${variantIndex + 1}-${colorIndex + 1}`;
            }
            
            // Ensure SKU is unique during creation
            let uniqueSku = finalSku;
            let skuCounter = 1;
            while (variantSkuSet.has(uniqueSku)) {
              uniqueSku = `${finalSku}-${skuCounter}`;
              skuCounter++;
            }
            variantSkuSet.add(uniqueSku);
            finalSku = uniqueSku;

            // Сохраняем все изображения цвета через запятую в imageUrl
            const variantImageUrl = colorData.images && colorData.images.length > 0 
              ? colorData.images.join(',') 
              : undefined;

            // Используем цену цвета, если указана, иначе цену варианта
            // For empty colors (non-color attributes), always use variant base price
            // Convert from defaultCurrency to USD
            const hasColor = colorData.colorValue && colorData.colorValue.trim() !== '';
            const finalPriceRaw = hasColor && colorData.price && colorData.price.trim() !== '' 
              ? parseFloat(colorData.price) 
              : baseVariantData.price;
            const finalPrice = convertPrice(finalPriceRaw, defaultCurrency, 'USD');

            const finalCompareAtPriceRaw = hasColor && colorData.compareAtPrice && colorData.compareAtPrice.trim() !== ''
              ? parseFloat(colorData.compareAtPrice)
              : baseVariantData.compareAtPrice;
            const finalCompareAtPrice = finalCompareAtPriceRaw ? convertPrice(finalCompareAtPriceRaw, defaultCurrency, 'USD') : undefined;

            // Collect all attribute options for this variant
            const variantOptions: Array<{ attributeKey: string; value: string; valueId?: string }> = [];
            
            // Add color option if exists
            if (colorData.colorValue && colorData.colorValue.trim() !== '') {
              const colorAttr = attributes.find(a => a.key === 'color');
              const colorValue = colorAttr?.values.find(v => v.value === colorData.colorValue);
              if (colorValue) {
                variantOptions.push({ attributeKey: 'color', value: colorData.colorValue, valueId: colorValue.id });
              } else {
                variantOptions.push({ attributeKey: 'color', value: colorData.colorValue });
              }
            }
            
            // Add other attribute options from selectedAttributesForVariants
            if (selectedAttributesForVariants.size > 0 && generatedVariants.length > 0) {
              const variant = generatedVariants[0];
              Array.from(selectedAttributesForVariants).forEach((attributeId) => {
                const attribute = attributes.find(a => a.id === attributeId);
                if (!attribute || attribute.key === 'color' || attribute.key === 'size') return;
                
                const selectedValueIds = variant.selectedValueIds.filter(id => 
                  attribute.values.some(v => v.id === id)
                );
                
                selectedValueIds.forEach((valueId) => {
                  const value = attribute.values.find(v => v.id === valueId);
                  if (value) {
                    variantOptions.push({ attributeKey: attribute.key, value: value.value, valueId: value.id });
                  }
                });
              });
            }
            
            variants.push({
              ...baseVariantData,
              price: finalPrice,
              compareAtPrice: finalCompareAtPrice,
              color: colorData.colorValue && colorData.colorValue.trim() !== '' ? colorData.colorValue : undefined,
              stock: parseInt(stockForVariant) || 0,
              sku: finalSku,
              imageUrl: variantImageUrl,
              isFeatured: !!colorData.isFeatured,
              options: variantOptions.length > 0 ? variantOptions : undefined,
            });
          }
        });
        } else {
          // No colors - create variant without color
          // Check if we have sizes in variant.sizes or need to handle sizes separately
          const variantSizes = variant.sizes || [];
          const variantSizeStocks = variant.sizeStocks || {};
          
          // If variant has sizes, create variants for each size
          if (variantSizes.length > 0) {
            variantSizes.forEach((size, sizeIndex) => {
              const stockForVariant = variantSizeStocks[size] || '0';
              
              const skuSuffix = variantSizes.length > 1 ? `-${sizeIndex + 1}` : '';
              
              // Generate SKU if not provided
              let finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
              if (!finalSku || finalSku === '') {
                finalSku = formData.slug ? `${formData.slug.toUpperCase()}-${Date.now()}-${variantIndex + 1}-${sizeIndex + 1}` : undefined;
              }
              
              // Ensure SKU is unique during creation
              let uniqueSku = finalSku;
              if (uniqueSku) {
                let skuCounter = 1;
                while (variantSkuSet.has(uniqueSku)) {
                  uniqueSku = `${finalSku}-${skuCounter}`;
                  skuCounter++;
                }
                variantSkuSet.add(uniqueSku);
                finalSku = uniqueSku;
              }
              
              // Convert prices from defaultCurrency to USD
              const finalPrice = convertPrice(baseVariantData.price, defaultCurrency, 'USD');
              const finalCompareAtPrice = baseVariantData.compareAtPrice 
                ? convertPrice(baseVariantData.compareAtPrice, defaultCurrency, 'USD')
                : undefined;
              
              // Collect all attribute options for this variant
              const variantOptions: Array<{ attributeKey: string; value: string; valueId?: string }> = [];
              
              // Add size option
              if (size && size.trim() !== '') {
                const sizeAttr = attributes.find(a => a.key === 'size');
                const sizeValue = sizeAttr?.values.find(v => v.value === size);
                if (sizeValue) {
                  variantOptions.push({ attributeKey: 'size', value: size, valueId: sizeValue.id });
                } else {
                  variantOptions.push({ attributeKey: 'size', value: size });
                }
              }
              
              // Add other attribute options from selectedAttributesForVariants (excluding color and size)
              if (selectedAttributesForVariants.size > 0 && generatedVariants.length > 0) {
                const genVariant = generatedVariants[0];
                Array.from(selectedAttributesForVariants).forEach((attributeId) => {
                  const attribute = attributes.find(a => a.id === attributeId);
                  if (!attribute || attribute.key === 'color' || attribute.key === 'size') return;
                  
                  const selectedValueIds = genVariant.selectedValueIds.filter(id => 
                    attribute.values.some(v => v.id === id)
                  );
                  
                  selectedValueIds.forEach((valueId) => {
                    const value = attribute.values.find(v => v.id === valueId);
                    if (value) {
                      variantOptions.push({ attributeKey: attribute.key, value: value.value, valueId: value.id });
                    }
                  });
                });
              }
              
              variants.push({
                ...baseVariantData,
                price: finalPrice,
                compareAtPrice: finalCompareAtPrice,
                size: size,
                stock: parseInt(stockForVariant) || 0,
                sku: finalSku,
                options: variantOptions.length > 0 ? variantOptions : undefined,
              });
            });
          } else {
            // No colors and no sizes - create single variant without color and size
            // But check if we have images from non-color attributes
            let finalSku = variant.sku ? variant.sku.trim() : undefined;
            if (!finalSku || finalSku === '') {
              finalSku = formData.slug ? `${formData.slug.toUpperCase()}-${Date.now()}-${variantIndex + 1}` : undefined;
            }
            
            // Ensure SKU is unique during creation
            let uniqueSku = finalSku;
            if (uniqueSku) {
              let skuCounter = 1;
              while (variantSkuSet.has(uniqueSku)) {
                uniqueSku = `${finalSku}-${skuCounter}`;
                skuCounter++;
              }
              variantSkuSet.add(uniqueSku);
              finalSku = uniqueSku;
            }
            
            const generatedSku = finalSku;
            
            // Check if we have any images from attribute values (for non-color, non-size attributes)
            let variantImageUrl: string | undefined = undefined;
            if (selectedAttributesForVariants.size > 0) {
              const allAttributeImages: string[] = [];
              Array.from(selectedAttributesForVariants).forEach((attributeId) => {
                const attribute = attributes.find(a => a.id === attributeId);
                if (!attribute || attribute.key === 'color' || attribute.key === 'size') return;
                
                // Get selected value IDs for this attribute from generatedVariants
                // Collect images from all values of this attribute if it's selected
                attribute.values.forEach((value) => {
                  if (value.imageUrl) {
                    allAttributeImages.push(value.imageUrl);
                  }
                });
              });
              
              if (allAttributeImages.length > 0) {
                variantImageUrl = allAttributeImages.join(',');
                console.log('✅ [ADMIN] Added images from non-color attributes to variant:', variantImageUrl);
              }
            }
            
            // Collect all attribute options for this variant
            const variantOptions: Array<{ attributeKey: string; value: string; valueId?: string }> = [];
            
            // Add all attribute options from selectedAttributesForVariants
            if (selectedAttributesForVariants.size > 0 && generatedVariants.length > 0) {
              const genVariant = generatedVariants[0];
              Array.from(selectedAttributesForVariants).forEach((attributeId) => {
                const attribute = attributes.find(a => a.id === attributeId);
                if (!attribute) return;
                
                const selectedValueIds = genVariant.selectedValueIds.filter(id => 
                  attribute.values.some(v => v.id === id)
                );
                
                selectedValueIds.forEach((valueId) => {
                  const value = attribute.values.find(v => v.id === valueId);
                  if (value) {
                    variantOptions.push({ attributeKey: attribute.key, value: value.value, valueId: value.id });
                  }
                });
              });
            }
            
            variants.push({
              ...baseVariantData,
              color: undefined,
              stock: 0,
              sku: generatedSku,
              imageUrl: variantImageUrl,
              options: variantOptions.length > 0 ? variantOptions : undefined,
            });
          }
        }
      });
      }
      } // End of variable products variant processing

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
        
        // Ensure SKU is unique - keep generating until we find a unique one
        let finalSku = variant.sku;
        let skuCounter = 1;
        while (finalSkuSet.has(finalSku)) {
          const baseSlug = formData.slug || 'PROD';
          finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${i + 1}-${skuCounter}-${Math.random().toString(36).substr(2, 4)}`;
          skuCounter++;
          console.log(`⚠️ [ADMIN] Duplicate SKU found, generating new one: ${finalSku}`);
        }
        
        variant.sku = finalSku;
        finalSkuSet.add(finalSku);
      }
      
      console.log('✅ [ADMIN] Final SKU validation complete. All SKUs are unique:', Array.from(finalSkuSet));

      // Final validation - check size requirement for categories that require sizes
      // Skip this validation for Simple products - they don't have size attributes
      const categoryRequiresSizesFinal = isClothingCategory();
      if (productType === 'variable' && categoryRequiresSizesFinal && finalPrimaryCategoryId) {
        console.log('🔍 [VALIDATION] Checking size requirement for category:', finalPrimaryCategoryId);
        console.log('📦 [VALIDATION] Total variants to check:', variants.length);
        
        // Check if any variant has size in options array or size field
        const variantsWithSize: any[] = [];
        const variantsWithoutSize: any[] = [];
        
        variants.forEach((variant, index) => {
          let hasSize = false;
          let sizeSource = '';
          
          // Check variant.size field (legacy support)
          if (variant.size && variant.size.trim() !== "") {
            hasSize = true;
            sizeSource = 'variant.size';
          }
          
          // New format: check variant.options array for size attribute
          if (!hasSize && variant.options && Array.isArray(variant.options)) {
            const sizeOption = variant.options.find((opt: any) => {
              return (opt.attributeKey === 'size' || opt.key === 'size' || opt.attribute === 'size') &&
                     opt.value && opt.value.trim() !== "";
            });
            if (sizeOption) {
              hasSize = true;
              sizeSource = 'variant.options';
            }
          }
          
          if (hasSize) {
            variantsWithSize.push({ index, variant, sizeSource });
          } else {
            variantsWithoutSize.push({ index, variant });
          }
        });
        
        console.log('✅ [VALIDATION] Variants with size:', variantsWithSize.length, variantsWithSize.map(v => ({
          index: v.index,
          size: v.variant.size,
          options: v.variant.options,
          source: v.sizeSource
        })));
        console.log('❌ [VALIDATION] Variants without size:', variantsWithoutSize.length, variantsWithoutSize.map(v => ({
          index: v.index,
          hasSizeField: !!v.variant.size,
          hasOptions: !!v.variant.options,
          options: v.variant.options
        })));

        if (variantsWithSize.length === 0) {
          console.error('❌ [VALIDATION] Final size validation failed. No variants have size.');
          console.error('📋 [VALIDATION] All variants:', JSON.stringify(variants, null, 2));
          console.error('🔍 [VALIDATION] Debug info:', {
            totalVariants: variants.length,
            useGeneratedVariants: productType === 'variable' && generatedVariants.length > 0 && selectedAttributesForVariants.size > 0,
            selectedAttributesForVariants: Array.from(selectedAttributesForVariants),
            sizeAttribute: getSizeAttribute()?.id,
            generatedVariantsCount: generatedVariants.length,
            formDataVariantsCount: formData.variants.length
          });
        
          
                  }
        console.log('✅ [VALIDATION] Final size validation passed. Found', variantsWithSize.length, 'variant(s) with size.');
      } else {
        console.log('ℹ️ [VALIDATION] Size validation skipped (category does not require sizes)');
      }
      
      // Colors are now optional - no validation needed

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

      // Helper function to check if image is base64
      const isBase64Image = (url: string): boolean => {
        return url.startsWith('data:image/');
      };

      // Helper function to check if image is already a URL
      const isUrl = (url: string): boolean => {
        return url.startsWith('http://') || url.startsWith('https://');
      };

      // Helper function to get base64 size in bytes (approximate)
      const getBase64Size = (base64: string): number => {
        // Remove data:image/...;base64, prefix
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        // Base64 is ~33% larger than binary, so we calculate approximate size
        return Math.ceil(base64Data.length * 0.75);
      };

      // Helper function to process images - keep URLs as is, filter out large base64
      const processImages = (images: string[]): { processed: string[]; skipped: number } => {
        const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB per image max
        let skippedCount = 0;
        
        const processed = images.filter(img => {
          // If already a URL, keep as is
          if (isUrl(img)) {
            return true;
          }
          
          // If base64, check size
          if (isBase64Image(img)) {
            const size = getBase64Size(img);
            if (size > MAX_BASE64_SIZE) {
              console.warn(`⚠️ [ADMIN] Image too large (${Math.round(size / 1024)}KB), skipping to avoid 413 error.`);
              skippedCount++;
              return false; // Skip large base64 images
            }
            // Small base64, keep as is (will be in payload)
            return true;
          }
          
          // Unknown format, keep as is
          return true;
        });
        
        return { processed, skipped: skippedCount };
      };

      // Process main product images separately to maintain exact mapping
      const mainImages: string[] = [];
      if (formData.imageUrls.length > 0) {
        mainImages.push(...formData.imageUrls.filter(Boolean));
      } else if (formData.mainProductImage) {
        mainImages.push(formData.mainProductImage);
      }

      // Process main images with position preservation
      // This function processes each image individually and preserves original positions
      const processMainImagesWithPositions = (images: string[]): { mapping: (string | null)[]; skipped: number } => {
        const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB per image max
        const mapping: (string | null)[] = [];
        let skippedCount = 0;
        
        images.forEach((img) => {
          // If already a URL, keep as is
          if (isUrl(img)) {
            mapping.push(img);
            return;
          }
          
          // If base64, check size
          if (isBase64Image(img)) {
            const size = getBase64Size(img);
            if (size > MAX_BASE64_SIZE) {
              console.warn(`⚠️ [ADMIN] Main image too large (${Math.round(size / 1024)}KB), skipping to avoid 413 error.`);
              skippedCount++;
              mapping.push(null); // Mark as skipped
              return;
            }
            // Small base64, keep as is
            mapping.push(img);
            return;
          }
          
          // Unknown format, keep as is
          mapping.push(img);
        });
        
        return { mapping, skipped: skippedCount };
      };
      
      const mainImagesProcessed = mainImages.length > 0 ? processMainImagesWithPositions(mainImages) : { mapping: [], skipped: 0 };
      const mainImageMapping = mainImagesProcessed.mapping; // Keep nulls to preserve positions

      // Collect variant images
      const variantImages: string[] = [];
      variants.forEach(variant => {
        if (variant.imageUrl) {
          // imageUrl can be comma-separated string
          const imageUrls = variant.imageUrl.split(',').map((url: string) => url.trim()).filter(Boolean);
          variantImages.push(...imageUrls);
        }
      });

      // Process variant images
      const variantImagesProcessed = variantImages.length > 0 ? processImages(variantImages) : { processed: [], skipped: 0 };
      const processedVariantImages = variantImagesProcessed.processed;
      const skippedImagesCount = mainImagesProcessed.skipped + variantImagesProcessed.skipped;
      
      // Warn user if images were skipped
      if (skippedImagesCount > 0) {
        console.warn(`⚠️ [ADMIN] ${skippedImagesCount} large image(s) were skipped to avoid 413 error.`);
      }

      // Update variants with processed images
      let variantImageIndex = 0;
      variants.forEach(variant => {
        if (variant.imageUrl) {
          const imageUrls = variant.imageUrl.split(',').map((url: string) => url.trim()).filter(Boolean);
          const processedUrls = processedVariantImages.slice(variantImageIndex, variantImageIndex + imageUrls.length);
          variant.imageUrl = processedUrls.join(',');
          variantImageIndex += imageUrls.length;
        }
      });

      // Build final media array with proper order
      const finalMedia: string[] = [];
      
      if (formData.imageUrls.length > 0) {
        // Use mainImageMapping which preserves positions
        // Map it back to formData.imageUrls indices
        const processedImageUrls: string[] = [];
        
        formData.imageUrls.forEach((originalUrl, index) => {
          if (!originalUrl || !originalUrl.trim()) {
            return; // Skip empty URLs
          }
          
          // Find corresponding processed image in mainImageMapping
          // mainImageMapping is in the same order as mainImages (which is formData.imageUrls)
          const mainImagesIndex = mainImages.indexOf(originalUrl);
          if (mainImagesIndex >= 0 && mainImagesIndex < mainImageMapping.length) {
            const processedImg = mainImageMapping[mainImagesIndex];
            if (processedImg) {
              processedImageUrls[index] = processedImg;
            }
            // If null, image was skipped - don't add it to finalMedia
          }
        });
        
        // Add featured image first (main image)
        if (processedImageUrls[formData.featuredImageIndex]) {
          finalMedia.push(processedImageUrls[formData.featuredImageIndex]);
        }
        // Add other images in order (skip null/undefined)
        processedImageUrls.forEach((url, index) => {
          if (index !== formData.featuredImageIndex && url) {
            finalMedia.push(url);
          }
        });
      } else if (formData.mainProductImage) {
        // Fallback to legacy mainProductImage
        const mainImgProcessed = mainImageMapping[0];
        if (mainImgProcessed) {
          finalMedia.push(mainImgProcessed);
        }
      }
      
      if (finalMedia.length > 0) {
        payload.media = finalMedia;
      }
      
      // Also add mainProductImage as separate field for easier access
      // Use featured image from imageUrls if available
      const mainImage = formData.imageUrls.length > 0 && mainImageMapping.length > formData.featuredImageIndex
        ? mainImageMapping[formData.featuredImageIndex]
        : (mainImageMapping.length > 0 ? mainImageMapping[0] : formData.mainProductImage);
      if (mainImage) {
        payload.mainProductImage = mainImage;
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
      
      // Error logged to console
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
                {/* Product Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.products.add.productType')} *
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    {t('admin.products.add.productTypeDescription')}
                  </p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="productType"
                        value="simple"
                        checked={productType === 'simple'}
                        onChange={(e) => setProductType(e.target.value as 'simple' | 'variable')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t('admin.products.add.productTypeSimple')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="productType"
                        value="variable"
                        checked={productType === 'variable'}
                        onChange={(e) => setProductType(e.target.value as 'simple' | 'variable')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t('admin.products.add.productTypeVariable')}</span>
                    </label>
                  </div>
                </div>

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

            {/* Product Images */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.mainProductImage')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.products.add.productImages')}
                    <span className="text-xs text-gray-500 ml-2">({t('admin.products.add.uploadMultipleImages')})</span>
                  </label>
                  
                  {/* Upload Button */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageUploadLoading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {imageUploadLoading ? t('admin.products.add.uploading') : t('admin.products.add.uploadImages')}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadImages}
                      className="hidden"
                    />
                  </div>

                  {/* Images Grid */}
                  {formData.imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {formData.imageUrls.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <div className={`relative border-2 rounded-md overflow-hidden ${
                            formData.featuredImageIndex === index 
                              ? 'border-blue-500 ring-2 ring-blue-300' 
                              : 'border-gray-300'
                          }`}>
                            <img
                              src={imageUrl}
                              alt={`Product image ${index + 1}`}
                              className="w-full h-48 object-cover"
                            />
                            
                            {/* Main Checkbox */}
                            <div className="absolute top-2 left-2">
                              <label className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md cursor-pointer hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={formData.featuredImageIndex === index}
                                  onChange={() => setFeaturedImage(index)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">
                                  {formData.featuredImageIndex === index ? t('admin.products.add.main') : t('admin.products.add.setAsMain')}
                                </span>
                              </label>
                            </div>

                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => removeImageUrl(index)}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title={t('admin.products.add.removeImage')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>

                            {/* Main Badge */}
                            {formData.featuredImageIndex === index && (
                              <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                                {t('admin.products.add.main')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                        {categoriesExpanded && (() => {
                          // Build category tree structure
                          const categoryMap = new Map<string, Category & { children: Category[] }>();
                          const rootCategories: (Category & { children: Category[] })[] = [];

                          // First pass: create map and identify root categories
                          categories.forEach((category) => {
                            categoryMap.set(category.id, { ...category, children: [] });
                          });

                          // Second pass: build tree structure
                          categories.forEach((category) => {
                            if (category.parentId && categoryMap.has(category.parentId)) {
                              const parent = categoryMap.get(category.parentId)!;
                              const child = categoryMap.get(category.id)!;
                              parent.children.push(child);
                            } else {
                              rootCategories.push(categoryMap.get(category.id)!);
                            }
                          });

                          // Flatten tree for display (parent first, then children)
                          const flattenTree = (nodes: (Category & { children: Category[] })[], result: (Category & { isSubcategory: boolean })[] = []): (Category & { isSubcategory: boolean })[] => {
                            nodes.forEach((node) => {
                              result.push({ ...node, isSubcategory: false });
                              if (node.children && node.children.length > 0) {
                                node.children.forEach((child) => {
                                  result.push({ ...child, isSubcategory: true });
                                });
                              }
                            });
                            return result;
                          };

                          const displayCategories = flattenTree(rootCategories);

                          return (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              <div className="p-2">
                                <div className="space-y-1">
                                  {displayCategories.map((category) => (
                                    <label
                                      key={category.id}
                                      className={`flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded ${
                                        category.isSubcategory ? 'pl-6' : ''
                                      }`}
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
                                          const newIsSizeRequired = selectedCategory?.requiresSizes ?? false;
                                          
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
                                      <span className={`text-gray-700 ${
                                        category.isSubcategory 
                                          ? 'text-xs' 
                                          : 'text-sm font-semibold'
                                      }`}>
                                        {category.title}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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

            {/* Simple Product Fields - Only shown when productType === 'simple' */}
            {/* Moved here to appear after Product Labels */}
            {productType === 'simple' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.productVariants')}</h2>
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Price */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.products.add.price')} *
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={simpleProductData.price}
                          onChange={(e) => setSimpleProductData((prev) => ({ ...prev, price: e.target.value }))}
                          placeholder={t('admin.products.add.pricePlaceholder')}
                          className="flex-1"
                          min="0"
                          step="0.01"
                          required
                        />
                        <span className="text-sm text-gray-500 whitespace-nowrap">{CURRENCIES[defaultCurrency].symbol}</span>
                      </div>
                    </div>

                    {/* Compare At Price */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.products.add.compareAtPrice')}
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={simpleProductData.compareAtPrice}
                          onChange={(e) => setSimpleProductData((prev) => ({ ...prev, compareAtPrice: e.target.value }))}
                          placeholder={t('admin.products.add.pricePlaceholder')}
                          className="flex-1"
                          min="0"
                          step="0.01"
                        />
                        <span className="text-sm text-gray-500 whitespace-nowrap">{CURRENCIES[defaultCurrency].symbol}</span>
                      </div>
                    </div>

                    {/* SKU */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.products.add.sku')} *
                      </label>
                      <Input
                        type="text"
                        value={simpleProductData.sku}
                        onChange={(e) => setSimpleProductData((prev) => ({ ...prev, sku: e.target.value }))}
                        placeholder={t('admin.products.add.autoGenerated')}
                        className="w-full"
                        required
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.products.add.quantity')} *
                      </label>
                      <Input
                        type="number"
                        value={simpleProductData.quantity}
                        onChange={(e) => setSimpleProductData((prev) => ({ ...prev, quantity: e.target.value }))}
                        placeholder={t('admin.products.add.quantityPlaceholder')}
                        className="w-full"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Select Attributes for Variants - Only shown when productType === 'variable' */}
            {productType === 'variable' && (
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
                        
                        // Get selected values for this attribute to show preview
                        const selectedValueIds = selectedAttributeValueIds[attributeId] || [];
                        const selectedValues = selectedValueIds
                          .map(id => attribute.values.find(v => v.id === id))
                          .filter((v): v is NonNullable<typeof v> => v !== null);
                        
                        // Get first selected value's image if available
                        const previewImage = selectedValues.find(v => v.imageUrl)?.imageUrl;
                        const isColor = attribute.key === 'color';
                        const previewColor = isColor && selectedValues.length > 0 
                          ? (selectedValues[0].colors?.[0] || getColorHex(selectedValues[0].label))
                          : null;
                        
                        return (
                          <span
                            key={attributeId}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200"
                          >
                            {previewImage ? (
                              <img
                                src={previewImage}
                                alt={attribute.name}
                                className="w-4 h-4 object-cover rounded border border-gray-300"
                              />
                            ) : previewColor ? (
                              <span
                                className="inline-block w-4 h-4 rounded-full border border-gray-300"
                                style={{ backgroundColor: previewColor }}
                              />
                            ) : null}
                            {attribute.name}
                            {selectedValues.length > 0 && (
                              <span className="text-xs text-blue-600">
                                ({selectedValues.length})
                              </span>
                            )}
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
            )}

            {/* New Multi-Attribute Variant Builder - Only shown when productType === 'variable' */}
            {/* Show in edit mode if variants are loaded, or if attributes are selected */}
            {productType === 'variable' && ((isEditMode && generatedVariants.length > 0) || selectedAttributesForVariants.size > 0) && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.products.add.variantBuilder')}</h2>
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">

                  {/* Generated Variants Table */}
                  {generatedVariants.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {t('admin.products.add.generatedVariants')} ({generatedVariants.length.toString()})
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const price = prompt(t('admin.products.add.enterDefaultPrice'));
                              if (price !== null) {
                                applyToAllVariants('price', price);
                              }
                            }}
                          >
                            {t('admin.products.add.applyPriceToAll')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const stock = prompt(t('admin.products.add.enterDefaultStock'));
                              if (stock !== null) {
                                applyToAllVariants('stock', stock);
                              }
                            }}
                          >
                            {t('admin.products.add.applyStockToAll')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const skuPrefix = prompt(t('admin.products.add.enterSkuPrefix'));
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
                            {t('admin.products.add.applySkuToAll')}
                          </Button>
                        </div>
                      </div>

                      <div className="border border-gray-300 rounded-lg" style={{ overflowX: 'hidden', overflowY: 'hidden' }}>
                        <table className="w-full divide-y divide-gray-200 bg-white">
                          <thead className="bg-gray-50">
                            <tr>
                              {/* In edit mode, if no attributes selected but variants exist, extract attributes from variants */}
                              {(() => {
                                const attributesToShow = selectedAttributesForVariants.size > 0 
                                  ? Array.from(selectedAttributesForVariants)
                                  : (isEditMode && generatedVariants.length > 0
                                      ? (() => {
                                          // Extract unique attribute IDs from variants
                                          const attrIds = new Set<string>();
                                          generatedVariants.forEach(variant => {
                                            variant.selectedValueIds.forEach(valueId => {
                                              const attr = attributes.find(a => 
                                                a.values.some(v => v.id === valueId)
                                              );
                                              if (attr) attrIds.add(attr.id);
                                            });
                                          });
                                          return Array.from(attrIds);
                                        })()
                                      : []);
                                
                                return attributesToShow.map((attributeId) => {
                                  const attribute = attributes.find(a => a.id === attributeId);
                                  return attribute ? (
                                    <th key={attributeId} className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      {attribute.name}
                                    </th>
                                  ) : null;
                                });
                              })()}
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.price')}
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.compareAtPrice')}
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.stock')}
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.sku')}
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.products.add.image')}
                              </th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                {t('admin.products.add.actions') || 'Actions'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {generatedVariants.length > 0 && generatedVariants.map((variant) => {
                              // Get attributes to show for this variant
                              const attributesToShow = selectedAttributesForVariants.size > 0 
                                ? Array.from(selectedAttributesForVariants)
                                : (isEditMode
                                    ? (() => {
                                        // Extract unique attribute IDs from this variant's values
                                        const attrIds = new Set<string>();
                                        variant.selectedValueIds.forEach(valueId => {
                                          const attr = attributes.find(a => 
                                            a.values.some(v => v.id === valueId)
                                          );
                                          if (attr) attrIds.add(attr.id);
                                        });
                                        return Array.from(attrIds);
                                      })()
                                    : []);
                              
                              return (
                              <tr key={variant.id} className="hover:bg-gray-50">
                                {attributesToShow.map((attributeId) => {
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
                                      imageUrl: value.imageUrl || null,
                                    } : null;
                                  }).filter((v): v is NonNullable<typeof v> => v !== null);
                                  
                                  // Create unique key for this cell's dropdown
                                  const cellDropdownKey = `${variant.id}-${attributeId}`;
                                  
                                  return (
                                    <td key={attributeId} className="px-2 py-2 whitespace-nowrap">
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenValueModal({ variantId: variant.id, attributeId });
                                          }}
                                          className="w-full text-left flex items-center gap-1 p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                          <div className="flex-1 flex flex-wrap items-center gap-1 min-w-0">
                                            {selectedValues.length > 0 ? (
                                              selectedValues.map((val) => (
                                                <span
                                                  key={val.id}
                                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                                                >
                                                  {val.imageUrl ? (
                                                    <img
                                                      src={val.imageUrl}
                                                      alt={val.label}
                                                      className="w-3 h-3 object-cover rounded border border-gray-300"
                                                    />
                                                  ) : isColor && val.colorHex ? (
                                                    <span
                                                      className="inline-block w-3 h-3 rounded-full border border-gray-300"
                                                      style={{ backgroundColor: val.colorHex }}
                                                    />
                                                  ) : null}
                                                  {val.label}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-xs text-gray-500">{t('admin.products.add.valuesPlaceholder')}</span>
                                            )}
                                          </div>
                                          <svg
                                            className="w-3 h-3 text-gray-400 transition-transform flex-shrink-0"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                        
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      value={variant.price}
                                      onChange={(e) => {
                                        setGeneratedVariants(prev => prev.map(v => 
                                          v.id === variant.id ? { ...v, price: e.target.value } : v
                                        ));
                                      }}
                                      placeholder={t('admin.products.add.pricePlaceholder')}
                                      className="w-20 text-xs"
                                      min="0"
                                      step="0.01"
                                    />
                                    <span className="text-xs text-gray-500">{CURRENCIES[defaultCurrency].symbol}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      value={variant.compareAtPrice}
                                      onChange={(e) => {
                                        setGeneratedVariants(prev => prev.map(v => 
                                          v.id === variant.id ? { ...v, compareAtPrice: e.target.value } : v
                                        ));
                                      }}
                                      placeholder={t('admin.products.add.pricePlaceholder')}
                                      className="w-20 text-xs"
                                      min="0"
                                      step="0.01"
                                    />
                                    <span className="text-xs text-gray-500">{CURRENCIES[defaultCurrency].symbol}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <Input
                                    type="number"
                                    value={variant.stock}
                                    onChange={(e) => {
                                      setGeneratedVariants(prev => prev.map(v => 
                                        v.id === variant.id ? { ...v, stock: e.target.value } : v
                                      ));
                                    }}
                                    placeholder={t('admin.products.add.quantityPlaceholder')}
                                    className="w-16 text-xs"
                                    min="0"
                                  />
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <Input
                                    type="text"
                                    value={variant.sku}
                                    onChange={(e) => {
                                      setGeneratedVariants(prev => prev.map(v => 
                                        v.id === variant.id ? { ...v, sku: e.target.value } : v
                                      ));
                                    }}
                                    placeholder={t('admin.products.add.autoGenerated')}
                                    className="w-24 text-xs"
                                  />
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {variant.image ? (
                                      <div className="relative inline-block">
                                        <img
                                          src={variant.image}
                                          alt="Variant image"
                                          className="w-12 h-12 object-cover border border-gray-300 rounded-md"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setGeneratedVariants(prev => prev.map(v => 
                                              v.id === variant.id ? { ...v, image: null } : v
                                            ));
                                            if (variantImageInputRefs.current[variant.id]) {
                                              variantImageInputRefs.current[variant.id]!.value = '';
                                            }
                                          }}
                                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                                          title={t('admin.products.add.removeImage')}
                                        >
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => variantImageInputRefs.current[variant.id]?.click()}
                                        disabled={imageUploadLoading}
                                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="hidden sm:inline">{imageUploadLoading ? t('admin.products.add.uploading') : t('admin.products.add.uploadImage')}</span>
                                        <span className="sm:hidden">+</span>
                                      </button>
                                    )}
                                    <input
                                      ref={(el) => { variantImageInputRefs.current[variant.id] = el; }}
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleUploadVariantImage(variant.id, e)}
                                      className="hidden"
                                    />
                                  </div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGeneratedVariants(prev => prev.filter(v => v.id !== variant.id));
                                    }}
                                    className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors flex items-center gap-1"
                                    title={t('admin.products.add.deleteVariant') || 'Delete variant'}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    {t('admin.products.add.delete') || 'Delete'}
                                  </button>
                                </td>
                              </tr>
                              );
                            })}
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
                            setGeneratedVariants(prev => {
                              const updated = [...prev, newVariant];
                              console.log('✅ [VARIANT BUILDER] New manual variant added:', {
                                newVariantId: newVariant.id,
                                totalVariants: updated.length,
                                manualVariants: updated.filter(v => v.id !== 'variant-all').length,
                                autoVariants: updated.filter(v => v.id === 'variant-all').length
                              });
                              return updated;
                            });
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

      {/* Value Selection Modal */}
      {openValueModal && (() => {
        const variant = generatedVariants.find(v => v.id === openValueModal.variantId);
        const attribute = attributes.find(a => a.id === openValueModal.attributeId);
        
        if (!variant || !attribute) return null;
        
        const isColor = attribute.key === 'color';
        const selectedValueIds = variant.selectedValueIds.filter(id => {
          return attribute.values.some(v => v.id === id);
        });
        
        return (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setOpenValueModal(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h3 className="text-xl font-semibold text-gray-900">
                  {t('admin.products.add.selectValues')} {attribute.name}
                </h3>
                <button
                  onClick={() => setOpenValueModal(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* "All" option */}
                <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 mb-3 border border-gray-200">
                  <input
                    type="checkbox"
                    checked={attribute.values.length > 0 && selectedValueIds.length === attribute.values.length}
                    onChange={(e) => {
                      const isAutoVariant = variant.id === 'variant-all';
                      
                      if (e.target.checked) {
                        // Select all values
                        const allValueIds = attribute.values.map(v => v.id);
                        // Add to variant's selectedValueIds (merge with existing)
                        const currentIds = variant.selectedValueIds;
                        const newIds = [...new Set([...currentIds, ...allValueIds])];
                        
                        // Update variant - merge with existing selectedValueIds
                        setGeneratedVariants(prev => prev.map(v => 
                          v.id === variant.id ? { ...v, selectedValueIds: newIds } : v
                        ));
                        
                        // Only update selectedAttributeValueIds for auto-generated variant
                        // This prevents affecting other manually added variants
                        if (isAutoVariant) {
                          setSelectedAttributeValueIds(prev => ({
                            ...prev,
                            [openValueModal.attributeId]: allValueIds,
                          }));
                        }
                      } else {
                        // Deselect all values for this attribute
                        const valueIdsToRemove = attribute.values.map(v => v.id);
                        const newIds = variant.selectedValueIds.filter(id => !valueIdsToRemove.includes(id));
                        
                        setGeneratedVariants(prev => prev.map(v => 
                          v.id === variant.id ? { ...v, selectedValueIds: newIds } : v
                        ));
                        
                        // Only update selectedAttributeValueIds for auto-generated variant
                        if (isAutoVariant) {
                          setSelectedAttributeValueIds(prev => ({
                            ...prev,
                            [openValueModal.attributeId]: [],
                          }));
                        }
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">All</span>
                </label>
                
                <div className="border-t border-gray-200 my-3"></div>
                
                {/* Individual value checkboxes - grid layout */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {attribute.values.map((value) => {
                    const isSelected = variant.selectedValueIds.includes(value.id);
                    // Debug: Log color information for each value
                    if (isColor) {
                      console.log('🎨 [ADD PRODUCT] Color value:', {
                        valueId: value.id,
                        valueLabel: value.label,
                        colors: value.colors,
                        colorsType: typeof value.colors,
                        colorsIsArray: Array.isArray(value.colors),
                        colorsLength: value.colors?.length,
                        hasColors: value.colors && value.colors.length > 0
                      });
                    }
                    const valueColorHex = isColor && value.colors && value.colors.length > 0 
                      ? value.colors[0] 
                      : isColor 
                        ? getColorHex(value.label) 
                        : null;
                    
                    return (
                      <label
                        key={value.id}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all border-2 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600'
                            : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const isAutoVariant = variant.id === 'variant-all';
                            const currentIds = variant.selectedValueIds;
                            let newIds: string[];
                            
                            if (e.target.checked) {
                              // Add value if not already selected
                              newIds = [...currentIds, value.id];
                            } else {
                              // Remove value
                              newIds = currentIds.filter(id => id !== value.id);
                            }
                            
                            // Update variant first (to preserve dropdown state)
                            setGeneratedVariants(prev => {
                              const updated = prev.map(v => 
                                v.id === variant.id ? { ...v, selectedValueIds: newIds } : v
                              );
                              console.log('✅ [VARIANT BUILDER] Value selection updated:', {
                                variantId: variant.id,
                                isAutoVariant,
                                valueId: value.id,
                                action: e.target.checked ? 'added' : 'removed',
                                newSelectedIds: newIds.length,
                                totalVariants: updated.length
                              });
                              return updated;
                            });
                            
                            // Only update selectedAttributeValueIds for auto-generated variant
                            // This prevents affecting other manually added variants
                            if (isAutoVariant) {
                              const currentAttrIds = selectedAttributeValueIds[openValueModal.attributeId] || [];
                              let newAttrIds: string[];
                              if (e.target.checked) {
                                newAttrIds = [...currentAttrIds, value.id];
                              } else {
                                newAttrIds = currentAttrIds.filter(id => id !== value.id);
                              }
                              
                              setSelectedAttributeValueIds(prev => ({
                                ...prev,
                                [openValueModal.attributeId]: newAttrIds,
                              }));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        {/* Display image, color, or nothing */}
                        {value.imageUrl ? (
                          <img
                            src={value.imageUrl}
                            alt={value.label}
                            className="w-8 h-8 object-cover rounded border border-gray-300 flex-shrink-0"
                          />
                        ) : isColor && valueColorHex ? (
                          <span
                            className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0"
                            style={{ backgroundColor: valueColorHex }}
                          />
                        ) : null}
                        <span className="text-xs font-medium text-gray-900 text-center">{value.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenValueModal(null)}
                >
                  {t('admin.common.close')}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
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
