import { db } from "@white-shop/db";
import { Prisma } from "@prisma/client";
import { adminService } from "./admin.service";

interface ProductFilters {
  category?: string;
  search?: string;
  filter?: string;
  minPrice?: number;
  maxPrice?: number;
  colors?: string;
  sizes?: string;
  brand?: string;
  sort?: string;
  page?: number;
  limit?: number;
  lang?: string;
}

// Типы для продуктов с включенными отношениями
type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    brand: {
      include: {
        translations: true;
      };
    };
    variants: {
      include: {
        options: true;
      };
    };
    labels: true;
    categories: {
      include: {
        translations: true;
      };
    };
  };
}>;

/**
 * Normalize comma-separated filter values and drop placeholders like "undefined" or "null".
 */
const normalizeFilterList = (
  value?: string,
  transform?: (v: string) => string
): string[] => {
  if (!value || typeof value !== "string") return [];

  const invalidTokens = new Set(["undefined", "null", ""]);
  const items = value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => !invalidTokens.has(v.toLowerCase()));

  if (transform) {
    return items.map(transform);
  }

  return items;
};

class ProductsService {
  /**
   * Get all products with filters
   */
  async findAll(filters: ProductFilters) {
    const {
      category,
      search,
      filter,
      minPrice,
      maxPrice,
      colors,
      sizes,
      brand,
      sort = "createdAt",
      page = 1,
      limit = 24,
      lang = "en",
    } = filters;

    const skip = (page - 1) * limit;
    const bestsellerProductIds: string[] = [];

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      published: true,
      deletedAt: null,
    };

    // Add search filter
    if (search && search.trim()) {
      where.OR = [
        {
          translations: {
            some: {
              title: {
                contains: search.trim(),
                mode: "insensitive",
              },
            },
          },
        },
        {
          translations: {
            some: {
              subtitle: {
                contains: search.trim(),
                mode: "insensitive",
              },
            },
          },
        },
        {
          variants: {
            some: {
              sku: {
                contains: search.trim(),
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    // Add category filter
    if (category) {
      console.log('🔍 [PRODUCTS SERVICE] Looking for category:', { category, lang });
      const categoryDoc = await db.category.findFirst({
        where: {
          translations: {
            some: {
              slug: category,
              locale: lang,
            },
          },
          published: true,
          deletedAt: null,
        },
      });

      if (categoryDoc) {
        console.log('✅ [PRODUCTS SERVICE] Category found:', { id: categoryDoc.id, slug: category });
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            {
              OR: [
                { primaryCategoryId: categoryDoc.id },
                { categoryIds: { has: categoryDoc.id } },
              ],
            },
          ];
          delete where.OR;
        } else {
          where.OR = [
            { primaryCategoryId: categoryDoc.id },
            { categoryIds: { has: categoryDoc.id } },
          ];
        }
      } else {
        console.warn('⚠️ [PRODUCTS SERVICE] Category not found:', { category, lang });
      }
    }

    // Add filter for new, featured, bestseller
    if (filter === "new") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      where.createdAt = { gte: thirtyDaysAgo };
    } else if (filter === "featured") {
      where.featured = true;
    } else if (filter === "bestseller") {
      type BestsellerVariant = { variantId: string | null; _sum: { quantity: number | null } };
      const bestsellerVariants: BestsellerVariant[] = await db.orderItem.groupBy({
        by: ["variantId"],
        _sum: { quantity: true },
        where: {
          variantId: {
            not: null,
          },
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 200,
      });

      const variantIds = bestsellerVariants
        .map((item) => item.variantId)
        .filter((id): id is string => Boolean(id));

      if (variantIds.length > 0) {
        const variantProductMap = await db.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, productId: true },
        });

        const variantToProduct = new Map<string, string>();
        variantProductMap.forEach(({ id, productId }: { id: string; productId: string }) => {
          variantToProduct.set(id, productId);
        });

        const productSales = new Map<string, number>();
        bestsellerVariants.forEach((item: BestsellerVariant) => {
          const variantId = item.variantId;
          if (!variantId) return;
          const productId = variantToProduct.get(variantId);
          if (!productId) return;
          const qty = item._sum?.quantity || 0;
          productSales.set(productId, (productSales.get(productId) || 0) + qty);
        });

        bestsellerProductIds.push(
          ...Array.from(productSales.entries())
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .map(([productId]) => productId)
        );

        if (bestsellerProductIds.length > 0) {
          where.id = {
            in: bestsellerProductIds,
          };
        }
      }
    }

    // Get products
    console.log('🔍 [PRODUCTS SERVICE] Fetching products with where clause:', JSON.stringify(where, null, 2));
    let products = await db.product.findMany({
      where,
      include: {
        translations: true,
        brand: {
          include: {
            translations: true,
          },
        },
        variants: {
          where: {
            published: true,
          },
          include: {
            options: true,
          },
        },
        labels: true,
        categories: {
          include: {
            translations: true,
          },
        },
      },
      skip,
      take: limit * 10, // Get more to filter in memory
    });
    
    console.log(`✅ [PRODUCTS SERVICE] Found ${products.length} products from database`);

    // Filter by price, colors, sizes, brand in memory
    if (minPrice || maxPrice) {
      const min = minPrice || 0;
      const max = maxPrice || Infinity;
      products = products.filter((product: ProductWithRelations) => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        if (variants.length === 0) return false;
        const prices = variants.map((v: { price: number }) => v.price).filter((p: number | undefined) => p !== undefined);
        if (prices.length === 0) return false;
        const minPrice = Math.min(...prices);
        return minPrice >= min && minPrice <= max;
      });
    }

