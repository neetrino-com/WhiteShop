import { db } from "@white-shop/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { findOrCreateAttributeValue } from "../utils/variant-generator";
import { ensureProductAttributesTable } from "../utils/db-ensure";

class AdminService {
  /**
   * Ensure colors and imageUrl columns exist in attribute_values table
   * This is a runtime migration that runs automatically when needed
   */
  private async ensureColorsColumnsExist() {
    try {
      // Check if colors column exists
      const colorsCheck = await db.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = 'attribute_values' 
          AND column_name = 'colors'
        ) as exists;
      `) as Array<{ exists: boolean }>;

      const colorsExists = colorsCheck[0]?.exists || false;

      // Check if imageUrl column exists
      const imageUrlCheck = await db.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = 'attribute_values' 
          AND column_name = 'imageUrl'
        ) as exists;
      `) as Array<{ exists: boolean }>;

      const imageUrlExists = imageUrlCheck[0]?.exists || false;

      if (colorsExists && imageUrlExists) {
        return; // Columns already exist
      }

      console.log('📝 [ADMIN SERVICE] Adding missing colors/imageUrl columns...');

      // Add colors column if it doesn't exist
      if (!colorsExists) {
        await db.$executeRawUnsafe(`
          ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "colors" JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('✅ [ADMIN SERVICE] Added "colors" column');
      }

      // Add imageUrl column if it doesn't exist
      if (!imageUrlExists) {
        await db.$executeRawUnsafe(`
          ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
        `);
        console.log('✅ [ADMIN SERVICE] Added "imageUrl" column');
      }

      // Create index if it doesn't exist
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "attribute_values_colors_idx" 
        ON "attribute_values" USING GIN ("colors");
      `);

      console.log('✅ [ADMIN SERVICE] Migration completed successfully!');
    } catch (error: any) {
      console.error('❌ [ADMIN SERVICE] Migration error:', error.message);
      throw error; // Re-throw to handle in calling code
    }
  }

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
                options: {
                  include: {
                    attributeValue: {
                      include: {
                        attribute: true,
                      },
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

      // Extract variant options (color, size, etc.)
      // Support both new format (AttributeValue) and old format (attributeKey/value)
      const variantOptions = variant?.options?.map((opt: {
        attributeKey: string | null;
        value: string | null;
        valueId: string | null;
        attributeValue: {
          value: string;
          attribute: {
            key: string;
          };
        } | null;
      }) => {
        // Debug logging for each option
        console.log(`🔍 [ADMIN SERVICE] Processing option:`, {
          attributeKey: opt.attributeKey,
          value: opt.value,
          valueId: opt.valueId,
          hasAttributeValue: !!opt.attributeValue,
          attributeValueData: opt.attributeValue ? {
            value: opt.attributeValue.value,
            attributeKey: opt.attributeValue.attribute.key,
          } : null,
        });

        // New format: Use AttributeValue if available
        if (opt.attributeValue) {
          return {
            attributeKey: opt.attributeValue.attribute.key || undefined,
            value: opt.attributeValue.value || undefined,
          };
        }
        // Old format: Use attributeKey and value directly
        return {
          attributeKey: opt.attributeKey || undefined,
          value: opt.value || undefined,
        };
      }) || [];

      console.log(`🔍 [ADMIN SERVICE] Item mapping:`, {
        productTitle: item.productTitle,
        variantId: item.variantId,
        hasVariant: !!variant,
        optionsCount: variant?.options?.length || 0,
        variantOptions,
      });

      return {
        id: item.id,
        variantId: item.variantId || variant?.id || null,
        productId: product?.id || null,
        productTitle: translation?.title || item.productTitle || "Unknown Product",
        sku: variant?.sku || item.sku || "N/A",
        quantity,
        total,
        unitPrice,
        variantOptions,
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
   * Հեռացնում է պատվերը և բոլոր կապված գրառումները (cascade)
   */
  async deleteOrder(orderId: string) {
    try {
      console.log('🗑️ [ADMIN] Սկսվում է պատվերի հեռացում:', {
        orderId,
        timestamp: new Date().toISOString(),
      });
      
      // Ստուգում ենք, արդյոք պատվերը գոյություն ունի
      console.log('🔍 [ADMIN] Ստուգվում է պատվերի գոյությունը...');
      const existing = await db.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          _count: {
            select: {
              items: true,
              payments: true,
              events: true,
            },
          },
        },
      });

      if (!existing) {
        console.log('❌ [ADMIN] Պատվերը չի գտնվել:', orderId);
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Order not found",
          detail: `Order with id '${orderId}' does not exist`,
        };
      }

      console.log('✅ [ADMIN] Պատվերը գտնվել է:', {
        id: existing.id,
        number: existing.number,
        status: existing.status,
        total: existing.total,
        itemsCount: existing._count.items,
        paymentsCount: existing._count.payments,
        eventsCount: existing._count.events,
      });

      // Հեռացնում ենք պատվերը (cascade-ը ավտոմատ կհեռացնի կապված items, payments, events)
      console.log('🗑️ [ADMIN] Հեռացվում է պատվերը և կապված գրառումները...');
      
      try {
        await db.order.delete({
          where: { id: orderId },
        });
        console.log('✅ [ADMIN] Prisma delete հարցումը հաջողությամբ ավարտված');
      } catch (deleteError: any) {
        console.error('❌ [ADMIN] Prisma delete սխալ:', {
          code: deleteError?.code,
          meta: deleteError?.meta,
          message: deleteError?.message,
          name: deleteError?.name,
        });
        throw deleteError;
      }

      console.log('✅ [ADMIN] Պատվերը հաջողությամբ հեռացվել է:', {
        orderId,
        orderNumber: existing.number,
        timestamp: new Date().toISOString(),
      });
      
      return { success: true };
    } catch (error: any) {
      // Եթե սա մեր ստեղծած սխալ է, ապա վերադարձնում ենք այն
      if (error.status && error.type) {
        console.error('❌ [ADMIN] Ստանդարտ սխալ:', {
          status: error.status,
          type: error.type,
          title: error.title,
          detail: error.detail,
        });
        throw error;
      }

      // Մանրամասն լոգավորում Prisma սխալների համար
      console.error('❌ [ADMIN] Պատվերի հեռացման սխալ:', {
        orderId,
        error: {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack?.substring(0, 500),
        },
        timestamp: new Date().toISOString(),
      });

      // Prisma սխալների մշակում
      if (error?.code === 'P2025') {
        // Record not found
        console.log('⚠️ [ADMIN] Prisma P2025: Գրառումը չի գտնվել');
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Order not found",
          detail: `Order with id '${orderId}' does not exist`,
        };
      }

      if (error?.code === 'P2003') {
        // Foreign key constraint failed
        console.log('⚠️ [ADMIN] Prisma P2003: Foreign key սահմանափակում');
        throw {
          status: 409,
          type: "https://api.shop.am/problems/conflict",
          title: "Cannot delete order",
          detail: "Order has related records that cannot be deleted",
        };
      }

      // Գեներիկ սխալ
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: error?.message || "Failed to delete order",
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
    categories?: string[];
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

    // Category filter - support both single category and multiple categories
    const categoryIds = filters.categories && filters.categories.length > 0 
      ? filters.categories 
      : filters.category 
        ? [filters.category] 
        : [];
    
    if (categoryIds.length > 0) {
      const categoryConditions: any[] = [];
      categoryIds.forEach((categoryId) => {
        categoryConditions.push(
          {
            primaryCategoryId: categoryId,
          },
          {
            categoryIds: {
              has: categoryId,
            },
          }
        );
      });
      orConditions.push(...categoryConditions);
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
    attributeIds?: string[];
    variants: Array<{
      price: string | number;
      compareAtPrice?: string | number;
      stock: string | number;
      sku?: string;
      color?: string;
      size?: string;
      imageUrl?: string;
      published?: boolean;
      options?: Array<{
        attributeKey: string;
        value: string;
        valueId?: string;
      }>;
    }>;
  }) {
    try {
      console.log('🆕 [ADMIN SERVICE] Creating product:', data.title);

      const result = await db.$transaction(async (tx: any) => {
        // Generate variants with options
        // Support both old format (color/size strings) and new format (AttributeValue IDs)
        // Also support generic options array for any attribute type
        const variantsData = await Promise.all(
          data.variants.map(async (variant: any) => {
            const options: any[] = [];
            
            // If variant has explicit options array, use it (new format)
            if (variant.options && Array.isArray(variant.options) && variant.options.length > 0) {
              for (const opt of variant.options) {
                if (opt.valueId) {
                  // New format: use valueId
                  options.push({ valueId: opt.valueId });
                } else if (opt.attributeKey && opt.value) {
                  // Try to find or create AttributeValue
                  const valueId = await findOrCreateAttributeValue(opt.attributeKey, opt.value, data.locale);
                  if (valueId) {
                    options.push({ valueId: valueId });
                  } else {
                    // Fallback to old format if AttributeValue not found
                    options.push({ attributeKey: opt.attributeKey, value: opt.value });
                  }
                }
              }
            } else {
              // Old format: Try to find or create AttributeValues for color and size
              if (variant.color) {
                const colorValueId = await findOrCreateAttributeValue("color", variant.color, data.locale);
                if (colorValueId) {
                  options.push({ valueId: colorValueId });
                } else {
                  // Fallback to old format if AttributeValue not found
                  options.push({ attributeKey: "color", value: variant.color });
                }
              }
              
              if (variant.size) {
                const sizeValueId = await findOrCreateAttributeValue("size", variant.size, data.locale);
                if (sizeValueId) {
                  options.push({ valueId: sizeValueId });
                } else {
                  // Fallback to old format if AttributeValue not found
                  options.push({ attributeKey: "size", value: variant.size });
                }
              }
            }

            const price = typeof variant.price === 'number' ? variant.price : parseFloat(String(variant.price));
            const stock = typeof variant.stock === 'number' ? variant.stock : parseInt(String(variant.stock), 10);
            const compareAtPrice = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null && variant.compareAtPrice !== ''
              ? (typeof variant.compareAtPrice === 'number' ? variant.compareAtPrice : parseFloat(String(variant.compareAtPrice)))
              : undefined;

            return {
              sku: variant.sku || undefined,
              price,
              compareAtPrice,
              stock: isNaN(stock) ? 0 : stock,
              imageUrl: variant.imageUrl || undefined,
              published: variant.published !== false,
              options: {
                create: options,
              },
            };
          })
        );

        const product = await tx.product.create({
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
            labels: data.labels && data.labels.length > 0
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
        });

        // Create ProductAttribute relations if attributeIds provided
        if (data.attributeIds && data.attributeIds.length > 0) {
          try {
            // Ensure table exists (for Vercel deployments where migrations might not run)
            await ensureProductAttributesTable();
            
            console.log('🔗 [ADMIN SERVICE] Creating ProductAttribute relations for product:', product.id, 'attributes:', data.attributeIds);
            await tx.productAttribute.createMany({
              data: data.attributeIds.map((attributeId) => ({
                productId: product.id,
                attributeId,
              })),
              skipDuplicates: true,
            });
            console.log('✅ [ADMIN SERVICE] Created ProductAttribute relations:', data.attributeIds);
          } catch (error: any) {
            console.error('❌ [ADMIN SERVICE] Failed to create ProductAttribute relations:', error);
            console.error('   Product ID:', product.id);
            console.error('   Attribute IDs:', data.attributeIds);
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);
            // Re-throw to fail the transaction
            throw error;
          }
        }

        return await tx.product.findUnique({
          where: { id: product.id },
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
      });

      // Revalidate cache
      try {
        console.log('🧹 [ADMIN SERVICE] Revalidating paths for new product');
        revalidatePath('/');
        revalidatePath('/products');
        // @ts-expect-error - revalidateTag type issue in Next.js
        revalidateTag('products');
      } catch (e) {
        console.warn('⚠️ [ADMIN SERVICE] Revalidation failed:', e);
      }

      return result;
    } catch (error: any) {
      console.error("❌ [ADMIN SERVICE] createProduct error:", error);
      throw error;
    }
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
      attributeIds?: string[];
      variants?: Array<{
        id?: string;
        price: string | number;
        compareAtPrice?: string | number;
        stock: string | number;
        sku?: string;
        color?: string;
        size?: string;
        imageUrl?: string;
        published?: boolean;
      }>;
    }
  ) {
    try {
      console.log('🔄 [ADMIN SERVICE] Updating product:', productId);
      
      // Check if product exists
      const existing = await db.product.findUnique({
        where: { id: productId },
        include: {
          translations: true,
        }
      });

      if (!existing) {
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Product not found",
          detail: `Product with id '${productId}' does not exist`,
        };
      }

      // Execute everything in a transaction for atomicity and speed
      const result = await db.$transaction(async (tx: any) => {
        // 1. Update product base data
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
        if (data.featured !== undefined) updateData.featured = data.featured;

        // 2. Update translation
        if (data.title || data.slug || data.subtitle !== undefined || data.descriptionHtml !== undefined) {
          const locale = data.locale || "en";
          await tx.productTranslation.upsert({
            where: {
              productId_locale: {
                productId,
                locale,
              },
            },
            update: {
              ...(data.title && { title: data.title }),
              ...(data.slug && { slug: data.slug }),
              ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
              ...(data.descriptionHtml !== undefined && { descriptionHtml: data.descriptionHtml || null }),
            },
            create: {
              productId,
              locale,
              title: data.title || "",
              slug: data.slug || "",
              subtitle: data.subtitle || null,
              descriptionHtml: data.descriptionHtml || null,
            },
          });
        }

        // 3. Update labels
        if (data.labels !== undefined) {
          await tx.productLabel.deleteMany({ where: { productId } });
          if (data.labels.length > 0) {
            await tx.productLabel.createMany({
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

        // 3.5. Update ProductAttribute relations
        if (data.attributeIds !== undefined) {
          // Ensure table exists (for Vercel deployments where migrations might not run)
          await ensureProductAttributesTable();
          
          await tx.productAttribute.deleteMany({ where: { productId } });
          if (data.attributeIds.length > 0) {
            await tx.productAttribute.createMany({
              data: data.attributeIds.map((attributeId) => ({
                productId,
                attributeId,
              })),
              skipDuplicates: true,
            });
            console.log('✅ [ADMIN SERVICE] Updated ProductAttribute relations:', data.attributeIds);
          }
        }

        // 4. Update variants
        if (data.variants !== undefined) {
          // Get existing variants to handle related items
          const existingVariants = await tx.productVariant.findMany({
            where: { productId },
            select: { id: true },
          });
          
          if (existingVariants.length > 0) {
            const variantIds = existingVariants.map((v: { id: string }) => v.id);
            await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
            await tx.orderItem.updateMany({
              where: { variantId: { in: variantIds } },
              data: { variantId: null },
            });
          }
          
          await tx.productVariant.deleteMany({ where: { productId } });

          // Create new variants
          if (data.variants.length > 0) {
            const locale = data.locale || "en";
            for (const variant of data.variants) {
              const options: any[] = [];
              
              // Try to find or create AttributeValues for color and size
              if (variant.color) {
                const colorValueId = await findOrCreateAttributeValue("color", variant.color, locale);
                if (colorValueId) {
                  options.push({ valueId: colorValueId });
                } else {
                  // Fallback to old format if AttributeValue not found
                  options.push({ attributeKey: "color", value: variant.color });
                }
              }
              
              if (variant.size) {
                const sizeValueId = await findOrCreateAttributeValue("size", variant.size, locale);
                if (sizeValueId) {
                  options.push({ valueId: sizeValueId });
                } else {
                  // Fallback to old format if AttributeValue not found
                  options.push({ attributeKey: "size", value: variant.size });
                }
              }

              const price = typeof variant.price === 'number' ? variant.price : parseFloat(String(variant.price));
              const stock = typeof variant.stock === 'number' ? variant.stock : parseInt(String(variant.stock), 10);
              const compareAtPrice = variant.compareAtPrice !== undefined && variant.compareAtPrice !== null && variant.compareAtPrice !== ''
                ? (typeof variant.compareAtPrice === 'number' ? variant.compareAtPrice : parseFloat(String(variant.compareAtPrice)))
                : undefined;

              if (isNaN(price) || price < 0) {
                throw new Error(`Invalid price value: ${variant.price}`);
              }

              await tx.productVariant.create({
                data: {
                  productId,
                  sku: variant.sku || undefined,
                  price,
                  compareAtPrice,
                  stock: isNaN(stock) ? 0 : stock,
                  imageUrl: variant.imageUrl || undefined,
                  published: variant.published !== false,
                  options: {
                    create: options,
                  },
                },
              });
            }
          }
        }

        // 5. Finally update the product record itself
        return await tx.product.update({
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
      });

      // 6. Revalidate cache for this product and related pages
      try {
        console.log('🧹 [ADMIN SERVICE] Revalidating paths for product:', productId);
        revalidatePath(`/products/${result.translations[0]?.slug}`);
        revalidatePath('/');
        revalidatePath('/products');
        // @ts-expect-error - revalidateTag type issue in Next.js
        revalidateTag('products');
        // @ts-expect-error - revalidateTag type issue in Next.js
        revalidateTag(`product-${productId}`);
      } catch (e) {
        console.warn('⚠️ [ADMIN SERVICE] Revalidation failed (expected in some environments):', e);
      }

      return result;
    } catch (error: any) {
      // ... (rest of error handling)
      console.error("❌ [ADMIN SERVICE] updateProduct error:", error);
      throw error;
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
   * Update category
   */
  async updateCategory(categoryId: string, data: {
    title?: string;
    locale?: string;
    parentId?: string | null;
    requiresSizes?: boolean;
  }) {
    const locale = data.locale || "en";
    
    const category = await db.category.findUnique({
      where: { id: categoryId },
      include: {
        translations: true,
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

    // Prevent circular reference (category cannot be its own parent)
    if (data.parentId === categoryId) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/bad-request",
        title: "Invalid parent",
        detail: "Category cannot be its own parent",
      };
    }

    // Prevent setting parent to a child category (would create circular reference)
    if (data.parentId) {
      const potentialParent = await db.category.findUnique({
        where: { id: data.parentId },
        include: {
          children: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      if (!potentialParent) {
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Parent category not found",
          detail: `Parent category with id '${data.parentId}' does not exist`,
        };
      }

      // Check if the category to update is in the children of the potential parent
      const isChild = await this.isCategoryDescendant(potentialParent.id, categoryId);
      if (isChild) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/bad-request",
          title: "Circular reference",
          detail: "Cannot set parent to a category that is a descendant of this category",
        };
      }
    }

    const updateData: any = {};
    
    if (data.parentId !== undefined) {
      updateData.parentId = data.parentId || null;
    }
    
    if (data.requiresSizes !== undefined) {
      updateData.requiresSizes = data.requiresSizes;
    }

    // Update translation if title is provided
    if (data.title) {
      const slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const categoryTranslations = Array.isArray(category.translations) ? category.translations : [];
      const existingTranslation = categoryTranslations.find((t: { locale: string }) => t.locale === locale);

      if (existingTranslation) {
        // Update existing translation
        await db.categoryTranslation.update({
          where: { id: existingTranslation.id },
          data: {
            title: data.title,
            slug,
          },
        });
      } else {
        // Create new translation
        await db.categoryTranslation.create({
          data: {
            categoryId: category.id,
            locale,
            title: data.title,
            slug,
            fullPath: slug,
          },
        });
      }
    }

    // Update category base data
    const updatedCategory = await db.category.update({
      where: { id: categoryId },
      data: updateData,
      include: {
        translations: true,
      },
    });

    const categoryTranslations = Array.isArray(updatedCategory.translations) ? updatedCategory.translations : [];
    const translation = categoryTranslations.find((t: { locale: string }) => t.locale === locale) || categoryTranslations[0] || null;

    return {
      data: {
        id: updatedCategory.id,
        title: translation?.title || "",
        slug: translation?.slug || "",
        parentId: updatedCategory.parentId,
        requiresSizes: updatedCategory.requiresSizes || false,
      },
    };
  }

  /**
   * Helper function to check if a category is a descendant of another category
   */
  private async isCategoryDescendant(ancestorId: string, descendantId: string, visited: Set<string> = new Set()): Promise<boolean> {
    if (visited.has(descendantId)) {
      // Circular reference detected
      return false;
    }
    visited.add(descendantId);

    const category = await db.category.findUnique({
      where: { id: descendantId },
      include: {
        parent: true,
      },
    });

    if (!category || !category.parent) {
      return false;
    }

    if (category.parent.id === ancestorId) {
      return true;
    }

    return this.isCategoryDescendant(ancestorId, category.parent.id, visited);
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
   * Update brand
   */
  async updateBrand(
    brandId: string,
    data: {
      name?: string;
      locale?: string;
      logoUrl?: string;
    }
  ) {
    console.log('🔄 [ADMIN SERVICE] updateBrand called:', brandId, data);
    
    const brand = await db.brand.findUnique({
      where: { id: brandId },
      include: {
        translations: true,
      },
    });

    if (!brand) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Brand not found",
        detail: `Brand with id '${brandId}' does not exist`,
      };
    }

    const locale = data.locale || "en";
    const updateData: any = {};

    // Update logo URL if provided
    if (data.logoUrl !== undefined) {
      updateData.logoUrl = data.logoUrl || null;
    }

    // Update translation if name is provided
    if (data.name !== undefined) {
      const brandTranslations = Array.isArray(brand.translations) ? brand.translations : [];
      const existingTranslation = brandTranslations.find(
        (t: { locale: string }) => t.locale === locale
      );

      if (existingTranslation) {
        // Update existing translation
        await db.brandTranslation.update({
          where: { id: existingTranslation.id },
          data: { name: data.name },
        });
      } else {
        // Create new translation
        await db.brandTranslation.create({
          data: {
            brandId: brand.id,
            locale,
            name: data.name,
          },
        });
      }
    }

    // Update brand base data if needed
    if (Object.keys(updateData).length > 0) {
      await db.brand.update({
        where: { id: brandId },
        data: updateData,
      });
    }

    // Fetch updated brand with translations
    const updatedBrand = await db.brand.findUnique({
      where: { id: brandId },
      include: {
        translations: {
          where: { locale },
          take: 1,
        },
      },
    });

    const brandTranslations = Array.isArray(updatedBrand?.translations) 
      ? updatedBrand.translations 
      : [];
    const translation = brandTranslations[0] || null;

    return {
      data: {
        id: updatedBrand!.id,
        name: translation?.name || "",
        slug: updatedBrand!.slug,
      },
    };
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
    // Ensure colors and imageUrl columns exist (runtime migration)
    try {
      await this.ensureColorsColumnsExist();
    } catch (migrationError: any) {
      console.warn('⚠️ [ADMIN SERVICE] Migration check failed:', migrationError.message);
      // Continue anyway - might already exist
    }

    let attributes;
    try {
      attributes = await db.attribute.findMany({
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
    } catch (error: any) {
      // If attribute_values.colors column doesn't exist, fetch without it
      if (error?.code === 'P2022' || error?.message?.includes('attribute_values.colors') || error?.message?.includes('does not exist')) {
        console.warn('⚠️ [ADMIN SERVICE] attribute_values.colors column not found, fetching without it:', error.message);
        // Fetch attributes first
        const attributesList = await db.attribute.findMany({
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

        // Fetch values separately without colors and imageUrl using Prisma
        // Try with select first, if it fails (because Prisma tries to select colors), use raw query
        let allValues: any[];
        try {
          allValues = await db.attributeValue.findMany({
            select: {
              id: true,
              attributeId: true,
              value: true,
              position: true,
              translations: {
                where: { locale: "en" },
                take: 1,
              },
            },
            orderBy: {
              position: "asc",
            },
          });
        } catch (selectError: any) {
          // If select also fails, use raw query with correct column name
          // Try with quoted name first, then without quotes
          console.warn('⚠️ [ADMIN SERVICE] Using raw query for attribute values:', selectError.message);
          try {
            allValues = await db.$queryRaw`
              SELECT 
                av.id,
                av."attributeId",
                av.value,
                av.position
              FROM attribute_values av
              ORDER BY av.position ASC
            ` as any[];
          } catch (rawError: any) {
            // If quoted name doesn't work, try without quotes (snake_case)
            console.warn('⚠️ [ADMIN SERVICE] Trying with snake_case column name:', rawError.message);
            allValues = await db.$queryRaw`
              SELECT 
                av.id,
                av.attribute_id as "attributeId",
                av.value,
                av.position
              FROM attribute_values av
              ORDER BY av.position ASC
            ` as any[];
          }
          
          // Fetch translations separately
          const valueIds = allValues.map((v: any) => v.id);
          const valueTranslations = valueIds.length > 0 
            ? await db.attributeValueTranslation.findMany({
                where: {
                  attributeValueId: { in: valueIds },
                  locale: "en",
                },
              })
            : [];
          
          // Add translations to values
          allValues = allValues.map((val: any) => ({
            ...val,
            translations: valueTranslations.filter((t: any) => t.attributeValueId === val.id),
          }));
        }

        // Combine attributes with their values
        attributes = attributesList.map((attr: any) => {
          const attrValues = allValues
            .filter((val: any) => val.attributeId === attr.id)
            .map((val: any) => {
              return {
                id: val.id,
                attributeId: val.attributeId,
                value: val.value,
                position: val.position,
                colors: null, // Add null for compatibility
                imageUrl: null, // Add null for compatibility
                translations: Array.isArray(val.translations) ? val.translations : [],
              };
            });
          
          return {
            ...attr,
            values: attrValues,
          };
        });
      } else {
        throw error;
      }
    }

    return {
      data: attributes.map((attribute: { id: string; key: string; type: string; filterable: boolean; translations?: Array<{ name: string }>; values?: Array<{ id: string; value: string; translations?: Array<{ label: string }>; colors?: any; imageUrl?: string | null }> }) => {
        const translations = Array.isArray(attribute.translations) ? attribute.translations : [];
        const translation = translations[0] || null;
        const values = Array.isArray(attribute.values) ? attribute.values : [];
        return {
          id: attribute.id,
          key: attribute.key,
          name: translation?.name || attribute.key,
          type: attribute.type,
          filterable: attribute.filterable,
          values: values.map((value: any) => {
            const valueTranslations = Array.isArray(value.translations) ? value.translations : [];
            const valueTranslation = valueTranslations[0] || null;
            const colorsData = value.colors;
            const colorsArray = Array.isArray(colorsData) 
              ? colorsData 
              : (colorsData ? JSON.parse(colorsData as string) : []);
            
            return {
              id: value.id,
              value: value.value,
              label: valueTranslation?.label || value.value,
              colors: colorsArray,
              imageUrl: value.imageUrl || null,
            };
          }),
        };
      }),
    };
  }

  /**
   * Create attribute
   */
  async createAttribute(data: {
    name: string;
    key: string;
    type?: string;
    filterable?: boolean;
    locale?: string;
  }) {
    console.log('🆕 [ADMIN SERVICE] Creating attribute:', data.key);

    // Check if attribute with this key already exists
    const existing = await db.attribute.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Attribute already exists",
        detail: `Attribute with key '${data.key}' already exists`,
      };
    }

    const attribute = await db.attribute.create({
      data: {
        key: data.key,
        type: data.type || "select",
        filterable: data.filterable !== false,
        translations: {
          create: {
            locale: data.locale || "en",
            name: data.name,
          },
        },
      },
      include: {
        translations: {
          where: { locale: data.locale || "en" },
        },
        values: {
          include: {
            translations: {
              where: { locale: data.locale || "en" },
            },
          },
        },
      },
    });

    const translation = attribute.translations[0];
    const values = attribute.values || [];

    return {
      id: attribute.id,
      key: attribute.key,
      name: translation?.name || attribute.key,
      type: attribute.type,
      filterable: attribute.filterable,
      values: values.map((val: any) => {
        const valTranslation = val.translations?.[0];
        return {
          id: val.id,
          value: val.value,
          label: valTranslation?.label || val.value,
        };
      }),
    };
  }

  /**
   * Add attribute value
   */
  async addAttributeValue(attributeId: string, data: { label: string; locale?: string }) {
    console.log('➕ [ADMIN SERVICE] Adding attribute value:', { attributeId, label: data.label });

    const attribute = await db.attribute.findUnique({
      where: { id: attributeId },
    });

    if (!attribute) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Attribute not found",
        detail: `Attribute with id '${attributeId}' does not exist`,
      };
    }

    // Use label as value (normalized)
    const value = data.label.trim().toLowerCase().replace(/\s+/g, '-');

    // Check if value already exists
    const existing = await db.attributeValue.findFirst({
      where: {
        attributeId,
        value,
      },
    });

    if (existing) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Value already exists",
        detail: `Value '${data.label}' already exists for this attribute`,
      };
    }

    const attributeValue = await db.attributeValue.create({
      data: {
        attributeId,
        value,
        translations: {
          create: {
            locale: data.locale || "en",
            label: data.label.trim(),
          },
        },
      },
    });

    // Return updated attribute with all values
    const updatedAttribute = await db.attribute.findUnique({
      where: { id: attributeId },
      include: {
        translations: {
          where: { locale: data.locale || "en" },
        },
        values: {
          include: {
            translations: {
              where: { locale: data.locale || "en" },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!updatedAttribute) {
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "Failed to retrieve updated attribute",
      };
    }

    const translation = updatedAttribute.translations[0];
    const values = updatedAttribute.values || [];

    return {
      id: updatedAttribute.id,
      key: updatedAttribute.key,
      name: translation?.name || updatedAttribute.key,
      type: updatedAttribute.type,
      filterable: updatedAttribute.filterable,
      values: values.map((val: any) => {
        const valTranslation = val.translations?.[0];
        return {
          id: val.id,
          value: val.value,
          label: valTranslation?.label || val.value,
          colors: Array.isArray(val.colors) ? val.colors : (val.colors ? JSON.parse(val.colors as string) : []),
          imageUrl: val.imageUrl || null,
        };
      }),
    };
  }

  /**
   * Update attribute value
   */
  async updateAttributeValue(
    attributeId: string,
    valueId: string,
    data: {
      label?: string;
      colors?: string[];
      imageUrl?: string | null;
      locale?: string;
    }
  ) {
    console.log('✏️ [ADMIN SERVICE] Updating attribute value:', { attributeId, valueId, data });

    // Ensure colors and imageUrl columns exist (runtime migration)
    try {
      await this.ensureColorsColumnsExist();
    } catch (migrationError: any) {
      console.warn('⚠️ [ADMIN SERVICE] Migration check failed:', migrationError.message);
      // Continue anyway - might already exist
    }

    const attributeValue = await db.attributeValue.findUnique({
      where: { id: valueId },
      include: {
        attribute: true,
        translations: true,
      },
    });

    if (!attributeValue) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Attribute value not found",
        detail: `Attribute value with id '${valueId}' does not exist`,
      };
    }

    if (attributeValue.attributeId !== attributeId) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation Error",
        detail: "Attribute value does not belong to the specified attribute",
      };
    }

    const locale = data.locale || "en";
    const updateData: any = {};

    // Update colors if provided
    if (data.colors !== undefined) {
      updateData.colors = data.colors.length > 0 ? data.colors : [];
    }

    // Update imageUrl if provided
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl || null;
    }

    // Update translation label if provided
    if (data.label !== undefined) {
      const existingTranslation = attributeValue.translations.find(
        (t: any) => t.locale === locale
      );

      if (existingTranslation) {
        await db.attributeValueTranslation.update({
          where: { id: existingTranslation.id },
          data: { label: data.label.trim() },
        });
      } else {
        await db.attributeValueTranslation.create({
          data: {
            attributeValueId: valueId,
            locale,
            label: data.label.trim(),
          },
        });
      }
    }

    // Update attribute value if colors or imageUrl changed
    if (Object.keys(updateData).length > 0) {
      await db.attributeValue.update({
        where: { id: valueId },
        data: updateData,
      });
    }

    // Return updated attribute with all values
    const updatedAttribute = await db.attribute.findUnique({
      where: { id: attributeId },
      include: {
        translations: {
          where: { locale },
        },
        values: {
          include: {
            translations: {
              where: { locale },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!updatedAttribute) {
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "Failed to retrieve updated attribute",
      };
    }

    const translation = updatedAttribute.translations[0];
    const values = updatedAttribute.values || [];

    return {
      id: updatedAttribute.id,
      key: updatedAttribute.key,
      name: translation?.name || updatedAttribute.key,
      type: updatedAttribute.type,
      filterable: updatedAttribute.filterable,
      values: values.map((val: any) => {
        const valTranslation = val.translations?.[0];
        const colorsData = val.colors;
        const colorsArray = Array.isArray(colorsData) 
          ? colorsData 
          : (colorsData ? JSON.parse(colorsData as string) : []);
        
        return {
          id: val.id,
          value: val.value,
          label: valTranslation?.label || val.value,
          colors: colorsArray,
          imageUrl: val.imageUrl || null,
        };
      }),
    };
  }

  /**
   * Delete attribute
   */
  async deleteAttribute(attributeId: string) {
    try {
      console.log('🗑️ [ADMIN SERVICE] Սկսվում է attribute-ի հեռացում:', {
        attributeId,
        timestamp: new Date().toISOString(),
      });

      // Ստուգում ենք, արդյոք attribute-ը գոյություն ունի
      console.log('🔍 [ADMIN SERVICE] Ստուգվում է attribute-ի գոյությունը...');
      const attribute = await db.attribute.findUnique({
        where: { id: attributeId },
        select: {
          id: true,
          key: true,
        },
      });

      if (!attribute) {
        console.log('❌ [ADMIN SERVICE] Attribute-ը չի գտնվել:', attributeId);
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Attribute not found",
          detail: `Attribute with id '${attributeId}' does not exist`,
        };
      }

      console.log('✅ [ADMIN SERVICE] Attribute-ը գտնվել է:', {
        id: attribute.id,
        key: attribute.key,
      });

      // Ստուգում ենք, արդյոք attribute-ը օգտագործվում է արտադրանքներում
      console.log('🔍 [ADMIN SERVICE] Ստուգվում է, արդյոք attribute-ը օգտագործվում է արտադրանքներում...');
      
      let productAttributesCount = 0;
      
      // Ստուգում ենք, արդյոք db.productAttribute գոյություն ունի
      if (db.productAttribute) {
        try {
          productAttributesCount = await db.productAttribute.count({
            where: { attributeId },
          });
          console.log('📊 [ADMIN SERVICE] Product attributes count:', productAttributesCount);
        } catch (countError: any) {
          console.error('❌ [ADMIN SERVICE] Product attributes count սխալ:', {
            error: countError,
            message: countError?.message,
            code: countError?.code,
          });
          // Եթե count-ը չի աշխատում, փորձում ենք findMany-ով
          try {
            const productAttributes = await db.productAttribute.findMany({
              where: { attributeId },
              select: { id: true },
            });
            productAttributesCount = productAttributes.length;
            console.log('📊 [ADMIN SERVICE] Product attributes count (via findMany):', productAttributesCount);
          } catch (findError: any) {
            console.warn('⚠️ [ADMIN SERVICE] Product attributes findMany-ը նույնպես չի աշխատում, skip անում ենք ստուգումը');
            productAttributesCount = 0;
          }
        }
      } else {
        console.warn('⚠️ [ADMIN SERVICE] db.productAttribute-ը undefined է, skip անում ենք product attributes ստուգումը');
      }

      if (productAttributesCount > 0) {
        console.log('⚠️ [ADMIN SERVICE] Attribute-ը օգտագործվում է արտադրանքներում:', productAttributesCount);
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Cannot delete attribute",
          detail: `Attribute is used in ${productAttributesCount} product(s). Please remove it from products first.`,
        };
      }

      // Ստուգում ենք, արդյոք attribute values-ները օգտագործվում են variants-ներում
      console.log('🔍 [ADMIN SERVICE] Ստուգվում է, արդյոք attribute values-ները օգտագործվում են variants-ներում...');
      const attributeValues = await db.attributeValue.findMany({
        where: { attributeId },
        select: { id: true },
      });

      console.log('📊 [ADMIN SERVICE] Attribute values count:', attributeValues.length);

      if (attributeValues.length > 0) {
        const valueIds = attributeValues.map((v: { id: string }) => v.id);
        console.log('🔍 [ADMIN SERVICE] Ստուգվում է variant options...');
        
        let variantOptionsCount = 0;
        try {
          variantOptionsCount = await db.productVariantOption.count({
            where: {
              valueId: { in: valueIds },
            },
          });
          console.log('📊 [ADMIN SERVICE] Variant options count:', variantOptionsCount);
        } catch (countError: any) {
          console.error('❌ [ADMIN SERVICE] Variant options count սխալ:', {
            error: countError,
            message: countError?.message,
            code: countError?.code,
          });
          // Եթե count-ը չի աշխատում, փորձում ենք findMany-ով
          const variantOptions = await db.productVariantOption.findMany({
            where: {
              valueId: { in: valueIds },
            },
            select: { id: true },
          });
          variantOptionsCount = variantOptions.length;
          console.log('📊 [ADMIN SERVICE] Variant options count (via findMany):', variantOptionsCount);
        }

        if (variantOptionsCount > 0) {
          console.log('⚠️ [ADMIN SERVICE] Attribute values-ները օգտագործվում են variants-ներում:', variantOptionsCount);
          throw {
            status: 400,
            type: "https://api.shop.am/problems/validation-error",
            title: "Cannot delete attribute",
            detail: `Some attribute values are used in ${variantOptionsCount} variant(s). Please remove them from variants first.`,
          };
        }
      }

      // Հեռացնում ենք attribute-ը (values-ները կհեռացվեն cascade-ով)
      console.log('🗑️ [ADMIN SERVICE] Հեռացվում է attribute-ը...');
      await db.attribute.delete({
        where: { id: attributeId },
      });

      console.log('✅ [ADMIN SERVICE] Attribute-ը հաջողությամբ հեռացվել է:', {
        attributeId,
        timestamp: new Date().toISOString(),
      });
      
      return { success: true };
    } catch (error: any) {
      // Եթե սա մեր ստեղծած սխալ է, ապա վերադարձնում ենք այն
      if (error.status && error.type) {
        console.error('❌ [ADMIN SERVICE] Ստանդարտ սխալ:', {
          status: error.status,
          type: error.type,
          title: error.title,
          detail: error.detail,
        });
        throw error;
      }

      // Մանրամասն լոգավորում
      console.error('❌ [ADMIN SERVICE] Attribute հեռացման սխալ:', {
        attributeId,
        error: {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack?.substring(0, 1000),
        },
        timestamp: new Date().toISOString(),
      });

      // Prisma սխալների մշակում
      if (error?.code === 'P2025') {
        console.log('⚠️ [ADMIN SERVICE] Prisma P2025: Գրառումը չի գտնվել');
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Attribute not found",
          detail: `Attribute with id '${attributeId}' does not exist`,
        };
      }

      // Գեներիկ սխալ
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: error?.message || "Failed to delete attribute",
      };
    }
  }

  /**
   * Delete attribute value
   */
  async deleteAttributeValue(attributeValueId: string) {
    try {
      console.log('🗑️ [ADMIN SERVICE] Deleting attribute value:', attributeValueId);

      // First check if attribute value exists
      const attributeValue = await db.attributeValue.findUnique({
        where: { id: attributeValueId },
        select: {
          id: true,
          attributeId: true,
        },
      });

      if (!attributeValue) {
        throw {
          status: 404,
          type: "https://api.shop.am/problems/not-found",
          title: "Attribute value not found",
          detail: `Attribute value with id '${attributeValueId}' does not exist`,
        };
      }

      // Check if value is used in any variants
      const variantOptionsCount = await db.productVariantOption.count({
        where: {
          valueId: attributeValueId,
        },
      });

      if (variantOptionsCount > 0) {
        throw {
          status: 400,
          type: "https://api.shop.am/problems/validation-error",
          title: "Cannot delete attribute value",
          detail: `Attribute value is used in ${variantOptionsCount} variant(s). Please remove it from variants first.`,
        };
      }

      // Delete attribute value
      await db.attributeValue.delete({
        where: { id: attributeValueId },
      });

      // Return updated attribute
      const attribute = await db.attribute.findUnique({
        where: { id: attributeValue.attributeId },
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
            orderBy: { position: "asc" },
          },
        },
      });

      if (!attribute) {
        throw {
          status: 500,
          type: "https://api.shop.am/problems/internal-error",
          title: "Internal Server Error",
          detail: "Failed to retrieve updated attribute",
        };
      }

      const translation = attribute.translations[0];
      const values = attribute.values || [];

      return {
        id: attribute.id,
        key: attribute.key,
        name: translation?.name || attribute.key,
        type: attribute.type,
        filterable: attribute.filterable,
        values: values.map((val: any) => {
          const valTranslation = val.translations?.[0];
          return {
            id: val.id,
            value: val.value,
            label: valTranslation?.label || val.value,
          };
        }),
      };
    } catch (error: any) {
      console.error('❌ [ADMIN SERVICE] Error deleting attribute value:', error);
      if (error.status) {
        throw error;
      }
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: error.message || "Failed to delete attribute value",
      };
    }
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

