const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const Attribute = require('../models/Attribute');
const { safeRedis } = require('../lib/redis');

const adminController = {
  /**
   * Get admin dashboard statistics
   * GET /api/v1/admin/stats
   */
  async getStats(req, res, next) {
    try {
      console.log('📊 [ADMIN] Fetching dashboard statistics...');
      console.log('📊 [ADMIN] User making request:', req.user?.id, req.user?.email);

      // Get total users (excluding deleted)
      let totalUsers = 0;
      try {
        totalUsers = await User.countDocuments({ deletedAt: null });
        console.log('✅ [ADMIN] Total users:', totalUsers);
      } catch (err) {
        console.error('❌ [ADMIN] Error counting users:', err);
        totalUsers = 0;
      }
      
      // Get total products (excluding deleted)
      let totalProducts = 0;
      let lowStockProducts = 0;
      try {
        totalProducts = await Product.countDocuments({ deletedAt: null });
        lowStockProducts = await Product.countDocuments({
          deletedAt: null,
          'variants.stock': { $lt: 10 },
        });
        console.log('✅ [ADMIN] Total products:', totalProducts, 'Low stock:', lowStockProducts);
      } catch (err) {
        console.error('❌ [ADMIN] Error counting products:', err);
        totalProducts = 0;
        lowStockProducts = 0;
      }
      
      // Get total orders
      let totalOrders = 0;
      let recentOrders = 0;
      let pendingOrders = 0;
      let totalRevenue = 0;
      try {
        totalOrders = await Order.countDocuments();
        
        // Get recent orders count (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        recentOrders = await Order.countDocuments({
          createdAt: { $gte: sevenDaysAgo },
        });

        // Get pending orders count
        pendingOrders = await Order.countDocuments({
          status: 'pending',
        });

        // Get total revenue (sum of all paid orders)
        const revenueResult = await Order.aggregate([
          {
            $match: {
              paymentStatus: 'paid',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$total' },
            },
          },
        ]);
        totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
        
        console.log('✅ [ADMIN] Orders stats:', { totalOrders, recentOrders, pendingOrders, totalRevenue });
      } catch (err) {
        console.error('❌ [ADMIN] Error counting orders:', err);
        totalOrders = 0;
        recentOrders = 0;
        pendingOrders = 0;
        totalRevenue = 0;
      }

      const stats = {
        users: {
          total: totalUsers,
        },
        products: {
          total: totalProducts,
          lowStock: lowStockProducts,
        },
        orders: {
          total: totalOrders,
          recent: recentOrders,
          pending: pendingOrders,
        },
        revenue: {
          total: Number(totalRevenue),
          currency: 'AMD',
        },
      };

      console.log('✅ [ADMIN] Statistics fetched successfully:', JSON.stringify(stats, null, 2));
      res.json(stats);
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching stats:', error);
      console.error('❌ [ADMIN] Error stack:', error.stack);
      
      // Return error response
      res.status(500).json({
        type: 'https://api.shop.am/problems/internal-server-error',
        title: 'Internal Server Error',
        status: 500,
        detail: error.message || 'Failed to fetch statistics',
        instance: req.path,
      });
    }
  },

  /**
   * Get all users (admin only)
   * GET /api/v1/admin/users?page=&limit=&search=
   */
  async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = { deletedAt: null };

      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { email: searchRegex },
          { phone: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
        ];
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-passwordHash')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        User.countDocuments(query),
      ]);

      res.json({
        data: users.map((user) => ({
          id: user._id.toString(),
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles || ['customer'],
          blocked: user.blocked || false,
          createdAt: user.createdAt,
        })),
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update user (admin only) - block/unblock user
   * PUT /api/v1/admin/users/:id
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      console.log('📝 [ADMIN] Updating user:', id);
      console.log('📝 [ADMIN] Update data:', JSON.stringify(updateData, null, 2));

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          detail: `User with id '${id}' does not exist`,
          instance: req.path,
        });
      }

      // Обновляем пользователя
      if (updateData.blocked !== undefined) {
        user.blocked = updateData.blocked;
      }
      
      // Можно добавить обновление других полей
      if (updateData.roles !== undefined) {
        user.roles = updateData.roles;
      }

      await user.save();

      console.log('✅ [ADMIN] User updated successfully:', id);
      console.log('📊 [ADMIN] Updated user details:', {
        id: user._id.toString(),
        blocked: user.blocked,
        roles: user.roles,
      });

      res.json({
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles || ['customer'],
        blocked: user.blocked || false,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error updating user:', error);
      next(error);
    }
  },

  /**
   * Get all orders (admin only)
   * GET /api/v1/admin/orders?page=&limit=&status=
   */
  async getOrders(req, res, next) {
    try {
      const { page = 1, limit = 20, status = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = {};
      if (status) {
        query.status = status;
      }

      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Order.countDocuments(query),
      ]);

      res.json({
        data: orders.map((order) => ({
          id: order._id.toString(),
          number: order.number,
          status: order.status,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          total: Number(order.total),
          currency: order.currency,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          itemsCount: order.items?.length || 0,
          createdAt: order.createdAt,
        })),
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all products (admin only, including unpublished)
   * GET /api/v1/admin/products?page=&limit=&search=
   */
  async getProducts(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = { deletedAt: null };

      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { 'translations.title': searchRegex },
          { 'translations.slug': searchRegex },
          { 'variants.sku': searchRegex },
        ];
      }

      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('brandId', 'slug')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Product.countDocuments(query),
      ]);

      res.json({
        data: products.map((product) => {
          const translation = product.translations?.[0];
          const variant = product.variants
            ?.filter((v) => v.published)
            .sort((a, b) => a.price - b.price)[0];

          // Group variants by color and calculate stock per color
          const colorStockMap = new Map();
          if (product.variants && product.variants.length > 0) {
            product.variants.forEach(v => {
              if (v.published && v.stock > 0) {
                const colorOption = v.options?.find(opt => opt.attributeKey === 'color');
                const color = colorOption?.value || 'default';
                const currentStock = colorStockMap.get(color) || 0;
                colorStockMap.set(color, currentStock + v.stock);
              }
            });
          }

          // Convert color stock map to array
          const colorStocks = Array.from(colorStockMap.entries()).map(([color, stock]) => ({
            color,
            stock,
          }));

          return {
            id: product._id.toString(),
            slug: translation?.slug || '',
            title: translation?.title || '',
            published: product.published || false,
            price: variant?.price || 0,
            stock: variant?.stock || 0,
            colorStocks: colorStocks, // Add color stocks array
            image: Array.isArray(product.media) && product.media[0]
              ? (typeof product.media[0] === 'string' ? product.media[0] : product.media[0].url)
              : null,
            createdAt: product.createdAt,
          };
        }),
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single product by ID (admin only)
   * GET /api/v1/admin/products/:id
   */
  async getProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { lang = 'en' } = req.query;

      console.log('📥 [ADMIN] Fetching product:', id);

      const product = await Product.findById(id)
        .populate('brandId')
        .populate('categoryIds')
        .populate('primaryCategoryId')
        .lean();

      if (!product) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Product not found',
          status: 404,
          detail: `Product with id '${id}' does not exist`,
          instance: req.path,
        });
      }

      const translation = product.translations?.find((t) => t.locale === lang) || product.translations?.[0];
      const brandTranslation = product.brandId?.translations?.find((t) => t.locale === lang) || product.brandId?.translations?.[0];

      // Get category translations
      const categoryTranslations = await Category.find({
        _id: { $in: product.categoryIds || [] },
      }).lean();

      const response = {
        id: product._id.toString(),
        slug: translation?.slug || '',
        title: translation?.title || '',
        subtitle: translation?.subtitle || '',
        descriptionHtml: translation?.descriptionHtml || '',
        brandId: product.brandId?._id?.toString() || null,
        primaryCategoryId: product.primaryCategoryId?._id?.toString() || product.primaryCategoryId?.toString() || null,
        categoryIds: (product.categoryIds || []).map((cat) => 
          cat._id?.toString() || cat.toString()
        ),
        published: product.published || false,
        media: Array.isArray(product.media) ? product.media.map((m) => 
          typeof m === 'string' ? m : m.url
        ) : [],
        variants: (product.variants || []).map((variant) => {
          const colorOption = variant.options?.find((opt) => opt.attributeKey === 'color');
          const sizeOption = variant.options?.find((opt) => opt.attributeKey === 'size');
          
          return {
            id: variant._id?.toString() || '',
            price: variant.price?.toString() || '0',
            compareAtPrice: variant.compareAtPrice?.toString() || '',
            stock: variant.stock?.toString() || '0',
            sku: variant.sku || '',
            color: colorOption?.value || '',
            size: sizeOption?.value || '',
            imageUrl: variant.imageUrl || '',
            published: variant.published !== false,
          };
        }),
      };

      console.log('✅ [ADMIN] Product fetched successfully:', id);
      res.json(response);
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching product:', error);
      next(error);
    }
  },

  /**
   * Create new product (admin only)
   * POST /api/v1/admin/products
   */
  async createProduct(req, res, next) {
    try {
      console.log('📝 [ADMIN] Creating new product...');
      console.log('📝 [ADMIN] Request body:', JSON.stringify(req.body, null, 2));

      const {
        title,
        slug,
        subtitle,
        descriptionHtml,
        brandId,
        categoryIds,
        primaryCategoryId,
        price,
        compareAtPrice,
        stock,
        sku,
        published = true, // По умолчанию публикуем продукт, чтобы он был виден сразу
        locale = 'en',
        media = [],
        variants = [],
      } = req.body;

      // Validate required fields
      if (!title || !slug) {
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'Title and slug are required',
          instance: req.path,
        });
      }

      // Validate price - only required if no variants are provided
      const hasVariants = variants && Array.isArray(variants) && variants.length > 0;
      let priceValue = 0;
      
      if (!hasVariants) {
        // If no variants, require top-level price
        priceValue = parseFloat(price);
        if (!price || isNaN(priceValue) || priceValue <= 0) {
          return res.status(400).json({
            type: 'https://api.shop.am/problems/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: 'Price is required and must be greater than 0',
            instance: req.path,
          });
        }
      } else {
        // If variants are provided, validate each variant has a valid price
        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          const variantPrice = parseFloat(variant.price);
          if (!variant.price || isNaN(variantPrice) || variantPrice <= 0) {
            return res.status(400).json({
              type: 'https://api.shop.am/problems/validation-error',
              title: 'Validation Error',
              status: 400,
              detail: `Variant ${i + 1}: Price is required and must be greater than 0`,
              instance: req.path,
            });
          }
        }
        // Get priceValue for fallback (use first variant price or provided price)
        priceValue = price ? parseFloat(price) : (variants[0] ? parseFloat(variants[0].price) : 0);
      }

      // Check if product with same slug already exists
      const existingProduct = await Product.findOne({
        'translations.slug': slug,
        'translations.locale': locale,
        deletedAt: null,
      });

      if (existingProduct) {
        return res.status(409).json({
          type: 'https://api.shop.am/problems/conflict',
          title: 'Conflict',
          status: 409,
          detail: `Product with slug '${slug}' already exists`,
          instance: req.path,
        });
      }

      // Process media (images)
      const processedMedia = Array.isArray(media) 
        ? media.filter((m) => m && (m.url || typeof m === 'string')).map((m, index) => {
            if (typeof m === 'string') {
              return { url: m, position: index, type: 'image' };
            }
            return { ...m, position: m.position || index, type: m.type || 'image' };
          })
        : [];

      // Get attributes once
      const [colorAttr, sizeAttr] = await Promise.all([
        Attribute.findOne({ key: 'color' }),
        Attribute.findOne({ key: 'size' }),
      ]);

      // Process variants
      let processedVariants = [];
      
      if (variants && Array.isArray(variants) && variants.length > 0) {
        // Use provided variants
        processedVariants = await Promise.all(
          variants.map(async (variant, index) => {
            const variantSku = variant.sku || (sku ? `${sku}-${index + 1}` : `PROD-${Date.now()}-${index + 1}`);
            const options = [];
            
            // Process color attribute
            if (variant.color && colorAttr) {
              const colorValue = colorAttr.values?.find((v) => v.value === variant.color || v._id.toString() === variant.color);
              if (colorValue) {
                options.push({
                  attributeId: colorAttr._id,
                  attributeKey: 'color',
                  valueId: colorValue._id,
                  value: colorValue.value,
                });
              }
            }
            
            // Process size attribute
            if (variant.size && sizeAttr) {
              const sizeValue = sizeAttr.values?.find((v) => v.value === variant.size || v._id.toString() === variant.size);
              if (sizeValue) {
                options.push({
                  attributeId: sizeAttr._id,
                  attributeKey: 'size',
                  valueId: sizeValue._id,
                  value: sizeValue.value,
                });
              }
            }
            
            return {
              sku: variantSku,
              price: parseFloat(variant.price || priceValue || 0),
              compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : (compareAtPrice ? parseFloat(compareAtPrice) : undefined),
              stock: parseInt(variant.stock || stock || 0),
              imageUrl: variant.imageUrl,
              published: variant.published !== false,
              options: options,
              position: variant.position || index,
            };
          })
        );
      } else {
        // Create default variant if no variants provided
        const productSku = sku || `PROD-${Date.now()}`;
        const defaultOptions = [];
        
        // Add color option if provided
        if (req.body.color && colorAttr) {
          const colorValue = colorAttr.values?.find((v) => v.value === req.body.color || v._id.toString() === req.body.color);
          if (colorValue) {
            defaultOptions.push({
              attributeId: colorAttr._id,
              attributeKey: 'color',
              valueId: colorValue._id,
              value: colorValue.value,
            });
          }
        }
        
        // Add size option if provided
        if (req.body.size && sizeAttr) {
          const sizeValue = sizeAttr.values?.find((v) => v.value === req.body.size || v._id.toString() === req.body.size);
          if (sizeValue) {
            defaultOptions.push({
              attributeId: sizeAttr._id,
              attributeKey: 'size',
              valueId: sizeValue._id,
              value: sizeValue.value,
            });
          }
        }
        
        processedVariants = [
          {
            sku: productSku,
            price: priceValue,
            compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : undefined,
            stock: parseInt(stock) || 0,
            published: true,
            options: defaultOptions,
          },
        ];
      }

      // Create product
      const productData = {
        translations: [
          {
            locale,
            title,
            slug,
            subtitle: subtitle || '',
            descriptionHtml: descriptionHtml || '',
          },
        ],
        variants: processedVariants,
        published: published === true,
        publishedAt: published ? new Date() : null,
      };
      
      if (processedMedia.length > 0) {
        productData.media = processedMedia;
      }

      if (brandId) {
        productData.brandId = brandId;
      }

      if (categoryIds && Array.isArray(categoryIds)) {
        productData.categoryIds = categoryIds;
      }

      if (primaryCategoryId) {
        productData.primaryCategoryId = primaryCategoryId;
      }
      
      // Get attribute IDs for product (use already fetched attributes)
      const attributeIds = [];
      if ((req.body.color || (variants && variants.some((v) => v.color))) && colorAttr) {
        if (!attributeIds.some((id) => id.toString() === colorAttr._id.toString())) {
          attributeIds.push(colorAttr._id);
        }
      }
      if ((req.body.size || (variants && variants.some((v) => v.size))) && sizeAttr) {
        if (!attributeIds.some((id) => id.toString() === sizeAttr._id.toString())) {
          attributeIds.push(sizeAttr._id);
        }
      }
      if (attributeIds.length > 0) {
        productData.attributeIds = attributeIds;
      }

      const product = await Product.create(productData);

      console.log('✅ [ADMIN] Product created successfully:', product._id.toString());
      console.log('📊 [ADMIN] Product details:', {
        id: product._id.toString(),
        published: product.published,
        publishedAt: product.publishedAt,
        variantsCount: product.variants?.length || 0,
        publishedVariantsCount: product.variants?.filter(v => v.published)?.length || 0,
        hasTranslations: product.translations?.length > 0,
        translationsCount: product.translations?.length || 0,
      });

      // Invalidate products cache to show new products immediately
      try {
        // Delete all products list cache keys (pattern matching)
        const keys = await safeRedis.keys('products:*');
        if (keys && keys.length > 0) {
          // Delete keys in batches to avoid issues with too many arguments
          for (const key of keys) {
            await safeRedis.del(key);
          }
          console.log('🗑️ [ADMIN] Invalidated products cache:', keys.length, 'keys');
        } else {
          console.log('ℹ️ [ADMIN] No products cache keys found to invalidate');
        }
        
        // Also invalidate individual product cache if slug exists
        if (slug) {
          const productCacheKey = `product:${slug}:*`;
          const productKeys = await safeRedis.keys(productCacheKey);
          if (productKeys && productKeys.length > 0) {
            for (const key of productKeys) {
              await safeRedis.del(key);
            }
            console.log('🗑️ [ADMIN] Invalidated product cache:', productKeys.length, 'keys');
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ [ADMIN] Cache invalidation error (non-critical):', cacheError.message);
      }

      const translation = product.translations?.[0];
      const variant = product.variants?.[0];

      res.status(201).json({
        id: product._id.toString(),
        slug: translation?.slug || '',
        title: translation?.title || '',
        subtitle: translation?.subtitle,
        description: translation?.descriptionHtml,
        price: variant?.price || 0,
        stock: variant?.stock || 0,
        sku: variant?.sku || '',
        published: product.published,
        createdAt: product.createdAt,
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error creating product:', error);
      next(error);
    }
  },

  /**
   * Update product (admin only)
   * PUT /api/v1/admin/products/:id
   */
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const {
        title,
        slug,
        subtitle,
        descriptionHtml,
        brandId,
        categoryIds,
        primaryCategoryId,
        published,
        locale = 'en',
        media = [],
        variants = [],
      } = req.body;

      console.log('📝 [ADMIN] Updating product:', id);
      console.log('📝 [ADMIN] Update data:', JSON.stringify(req.body, null, 2));

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Product not found',
          status: 404,
          detail: `Product with id '${id}' does not exist`,
          instance: req.path,
        });
      }

      // Update translations
      if (title || slug || subtitle !== undefined || descriptionHtml !== undefined) {
        const translationIndex = product.translations?.findIndex((t) => t.locale === locale) ?? -1;
        const translation = translationIndex >= 0 
          ? product.translations[translationIndex]
          : { locale, title: '', slug: '', subtitle: '', descriptionHtml: '' };

        if (title !== undefined) translation.title = title;
        if (slug !== undefined) translation.slug = slug;
        if (subtitle !== undefined) translation.subtitle = subtitle || '';
        if (descriptionHtml !== undefined) translation.descriptionHtml = descriptionHtml || '';

        if (translationIndex >= 0) {
          product.translations[translationIndex] = translation;
        } else {
          if (!product.translations) product.translations = [];
          product.translations.push(translation);
        }
      }

      // Process media
      if (Array.isArray(media)) {
        const processedMedia = media
          .filter((m) => m && (m.url || typeof m === 'string'))
          .map((m, index) => {
            if (typeof m === 'string') {
              return { url: m, position: index, type: 'image' };
            }
            return { ...m, position: m.position || index, type: m.type || 'image' };
          });
        product.media = processedMedia;
      }

      // Process variants if provided
      if (variants && Array.isArray(variants) && variants.length > 0) {
        // First, remove old variants to avoid SKU conflicts
        // We need to delete them from the database first to free up the SKU unique constraint
        if (product.variants && product.variants.length > 0) {
          // Remove variants by setting the array to empty
          // MongoDB will handle the deletion when we save
          product.variants = [];
          // Save to remove old variants from database
          await product.save();
        }

        const [colorAttr, sizeAttr] = await Promise.all([
          Attribute.findOne({ key: 'color' }),
          Attribute.findOne({ key: 'size' }),
        ]);

        // Helper function to check if SKU is unique
        const isSkuUnique = async (sku, excludeProductId) => {
          if (!sku) return false;
          const existing = await Product.findOne({
            _id: { $ne: excludeProductId },
            'variants.sku': sku,
            deletedAt: null,
          });
          return !existing;
        };

        const processedVariants = await Promise.all(
          variants.map(async (variant, index) => {
            // Generate unique SKU if not provided or if provided SKU is not unique
            let variantSku = variant.sku;
            if (!variantSku) {
              variantSku = `${product.skuPrefix || 'PROD'}-${Date.now()}-${index + 1}`;
            } else {
              // Check if SKU is unique (excluding current product)
              const isUnique = await isSkuUnique(variantSku, product._id);
              if (!isUnique) {
                // Add suffix to make it unique
                variantSku = `${variantSku}-${Date.now()}-${index + 1}`;
              }
            }
            const options = [];
            
            // Process color attribute
            if (variant.color && colorAttr) {
              const colorValue = colorAttr.values?.find((v) => v.value === variant.color || v._id.toString() === variant.color);
              if (colorValue) {
                options.push({
                  attributeId: colorAttr._id,
                  attributeKey: 'color',
                  valueId: colorValue._id,
                  value: colorValue.value,
                });
              }
            }
            
            // Process size attribute
            if (variant.size && sizeAttr) {
              const sizeValue = sizeAttr.values?.find((v) => v.value === variant.size || v._id.toString() === variant.size);
              if (sizeValue) {
                options.push({
                  attributeId: sizeAttr._id,
                  attributeKey: 'size',
                  valueId: sizeValue._id,
                  value: sizeValue.value,
                });
              }
            }
            
            return {
              sku: variantSku,
              price: parseFloat(variant.price || 0),
              compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : undefined,
              stock: parseInt(variant.stock || 0),
              imageUrl: variant.imageUrl,
              published: variant.published !== false,
              options: options,
              position: variant.position || index,
            };
          })
        );
        product.variants = processedVariants;
      }

      // Update other fields
      if (brandId !== undefined) product.brandId = brandId || null;
      if (categoryIds !== undefined) product.categoryIds = Array.isArray(categoryIds) ? categoryIds : [];
      if (primaryCategoryId !== undefined) product.primaryCategoryId = primaryCategoryId || null;
      if (published !== undefined) {
        product.published = published;
        product.publishedAt = published ? new Date() : null;
      }

      await product.save();

      console.log('✅ [ADMIN] Product updated successfully:', id);
      console.log('📊 [ADMIN] Updated product details:', {
        id: product._id.toString(),
        published: product.published,
        publishedAt: product.publishedAt,
      });

      // Invalidate products cache
      try {
        const keys = await safeRedis.keys('products:*');
        if (keys && keys.length > 0) {
          for (const key of keys) {
            await safeRedis.del(key);
          }
          console.log('🗑️ [ADMIN] Invalidated products cache:', keys.length, 'keys');
        }

        // Invalidate individual product cache
        if (product.translations && product.translations.length > 0) {
          for (const translation of product.translations) {
            const productCacheKey = `product:${translation.slug}:*`;
            const productKeys = await safeRedis.keys(productCacheKey);
            if (productKeys && productKeys.length > 0) {
              for (const key of productKeys) {
                await safeRedis.del(key);
              }
            }
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ [ADMIN] Cache invalidation error (non-critical):', cacheError.message);
      }

      const translation = product.translations?.[0];
      const variant = product.variants?.[0];

      res.json({
        id: product._id.toString(),
        slug: translation?.slug || '',
        title: translation?.title || '',
        subtitle: translation?.subtitle,
        description: translation?.descriptionHtml,
        price: variant?.price || 0,
        stock: variant?.stock || 0,
        sku: variant?.sku || '',
        published: product.published,
        publishedAt: product.publishedAt,
        updatedAt: product.updatedAt,
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error updating product:', error);
      next(error);
    }
  },

  /**
   * Delete product (admin only) - soft delete
   * DELETE /api/v1/admin/products/:id
   */
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;

      console.log('🗑️ [ADMIN] Deleting product:', id);

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Product not found',
          status: 404,
          detail: `Product with id '${id}' does not exist`,
          instance: req.path,
        });
      }

      // Soft delete - set deletedAt timestamp
      product.deletedAt = new Date();
      await product.save();

      console.log('✅ [ADMIN] Product deleted successfully:', id);

      // Invalidate products cache
      try {
        const keys = await safeRedis.keys('products:*');
        if (keys && keys.length > 0) {
          for (const key of keys) {
            await safeRedis.del(key);
          }
          console.log('🗑️ [ADMIN] Invalidated products cache:', keys.length, 'keys');
        }

        // Invalidate individual product cache
        if (product.translations && product.translations.length > 0) {
          for (const translation of product.translations) {
            const productCacheKey = `product:${translation.slug}:*`;
            const productKeys = await safeRedis.keys(productCacheKey);
            if (productKeys && productKeys.length > 0) {
              for (const key of productKeys) {
                await safeRedis.del(key);
              }
            }
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ [ADMIN] Cache invalidation error (non-critical):', cacheError.message);
      }

      res.json({
        message: 'Product deleted successfully',
        id: product._id.toString(),
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error deleting product:', error);
      next(error);
    }
  },

  /**
   * Get all brands (admin only)
   * GET /api/v1/admin/brands
   */
  async getBrands(req, res, next) {
    try {
      const brands = await Brand.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        data: brands.map((brand) => {
          const translation = brand.translations?.[0];
          return {
            id: brand._id.toString(),
            slug: brand.slug,
            name: translation?.name || '',
            logoUrl: brand.logoUrl,
            published: brand.published,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all categories (admin only, flat list)
   * GET /api/v1/admin/categories
   */
  async getCategories(req, res, next) {
    try {
      const { lang = 'en' } = req.query;
      const categories = await Category.find({ deletedAt: null })
        .sort({ position: 1 })
        .lean();

      res.json({
        data: categories.map((category) => {
          const translation = category.translations?.find((t) => t.locale === lang) || category.translations?.[0];
          return {
            id: category._id.toString(),
            slug: translation?.slug || '',
            title: translation?.title || '',
            parentId: category.parentId?.toString() || null,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all attributes (admin only)
   * GET /api/v1/admin/attributes?lang=
   */
  async getAttributes(req, res, next) {
    try {
      console.log('🔧 [ADMIN] Fetching attributes...');
      const { lang = 'en' } = req.query;
      const attributes = await Attribute.find()
        .sort({ position: 1 })
        .lean();

      const result = {
        data: attributes.map((attribute) => {
          const translation = attribute.translations?.find((t) => t.locale === lang) || attribute.translations?.[0];
          return {
            id: attribute._id.toString(),
            key: attribute.key,
            name: translation?.name || attribute.key,
            type: attribute.type,
            values: (attribute.values || []).map((val) => {
              const valTranslation = val.translations?.find((t) => t.locale === lang) || val.translations?.[0];
              return {
                id: val._id?.toString() || val.value,
                value: val.value,
                label: valTranslation?.label || val.value,
              };
            }),
          };
        }),
      };

      console.log(`✅ [ADMIN] Found ${result.data.length} attributes`);
      res.json(result);
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching attributes:', error);
      next(error);
    }
  },

  /**
   * Get recent activity
   * GET /api/v1/admin/activity?limit=
   */
  async getActivity(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      // Get recent orders
      const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('number status total createdAt customerEmail')
        .lean();

      // Get recent users
      const recentUsers = await User.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('email phone firstName lastName createdAt')
        .lean();

      const activity = [
        ...recentOrders.map((order) => ({
          type: 'order',
          title: `New order #${order.number}`,
          description: `Order total: ${order.total} ${order.currency || 'AMD'}`,
          timestamp: order.createdAt,
        })),
        ...recentUsers.map((user) => ({
          type: 'user',
          title: `New user registered`,
          description: user.email || user.phone || 'User',
          timestamp: user.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, parseInt(limit));

      res.json({ data: activity });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get recent orders for dashboard
   * GET /api/v1/admin/dashboard/recent-orders?limit=
   */
  async getRecentOrders(req, res, next) {
    try {
      const { limit = 5 } = req.query;

      console.log('📋 [ADMIN] Fetching recent orders for dashboard...');

      const orders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('number status paymentStatus total currency customerEmail customerPhone createdAt items')
        .lean();

      const formattedOrders = orders.map((order) => ({
        id: order._id.toString(),
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: Number(order.total),
        currency: order.currency || 'AMD',
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        itemsCount: order.items?.length || 0,
        createdAt: order.createdAt,
      }));

      console.log(`✅ [ADMIN] Found ${formattedOrders.length} recent orders`);
      res.json({ data: formattedOrders });
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching recent orders:', error);
      next(error);
    }
  },

  /**
   * Get top selling products
   * GET /api/v1/admin/dashboard/top-products?limit=
   */
  async getTopProducts(req, res, next) {
    try {
      const { limit = 5 } = req.query;

      console.log('📊 [ADMIN] Fetching top selling products...');

      // Aggregate products by total quantity sold
      const topProducts = await Order.aggregate([
        // Unwind items array
        { $unwind: '$items' },
        // Match only paid orders
        { $match: { paymentStatus: 'paid' } },
        // Group by product variant
        {
          $group: {
            _id: '$items.variantId',
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            orderCount: { $sum: 1 },
          },
        },
        // Sort by total quantity
        { $sort: { totalQuantity: -1 } },
        // Limit results
        { $limit: parseInt(limit) },
      ]);

      // Get all products to find which ones contain the top variants
      const allProducts = await Product.find({
        deletedAt: null,
      })
        .select('translations variants media')
        .lean();

      // Map results with product details
      const result = topProducts.map((topProduct) => {
        // Find the product that contains this variant
        const product = allProducts.find((p) =>
          p.variants?.some((v) => v._id?.toString() === topProduct._id.toString())
        );
        const variant = product?.variants?.find(
          (v) => v._id?.toString() === topProduct._id.toString()
        );
        const translation = product?.translations?.[0];

        return {
          variantId: topProduct._id.toString(),
          productId: product?._id?.toString() || '',
          title: translation?.title || 'Unknown Product',
          sku: variant?.sku || '',
          totalQuantity: topProduct.totalQuantity,
          totalRevenue: Number(topProduct.totalRevenue),
          orderCount: topProduct.orderCount,
          image: variant?.imageUrl || (Array.isArray(product?.media) && product?.media[0]
            ? (typeof product.media[0] === 'string' ? product.media[0] : product.media[0].url)
            : null),
        };
      });

      console.log(`✅ [ADMIN] Found ${result.length} top selling products`);
      res.json({ data: result });
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching top products:', error);
      next(error);
    }
  },

  /**
   * Get user activity statistics
   * GET /api/v1/admin/dashboard/user-activity?limit=
   */
  async getUserActivity(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      console.log('👥 [ADMIN] Fetching user activity...');

      // Get recent user registrations
      const recentUsers = await User.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('email phone firstName lastName createdAt lastLoginAt')
        .lean();

      // Get users with recent orders
      const usersWithOrders = await Order.aggregate([
        {
          $match: {
            userId: { $ne: null },
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          },
        },
        {
          $group: {
            _id: '$userId',
            orderCount: { $sum: 1 },
            totalSpent: { $sum: '$total' },
            lastOrderDate: { $max: '$createdAt' },
          },
        },
        { $sort: { orderCount: -1 } },
        { $limit: parseInt(limit) },
      ]);

      // Get user details for users with orders
      const userIds = usersWithOrders.map((u) => u._id);
      const activeUsers = await User.find({
        _id: { $in: userIds },
        deletedAt: null,
      })
        .select('email phone firstName lastName createdAt lastLoginAt')
        .lean();

      const activity = {
        recentRegistrations: recentUsers.map((user) => ({
          id: user._id.toString(),
          email: user.email,
          phone: user.phone,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
          registeredAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        })),
        activeUsers: usersWithOrders.map((userStat) => {
          const user = activeUsers.find((u) => u._id.toString() === userStat._id.toString());
          return {
            id: userStat._id.toString(),
            email: user?.email || '',
            phone: user?.phone || '',
            name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User' : 'Unknown',
            orderCount: userStat.orderCount,
            totalSpent: Number(userStat.totalSpent),
            lastOrderDate: userStat.lastOrderDate,
            lastLoginAt: user?.lastLoginAt,
          };
        }),
      };

      console.log(`✅ [ADMIN] Found ${activity.recentRegistrations.length} recent registrations and ${activity.activeUsers.length} active users`);
      res.json({ data: activity });
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching user activity:', error);
      next(error);
    }
  },
};

module.exports = adminController;

