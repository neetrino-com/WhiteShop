const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Settings = require('../models/Settings');
const { safeRedis } = require('../lib/redis');

const productsController = {
  /**
   * Get all products with filters
   * GET /api/v1/products?category=&filters=&search=&sort=&page=&limit=&lang=
   */
  async findAll(req, res, next) {
    try {
      const {
        category,
        filters,
        filter,
        search,
        sort = 'createdAt',
        page = 1,
        limit = 24,
        lang = 'en',
        minPrice,
        maxPrice,
        colors,
        sizes,
        brand,
      } = req.query;

      // Reduced cache TTL for products list to show new products faster
      // Cache key includes timestamp to help with cache invalidation
      const cacheKey = `products:${JSON.stringify(req.query)}`;
      const cached = await safeRedis.get(cacheKey);
      
      // Only use cache if it's less than 1 minute old (reduced from 5 minutes)
      // This ensures new products appear faster
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = {
        published: true,
        deletedAt: null,
      };

      // Add search filter
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { 'translations.title': searchRegex },
          { 'translations.subtitle': searchRegex },
          { 'translations.descriptionHtml': searchRegex },
          { 'variants.sku': searchRegex },
        ];
      }

      // Add category filter
      if (category) {
        const categoryDoc = await Category.findOne({
          'translations.slug': category,
          'translations.locale': lang,
          published: true,
          deletedAt: null,
        });

        if (categoryDoc) {
          if (query.$or) {
            // If search already exists, combine with category filter
            query.$and = [
              { $or: query.$or },
              {
                $or: [
                  { primaryCategoryId: categoryDoc._id },
                  { categoryIds: categoryDoc._id },
                ],
              },
            ];
            delete query.$or;
          } else {
            query.$or = [
              { primaryCategoryId: categoryDoc._id },
              { categoryIds: categoryDoc._id },
            ];
          }
        }
      }

      // Add filter for new, featured, bestseller
      const activeFilter = filter || filters;
      if (activeFilter) {
        if (activeFilter === 'new') {
          // Products created in the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query.createdAt = { $gte: thirtyDaysAgo };
        } else if (activeFilter === 'featured') {
          // Products marked as featured
          query.featured = true;
        } else if (activeFilter === 'bestseller' || activeFilter === 'top') {
          // For bestseller, we'll filter after getting products
          // This will be handled after the query
        }
      }

      // Get all products first
      let products = await Product.find(query)
        .populate('brandId', 'slug')
        .populate({
          path: 'brandId',
          select: 'slug translations',
        })
        .lean();

      // Handle bestseller filter (requires Order data)
      if (activeFilter === 'bestseller' || activeFilter === 'top') {
        const Order = require('../models/Order');
        try {
          // Get top selling product IDs from orders
          const topProducts = await Order.aggregate([
            { $unwind: '$items' },
            { $match: { paymentStatus: 'paid' } },
            {
              $group: {
                _id: '$items.variantId',
                totalQuantity: { $sum: '$items.quantity' },
              },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 100 }, // Get top 100 variants
          ]);

          // Get product IDs that contain these top variants
          const topVariantIds = topProducts.map((p) => p._id.toString());
          const allProductsForBestseller = await Product.find({
            published: true,
            deletedAt: null,
          })
            .select('_id variants')
            .lean();

          const bestsellerProductIds = new Set();
          allProductsForBestseller.forEach((product) => {
            const hasTopVariant = product.variants?.some((v) =>
              topVariantIds.includes(v._id?.toString())
            );
            if (hasTopVariant) {
              bestsellerProductIds.add(product._id.toString());
            }
          });

          // Filter products to only include bestsellers
          products = products.filter((product) =>
            bestsellerProductIds.has(product._id.toString())
          );
        } catch (err) {
          console.error('❌ [Products] Error fetching bestsellers:', err);
          // Fallback: if error, show featured products instead
          products = products.filter((product) => product.featured === true);
        }
      }

      // Filter by price if provided
      if (minPrice || maxPrice) {
        const minPriceNum = minPrice ? parseFloat(minPrice) : 0;
        const maxPriceNum = maxPrice ? parseFloat(maxPrice) : Infinity;
        
        products = products.filter((product) => {
          const publishedVariants = product.variants?.filter((v) => v.published) || [];
          if (publishedVariants.length === 0) return false;
          
          const minProductPrice = Math.min(...publishedVariants.map((v) => v.price));
          return minProductPrice >= minPriceNum && minProductPrice <= maxPriceNum;
        });
      }

      // Filter by brand if provided
      if (brand) {
        products = products.filter((product) => {
          return product.brandId && product.brandId._id?.toString() === brand;
        });
      }

      // Filter by colors if provided
      if (colors) {
        const colorList = colors.split(',').map((c) => c.trim().toLowerCase());
        products = products.filter((product) => {
          const publishedVariants = product.variants?.filter((v) => v.published && v.stock > 0) || [];
          return publishedVariants.some((variant) => {
            const colorOption = variant.options?.find((opt) => opt.attributeKey === 'color');
            if (colorOption?.value) {
              return colorList.includes(colorOption.value.toLowerCase().trim());
            }
            return false;
          });
        });
      }

      // Filter by sizes if provided
      if (sizes) {
        const sizeList = sizes.split(',').map((s) => s.trim().toUpperCase());
        products = products.filter((product) => {
          const publishedVariants = product.variants?.filter((v) => v.published && v.stock > 0) || [];
          return publishedVariants.some((variant) => {
            const sizeOption = variant.options?.find((opt) => opt.attributeKey === 'size');
            if (sizeOption?.value) {
              return sizeList.includes(sizeOption.value.toUpperCase().trim());
            }
            return false;
          });
        });
      }

      // Sort products
      if (sort === 'price') {
        products.sort((a, b) => {
          const aVariants = a.variants?.filter((v) => v.published) || [];
          const bVariants = b.variants?.filter((v) => v.published) || [];
          const aMinPrice = aVariants.length > 0 ? Math.min(...aVariants.map((v) => v.price)) : Infinity;
          const bMinPrice = bVariants.length > 0 ? Math.min(...bVariants.map((v) => v.price)) : Infinity;
          return bMinPrice - aMinPrice; // Descending
        });
      } else {
        products.sort((a, b) => {
          const aValue = a[sort] || 0;
          const bValue = b[sort] || 0;
          return new Date(bValue) - new Date(aValue); // Descending
        });
      }

      // Get total before pagination
      const total = products.length;

      // Apply pagination
      products = products.slice(skip, skip + parseInt(limit));

      // Get global discount setting
      const globalDiscountSetting = await Settings.findOne({ key: 'globalDiscount' }).lean();
      const globalDiscount = globalDiscountSetting?.value || 0;

      const response = {
        data: products.map((product) => {
          const translation = product.translations?.find((t) => t.locale === lang) || product.translations?.[0];
          const brandTranslation = product.brandId?.translations?.find((t) => t.locale === lang) || product.brandId?.translations?.[0];
          const variant = product.variants
            ?.filter((v) => v.published)
            .sort((a, b) => a.price - b.price)[0];

          const originalPrice = variant?.price || 0;
          let finalPrice = originalPrice;
          let discountPrice = null;
          const productDiscount = product.discountPercent || 0;

          // Apply product-specific discount first (if exists), otherwise apply global discount
          let actualDiscount = 0;
          if (productDiscount > 0 && originalPrice > 0) {
            discountPrice = originalPrice;
            finalPrice = originalPrice * (1 - productDiscount / 100);
            actualDiscount = productDiscount;
          } else if (globalDiscount > 0 && originalPrice > 0) {
            discountPrice = originalPrice;
            finalPrice = originalPrice * (1 - globalDiscount / 100);
            actualDiscount = globalDiscount;
          }

          // Process labels - update percentage labels with actual discount
          const processedLabels = (product.labels || []).map((label) => {
            // If it's a percentage label and there's an actual discount, update the value
            if (label.type === 'percentage' && actualDiscount > 0) {
              return {
                id: label._id?.toString() || '',
                type: label.type,
                value: Math.round(actualDiscount).toString(), // Round to whole number
                position: label.position || 'top-left',
                color: label.color || null,
              };
            }
            // Otherwise, return label as is
            return {
              id: label._id?.toString() || '',
              type: label.type,
              value: label.value,
              position: label.position || 'top-left',
              color: label.color || null,
            };
          });

          // If there is a discount but no percentage label, add an automatic one
          if (actualDiscount > 0) {
            const hasPercentageLabel = processedLabels.some(
              (label) => label.type === 'percentage'
            );

            if (!hasPercentageLabel) {
              const autoLabel = {
                id: `auto-discount-${product._id.toString()}`,
                type: 'percentage',
                value: Math.round(actualDiscount).toString(),
                position: 'top-left',
                color: null,
              };

              processedLabels.push(autoLabel);
              console.log('🏷️ [PRODUCTS] Auto discount label added', {
                productId: product._id.toString(),
                discount: autoLabel.value,
              });
            }
          }

          return {
            id: product._id.toString(),
            slug: translation?.slug || '',
            title: translation?.title || '',
            brand: product.brandId
              ? {
                  id: product.brandId._id.toString(),
                  name: brandTranslation?.name || '',
                }
              : null,
            price: finalPrice,
            originalPrice: discountPrice || variant?.compareAtPrice || null,
            compareAtPrice: variant?.compareAtPrice || null,
            globalDiscount: globalDiscount > 0 ? globalDiscount : null,
            productDiscount: productDiscount > 0 ? productDiscount : null,
            image: Array.isArray(product.media) && product.media[0]
              ? (typeof product.media[0] === 'string' ? product.media[0] : product.media[0].url)
              : null,
            inStock: (variant?.stock || 0) > 0,
            labels: processedLabels,
          };
        }),
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      };

      // Cache for 1 minute (reduced from 5 minutes) to show new products faster
      await safeRedis.setex(cacheKey, 60, JSON.stringify(response));

      res.json(response);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get available colors and sizes for products
   * GET /api/v1/products/filters?category=&search=&minPrice=&maxPrice=&lang=
   */
  async getFilters(req, res, next) {
    try {
      const { category, search, minPrice, maxPrice, lang = 'en' } = req.query;

      const query = {
        published: true,
        deletedAt: null,
      };

      // Add search filter
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { 'translations.title': searchRegex },
          { 'translations.subtitle': searchRegex },
          { 'translations.descriptionHtml': searchRegex },
          { 'variants.sku': searchRegex },
        ];
      }

      // Add category filter
      if (category) {
        const categoryDoc = await Category.findOne({
          'translations.slug': category,
          'translations.locale': lang,
          published: true,
          deletedAt: null,
        });

        if (categoryDoc) {
          if (query.$or) {
            query.$and = [
              { $or: query.$or },
              {
                $or: [
                  { primaryCategoryId: categoryDoc._id },
                  { categoryIds: categoryDoc._id },
                ],
              },
            ];
            delete query.$or;
          } else {
            query.$or = [
              { primaryCategoryId: categoryDoc._id },
              { categoryIds: categoryDoc._id },
            ];
          }
        }
      }

      // Get all products
      let products = await Product.find(query)
        .populate('brandId', 'slug')
        .populate({
          path: 'brandId',
          select: 'slug translations',
        })
        .lean();

      // Filter by price if provided
      if (minPrice || maxPrice) {
        const minPriceNum = minPrice ? parseFloat(minPrice) : 0;
        const maxPriceNum = maxPrice ? parseFloat(maxPrice) : Infinity;
        
        products = products.filter((product) => {
          const publishedVariants = product.variants?.filter((v) => v.published) || [];
          if (publishedVariants.length === 0) return false;
          
          const minProductPrice = Math.min(...publishedVariants.map((v) => v.price));
          return minProductPrice >= minPriceNum && minProductPrice <= maxPriceNum;
        });
      }

      // Extract colors and sizes
      const colorCountMap = new Map();
      const sizeCountMap = new Map();

      console.log(`[getFilters] Processing ${products.length} products`);
      
      products.forEach((product) => {
        const publishedVariants = product.variants?.filter((v) => v.published && v.stock > 0) || [];
        
        console.log(`[getFilters] Product ${product._id} has ${publishedVariants.length} published variants with stock`);
        
        publishedVariants.forEach((variant) => {
          // Extract colors
          const colorOption = variant.options?.find((opt) => opt.attributeKey === 'color');
          if (colorOption?.value) {
            const colorValue = colorOption.value.toLowerCase().trim();
            const currentCount = colorCountMap.get(colorValue) || 0;
            colorCountMap.set(colorValue, currentCount + 1);
            console.log(`[getFilters] Found color: ${colorValue}`);
          }

          // Extract sizes
          const sizeOption = variant.options?.find((opt) => opt.attributeKey === 'size');
          if (sizeOption?.value) {
            const sizeValue = sizeOption.value.toUpperCase().trim();
            const currentCount = sizeCountMap.get(sizeValue) || 0;
            sizeCountMap.set(sizeValue, currentCount + 1);
            console.log(`[getFilters] Found size: ${sizeValue}`);
          }
          
          // Debug: log variant options
          if (variant.options && variant.options.length > 0) {
            console.log(`[getFilters] Variant ${variant._id} options:`, JSON.stringify(variant.options));
          }
        });
      });
      
      console.log(`[getFilters] Total colors found: ${colorCountMap.size}, Total sizes found: ${sizeCountMap.size}`);

      const colors = Array.from(colorCountMap.entries())
        .map(([value, count]) => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
          count,
        }))
        .sort((a, b) => b.count - a.count);

      const sizes = Array.from(sizeCountMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => {
          const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
          const aIndex = SIZE_ORDER.indexOf(a.value);
          const bIndex = SIZE_ORDER.indexOf(b.value);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.value.localeCompare(b.value);
        });

      res.json({ colors, sizes });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get price range for products
   * GET /api/v1/products/price-range?category=&lang=
   */
  async getPriceRange(req, res, next) {
    try {
      const { category, lang = 'en' } = req.query;

      const query = {
        published: true,
        deletedAt: null,
      };

      // Add category filter if provided
      if (category) {
        const categoryDoc = await Category.findOne({
          'translations.slug': category,
          'translations.locale': lang,
          published: true,
          deletedAt: null,
        });

        if (categoryDoc) {
          query.$or = [
            { primaryCategoryId: categoryDoc._id },
            { categoryIds: categoryDoc._id },
          ];
        }
      }

      const products = await Product.find(query).lean();

      // Calculate min and max prices from all published variants
      let minPrice = Infinity;
      let maxPrice = 0;

      products.forEach((product) => {
        const publishedVariants = product.variants?.filter((v) => v.published) || [];
        if (publishedVariants.length > 0) {
          const productMinPrice = Math.min(...publishedVariants.map((v) => v.price));
          const productMaxPrice = Math.max(...publishedVariants.map((v) => v.price));
          
          if (productMinPrice < minPrice) minPrice = productMinPrice;
          if (productMaxPrice > maxPrice) maxPrice = productMaxPrice;
        }
      });

      // Round to nice numbers
      minPrice = minPrice === Infinity ? 0 : Math.floor(minPrice / 1000) * 1000;
      maxPrice = maxPrice === 0 ? 100000 : Math.ceil(maxPrice / 1000) * 1000;

      res.json({
        min: minPrice,
        max: maxPrice,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get product by slug
   * GET /api/v1/products/:slug?lang=
   */
  async findBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const { lang = 'en' } = req.query;

      const cacheKey = `product:${slug}:${lang}`;
      const cached = await safeRedis.get(cacheKey);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const product = await Product.findOne({
        'translations.slug': slug,
        'translations.locale': lang,
        published: true,
        deletedAt: null,
      })
        .populate('brandId')
        .populate('categoryIds')
        .populate('primaryCategoryId')
        .lean();

      if (!product) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Product not found',
          status: 404,
          detail: `Product with slug '${slug}' does not exist or is not published`,
          instance: req.path,
        });
      }

      const translation = product.translations?.find((t) => t.locale === lang) || product.translations?.[0];
      const brandTranslation = product.brandId?.translations?.find((t) => t.locale === lang) || product.brandId?.translations?.[0];

      const categories = await Category.find({
        _id: { $in: product.categoryIds || [] },
      }).lean();

      // Get global discount setting
      const globalDiscountSetting = await Settings.findOne({ key: 'globalDiscount' }).lean();
      const globalDiscount = globalDiscountSetting?.value || 0;
      const productDiscount = product.discountPercent || 0;

      // Calculate actual discount (product-specific takes priority)
      const actualDiscount = productDiscount > 0 ? productDiscount : (globalDiscount > 0 ? globalDiscount : 0);

      // Process labels - update percentage labels with actual discount
      const processedLabels = (product.labels || []).map((label) => {
        // If it's a percentage label and there's an actual discount, update the value
        if (label.type === 'percentage' && actualDiscount > 0) {
          return {
            id: label._id?.toString() || '',
            type: label.type,
            value: Math.round(actualDiscount).toString(), // Round to whole number
            position: label.position || 'top-left',
            color: label.color || null,
          };
        }
        // Otherwise, return label as is
        return {
          id: label._id?.toString() || '',
          type: label.type,
          value: label.value,
          position: label.position || 'top-left',
          color: label.color || null,
        };
      });

      const response = {
        id: product._id.toString(),
        slug: translation?.slug || '',
        title: translation?.title || '',
        subtitle: translation?.subtitle,
        description: translation?.descriptionHtml,
        brand: product.brandId
          ? {
              id: product.brandId._id.toString(),
              slug: product.brandId.slug,
              name: brandTranslation?.name || '',
              logo: product.brandId.logoUrl,
            }
          : null,
        categories: categories.map((cat) => {
          const catTranslation = cat.translations?.find((t) => t.locale === lang) || cat.translations?.[0];
          return {
            id: cat._id.toString(),
            slug: catTranslation?.slug || '',
            title: catTranslation?.title || '',
          };
        }),
        media: Array.isArray(product.media) ? product.media : [],
        labels: processedLabels,
        variants: product.variants
          ?.filter((v) => v.published)
          .sort((a, b) => a.price - b.price)
          .map((variant) => {
            const originalPrice = variant.price;
            let finalPrice = originalPrice;
            let discountPrice = null;

            // Apply product-specific discount first (if exists), otherwise apply global discount
            if (productDiscount > 0 && originalPrice > 0) {
              discountPrice = originalPrice;
              finalPrice = originalPrice * (1 - productDiscount / 100);
            } else if (globalDiscount > 0 && originalPrice > 0) {
              discountPrice = originalPrice;
              finalPrice = originalPrice * (1 - globalDiscount / 100);
            }

            return {
              id: variant._id?.toString() || '',
              sku: variant.sku,
              price: finalPrice,
              originalPrice: discountPrice || variant.compareAtPrice || null,
              compareAtPrice: variant.compareAtPrice || null,
              globalDiscount: globalDiscount > 0 ? globalDiscount : null,
              productDiscount: productDiscount > 0 ? productDiscount : null,
              stock: variant.stock,
              options: variant.options?.map((opt) => ({
                attribute: opt.attributeKey || '',
                value: opt.value || '',
                key: opt.attributeKey || '',
              })) || [],
              available: variant.stock > 0,
            };
          }) || [],
        globalDiscount: globalDiscount > 0 ? globalDiscount : null,
        productDiscount: productDiscount > 0 ? productDiscount : null,
        seo: {
          title: translation?.seoTitle || translation?.title,
          description: translation?.seoDescription,
        },
        published: product.published,
        publishedAt: product.publishedAt,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };

      // Cache for 10 minutes
      await safeRedis.setex(cacheKey, 600, JSON.stringify(response));

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = productsController;
