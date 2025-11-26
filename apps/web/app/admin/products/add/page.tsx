'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../../lib/api-client';

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
}

interface Attribute {
  id: string;
  key: string;
  name: string;
  type: string;
  values: Array<{
    id: string;
    value: string;
    label: string;
  }>;
}

interface Variant {
  id: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  sku: string;
  color: string;
  colors: string[]; // Multiple colors support
  colorStocks: Record<string, string>; // Stock for each color: { "red": "10", "blue": "5" }
  size: string;
  sizes: string[]; // Multiple sizes support
  sizeStocks: Record<string, string>; // Stock for each size: { "S": "10", "M": "5" }
  imageUrl: string;
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
    imageUrls: [] as string[],
    variants: [] as Variant[],
    labels: [] as ProductLabel[],
  });

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
          const colorAttribute = attributes.find((attr) => attr.key === 'color');
          const sizeAttribute = attributes.find((attr) => attr.key === 'size');
          
          // Group variants by color and size combinations
          const variantMap = new Map<string, any>();
          
          (product.variants || []).forEach((variant: any) => {
            const color = variant.color || '';
            const size = variant.size || '';
            const key = `${color}-${size}`;
            
            if (!variantMap.has(key)) {
              variantMap.set(key, {
                id: `variant-${Date.now()}-${Math.random()}`,
                price: variant.price || '',
                compareAtPrice: variant.compareAtPrice || '',
                stock: variant.stock || '',
                sku: variant.sku || '',
                color: color,
                colors: color ? [color] : [],
                colorStocks: color ? { [color]: variant.stock || '' } : {},
                size: size,
                sizes: size ? [size] : [],
                sizeStocks: size ? { [size]: variant.stock || '' } : {},
                imageUrl: variant.imageUrl || '',
              });
            } else {
              // If variant exists, merge sizes/colors
              const existing = variantMap.get(key)!;
              if (size && !existing.sizes.includes(size)) {
                existing.sizes.push(size);
                existing.sizeStocks[size] = variant.stock || '';
              }
              if (color && !existing.colors.includes(color)) {
                existing.colors.push(color);
                existing.colorStocks[color] = variant.stock || '';
              }
            }
          });
          
          setFormData({
            title: product.title || '',
            slug: product.slug || '',
            subtitle: product.subtitle || '',
            descriptionHtml: product.descriptionHtml || '',
            brandId: product.brandId || '',
            primaryCategoryId: product.primaryCategoryId || '',
            categoryIds: product.categoryIds || [],
            published: product.published || false,
            imageUrls: product.media || [],
            variants: Array.from(variantMap.values()),
            labels: (product.labels || []).map((label: any) => ({
              id: label.id || '',
              type: label.type || 'text',
              value: label.value || '',
              position: label.position || 'top-left',
              color: label.color || null,
            })),
          });
          
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
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  // Check if selected category requires sizes (clothing or shoes)
  const isClothingCategory = () => {
    if (!formData.primaryCategoryId) return false;
    const selectedCategory = categories.find((cat) => cat.id === formData.primaryCategoryId);
    if (!selectedCategory) return false;
    
    // Check by slug or title (clothing, shoes, одежда, հագուստ, կոշիկ, etc.)
    const sizeRequiredSlugs = ['clothing', 'odezhda', 'hagust', 'apparel', 'fashion', 'shoes', 'koshik', 'obuv'];
    const sizeRequiredTitles = ['clothing', 'одежда', 'հագուստ', 'apparel', 'fashion', 'shoes', 'կոշիկ', 'обувь'];
    
    return (
      sizeRequiredSlugs.some((slug) => selectedCategory.slug.toLowerCase().includes(slug)) ||
      sizeRequiredTitles.some((title) => selectedCategory.title.toLowerCase().includes(title))
    );
  };

  // Variant management functions
  const addVariant = () => {
    const newVariant: Variant = {
      id: `variant-${Date.now()}`,
      price: '',
      compareAtPrice: '',
      stock: '',
      sku: '',
      color: '',
      colors: [],
      colorStocks: {},
      size: '',
      sizes: [],
      sizeStocks: {},
      imageUrl: '',
    };
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
  };

  // Toggle color selection for variant
  const toggleVariantColor = (variantId: string, colorValue: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          const colors = v.colors || [];
          const colorStocks = v.colorStocks || {};
          const colorIndex = colors.indexOf(colorValue);
          if (colorIndex > -1) {
            // Remove color
            const newColors = colors.filter((c) => c !== colorValue);
            const newColorStocks = { ...colorStocks };
            delete newColorStocks[colorValue];
            return { 
              ...v, 
              colors: newColors, 
              color: newColors[0] || '',
              colorStocks: newColorStocks,
            };
          } else {
            // Add color
            const newColors = [...colors, colorValue];
            return { 
              ...v, 
              colors: newColors, 
              color: newColors[0] || '',
              colorStocks: { ...colorStocks, [colorValue]: '' },
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
            colorStocks: {
              ...(v.colorStocks || {}),
              [colorValue]: stock,
            },
          };
        }
        return v;
      }),
    }));
  };

  // Toggle size selection for variant
  const toggleVariantSize = (variantId: string, sizeValue: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          const sizes = v.sizes || [];
          const sizeStocks = v.sizeStocks || {};
          const sizeIndex = sizes.indexOf(sizeValue);
          if (sizeIndex > -1) {
            // Remove size
            const newSizes = sizes.filter((s) => s !== sizeValue);
            const newSizeStocks = { ...sizeStocks };
            delete newSizeStocks[sizeValue];
            return { 
              ...v, 
              sizes: newSizes, 
              size: newSizes[0] || '',
              sizeStocks: newSizeStocks,
            };
          } else {
            // Add size
            const newSizes = [...sizes, sizeValue];
            return { 
              ...v, 
              sizes: newSizes, 
              size: newSizes[0] || '',
              sizeStocks: { ...sizeStocks, [sizeValue]: '' },
            };
          }
        }
        return v;
      }),
    }));
  };

  // Update stock for a specific size
  const updateSizeStock = (variantId: string, sizeValue: string, stock: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            sizeStocks: {
              ...(v.sizeStocks || {}),
              [sizeValue]: stock,
            },
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

  const updateVariant = (variantId: string, field: keyof Variant, value: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.id === variantId ? { ...v, [field]: value } : v
      ),
    }));
  };

  const addImageUrl = () => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: [...prev.imageUrls, ''],
    }));
  };

  const removeImageUrl = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const updateImageUrl = (index: number, url: string) => {
    setFormData((prev) => {
      const newUrls = [...prev.imageUrls];
      newUrls[index] = url;
      return { ...prev, imageUrls: newUrls };
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

  const getColorAttribute = () => attributes.find((attr) => attr.key === 'color');
  const getSizeAttribute = () => attributes.find((attr) => attr.key === 'size');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('📝 [ADMIN] Submitting product form:', formData);

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
        
        const priceValue = parseFloat(variant.price);
        if (!variant.price || isNaN(priceValue) || priceValue <= 0) {
          alert(`Վարիանտ ${variantIndex}: Խնդրում ենք մուտքագրել վավեր գին, որը 0-ից մեծ է`);
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
        
        // Validate sizes and stocks for clothing and shoes
        if (isClothingCategory()) {
          const sizes = variant.sizes && variant.sizes.length > 0 ? variant.sizes : [];
          if (sizes.length === 0) {
            alert(`Variant ${formData.variants.indexOf(variant) + 1}: At least one size is required for this product category`);
            setLoading(false);
            return;
          }
          
          for (const size of sizes) {
            const stock = (variant.sizeStocks || {})[size];
            if (!stock || stock.trim() === '' || parseInt(stock) < 0) {
              const sizeLabel = getSizeAttribute()?.values.find((v) => v.value === size)?.label || size;
              alert(`Variant ${formData.variants.indexOf(variant) + 1}: Please enter stock for size "${sizeLabel}"`);
              setLoading(false);
              return;
            }
          }
        }

        // Validate colors and stocks
        const colors = variant.colors && variant.colors.length > 0 ? variant.colors : [];
        if (colors.length > 0) {
          for (const color of colors) {
            const stock = (variant.colorStocks || {})[color];
            if (!stock || stock.trim() === '' || parseInt(stock) < 0) {
              const colorLabel = getColorAttribute()?.values.find((v) => v.value === color)?.label || color;
              alert(`Variant ${formData.variants.indexOf(variant) + 1}: Please enter stock for color "${colorLabel}"`);
              setLoading(false);
              return;
            }
          }
        } else if (!variant.stock || parseInt(variant.stock) < 0) {
          // If no colors, validate general stock (only if no sizes or not clothing)
          if (!isClothingCategory() || (variant.sizes || []).length === 0) {
            alert(`Variant ${formData.variants.indexOf(variant) + 1}: Please enter stock`);
            setLoading(false);
            return;
          }
        }
      }

      // Prepare media array
      const media = formData.imageUrls
        .filter((url) => url.trim())
        .map((url) => ({ url: url.trim(), type: 'image' }));

      // Prepare variants array
      // Create variants for all combinations of colors and sizes with their respective stocks
      const variants: any[] = [];
      
      formData.variants.forEach((variant) => {
        const baseVariantData: any = {
          price: parseFloat(variant.price),
          published: true,
        };

        if (variant.compareAtPrice) {
          baseVariantData.compareAtPrice = parseFloat(variant.compareAtPrice);
        }

        if (variant.imageUrl) {
          baseVariantData.imageUrl = variant.imageUrl;
        }

        const colors = variant.colors && variant.colors.length > 0 ? variant.colors : [];
        const sizes = variant.sizes && variant.sizes.length > 0 ? variant.sizes : [];
        const colorStocks = variant.colorStocks || {};
        const sizeStocks = variant.sizeStocks || {};

        // If we have both colors and sizes, create variants for all combinations
        if (colors.length > 0 && sizes.length > 0) {
          colors.forEach((color, colorIndex) => {
            sizes.forEach((size, sizeIndex) => {
              // For clothing, prioritize size stock; otherwise use color stock
              // If both exist, use size stock for clothing, color stock for others
              let stockForVariant = '0';
              if (isClothingCategory() && sizeStocks[size]) {
                stockForVariant = sizeStocks[size];
              } else if (colorStocks[color]) {
                stockForVariant = colorStocks[color];
              } else if (sizeStocks[size]) {
                stockForVariant = sizeStocks[size];
              } else {
                stockForVariant = variant.stock || '0';
              }
              
              const skuSuffix = colors.length > 1 || sizes.length > 1 
                ? `-${colorIndex + 1}-${sizeIndex + 1}` 
                : '';
              
              // Generate SKU if not provided
              let finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
              if (!finalSku || finalSku === '') {
                const baseSlug = formData.slug || 'PROD';
                finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${colorIndex + 1}-${sizeIndex + 1}`;
              }
              
              variants.push({
                ...baseVariantData,
                color: color,
                size: size,
                stock: parseInt(stockForVariant) || 0,
                sku: finalSku,
              });
            });
          });
        } 
        // If we have only colors
        else if (colors.length > 0) {
          colors.forEach((color, colorIndex) => {
            const stockForColor = colorStocks[color] || variant.stock || '0';
            const skuSuffix = colors.length > 1 ? `-${colorIndex + 1}` : '';
            
            // Generate SKU if not provided
            let finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
            if (!finalSku || finalSku === '') {
              const baseSlug = formData.slug || 'PROD';
              finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${colorIndex + 1}`;
            }
            
            variants.push({
              ...baseVariantData,
              color: color,
              stock: parseInt(stockForColor) || 0,
              sku: finalSku,
            });
          });
        }
        // If we have only sizes (for clothing)
        else if (sizes.length > 0) {
          sizes.forEach((size, sizeIndex) => {
            const stockForSize = sizeStocks[size] || variant.stock || '0';
            const skuSuffix = sizes.length > 1 ? `-${sizeIndex + 1}` : '';
            
            // Generate SKU if not provided
            let finalSku = variant.sku ? `${variant.sku.trim()}${skuSuffix}` : undefined;
            if (!finalSku || finalSku === '') {
              const baseSlug = formData.slug || 'PROD';
              finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-${sizeIndex + 1}`;
            }
            
            variants.push({
              ...baseVariantData,
              size: size,
              stock: parseInt(stockForSize) || 0,
              sku: finalSku,
            });
          });
        } 
        // If no colors and no sizes, create single variant
        else {
          // Generate SKU if not provided
          let finalSku = variant.sku ? variant.sku.trim() : undefined;
          if (!finalSku || finalSku === '') {
            const baseSlug = formData.slug || 'PROD';
            finalSku = `${baseSlug.toUpperCase()}-${Date.now()}-1`;
          }
          
          variants.push({
            ...baseVariantData,
            stock: parseInt(variant.stock) || 0,
            sku: finalSku,
          });
        }
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

      // Prepare payload
      const payload: any = {
        title: formData.title,
        slug: formData.slug,
        subtitle: formData.subtitle || undefined,
        descriptionHtml: formData.descriptionHtml || undefined,
        brandId: formData.brandId || undefined,
        primaryCategoryId: formData.primaryCategoryId || undefined,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
        published: formData.published,
        locale: 'en',
        variants: variants,
      };

      // Add media if provided
      if (media.length > 0) {
        payload.media = media;
      }

      // Add labels if provided
      if (formData.labels && formData.labels.length > 0) {
        payload.labels = formData.labels
          .filter((label) => label.value && label.value.trim() !== '')
          .map((label) => ({
            type: label.type,
            value: label.value.trim(),
            position: label.position,
            color: label.color || null,
          }));
      }

      console.log('📤 [ADMIN] Sending payload:', JSON.stringify(payload, null, 2));
      
      if (isEditMode && productId) {
        // Update existing product
        const product = await apiClient.put(`/api/v1/admin/products/${productId}`, payload);
        console.log('✅ [ADMIN] Product updated:', product);
        alert('Ապրանքը հաջողությամբ թարմացվեց!');
      } else {
        // Create new product
        const product = await apiClient.post('/api/v1/admin/products', payload);
        console.log('✅ [ADMIN] Product created:', product);
        alert('Ապրանքը հաջողությամբ ստեղծվեց!');
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
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.primaryCategoryId}
                    onChange={(e) => {
                      const newCategoryId = e.target.value;
                      const newIsSizeRequired = categories.find((cat) => cat.id === newCategoryId) 
                        ? (() => {
                            const selectedCategory = categories.find((cat) => cat.id === newCategoryId);
                            if (!selectedCategory) return false;
                            const sizeRequiredSlugs = ['clothing', 'odezhda', 'hagust', 'apparel', 'fashion', 'shoes', 'koshik', 'obuv'];
                            const sizeRequiredTitles = ['clothing', 'одежда', 'հագուստ', 'apparel', 'fashion', 'shoes', 'կոշիկ', 'обувь'];
                            return (
                              sizeRequiredSlugs.some((slug) => selectedCategory.slug.toLowerCase().includes(slug)) ||
                              sizeRequiredTitles.some((title) => selectedCategory.title.toLowerCase().includes(title))
                            );
                          })()
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
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
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Images</h2>
              <div className="space-y-3">
                {formData.imageUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => updateImageUrl(index, e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeImageUrl(index)}
                      className="px-4"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addImageUrl}
                  className="w-full"
                >
                  + Add Image URL
                </Button>
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Price */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price *
                          </label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={variant.price}
                            onChange={(e) => {
                              let value = e.target.value;
                              value = value.replace(/[^\d.]/g, '');
                              const parts = value.split('.');
                              if (parts.length > 2) {
                                value = parts[0] + '.' + parts.slice(1).join('');
                              }
                              if (parts.length === 2 && parts[1].length > 2) {
                                value = parts[0] + '.' + parts[1].substring(0, 2);
                              }
                              updateVariant(variant.id, 'price', value);
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && !isNaN(parseFloat(value))) {
                                const numValue = parseFloat(value);
                                if (numValue > 0) {
                                  updateVariant(variant.id, 'price', numValue.toFixed(2));
                                }
                              }
                            }}
                            required
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>

                        {/* Compare At Price */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Compare At Price
                          </label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={variant.compareAtPrice}
                            onChange={(e) => {
                              let value = e.target.value;
                              value = value.replace(/[^\d.]/g, '');
                              const parts = value.split('.');
                              if (parts.length > 2) {
                                value = parts[0] + '.' + parts.slice(1).join('');
                              }
                              if (parts.length === 2 && parts[1].length > 2) {
                                value = parts[0] + '.' + parts[1].substring(0, 2);
                              }
                              updateVariant(variant.id, 'compareAtPrice', value);
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && !isNaN(parseFloat(value))) {
                                const numValue = parseFloat(value);
                                if (numValue > 0) {
                                  updateVariant(variant.id, 'compareAtPrice', numValue.toFixed(2));
                                }
                              }
                            }}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>

                        {/* Stock - Only show if no colors selected or single color */}
                        {(variant.colors || []).length <= 1 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Stock *
                            </label>
                            <Input
                              type="number"
                              value={variant.stock}
                              onChange={(e) => updateVariant(variant.id, 'stock', e.target.value)}
                              required
                              placeholder="0"
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* SKU */}
                        <div>
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

                        {/* Color - Multiple selection with stock per color */}
                        {getColorAttribute() && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Colors (Select multiple) *
                            </label>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border border-gray-300 rounded-md bg-white max-h-48 overflow-y-auto">
                                {getColorAttribute()?.values.map((val) => {
                                  const isSelected = (variant.colors || []).includes(val.value);
                                  return (
                                    <label
                                      key={val.id}
                                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleVariantColor(variant.id, val.value)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{val.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              
                              {/* Stock inputs for each selected color */}
                              {(variant.colors || []).length > 0 && (
                                <div className="mt-4 space-y-2">
                                  <p className="text-sm font-medium text-gray-700 mb-2">
                                    Stock per color:
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(variant.colors || []).map((colorValue) => {
                                      const colorLabel = getColorAttribute()?.values.find(
                                        (v) => v.value === colorValue
                                      )?.label || colorValue;
                                      const stockValue = (variant.colorStocks || {})[colorValue] || '';
                                      
                                      return (
                                        <div key={colorValue} className="flex items-center gap-2">
                                          <label className="text-sm text-gray-700 min-w-[80px]">
                                            {colorLabel}:
                                          </label>
                                          <Input
                                            type="number"
                                            value={stockValue}
                                            onChange={(e) => updateColorStock(variant.id, colorValue, e.target.value)}
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
                            </div>
                          </div>
                        )}

                        {/* Size - Multiple selection with stock per size */}
                        {isClothingCategory() && getSizeAttribute() && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Sizes (Select multiple) *
                            </label>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border border-gray-300 rounded-md bg-white max-h-48 overflow-y-auto">
                                {getSizeAttribute()?.values.map((val) => {
                                  const isSelected = (variant.sizes || []).includes(val.value);
                                  return (
                                    <label
                                      key={val.id}
                                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleVariantSize(variant.id, val.value)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{val.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              
                              {/* Stock inputs for each selected size */}
                              {(variant.sizes || []).length > 0 && (
                                <div className="mt-4 space-y-2">
                                  <p className="text-sm font-medium text-gray-700 mb-2">
                                    Stock per size:
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(variant.sizes || []).map((sizeValue) => {
                                      const sizeLabel = getSizeAttribute()?.values.find(
                                        (v) => v.value === sizeValue
                                      )?.label || sizeValue;
                                      const stockValue = (variant.sizeStocks || {})[sizeValue] || '';
                                      
                                      return (
                                        <div key={sizeValue} className="flex items-center gap-2">
                                          <label className="text-sm text-gray-700 min-w-[80px]">
                                            {sizeLabel}:
                                          </label>
                                          <Input
                                            type="number"
                                            value={stockValue}
                                            onChange={(e) => updateSizeStock(variant.id, sizeValue, e.target.value)}
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
                              
                              {isClothingCategory() && (variant.sizes || []).length === 0 && (
                                <p className="mt-1 text-sm text-red-600">At least one size is required for this product category</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Variant Image URL */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Variant Image URL (optional)
                          </label>
                          <Input
                            type="url"
                            value={variant.imageUrl}
                            onChange={(e) => updateVariant(variant.id, 'imageUrl', e.target.value)}
                            placeholder="https://example.com/variant-image.jpg"
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Publishing */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => setFormData((prev) => ({ ...prev, published: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Publish immediately</span>
              </label>
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