    // Filter by brand(s) - support multiple brands (comma-separated)
    const brandList = normalizeFilterList(brand);
    if (brandList.length > 0) {
      products = products.filter(
        (product: ProductWithRelations) => 
          product.brandId && brandList.includes(product.brandId)
      );
      console.log('🔍 [PRODUCTS SERVICE] Filtering by brands:', {
        brands: brandList,
        productsAfter: products.length
      });
    }

    // Filter by colors and sizes together if both are provided.
    // Skip filtering when only placeholder values (e.g., "undefined") are passed.
    const colorList = normalizeFilterList(colors, (v) => v.toLowerCase());
    const sizeList = normalizeFilterList(sizes, (v) => v.toUpperCase());

    if (colorList.length > 0 || sizeList.length > 0) {
      console.log('🔍 [PRODUCTS SERVICE] Filtering by:', {
        colors: colorList,
        sizes: sizeList,
        productsBefore: products.length
      });
      
      products = products.filter((product: ProductWithRelations) => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        
        if (variants.length === 0) {
          console.log('⚠️ [PRODUCTS SERVICE] Product has no variants:', product.id);
          return false;
        }
        
        // Find variants that match ALL specified filters
        const matchingVariants = variants.filter((variant: { id?: string; options?: Array<{ attributeKey?: string | null; value?: string | null }> }) => {
          const options = Array.isArray(variant.options) ? variant.options : [];
          
          if (options.length === 0) {
            console.log('⚠️ [PRODUCTS SERVICE] Variant has no options');
          }
          
          // Check color match if colors filter is provided
          if (colorList.length > 0) {
            const colorOption = options.find(
              (opt: { attributeKey?: string | null }) => opt.attributeKey === "color"
            );
            if (!colorOption || !colorOption.value) {
              console.log('⚠️ [PRODUCTS SERVICE] Variant missing color option:', {
                variantId: variant.id || 'unknown',
                options: options.map((o: { attributeKey?: string | null; value?: string | null }) => ({ key: o.attributeKey, value: o.value }))
              });
              return false;
            }
            const variantColorValue = colorOption.value.trim().toLowerCase();
            if (!colorList.includes(variantColorValue)) {
              console.log('⚠️ [PRODUCTS SERVICE] Color mismatch:', {
                variantId: variant.id || 'unknown',
                variantColor: variantColorValue,
                filterColors: colorList
              });
              return false;
            }
          }
          
          // Check size match if sizes filter is provided
          if (sizeList.length > 0) {
            const sizeOption = options.find(
              (opt: { attributeKey?: string | null }) => opt.attributeKey === "size"
            );
            if (!sizeOption || !sizeOption.value) {
              return false;
            }
            const variantSizeValue = sizeOption.value.trim().toUpperCase();
            if (!sizeList.includes(variantSizeValue)) {
              return false;
            }
          }
          
          return true;
        });
        
        const hasMatch = matchingVariants.length > 0;
        
        if (hasMatch) {
          console.log('✅ [PRODUCTS SERVICE] Product matches filters:', {
            productId: product.id,
            matchingVariantsCount: matchingVariants.length,
            totalVariants: variants.length
          });
        } else {
          console.log('❌ [PRODUCTS SERVICE] Product does not match filters:', {
            productId: product.id,
            totalVariants: variants.length,
            filters: { colors: colorList, sizes: sizeList }
          });
        }
        
        return hasMatch;
      });
      
