import { db } from "@white-shop/db";

class AdminService {
  /**
   * Get dashboard stats
   */
  async getStats() {
    // Count users
    const totalUsers = await db.user.count({
      where: { deletedAt: null },
    });

    // Count products
    const totalProducts = await db.product.count({
      where: { deletedAt: null },
    });

    // Count products with low stock (stock < 10)
    const lowStockProducts = await db.productVariant.count({
      where: {
        stock: { lt: 10 },
        published: true,
      },
    });

    // Count orders
    const totalOrders = await db.order.count();

    // Count recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = await db.order.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Count pending orders
    const pendingOrders = await db.order.count({
      where: { status: "pending" },
    });

    // Calculate total revenue from completed/paid orders
    const completedOrders = await db.order.findMany({
      where: {
        OR: [
          { status: "completed" },
          { paymentStatus: "paid" },
        ],
      },
      select: {
        total: true,
        currency: true,
      },
    });

    const totalRevenue = completedOrders.reduce((sum: number, order: { total: number; currency: string | null }) => sum + order.total, 0);
    const currency = completedOrders[0]?.currency || "AMD";

    return {
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
        total: totalRevenue,
        currency,
      },
    };
  }

  /**
   * Get users
   */
  async getUsers(_filters: any) {
    const users = await db.user.findMany({
      where: {
        deletedAt: null,
      },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        roles: true,
        blocked: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    return {
      data: users.map((user: { id: string; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; roles: string[] | null; blocked: boolean; createdAt: Date; _count?: { orders?: number } }) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        blocked: user.blocked,
        createdAt: user.createdAt,
        ordersCount: user._count?.orders ?? 0,
      })),
    };
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: any) {
    return await db.user.update({
      where: { id: userId },
      data: {
        blocked: data.blocked,
        roles: data.roles,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        roles: true,
        blocked: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "User not found",
        detail: `User with id '${userId}' does not exist`,
      };
    }

    await db.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        blocked: true,
      },
      select: { id: true },
    });

    return { success: true };
  }

  /**
   * Get orders with filters and pagination
   */
  async getOrders(filters: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Apply payment status filter
    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    // Determine sort field and order
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    
    // Map frontend sort fields to database fields
    const sortFieldMap: Record<string, string> = {
      'total': 'total',
      'createdAt': 'createdAt',
    };
    
    const dbSortField = sortFieldMap[sortBy] || 'createdAt';
    const orderBy: any = { [dbSortField]: sortOrder };

    console.log('📦 [ADMIN SERVICE] getOrders with filters:', { where, page, limit, skip, orderBy });

    // Get orders with pagination, including related user for basic customer info
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          items: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    // Format orders for response
    const formattedOrders = orders.map((order: { 
      id: string; 
      number: string; 
      status: string; 
      paymentStatus: string; 
      fulfillmentStatus: string; 
      total: number; 
      currency: string | null; 
      customerEmail: string | null; 
      customerPhone: string | null; 
      createdAt: Date;
      items: Array<unknown>;
      user?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
      } | null;
    }) => {
      const customer = order.user || null;
      const firstName = customer?.firstName || '';
      const lastName = customer?.lastName || '';

      return {
        id: order.id,
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        total: order.total,
        currency: order.currency || 'AMD',
        customerEmail: customer?.email || order.customerEmail || '',
        customerPhone: customer?.phone || order.customerPhone || '',
        customerFirstName: firstName,
        customerLastName: lastName,
        customerId: customer?.id || null,
        itemsCount: order.items.length,
        createdAt: order.createdAt.toISOString(),
      };
    });

    return {
      data: formattedOrders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single order by ID with full details for admin
   */
  async getOrderById(orderId: string) {
    // Fetch order with related user and items/variants/products
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    translations: {
                      where: { locale: "en" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Order not found",
        detail: `Order with id '${orderId}' does not exist`,
      };
    }

    const user = order.user as any;
    const items = Array.isArray(order.items) ? order.items : [];

    const formattedItems = items.map((item: any) => {
      const variant = item.variant;
      const product = variant?.product;
      const translations = Array.isArray(product?.translations)
        ? product.translations
        : [];
      const translation = translations[0] || null;

      const quantity = item.quantity ?? 0;
      const total = item.total ?? 0;
      const unitPrice =
        quantity > 0 ? Number((total / quantity).toFixed(2)) : total;

      return {
        id: item.id,
        variantId: item.variantId || variant?.id || null,
        productId: product?.id || null,
        productTitle: translation?.title || item.productTitle || "Unknown Product",
        sku: variant?.sku || item.sku || "N/A",
        quantity,
        total,
        unitPrice,
      };
    });

    const payments = Array.isArray(order.payments) ? order.payments : [];
    const primaryPayment = payments[0] || null;

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      total: order.total,
      currency: order.currency || "AMD",
      customerEmail: order.customerEmail || user?.email || undefined,
      customerPhone: order.customerPhone || user?.phone || undefined,
      billingAddress: order.billingAddress as any || null,
      shippingAddress: order.shippingAddress as any || null,
      shippingMethod: order.shippingMethod || null,
      notes: order.notes || null,
      adminNotes: order.adminNotes || null,
      ipAddress: order.ipAddress || null,
      userAgent: order.userAgent || null,
      payment: primaryPayment
        ? {
            id: primaryPayment.id,
            provider: primaryPayment.provider,
            method: primaryPayment.method,
            amount: primaryPayment.amount,
            currency: primaryPayment.currency,
            status: primaryPayment.status,
            cardLast4: primaryPayment.cardLast4,
            cardBrand: primaryPayment.cardBrand,
          }
        : null,
      customer: user
        ? {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt?.toISOString?.() ?? undefined,
      items: formattedItems,
    };
  }

  /**
   * Delete order
   */
  async deleteOrder(orderId: string) {
    try {
      console.log('🗑️ [ADMIN] Deleting order:', orderId);
      
      // Check if order exists
      const existing = await db.order.findUnique({
        where: { id: orderId },
      });

      if (!existing) {
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Order not found",
          detail: `Order with id '${orderId}' does not exist`,
        };
      }

      // Delete order (cascade will delete related items, payments, events)
      await db.order.delete({
        where: { id: orderId },
      });

      console.log('✅ [ADMIN] Order deleted successfully:', orderId);
      return { success: true };
    } catch (error: any) {
      console.error('❌ [ADMIN] Error deleting order:', error);
      // If it's already our custom error, re-throw it
      if (error.status && error.type) {
        throw error;
      }
      // Otherwise, wrap it
      throw {
        status: error.status || 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: error.message || "Failed to delete order",
      };
    }
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, data: any) {
    try {
      // Check if order exists
      const existing = await db.order.findUnique({
        where: { id: orderId },
      });

      if (!existing) {
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Order not found",
          detail: `Order with id '${orderId}' does not exist`,
        };
      }

      // Validate status values
      const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
      const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
      const validFulfillmentStatuses = ['unfulfilled', 'fulfilled', 'shipped', 'delivered'];

      if (data.status !== undefined && !validStatuses.includes(data.status)) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          detail: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        };
      }

      if (data.paymentStatus !== undefined && !validPaymentStatuses.includes(data.paymentStatus)) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          detail: `Invalid paymentStatus. Must be one of: ${validPaymentStatuses.join(', ')}`,
        };
      }

      if (data.fulfillmentStatus !== undefined && !validFulfillmentStatuses.includes(data.fulfillmentStatus)) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          detail: `Invalid fulfillmentStatus. Must be one of: ${validFulfillmentStatuses.join(', ')}`,
        };
      }

      // Prepare update data
      const updateData: any = {};
      if (data.status !== undefined) updateData.status = data.status;
      if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
      if (data.fulfillmentStatus !== undefined) updateData.fulfillmentStatus = data.fulfillmentStatus;

      // Update timestamps based on status changes
      if (data.status === 'completed' && existing.status !== 'completed') {
        updateData.fulfilledAt = new Date();
      }
      if (data.status === 'cancelled' && existing.status !== 'cancelled') {
        updateData.cancelledAt = new Date();
      }
      if (data.paymentStatus === 'paid' && existing.paymentStatus !== 'paid') {
        updateData.paidAt = new Date();
      }

      const order = await db.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: true,
          payments: true,
        },
      });

      // Create order event
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: 'order_updated',
          data: {
            updatedFields: Object.keys(updateData),
            previousStatus: existing.status,
            newStatus: data.status || existing.status,
          },
        },
      });

      return order;
    } catch (error: any) {
      // If it's already our custom error, re-throw it
      if (error.status && error.type) {
        throw error;
      }

      // Log Prisma/database errors
      console.error("❌ [ADMIN SERVICE] updateOrder error:", {
        orderId,
        error: {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack?.substring(0, 500),
        },
      });

      // Handle specific Prisma errors
      if (error?.code === 'P2025') {
        // Record not found
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Not Found",
          detail: error?.meta?.cause || "The requested order was not found",
        };
      }

      // Generic database error
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Database Error",
        detail: error?.message || "An error occurred while updating the order",
      };
    }
  }

  /**
   * Get products with filters and pagination
   */
  async getProducts(filters: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    sku?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
  }) {
    console.log("📦 [ADMIN SERVICE] getProducts called with filters:", filters);
    const startTime = Date.now();
    
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    const orConditions: any[] = [];

    // Search filter
    if (filters.search) {
      orConditions.push(
        {
          translations: {
            some: {
              title: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          variants: {
            some: {
              sku: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          },
        }
      );
    }

    // Category filter
    if (filters.category) {
      orConditions.push(
        {
          primaryCategoryId: filters.category,
        },
        {
          categoryIds: {
            has: filters.category,
          },
        }
      );
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    // SKU filter
    if (filters.sku) {
      where.variants = {
        some: {
          sku: {
            contains: filters.sku,
            mode: "insensitive",
          },
        },
      };
    }

    // Sort
    let orderBy: any = { createdAt: "desc" };
    if (filters.sort) {
      const [field, direction] = filters.sort.split("-");
      orderBy = { [field]: direction || "desc" };
    }

    console.log("📦 [ADMIN SERVICE] Executing database queries...");
    console.log("📦 [ADMIN SERVICE] Where clause:", JSON.stringify(where, null, 2));
    const queryStartTime = Date.now();

    let products: any[] = [];
    let total: number = 0;

    try {
      // Test database connection first
      console.log("📦 [ADMIN SERVICE] Testing database connection...");
      await db.$queryRaw`SELECT 1`;
      console.log("✅ [ADMIN SERVICE] Database connection OK");

      // First, try to get products with a simpler query
      console.log("📦 [ADMIN SERVICE] Fetching products...");
      products = await db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          translations: {
            where: { locale: "en" },
            take: 1,
          },
          variants: {
            where: { published: true },
            take: 1,
            orderBy: { price: "asc" },
          },
          labels: true,
        },
      });
      
      const productsTime = Date.now() - queryStartTime;
      console.log(`✅ [ADMIN SERVICE] Products fetched in ${productsTime}ms. Found ${products.length} products`);

      // Then get count - use a simpler approach if count is slow
      console.log("📦 [ADMIN SERVICE] Counting total products...");
      const countStartTime = Date.now();
      
      // Use a timeout for count query
      const countPromise = db.product.count({ where });
      const timeoutPromise = new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error("Count query timeout")), 10000)
      );
      
      total = await Promise.race([countPromise, timeoutPromise]) as number;
      const countTime = Date.now() - countStartTime;
      console.log(`✅ [ADMIN SERVICE] Count completed in ${countTime}ms. Total: ${total}`);
      
      const queryTime = Date.now() - queryStartTime;
      console.log(`✅ [ADMIN SERVICE] All database queries completed in ${queryTime}ms`);
    } catch (error: any) {
      const queryTime = Date.now() - queryStartTime;
      console.error(`❌ [ADMIN SERVICE] Database query error after ${queryTime}ms:`, error);
      console.error(`❌ [ADMIN SERVICE] Error details:`, {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack?.substring(0, 500),
      });
      
      // If count fails, try to get products without count
      if (error.message === "Count query timeout" || error.message?.includes("count")) {
        console.warn("⚠️ [ADMIN SERVICE] Count query failed, using estimated total");
        total = products?.length || limit; // Use current page size as fallback
      } else {
        // If products query also failed, rethrow
        if (!products) {
          throw error;
        }
        // If only count failed, use estimated total
        console.warn("⚠️ [ADMIN SERVICE] Count query failed, using estimated total");
        total = products.length || limit;
      }
    }

    const data = products.map((product) => {
      // Безопасное получение translation с проверкой на существование массива
      const translation = Array.isArray(product.translations) && product.translations.length > 0
        ? product.translations[0]
        : null;
      
      // Безопасное получение variant с проверкой на существование массива
      const variant = Array.isArray(product.variants) && product.variants.length > 0
        ? product.variants[0]
        : null;
      
      const image =
        Array.isArray(product.media) && product.media.length > 0
          ? typeof product.media[0] === "string"
            ? product.media[0]
            : (product.media[0] as any)?.url
          : null;

      return {
        id: product.id,
        slug: translation?.slug || "",
        title: translation?.title || "",
        published: product.published,
        featured: product.featured || false,
        price: variant?.price || 0,
        stock: variant?.stock || 0,
        discountPercent: product.discountPercent || 0, // Include discountPercent
        colorStocks: [], // Can be enhanced later
        image,
        createdAt: product.createdAt.toISOString(),
      };
    });

    const totalTime = Date.now() - startTime;
    console.log(`✅ [ADMIN SERVICE] getProducts completed in ${totalTime}ms. Returning ${data.length} products`);

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
   * Get product by ID
   */
  async getProductById(productId: string) {
    const product = await db.product.findUnique({
      where: { id: productId },
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
        detail: `Product with id '${productId}' does not exist`,
      };
    }

    // Безопасное получение translation с проверкой на существование массива
    const translations = Array.isArray(product.translations) ? product.translations : [];
    const translation = translations.find((t: { locale: string }) => t.locale === "en") || translations[0] || null;

    // Безопасное получение labels с проверкой на существование массива
    const labels = Array.isArray(product.labels) ? product.labels : [];
    
    // Безопасное получение variants с проверкой на существование массива
    const variants = Array.isArray(product.variants) ? product.variants : [];

    return {
      id: product.id,
      title: translation?.title || "",
      slug: translation?.slug || "",
      subtitle: translation?.subtitle || null,
      descriptionHtml: translation?.descriptionHtml || null,
      brandId: product.brandId || null,
      primaryCategoryId: product.primaryCategoryId || null,
      categoryIds: product.categoryIds || [],
      published: product.published,
      media: Array.isArray(product.media) ? product.media : [],
      labels: labels.map((label: { id: string; type: string; value: string; position: string; color: string | null }) => ({
        id: label.id,
        type: label.type,
        value: label.value,
        position: label.position,
        color: label.color,
      })),
      variants: variants.map((variant: { id: string; price: number; sku: string | null; stock: number; compareAtPrice?: number | null; imageUrl?: string | null; published?: boolean; options?: Array<{ attributeKey: string; value: string }> }) => {
        // Безопасное получение options с проверкой на существование массива
        const options = Array.isArray(variant.options) ? variant.options : [];
        const colorOption = options.find((opt: { attributeKey: string }) => opt.attributeKey === "color");
        const sizeOption = options.find((opt: { attributeKey: string }) => opt.attributeKey === "size");

        return {
          id: variant.id,
          price: variant.price.toString(),
          compareAtPrice: variant.compareAtPrice?.toString() || "",
          stock: variant.stock.toString(),
          sku: variant.sku || "",
          color: colorOption?.value || "",
          size: sizeOption?.value || "",
          imageUrl: variant.imageUrl || "",
          published: variant.published || false,
        };
      }),
    };
  }

  /**
   * Create product
   */
  async createProduct(data: {
    title: string;
    slug: string;
    subtitle?: string;
    descriptionHtml?: string;
    brandId?: string;
    primaryCategoryId?: string;
    categoryIds?: string[];
    published: boolean;
    featured?: boolean;
    locale: string;
    media?: any[];
    labels?: Array<{
      type: string;
      value: string;
      position: string;
      color?: string | null;
    }>;
    variants: Array<{
      price: string;
      compareAtPrice?: string;
      stock: string;
      sku?: string;
      color?: string;
      size?: string;
      imageUrl?: string;
      published?: boolean;
    }>;
  }) {
    // Validate size requirement for categories that require sizes
    if (data.primaryCategoryId) {
      const category = await db.category.findUnique({
        where: { id: data.primaryCategoryId },
      });

      // Only validate if category explicitly requires sizes (requiresSizes === true)
      if (category && category.requiresSizes === true) {
        // Check if at least one variant has a size
        const hasSizeInVariants = data.variants.some(
          (variant) => variant.size && variant.size.trim() !== ""
        );

        if (!hasSizeInVariants) {
          throw {
            status: 400,
            type: "https://api.shop.am/problems/validation-error",
            title: "Validation Error",
            detail: "At least one size is required for this product category",
          };
        }
      }
    }

    // Generate variants with options
    const variantsData = data.variants.map((variant) => {
      const options: any[] = [];
      if (variant.color) {
        options.push({
          attributeKey: "color",
          value: variant.color,
        });
      }
      if (variant.size) {
        options.push({
          attributeKey: "size",
          value: variant.size,
        });
      }

      return {
        sku: variant.sku || undefined,
        price: parseFloat(variant.price),
        compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : undefined,
        stock: parseInt(variant.stock) || 0,
        imageUrl: variant.imageUrl || undefined,
        published: variant.published !== false,
        options: {
          create: options,
        },
      };
    });

    const product = await db.product.create({
      data: {
        brandId: data.brandId || undefined,
        primaryCategoryId: data.primaryCategoryId || undefined,
        categoryIds: data.categoryIds || [],
        media: data.media || [],
        published: data.published,
        featured: data.featured ?? false,
        publishedAt: data.published ? new Date() : undefined,
        translations: {
          create: {
            locale: data.locale || "en",
            title: data.title,
            slug: data.slug,
            subtitle: data.subtitle || undefined,
            descriptionHtml: data.descriptionHtml || undefined,
          },
        },
        variants: {
          create: variantsData,
        },
        labels: data.labels
          ? {
              create: data.labels.map((label) => ({
                type: label.type,
                value: label.value,
                position: label.position,
                color: label.color || undefined,
              })),
            }
          : undefined,
      },
      include: {
        translations: true,
        variants: {
          include: {
            options: true,
          },
        },
        labels: true,
      },
    });

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: {
      title?: string;
      slug?: string;
      subtitle?: string;
      descriptionHtml?: string;
      brandId?: string;
      primaryCategoryId?: string;
      categoryIds?: string[];
      published?: boolean;
      featured?: boolean;
      locale?: string;
      media?: any[];
      labels?: Array<{
        id?: string;
        type: string;
        value: string;
        position: string;
        color?: string | null;
      }>;
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
  ) {
    try {
      // Check if product exists
      const existing = await db.product.findUnique({
        where: { id: productId },
      });

      if (!existing) {
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Product not found",
          detail: `Product with id '${productId}' does not exist`,
        };
      }

      // Update product
      const updateData: any = {};

      if (data.brandId !== undefined) updateData.brandId = data.brandId || null;
      if (data.primaryCategoryId !== undefined) updateData.primaryCategoryId = data.primaryCategoryId || null;
      if (data.categoryIds !== undefined) updateData.categoryIds = data.categoryIds || [];
      if (data.media !== undefined) updateData.media = data.media;
      if (data.published !== undefined) {
        updateData.published = data.published;
        if (data.published && !existing.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }
      if (data.featured !== undefined) {
        updateData.featured = data.featured;
      }

      // Update translation
      if (data.title || data.slug || data.subtitle !== undefined || data.descriptionHtml !== undefined) {
        const locale = data.locale || "en";
        const existingTranslation = await db.productTranslation.findUnique({
          where: {
            productId_locale: {
              productId,
              locale,
            },
          },
        });

        if (existingTranslation) {
          await db.productTranslation.update({
            where: { id: existingTranslation.id },
            data: {
              ...(data.title && { title: data.title }),
              ...(data.slug && { slug: data.slug }),
              ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
              ...(data.descriptionHtml !== undefined && { descriptionHtml: data.descriptionHtml || null }),
            },
          });
        } else {
          await db.productTranslation.create({
            data: {
              productId,
              locale,
              title: data.title || "",
              slug: data.slug || "",
              subtitle: data.subtitle || null,
              descriptionHtml: data.descriptionHtml || null,
            },
          });
        }
      }

      // Update labels
      if (data.labels !== undefined) {
        // Delete existing labels
        await db.productLabel.deleteMany({
          where: { productId },
        });

        // Create new labels
        if (data.labels.length > 0) {
          await db.productLabel.createMany({
            data: data.labels.map((label) => ({
              productId,
              type: label.type,
              value: label.value,
              position: label.position,
              color: label.color || undefined,
            })),
          });
        }
      }

      // Update variants
      if (data.variants !== undefined) {
        // Validate size requirement for categories that require sizes
        const categoryIdToCheck = data.primaryCategoryId !== undefined 
          ? data.primaryCategoryId 
          : existing.primaryCategoryId;

        if (categoryIdToCheck) {
          const category = await db.category.findUnique({
            where: { id: categoryIdToCheck },
          });

          // Only validate if category explicitly requires sizes (requiresSizes === true)
          if (category && category.requiresSizes === true) {
            // Check if at least one variant has a size
            const hasSizeInVariants = data.variants.some(
              (variant) => variant.size && variant.size.trim() !== ""
            );

            if (!hasSizeInVariants) {
              throw {
                status: 400,
                type: "https://api.shop.am/problems/validation-error",
                title: "Validation Error",
                detail: "At least one size is required for this product category",
              };
            }
          }
        }

        // Delete existing variants
        // First, delete cart items and update order items that reference these variants
        // to avoid foreign key constraint errors
        const existingVariants = await db.productVariant.findMany({
          where: { productId },
          select: { id: true },
        });
        
        if (existingVariants.length > 0) {
          const variantIds = existingVariants.map(v => v.id);
          
          // Delete cart items that reference these variants
          await db.cartItem.deleteMany({
            where: { variantId: { in: variantIds } },
          });
          
          // Update order items to set variantId to null (since it's optional)
          // This preserves order history while allowing variant deletion
          await db.orderItem.updateMany({
            where: { variantId: { in: variantIds } },
            data: { variantId: null },
          });
        }
        
        // Now we can safely delete the variants
        await db.productVariant.deleteMany({
          where: { productId },
        });

        // Create new variants
        if (data.variants.length > 0) {
          for (const variant of data.variants) {
            try {
              const options: any[] = [];
              if (variant.color) {
                options.push({
                  attributeKey: "color",
                  value: variant.color,
                });
              }
              if (variant.size) {
                options.push({
                  attributeKey: "size",
                  value: variant.size,
                });
              }

              // Validate and parse numeric values
              const price = parseFloat(String(variant.price));
              if (isNaN(price) || price < 0) {
                throw {
                  status: 400,
                  type: "https://api.shop.am/problems/validation-error",
                  title: "Validation Error",
                  detail: `Invalid price value: ${variant.price}. Price must be a valid positive number.`,
                };
              }

              const stock = parseInt(String(variant.stock), 10);
              if (isNaN(stock) || stock < 0) {
                throw {
                  status: 400,
                  type: "https://api.shop.am/problems/validation-error",
                  title: "Validation Error",
                  detail: `Invalid stock value: ${variant.stock}. Stock must be a valid non-negative integer.`,
                };
              }

              const compareAtPrice = variant.compareAtPrice ? parseFloat(String(variant.compareAtPrice)) : undefined;
              if (compareAtPrice !== undefined && (isNaN(compareAtPrice) || compareAtPrice < 0)) {
                throw {
                  status: 400,
                  type: "https://api.shop.am/problems/validation-error",
                  title: "Validation Error",
                  detail: `Invalid compareAtPrice value: ${variant.compareAtPrice}. CompareAtPrice must be a valid positive number.`,
                };
              }

              await db.productVariant.create({
                data: {
                  productId,
                  sku: variant.sku || undefined,
                  price,
                  compareAtPrice,
                  stock,
                  imageUrl: variant.imageUrl || undefined,
                  published: variant.published !== false,
                  options: {
                    create: options,
                  },
                },
              });
            } catch (variantError: any) {
              // If it's already our custom error, re-throw it
              if (variantError.status && variantError.type) {
                throw variantError;
              }
              // Otherwise, wrap Prisma/database errors
              console.error("❌ [ADMIN SERVICE] Error creating variant:", {
                variant,
                error: variantError,
                message: variantError?.message,
                code: variantError?.code,
                meta: variantError?.meta,
              });
              throw {
                status: 500,
                type: "https://api.shop.am/problems/internal-error",
                title: "Database Error",
                detail: `Failed to create variant: ${variantError?.message || "Unknown error"}`,
              };
            }
          }
        }
      }

      // Update product
      const product = await db.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          translations: true,
          variants: {
            include: {
              options: true,
            },
          },
          labels: true,
        },
      });

      return product;
    } catch (error: any) {
      // If it's already our custom error, re-throw it
      if (error.status && error.type) {
        throw error;
      }
      
      // Log Prisma/database errors with full details
      console.error("❌ [ADMIN SERVICE] updateProduct error:", {
        productId,
        error: {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack?.substring(0, 500),
        },
      });
      
      // Handle specific Prisma errors
      if (error?.code === 'P2002') {
        // Unique constraint violation
        const field = error?.meta?.target?.[0] || 'field';
        throw {
          status: 409,
          type: "https://api.shop.am/problems/conflict",
          title: "Conflict",
          detail: `A product with this ${field} already exists`,
        };
      }
      
      if (error?.code === 'P2025') {
        // Record not found
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Not Found",
          detail: error?.meta?.cause || "The requested resource was not found",
        };
      }
      
      // Generic database error
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Database Error",
        detail: error?.message || "An error occurred while updating the product",
      };
    }
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId: string) {
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Product not found",
        detail: `Product with id '${productId}' does not exist`,
      };
    }

    await db.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        published: false,
      },
    });

    return { success: true };
  }

  /**
   * Update product discount
   */
  async updateProductDiscount(productId: string, discountPercent: number) {
    console.log('💰 [ADMIN SERVICE] updateProductDiscount called:', { productId, discountPercent });
    
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      console.error('❌ [ADMIN SERVICE] Product not found:', productId);
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Product not found",
        detail: `Product with id '${productId}' does not exist`,
      };
    }

    const clampedDiscount = Math.max(0, Math.min(100, discountPercent));
    console.log('💰 [ADMIN SERVICE] Updating product discount:', {
      productId,
      oldDiscount: product.discountPercent,
      newDiscount: clampedDiscount,
    });

    const updated = await db.product.update({
      where: { id: productId },
      data: {
        discountPercent: clampedDiscount,
      },
    });

    console.log('✅ [ADMIN SERVICE] Product discount updated successfully:', {
      productId,
      discountPercent: updated.discountPercent,
    });

    return { success: true, discountPercent: updated.discountPercent };
  }

  /**
   * Get settings
   */
  async getSettings() {
    const settings = await db.settings.findMany({
      where: {
        key: {
          in: ['globalDiscount', 'categoryDiscounts', 'brandDiscounts'],
        },
      },
    });
    
    const globalDiscountSetting = settings.find((s: { key: string; value: string }) => s.key === 'globalDiscount');
    const categoryDiscountsSetting = settings.find((s: { key: string; value: string }) => s.key === 'categoryDiscounts');
    const brandDiscountsSetting = settings.find((s: { key: string; value: string }) => s.key === 'brandDiscounts');
    
    return {
      globalDiscount: globalDiscountSetting ? Number(globalDiscountSetting.value) : 0,
      categoryDiscounts: categoryDiscountsSetting ? (categoryDiscountsSetting.value as Record<string, number>) : {},
      brandDiscounts: brandDiscountsSetting ? (brandDiscountsSetting.value as Record<string, number>) : {},
    };
  }

  /**
   * Update settings
   */
  async updateSettings(data: any) {
    console.log('⚙️ [ADMIN SERVICE] Updating settings...', data);
    
    // Update global discount
    if (data.globalDiscount !== undefined) {
      const globalDiscountValue = Number(data.globalDiscount) || 0;
      await db.settings.upsert({
        where: { key: 'globalDiscount' },
        update: {
          value: globalDiscountValue,
          updatedAt: new Date(),
        },
        create: {
          key: 'globalDiscount',
          value: globalDiscountValue,
          description: 'Global discount percentage for all products',
        },
      });
      console.log('✅ [ADMIN SERVICE] Global discount updated:', globalDiscountValue);
    }
    
    // Update category discounts
    if (data.categoryDiscounts !== undefined) {
      await db.settings.upsert({
        where: { key: 'categoryDiscounts' },
        update: {
          value: data.categoryDiscounts,
          updatedAt: new Date(),
        },
        create: {
          key: 'categoryDiscounts',
          value: data.categoryDiscounts,
          description: 'Discount percentages by category ID',
        },
      });
      console.log('✅ [ADMIN SERVICE] Category discounts updated:', data.categoryDiscounts);
    }
    
    // Update brand discounts
    if (data.brandDiscounts !== undefined) {
      await db.settings.upsert({
        where: { key: 'brandDiscounts' },
        update: {
          value: data.brandDiscounts,
          updatedAt: new Date(),
        },
        create: {
          key: 'brandDiscounts',
          value: data.brandDiscounts,
          description: 'Discount percentages by brand ID',
        },
      });
      console.log('✅ [ADMIN SERVICE] Brand discounts updated:', data.brandDiscounts);
    }
    
    return { success: true };
  }

  /**
   * Get price filter settings
   */
  async getPriceFilterSettings() {
    console.log('⚙️ [ADMIN SERVICE] Fetching price filter settings...');
    const setting = await db.settings.findUnique({
      where: { key: 'price-filter' },
    });

    if (!setting) {
      console.log('✅ [ADMIN SERVICE] Price filter settings not found, returning defaults');
      return {
        minPrice: null,
        maxPrice: null,
        stepSize: null,
        stepSizePerCurrency: null,
      };
    }

    const value = setting.value as {
      minPrice?: number;
      maxPrice?: number;
      stepSize?: number;
      stepSizePerCurrency?: {
        USD?: number;
        AMD?: number;
        RUB?: number;
        GEL?: number;
      };
    };
    console.log('✅ [ADMIN SERVICE] Price filter settings loaded:', value);
    return {
      minPrice: value.minPrice ?? null,
      maxPrice: value.maxPrice ?? null,
      stepSize: value.stepSize ?? null,
      stepSizePerCurrency: value.stepSizePerCurrency ?? null,
    };
  }

  /**
   * Update price filter settings
   */
  async updatePriceFilterSettings(data: {
    minPrice?: number | null;
    maxPrice?: number | null;
    stepSize?: number | null;
    stepSizePerCurrency?: {
      USD?: number | null;
      AMD?: number | null;
      RUB?: number | null;
      GEL?: number | null;
    } | null;
  }) {
    console.log('⚙️ [ADMIN SERVICE] Updating price filter settings...', data);
    
    const value: {
      minPrice?: number;
      maxPrice?: number;
      stepSize?: number;
      stepSizePerCurrency?: {
        USD?: number;
        AMD?: number;
        RUB?: number;
        GEL?: number;
      };
    } = {};
    
    if (data.minPrice !== null && data.minPrice !== undefined) {
      value.minPrice = data.minPrice;
    }
    if (data.maxPrice !== null && data.maxPrice !== undefined) {
      value.maxPrice = data.maxPrice;
    }
    if (data.stepSize !== null && data.stepSize !== undefined) {
      value.stepSize = data.stepSize;
    }
    if (data.stepSizePerCurrency) {
      const cleaned: { USD?: number; AMD?: number; RUB?: number; GEL?: number } = {};
      if (data.stepSizePerCurrency.USD !== null && data.stepSizePerCurrency.USD !== undefined) {
        cleaned.USD = data.stepSizePerCurrency.USD;
      }
      if (data.stepSizePerCurrency.AMD !== null && data.stepSizePerCurrency.AMD !== undefined) {
        cleaned.AMD = data.stepSizePerCurrency.AMD;
      }
      if (data.stepSizePerCurrency.RUB !== null && data.stepSizePerCurrency.RUB !== undefined) {
        cleaned.RUB = data.stepSizePerCurrency.RUB;
      }
      if (data.stepSizePerCurrency.GEL !== null && data.stepSizePerCurrency.GEL !== undefined) {
        cleaned.GEL = data.stepSizePerCurrency.GEL;
      }
      if (Object.keys(cleaned).length > 0) {
        value.stepSizePerCurrency = cleaned;
      }
    }

    const setting = await db.settings.upsert({
      where: { key: 'price-filter' },
      update: {
        value: value,
        updatedAt: new Date(),
      },
      create: {
        key: 'price-filter',
        value: value,
        description: 'Price filter default range and step size settings',
      },
    });

    console.log('✅ [ADMIN SERVICE] Price filter settings updated:', setting);
    const stored = setting.value as any;
    return {
      success: true,
      minPrice: stored.minPrice ?? null,
      maxPrice: stored.maxPrice ?? null,
      stepSize: stored.stepSize ?? null,
      stepSizePerCurrency: stored.stepSizePerCurrency ?? null,
    };
  }

  /**
   * Get user activity (recent registrations and active users)
   */
  async getUserActivity(limit: number = 10) {
    // Get recent registrations
    const recentUsers = await db.user.findMany({
      where: {
        deletedAt: null,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    const recentRegistrations = recentUsers.map((user: { id: string; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; createdAt: Date }) => ({
      id: user.id,
      email: user.email || undefined,
      phone: user.phone || undefined,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.phone || "Unknown",
      registeredAt: user.createdAt.toISOString(),
      lastLoginAt: undefined, // We don't track last login yet
    }));

    // Get active users (users with orders)
    const usersWithOrders = await db.user.findMany({
      where: {
        deletedAt: null,
        orders: {
          some: {},
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      take: limit,
    });

    const activeUsers = usersWithOrders.map((user: { id: string; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; createdAt: Date; orders: Array<{ id: string; total: number; createdAt: Date }> }) => {
      const orders = Array.isArray(user.orders) ? user.orders : [];
      const orderCount = orders.length;
      const totalSpent = orders.reduce((sum: number, order: { total: number }) => sum + order.total, 0);
      const lastOrder = orders[0] || null;

      return {
        id: user.id,
        email: user.email || undefined,
        phone: user.phone || undefined,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.phone || "Unknown",
        orderCount,
        totalSpent,
        lastOrderDate: lastOrder ? lastOrder.createdAt.toISOString() : user.createdAt.toISOString(),
        lastLoginAt: undefined, // We don't track last login yet
      };
    });

    return {
      recentRegistrations,
      activeUsers,
    };
  }

  /**
   * Get recent orders for dashboard
   */
  async getRecentOrders(limit: number = 5) {
    const orders = await db.order.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    return orders.map((order: { id: string; number: string; status: string; paymentStatus: string; total: number; currency: string | null; customerEmail: string | null; customerPhone: string | null; createdAt: Date; items: Array<unknown> }) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      currency: order.currency,
      customerEmail: order.customerEmail || undefined,
      customerPhone: order.customerPhone || undefined,
      itemsCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
    }));
  }

  /**
   * Get top products for dashboard
   */
  async getTopProducts(limit: number = 5) {
    // Get all order items with their variants
    const orderItems = await db.orderItem.findMany({
      include: {
        variant: {
          include: {
            product: {
              include: {
                translations: {
                  where: { locale: "en" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Group by variant and calculate stats
    const productStats = new Map<
      string,
      {
        variantId: string;
        productId: string;
        title: string;
        sku: string;
        totalQuantity: number;
        totalRevenue: number;
        orderCount: number;
        image?: string | null;
      }
    >();

    orderItems.forEach((item: { variantId: string | null; quantity: number; total: number; variant?: { id: string; productId: string; sku: string | null; product?: { translations?: Array<{ title: string }>; media?: Array<{ url?: string }> } }; sku?: string }) => {
      if (!item.variant) return;

      const variantId = item.variantId || item.variant.id;
      const productId = item.variant.productId;
      const product = item.variant.product;
      const translations = product?.translations || [];
      const translation = translations[0];
      const title = translation?.title || "Unknown Product";
      const sku = item.variant.sku || item.sku || "N/A";
      const image = product && Array.isArray(product.media) && product.media.length > 0
        ? (product.media[0] as any)?.url || null
        : null;

      if (!productStats.has(variantId)) {
        productStats.set(variantId, {
          variantId,
          productId,
          title,
          sku,
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0,
          image,
        });
      }

      const stats = productStats.get(variantId)!;
      stats.totalQuantity += item.quantity;
      stats.totalRevenue += item.total;
      stats.orderCount += 1;
    });

    // Convert to array and sort by revenue
    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return topProducts;
  }

  /**
   * Get categories for admin
   */
  async getCategories() {
    const categories = await db.category.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        translations: {
          where: { locale: "en" },
          take: 1,
        },
      },
      orderBy: {
        position: "asc",
      },
    });

    return {
      data: categories.map((category: { id: string; parentId: string | null; requiresSizes: boolean | null; translations?: Array<{ title: string; slug: string }> }) => {
        const translations = Array.isArray(category.translations) ? category.translations : [];
        const translation = translations[0] || null;
        return {
          id: category.id,
          title: translation?.title || "",
          slug: translation?.slug || "",
          parentId: category.parentId,
          requiresSizes: category.requiresSizes || false,
        };
      }),
    };
  }

  /**
   * Create category
   */
  async createCategory(data: {
    title: string;
    locale?: string;
    parentId?: string;
    requiresSizes?: boolean;
  }) {
    const locale = data.locale || "en";
    
    // Generate slug from title
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const category = await db.category.create({
      data: {
        parentId: data.parentId || undefined,
        requiresSizes: data.requiresSizes || false,
        published: true,
        translations: {
          create: {
            locale,
            title: data.title,
            slug,
            fullPath: slug, // Can be enhanced to build full path
          },
        },
      },
      include: {
        translations: true,
      },
    });

    // Безопасное получение translation с проверкой на существование массива
    const categoryTranslations = Array.isArray(category.translations) ? category.translations : [];
    const translation = categoryTranslations.find((t: { locale: string }) => t.locale === locale) || categoryTranslations[0] || null;

    return {
      data: {
        id: category.id,
        title: translation?.title || "",
        slug: translation?.slug || "",
        parentId: category.parentId,
        requiresSizes: category.requiresSizes || false,
      },
    };
  }

  /**
   * Get brands for admin
   */
  async getBrands() {
    const brands = await db.brand.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        translations: {
          where: { locale: "en" },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      data: brands.map((brand: { id: string; slug: string; translations?: Array<{ name: string }> }) => {
        const translations = Array.isArray(brand.translations) ? brand.translations : [];
        const translation = translations[0] || null;
        return {
          id: brand.id,
          name: translation?.name || "",
          slug: brand.slug,
        };
      }),
    };
  }

  /**
   * Create brand
   */
  async createBrand(data: {
    name: string;
    locale?: string;
    logoUrl?: string;
  }) {
    const locale = data.locale || "en";
    
    // Generate base slug from name
    const baseSlug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Generate unique slug by appending number if needed
    let slug = baseSlug;
    let counter = 1;
    let existing = await db.brand.findUnique({
      where: { slug },
    });

    while (existing) {
      slug = `${baseSlug}-${counter}`;
      counter++;
      existing = await db.brand.findUnique({
        where: { slug },
      });
      
      // Safety check to prevent infinite loop
      if (counter > 1000) {
        throw {
          status: 500,
          type: "https://api.shop.am/problems/internal-error",
          title: "Unable to generate unique slug",
          detail: "Could not generate a unique slug for the brand after many attempts",
        };
      }
    }

    const brand = await db.brand.create({
      data: {
        slug,
        logoUrl: data.logoUrl || undefined,
        published: true,
        translations: {
          create: {
            locale,
            name: data.name,
          },
        },
      },
      include: {
        translations: true,
      },
    });

    // Безопасное получение translation с проверкой на существование массива
    const brandTranslations = Array.isArray(brand.translations) ? brand.translations : [];
    const translation = brandTranslations.find((t: { locale: string }) => t.locale === locale) || brandTranslations[0] || null;

    return {
      data: {
        id: brand.id,
        name: translation?.name || "",
        slug: brand.slug,
      },
    };
  }

  /**
   * Delete category (soft delete)
   */
  async deleteCategory(categoryId: string) {
    console.log('🗑️ [ADMIN SERVICE] deleteCategory called:', categoryId);
    
    const category = await db.category.findUnique({
      where: { id: categoryId },
      include: {
        children: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    if (!category) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Category not found",
        detail: `Category with id '${categoryId}' does not exist`,
      };
    }

    // Check if category has children
    const childrenCount = category.children ? category.children.length : 0;
    if (childrenCount > 0) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/bad-request",
        title: "Cannot delete category",
        detail: `This category has ${childrenCount} child categor${childrenCount > 1 ? 'ies' : 'y'}. Please delete or move child categories first.`,
        childrenCount,
      };
    }

    // Check if category has products (using count for better performance)
    const productsCount = await db.product.count({
      where: {
        OR: [
          { primaryCategoryId: categoryId },
          { categoryIds: { has: categoryId } },
        ],
        deletedAt: null,
      },
    });

    if (productsCount > 0) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/bad-request",
        title: "Cannot delete category",
        detail: `This category has ${productsCount} associated product${productsCount > 1 ? 's' : ''}. Please remove products from this category first.`,
        productsCount,
      };
    }

    await db.category.update({
      where: { id: categoryId },
      data: {
        deletedAt: new Date(),
        published: false,
      },
    });

    console.log('✅ [ADMIN SERVICE] Category deleted:', categoryId);
    return { success: true };
  }

  /**
   * Delete brand (soft delete)
   */
  async deleteBrand(brandId: string) {
    console.log('🗑️ [ADMIN SERVICE] deleteBrand called:', brandId);
    
    const brand = await db.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Brand not found",
        detail: `Brand with id '${brandId}' does not exist`,
      };
    }

    // Check if brand has products (using count for better performance)
    const productsCount = await db.product.count({
      where: {
        brandId: brandId,
        deletedAt: null,
      },
    });

    if (productsCount > 0) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/bad-request",
        title: "Cannot delete brand",
        detail: `This brand has ${productsCount} associated product${productsCount > 1 ? 's' : ''}. Please remove or change brand for these products first.`,
        productsCount,
      };
    }

    await db.brand.update({
      where: { id: brandId },
      data: {
        deletedAt: new Date(),
        published: false,
      },
    });

    console.log('✅ [ADMIN SERVICE] Brand deleted:', brandId);
    return { success: true };
  }

  /**
   * Get attributes for admin
   */
  async getAttributes() {
    const attributes = await db.attribute.findMany({
      include: {
        translations: {
          where: { locale: "en" },
          take: 1,
        },
        values: {
          include: {
            translations: {
              where: { locale: "en" },
              take: 1,
            },
          },
          orderBy: {
            position: "asc",
          },
        },
      },
      orderBy: {
        position: "asc",
      },
    });

    return {
      data: attributes.map((attribute: { id: string; key: string; type: string; filterable: boolean; translations?: Array<{ name: string }>; values?: Array<{ id: string; value: string; translations?: Array<{ label: string }> }> }) => {
        const translations = Array.isArray(attribute.translations) ? attribute.translations : [];
        const translation = translations[0] || null;
        const values = Array.isArray(attribute.values) ? attribute.values : [];
        return {
          id: attribute.id,
          key: attribute.key,
          name: translation?.name || attribute.key,
          type: attribute.type,
          filterable: attribute.filterable,
          values: values.map((value: { id: string; value: string; translations?: Array<{ label: string }> }) => {
            const valueTranslations = Array.isArray(value.translations) ? value.translations : [];
            const valueTranslation = valueTranslations[0] || null;
            return {
              id: value.id,
              value: value.value,
              label: valueTranslation?.label || value.value,
            };
          }),
        };
      }),
    };
  }

  /**
   * Get recent activity for dashboard
   */
  async getActivity(limit: number = 10) {
    const activities: Array<{
      type: string;
      title: string;
      description: string;
      timestamp: string;
    }> = [];

    // Get recent orders
    const recentOrders = await db.order.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    recentOrders.forEach((order: { number: string; items: Array<unknown>; total: number; currency: string | null; createdAt: Date }) => {
      activities.push({
        type: "order",
        title: `New Order #${order.number}`,
        description: `${order.items.length} items • ${order.total} ${order.currency}`,
        timestamp: order.createdAt.toISOString(),
      });
    });

    // Get recent user registrations
    const recentUsers = await db.user.findMany({
      take: Math.floor(limit / 2),
      orderBy: { createdAt: "desc" },
      where: { deletedAt: null },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    recentUsers.forEach((user: { firstName: string | null; lastName: string | null; email: string | null; phone: string | null; createdAt: Date }) => {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.phone || "New User";
      activities.push({
        type: "user",
        title: "New User Registration",
        description: name,
        timestamp: user.createdAt.toISOString(),
      });
    });

    // Sort by timestamp (most recent first) and limit
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get analytics data
   */
  async getAnalytics(period: string = 'week', startDate?: string, endDate?: string) {
    // Calculate date range based on period
    let start: Date;
    let end: Date = new Date();
    end.setHours(23, 59, 59, 999);

    switch (period) {
      case 'day':
        start = new Date();
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case 'year':
        start = new Date();
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        } else {
          start = new Date();
          start.setDate(start.getDate() - 7);
          start.setHours(0, 0, 0, 0);
        }
        break;
      default:
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    }

    // Get orders in date range
    const orders = await db.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    translations: {
                      where: { locale: 'en' },
                      take: 1,
                    },
                    categories: {
                      include: {
                        translations: {
                          where: { locale: 'en' },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate order statistics
    const totalOrders = orders.length;
    const paidOrders = orders.filter((o: { paymentStatus: string }) => o.paymentStatus === 'paid').length;
    const pendingOrders = orders.filter((o: { status: string }) => o.status === 'pending').length;
    const completedOrders = orders.filter((o: { status: string }) => o.status === 'completed').length;
    const totalRevenue = orders
      .filter((o: { paymentStatus: string }) => o.paymentStatus === 'paid')
      .reduce((sum: number, o: { total: number }) => sum + o.total, 0);

    // Calculate top products
    const productMap = new Map<string, {
      variantId: string;
      productId: string;
      title: string;
      sku: string;
      totalQuantity: number;
      totalRevenue: number;
      orderCount: number;
      image?: string | null;
    }>();

    orders.forEach((order: { items: Array<{ variantId: string | null; variant?: { product?: { id: string; translations?: Array<{ title: string }>; media?: Array<{ url?: string }> } }; productTitle?: string; sku?: string; quantity: number; total: number }> }) => {
      order.items.forEach((item: { variantId: string | null; variant?: { product?: { id: string; translations?: Array<{ title: string }>; media?: Array<{ url?: string }> } }; productTitle?: string; sku?: string; quantity: number; total: number }) => {
        if (item.variantId) {
          const key = item.variantId;
          const existing = productMap.get(key) || {
            variantId: item.variantId,
            productId: item.variant?.product?.id || '',
            title: item.productTitle || 'Unknown Product',
            sku: item.sku || 'N/A',
            totalQuantity: 0,
            totalRevenue: 0,
            orderCount: 0,
            image: null,
          };
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += item.total;
          existing.orderCount += 1;
          productMap.set(key, existing);
        }
      });
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Calculate top categories
    const categoryMap = new Map<string, {
      categoryId: string;
      categoryName: string;
      totalQuantity: number;
      totalRevenue: number;
      orderCount: number;
    }>();

    orders.forEach((order: { items: Array<{ variant?: { product?: { categories: Array<{ id: string; translations?: Array<{ title: string }> }> } }; quantity: number; total: number }> }) => {
      order.items.forEach((item: { variant?: { product?: { categories: Array<{ id: string; translations?: Array<{ title: string }> }> } }; quantity: number; total: number }) => {
        if (item.variant?.product) {
          item.variant.product.categories.forEach((category: { id: string; translations?: Array<{ title: string }> }) => {
            const categoryId = category.id;
            const translations = category.translations || [];
            const categoryName = translations[0]?.title || category.id;
            const existing = categoryMap.get(categoryId) || {
              categoryId,
              categoryName,
              totalQuantity: 0,
              totalRevenue: 0,
              orderCount: 0,
            };
            existing.totalQuantity += item.quantity;
            existing.totalRevenue += item.total;
            existing.orderCount += 1;
            categoryMap.set(categoryId, existing);
          });
        }
      });
    });

    const topCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Calculate orders by day
    const ordersByDayMap = new Map<string, { count: number; revenue: number }>();

    orders.forEach((order: { createdAt: Date; paymentStatus: string; total: number }) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = ordersByDayMap.get(dateKey) || { count: 0, revenue: 0 };
      existing.count += 1;
      if (order.paymentStatus === 'paid') {
        existing.revenue += order.total;
      }
      ordersByDayMap.set(dateKey, existing);
    });

    const ordersByDay = Array.from(ordersByDayMap.entries())
      .map(([date, data]) => ({
        _id: date,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => a._id.localeCompare(b._id));

    return {
      period,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      orders: {
        totalOrders,
        totalRevenue,
        paidOrders,
        pendingOrders,
        completedOrders,
      },
      topProducts,
      topCategories,
      ordersByDay,
    };
  }

  /**
   * Get delivery settings
   */
  async getDeliverySettings() {
    console.log('🚚 [ADMIN SERVICE] getDeliverySettings called');
    
    const setting = await db.settings.findUnique({
      where: { key: 'delivery-locations' },
    });

    if (!setting) {
      console.log('✅ [ADMIN SERVICE] Delivery settings not found, returning defaults');
      return {
        locations: [],
      };
    }

    const value = setting.value as { locations?: Array<{ id?: string; country: string; city: string; price: number }> };
    console.log('✅ [ADMIN SERVICE] Delivery settings loaded:', value);
    return {
      locations: value.locations || [],
    };
  }

  /**
   * Get delivery price for a specific city
   */
  async getDeliveryPrice(city: string, country: string = 'Armenia') {
    console.log('🚚 [ADMIN SERVICE] getDeliveryPrice called:', { city, country });
    
    const setting = await db.settings.findUnique({
      where: { key: 'delivery-locations' },
    });

    if (!setting) {
      console.log('✅ [ADMIN SERVICE] Delivery settings not found, returning default price');
      return 1000; // Default price
    }

    const value = setting.value as { locations?: Array<{ country: string; city: string; price: number }> };
    const locations = value.locations || [];

    // Find matching location (case-insensitive)
    const location = locations.find(
      (loc) => 
        loc.city.toLowerCase().trim() === city.toLowerCase().trim() &&
        loc.country.toLowerCase().trim() === country.toLowerCase().trim()
    );

    if (location) {
      console.log('✅ [ADMIN SERVICE] Delivery price found:', location.price);
      return location.price;
    }

    // If no exact match, try to find by city only (case-insensitive)
    const cityMatch = locations.find(
      (loc) => loc.city.toLowerCase().trim() === city.toLowerCase().trim()
    );

    if (cityMatch) {
      console.log('✅ [ADMIN SERVICE] Delivery price found by city:', cityMatch.price);
      return cityMatch.price;
    }

    // Return default price if no match found
    console.log('✅ [ADMIN SERVICE] No delivery price found, returning default');
    return 1000; // Default price
  }

  /**
   * Update delivery settings
   */
  async updateDeliverySettings(data: { locations: Array<{ id?: string; country: string; city: string; price: number }> }) {
    console.log('🚚 [ADMIN SERVICE] updateDeliverySettings called:', data);
    
    // Validate locations
    if (!Array.isArray(data.locations)) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation Error",
        detail: "Locations must be an array",
      };
    }

    // Validate each location
    for (const location of data.locations) {
      if (!location.country || !location.city) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          detail: "Each location must have country and city",
        };
      }
      if (typeof location.price !== 'number' || location.price < 0) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          detail: "Price must be a non-negative number",
        };
      }
    }

    // Generate IDs for new locations
    const locationsWithIds = data.locations.map((location, index) => ({
      ...location,
      id: location.id || `location-${Date.now()}-${index}`,
    }));

    const setting = await db.settings.upsert({
      where: { key: 'delivery-locations' },
      update: {
        value: { locations: locationsWithIds },
        updatedAt: new Date(),
      },
      create: {
        key: 'delivery-locations',
        value: { locations: locationsWithIds },
        description: 'Delivery prices by country and city',
      },
    });

    console.log('✅ [ADMIN SERVICE] Delivery settings updated:', setting);
    return {
      locations: locationsWithIds,
    };
  }
}

export const adminService = new AdminService();