      console.log('🔍 [PRODUCTS SERVICE] Products after filter:', products.length);
    }

    // Sort
    if (filter === "bestseller" && bestsellerProductIds.length > 0) {
      const rank = new Map<string, number>();
      bestsellerProductIds.forEach((id, index) => rank.set(id, index));
      products.sort((a: ProductWithRelations, b: ProductWithRelations) => {
        const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aRank - bRank;
      });
    } else if (sort === "price") {
      products.sort((a: ProductWithRelations, b: ProductWithRelations) => {
        const aVariants = Array.isArray(a.variants) ? a.variants : [];
        const bVariants = Array.isArray(b.variants) ? b.variants : [];
        const aPrice = aVariants.length > 0 ? Math.min(...aVariants.map((v: { price: number }) => v.price)) : 0;
        const bPrice = bVariants.length > 0 ? Math.min(...bVariants.map((v: { price: number }) => v.price)) : 0;
        return bPrice - aPrice;
      });
    } else {
      products.sort((a: ProductWithRelations, b: ProductWithRelations) => {
        const aValue = a[sort as keyof typeof a] as Date;
        const bValue = b[sort as keyof typeof b] as Date;
        return new Date(bValue).getTime() - new Date(aValue).getTime();
      });
    }

    const total = products.length;
    products = products.slice(0, limit);

    // Get discount settings
    const discountSettings = await db.settings.findMany({
      where: {
        key: {
          in: ["globalDiscount", "categoryDiscounts", "brandDiscounts"],
        },
      },
    });

    const globalDiscount =
      Number(
        discountSettings.find((s: { key: string; value: unknown }) => s.key === "globalDiscount")?.value
      ) || 0;
    
    const categoryDiscountsSetting = discountSettings.find((s: { key: string; value: unknown }) => s.key === "categoryDiscounts");
    const categoryDiscounts = categoryDiscountsSetting ? (categoryDiscountsSetting.value as Record<string, number>) || {} : {};
    
    const brandDiscountsSetting = discountSettings.find((s: { key: string; value: unknown }) => s.key === "brandDiscounts");
    const brandDiscounts = brandDiscountsSetting ? (brandDiscountsSetting.value as Record<string, number>) || {} : {};

    // Format response
    const data = products.map((product: ProductWithRelations) => {
      // Безопасное получение translation с проверкой на существование массива
      const translations = Array.isArray(product.translations) ? product.translations : [];
      const translation = translations.find((t: { locale: string }) => t.locale === lang) || translations[0] || null;
      
      // Безопасное получение brand translation
      const brandTranslations = product.brand && Array.isArray(product.brand.translations)
        ? product.brand.translations
        : [];
      const brandTranslation = brandTranslations.length > 0
        ? brandTranslations.find((t: { locale: string }) => t.locale === lang) || brandTranslations[0]
        : null;
      
      // Безопасное получение variant
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const variant = variants.length > 0
        ? variants.sort((a: { price: number }, b: { price: number }) => a.price - b.price)[0]
        : null;

      // Get all unique colors from variants
      const colorSet = new Set<string>();
      variants.forEach((v: { options?: Array<{ attributeKey?: string | null; value?: string | null }> }) => {
        const options = Array.isArray(v.options) ? v.options : [];
        const colorOption = options.find((opt: { attributeKey?: string | null }) => opt.attributeKey === "color");
        if (colorOption?.value) {
          colorSet.add(colorOption.value.trim().toLowerCase());
        }
      });
      const availableColors = Array.from(colorSet);

      const originalPrice = variant?.price || 0;
      let finalPrice = originalPrice;
      const productDiscount = product.discountPercent || 0;
      
      // Calculate applied discount with priority: productDiscount > categoryDiscount > brandDiscount > globalDiscount
      let appliedDiscount = 0;
      if (productDiscount > 0) {
        appliedDiscount = productDiscount;
      } else {
        // Check category discounts
        const primaryCategoryId = product.primaryCategoryId;
        if (primaryCategoryId && categoryDiscounts[primaryCategoryId]) {
          appliedDiscount = categoryDiscounts[primaryCategoryId];
        } else {
          // Check brand discounts
          const brandId = product.brandId;
          if (brandId && brandDiscounts[brandId]) {
            appliedDiscount = brandDiscounts[brandId];
          } else if (globalDiscount > 0) {
            appliedDiscount = globalDiscount;
          }
        }
      }

      if (appliedDiscount > 0 && originalPrice > 0) {
        finalPrice = originalPrice * (1 - appliedDiscount / 100);
      }

      // Get categories with translations
      const categories = Array.isArray(product.categories) ? product.categories.map((cat: { id: string; translations?: Array<{ locale: string; slug: string; title: string }> }) => {
        const catTranslations = Array.isArray(cat.translations) ? cat.translations : [];
        const catTranslation = catTranslations.find((t: { locale: string }) => t.locale === lang) || catTranslations[0] || null;
        return {
          id: cat.id,
          slug: catTranslation?.slug || "",
          title: catTranslation?.title || "",
        };
      }) : [];

      return {
        id: product.id,
        slug: translation?.slug || "",
        title: translation?.title || "",
        brand: product.brand
          ? {
              id: product.brand.id,
              name: brandTranslation?.name || "",
            }
          : null,
        categories,
        price: finalPrice,
        originalPrice: appliedDiscount > 0 ? originalPrice : variant?.compareAtPrice || null,
        compareAtPrice: variant?.compareAtPrice || null,
        discountPercent: appliedDiscount > 0 ? appliedDiscount : null,
        image:
          Array.isArray(product.media) && product.media[0]
            ? typeof product.media[0] === "string"
              ? product.media[0]
              : (product.media[0] as any).url
            : null,
        inStock: (variant?.stock || 0) > 0,
        labels: Array.isArray(product.labels) ? product.labels.map((label: { id: string; type: string; value: string; position: string; color: string | null }) => ({
          id: label.id,
          type: label.type,
          value: label.value,
          position: label.position,
          color: label.color,
        })) : [],
        colors: availableColors, // Add available colors array
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get available filters (colors and sizes)
   */
  async getFilters(filters: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    lang?: string;
  }) {
    try {
      const where: Prisma.ProductWhereInput = {
        published: true,
        deletedAt: null,
      };

      // Add search filter
      if (filters.search && filters.search.trim()) {
        where.OR = [
          {
            translations: {
              some: {
                title: {
                  contains: filters.search.trim(),
                  mode: "insensitive",
                },
              },
            },
          },
          {
            translations: {
              some: {
                subtitle: {
                  contains: filters.search.trim(),
                  mode: "insensitive",
                },
              },
            },
          },
          {
            variants: {
              some: {
                sku: {
                  contains: filters.search.trim(),
                  mode: "insensitive",
                },
              },
            },
          },
        ];
      }

      // Add category filter
      if (filters.category) {
        try {
          const categoryDoc = await db.category.findFirst({
            where: {
              translations: {
                some: {
                  slug: filters.category,
                  locale: filters.lang || "en",
                },
              },
              published: true,
              deletedAt: null,
            },
          });

          if (categoryDoc && categoryDoc.id) {
            if (where.OR) {
              where.AND = [
                { OR: where.OR },
                {
                  OR: [
                    { primaryCategoryId: categoryDoc.id },
                    { categoryIds: { has: categoryDoc.id } },
                  ],
                },
              ];
              delete where.OR;
            } else {
              where.OR = [
                { primaryCategoryId: categoryDoc.id },
                { categoryIds: { has: categoryDoc.id } },
              ];
            }
          }
        } catch (categoryError) {
          console.error('❌ [PRODUCTS SERVICE] Error fetching category:', categoryError);
          // Continue without category filter if there's an error
        }
      }

      // Get products with variants
      let products;
      try {
        products = await db.product.findMany({
          where,
          include: {
            variants: {
              where: {
                published: true,
              },
              include: {
                options: true,
              },
            },
          },
        });
      } catch (dbError) {
        console.error('❌ [PRODUCTS SERVICE] Error fetching products in getFilters:', dbError);
        throw dbError;
      }

      // Ensure products is an array
      if (!products || !Array.isArray(products)) {
        products = [];
      }

    // Filter by price in memory
    if (filters.minPrice || filters.maxPrice) {
      const min = filters.minPrice || 0;
      const max = filters.maxPrice || Infinity;
      products = products.filter((product: ProductWithRelations) => {
        if (!product || !product.variants || !Array.isArray(product.variants)) {
          return false;
        }
        const prices = product.variants.map((v: { price?: number }) => v?.price).filter((p: number | undefined): p is number => p !== undefined);
        if (prices.length === 0) return false;
        const minPrice = Math.min(...prices);
        return minPrice >= min && minPrice <= max;
      });
    }

    // Collect colors and sizes from variants
    // Use Map with lowercase key to merge colors with different cases
    // Store both count and canonical label (prefer capitalized version)
    const colorMap = new Map<string, { count: number; label: string }>();
    const sizeMap = new Map<string, number>();

    products.forEach((product: ProductWithRelations) => {
      if (!product || !product.variants || !Array.isArray(product.variants)) {
        return;
      }
      product.variants.forEach((variant: { options?: Array<{ attributeKey?: string | null; value?: string | null }> }) => {
        if (!variant || !variant.options || !Array.isArray(variant.options)) {
          return;
        }
        variant.options.forEach((option: { attributeKey?: string | null; value?: string | null }) => {
          if (!option) return;
          if (option.attributeKey === "color" && option.value) {
            const colorValue = option.value.trim();
            if (colorValue) {
              const colorKey = colorValue.toLowerCase();
              const existing = colorMap.get(colorKey);
              
              // Prefer capitalized version for label (e.g., "Black" over "black")
              // If both exist, keep the one that starts with uppercase
              const preferredLabel = existing 
                ? (colorValue[0] === colorValue[0].toUpperCase() ? colorValue : existing.label)
                : colorValue;
              
              colorMap.set(colorKey, {
                count: (existing?.count || 0) + 1,
                label: preferredLabel,
              });
            }
          } else if (option.attributeKey === "size" && option.value) {
            const sizeValue = option.value.trim().toUpperCase();
            if (sizeValue) {
              sizeMap.set(sizeValue, (sizeMap.get(sizeValue) || 0) + 1);
            }
          }
        });
      });
    });

    // Convert maps to arrays
    const colors: Array<{ value: string; label: string; count: number }> = Array.from(
      colorMap.entries()
    ).map(([key, data]: [string, { count: number; label: string }]) => ({
      value: key, // lowercase for filtering
      label: data.label, // canonical label (prefer capitalized)
      count: data.count, // merged count
    }));

    const sizes: Array<{ value: string; count: number }> = Array.from(
      sizeMap.entries()
    ).map(([value, count]: [string, number]) => ({
      value,
      count,
    }));

    // Sort sizes by predefined order
    const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    sizes.sort((a: { value: string }, b: { value: string }) => {
      const aIndex = SIZE_ORDER.indexOf(a.value);
      const bIndex = SIZE_ORDER.indexOf(b.value);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.value.localeCompare(b.value);
    });

      // Sort colors alphabetically
      colors.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));

      return {
        colors,
        sizes,
      };
    } catch (error) {
      console.error('❌ [PRODUCTS SERVICE] Error in getFilters:', error);
      // Return empty arrays on error
      return {
        colors: [],
        sizes: [],
      };
    }
  }

  /**
   * Get price range
   */
  async getPriceRange(filters: { category?: string; lang?: string }) {
    const where: Prisma.ProductWhereInput = {
      published: true,
      deletedAt: null,
    };

    if (filters.category) {
      const categoryDoc = await db.category.findFirst({
        where: {
          translations: {
            some: {
              slug: filters.category,
              locale: filters.lang || "en",
            },
          },
        },
      });

      if (categoryDoc) {
        where.OR = [
          { primaryCategoryId: categoryDoc.id },
          { categoryIds: { has: categoryDoc.id } },
        ];
      }
    }

    const products = await db.product.findMany({
      where,
      include: {
        variants: {
          where: {
            published: true,
          },
        },
      },
    });

    let minPrice = Infinity;
    let maxPrice = 0;

    products.forEach((product: { variants: Array<{ price: number }> }) => {
      if (product.variants.length > 0) {
        const prices = product.variants.map((v: { price: number }) => v.price);
        const productMin = Math.min(...prices);
        const productMax = Math.max(...prices);
        if (productMin < minPrice) minPrice = productMin;
        if (productMax > maxPrice) maxPrice = productMax;
      }
    });

    minPrice = minPrice === Infinity ? 0 : Math.floor(minPrice / 1000) * 1000;
    maxPrice = maxPrice === 0 ? 100000 : Math.ceil(maxPrice / 1000) * 1000;

    // Load price filter settings to provide optional step sizes per currency
    let stepSize: number | null = null;
    let stepSizePerCurrency: {
      USD?: number;
      AMD?: number;
      RUB?: number;
      GEL?: number;
    } | null = null;

    try {
      const settings = await adminService.getPriceFilterSettings();
      stepSize = settings.stepSize ?? null;

      if (settings.stepSizePerCurrency) {
        // stepSizePerCurrency in settings is stored in display currency units.
        // Here we pass them through to the frontend as-is; the slider logic
        // will choose the appropriate value for the active currency.
        stepSizePerCurrency = {
          USD: settings.stepSizePerCurrency.USD ?? undefined,
          AMD: settings.stepSizePerCurrency.AMD ?? undefined,
          RUB: settings.stepSizePerCurrency.RUB ?? undefined,
          GEL: settings.stepSizePerCurrency.GEL ?? undefined,
        };
      }
    } catch (error) {
      console.error('❌ [PRODUCTS SERVICE] Error loading price filter settings for price range:', error);
    }

    return {
      min: minPrice,
      max: maxPrice,
      stepSize,
      stepSizePerCurrency,
    };
  }

  /**
   * Get product by slug
   */
  async findBySlug(slug: string, lang: string = "en") {
    const product = await db.product.findFirst({
      where: {
        translations: {
          some: {
            slug,
            locale: lang,
          },
        },
        published: true,
        deletedAt: null,
      },
      include: {
        translations: true,
        brand: {
          include: {
            translations: true,
          },
        },
        categories: {
          include: {
            translations: true,
          },
        },
        variants: {
          where: {
            published: true,
          },
          include: {
            options: true,
          },
        },
        labels: true,
      },
    });

    if (!product) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Product not found",
        detail: `Product with slug '${slug}' does not exist or is not published`,
      };
    }

    // Безопасное получение translation с проверкой на существование массива
    const translations = Array.isArray(product.translations) ? product.translations : [];
    const translation = translations.find((t: { locale: string }) => t.locale === lang) || translations[0] || null;
    
    // Безопасное получение brand translation
    const brandTranslations = product.brand && Array.isArray(product.brand.translations)
      ? product.brand.translations
      : [];
    const brandTranslation = brandTranslations.length > 0
      ? brandTranslations.find((t: { locale: string }) => t.locale === lang) || brandTranslations[0]
      : null;

    // Get all discount settings
    const discountSettings = await db.settings.findMany({
      where: {
        key: {
          in: ["globalDiscount", "categoryDiscounts", "brandDiscounts"],
        },
      },
    });

    const globalDiscountSetting = discountSettings.find((s: { key: string; value: unknown }) => s.key === "globalDiscount");
    const globalDiscount = Number(globalDiscountSetting?.value) || 0;
    
    const categoryDiscountsSetting = discountSettings.find((s: { key: string; value: unknown }) => s.key === "categoryDiscounts");
    const categoryDiscounts = categoryDiscountsSetting ? (categoryDiscountsSetting.value as Record<string, number>) || {} : {};
    
    const brandDiscountsSetting = discountSettings.find((s: { key: string; value: unknown }) => s.key === "brandDiscounts");
    const brandDiscounts = brandDiscountsSetting ? (brandDiscountsSetting.value as Record<string, number>) || {} : {};
    
    const productDiscount = product.discountPercent || 0;
    
    // Calculate actual discount with priority: productDiscount > categoryDiscount > brandDiscount > globalDiscount
    let actualDiscount = 0;
    if (productDiscount > 0) {
      actualDiscount = productDiscount;
    } else {
      // Check category discounts
      const primaryCategoryId = product.primaryCategoryId;
      if (primaryCategoryId && categoryDiscounts[primaryCategoryId]) {
        actualDiscount = categoryDiscounts[primaryCategoryId];
      } else {
        // Check brand discounts
        const brandId = product.brandId;
        if (brandId && brandDiscounts[brandId]) {
          actualDiscount = brandDiscounts[brandId];
        } else if (globalDiscount > 0) {
          actualDiscount = globalDiscount;
        }
      }
    }

    return {
      id: product.id,
      slug: translation?.slug || "",
      title: translation?.title || "",
      subtitle: translation?.subtitle || null,
      description: translation?.descriptionHtml || null,
      brand: product.brand
        ? {
            id: product.brand.id,
            slug: product.brand.slug,
            name: brandTranslation?.name || "",
            logo: product.brand.logoUrl,
          }
        : null,
      categories: Array.isArray(product.categories) ? product.categories.map((cat: { id: string; translations?: Array<{ locale: string; slug: string; title: string }> }) => {
        const catTranslations = Array.isArray(cat.translations) ? cat.translations : [];
        const catTranslation = catTranslations.find((t: { locale: string }) => t.locale === lang) || catTranslations[0] || null;
        return {
          id: cat.id,
          slug: catTranslation?.slug || "",
          title: catTranslation?.title || "",
        };
      }) : [],
      media: Array.isArray(product.media) ? product.media : [],
      labels: Array.isArray(product.labels) ? product.labels.map((label: { id: string; type: string; value: string; position: string; color: string | null }) => ({
        id: label.id,
        type: label.type,
        value: label.value,
        position: label.position,
        color: label.color,
      })) : [],
      variants: Array.isArray(product.variants) ? product.variants
        .sort((a: { price: number }, b: { price: number }) => a.price - b.price)
        .map((variant: { id: string; sku: string | null; price: number; compareAtPrice: number | null; stock: number; imageUrl?: string | null; options?: Array<{ attributeKey?: string | null; value?: string | null }> }) => {
          const originalPrice = variant.price;
          let finalPrice = originalPrice;
          let discountPrice = null;

          if (actualDiscount > 0 && originalPrice > 0) {
            discountPrice = originalPrice;
            finalPrice = originalPrice * (1 - actualDiscount / 100);
          }

          return {
            id: variant.id,
            sku: variant.sku || "",
            price: finalPrice,
            originalPrice: discountPrice || variant.compareAtPrice || null,
            compareAtPrice: variant.compareAtPrice || null,
            globalDiscount: globalDiscount > 0 ? globalDiscount : null,
            productDiscount: productDiscount > 0 ? productDiscount : null,
            stock: variant.stock,
            imageUrl: variant.imageUrl || null,
            options: Array.isArray(variant.options) ? variant.options.map((opt: { attributeKey?: string | null; value?: string | null }) => ({
              attribute: opt.attributeKey || "",
              value: opt.value || "",
              key: opt.attributeKey || "",
            })) : [],
            available: variant.stock > 0,
          };
        }) : [],
      globalDiscount: globalDiscount > 0 ? globalDiscount : null,
      productDiscount: productDiscount > 0 ? productDiscount : null,
      seo: {
        title: translation?.seoTitle || translation?.title,
        description: translation?.seoDescription || null,
      },
      published: product.published,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

export const productsService = new ProductsService();

