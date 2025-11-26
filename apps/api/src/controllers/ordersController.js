const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

/**
 * Generate order number
 */
function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(5, '0');
  return `${year}${month}${day}-${random}`;
}

const ordersController = {
  /**
   * Create order (checkout)
   * POST /api/v1/orders/checkout
   */
  async checkout(req, res, next) {
    try {
      const {
        cartId,
        items, // For guest checkout - items array
        email,
        phone,
        shippingAddress,
        billingAddress,
        shippingMethod,
        paymentMethod,
        notes,
        idempotencyKey,
      } = req.body;

      let cart;

      // Handle guest checkout - create cart from items
      if (cartId === 'guest-cart' && items && Array.isArray(items) && items.length > 0) {
        // Create temporary cart for guest checkout
        const cartItems = [];
        for (const item of items) {
          if (!item.productId || !item.variantId || !item.quantity) {
            continue;
          }

          // Get product and variant to get price
          const product = await Product.findById(item.productId);
          if (!product) continue;

          const variant = product.variants?.find(
            (v) => v._id.toString() === item.variantId.toString()
          );

          if (!variant || !variant.published) {
            continue;
          }

          cartItems.push({
            variantId: item.variantId,
            productId: item.productId,
            quantity: item.quantity,
            priceSnapshot: variant.price,
          });
        }

        if (cartItems.length === 0) {
          return res.status(400).json({
            type: 'https://api.shop.am/problems/validation-error',
            title: 'Cart is empty',
            status: 400,
            detail: 'Cart must contain at least one valid item',
            instance: req.path,
          });
        }

        // Create temporary cart object
        cart = {
          items: cartItems,
          locale: 'en',
        };
      } else {
        // Validate cartId for regular checkout
        if (!cartId) {
          return res.status(400).json({
            type: 'https://api.shop.am/problems/validation-error',
            title: 'Validation failed',
            status: 400,
            detail: 'cartId is required',
            instance: req.path,
          });
        }

        // Get cart from database
        cart = await Cart.findOne({
          _id: cartId,
          ...(req.user?.id ? { userId: req.user.id } : {}),
        }).populate('items.productId').lean();

        if (!cart || !cart.items || cart.items.length === 0) {
          return res.status(400).json({
            type: 'https://api.shop.am/problems/validation-error',
            title: 'Cart is empty',
            status: 400,
            detail: 'Cart must contain at least one item',
            instance: req.path,
          });
        }
      }

      // Get product details and validate variants
      const orderItems = [];
      for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        const variant = product.variants?.find(
          (v) => v._id.toString() === item.variantId.toString()
        );

        if (!variant || !variant.published) {
          return res.status(404).json({
            type: 'https://api.shop.am/problems/not-found',
            title: 'Variant not found',
            status: 404,
            detail: `Variant ${item.variantId} not found or not published`,
            instance: req.path,
          });
        }

        const translation = product.translations?.find(
          (t) => t.locale === (cart.locale || 'en')
        ) || product.translations?.[0];

        orderItems.push({
          variantId: item.variantId,
          productTitle: translation?.title || 'Product',
          variantTitle: variant.options?.map((opt) => `${opt.attributeKey}: ${opt.value}`).join(', ') || '',
          sku: variant.sku,
          quantity: item.quantity,
          price: Number(item.priceSnapshot),
          total: Number(item.priceSnapshot) * item.quantity,
          imageUrl: variant.imageUrl || (Array.isArray(product.media) && product.media[0]
            ? (typeof product.media[0] === 'string' ? product.media[0] : product.media[0].url)
            : null),
        });
      }

      // Calculate totals
      const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      const shippingAmount = 0; // TODO: Calculate based on shippingMethod
      const taxAmount = 0; // TODO: Calculate tax
      const discountAmount = 0; // TODO: Apply coupon if exists
      const total = subtotal + shippingAmount + taxAmount - discountAmount;

      // Create order
      const orderNumber = generateOrderNumber();
      const order = await Order.create({
        number: orderNumber,
        userId: req.user?.id || null,
        status: 'pending',
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        subtotal,
        discountAmount,
        shippingAmount,
        taxAmount,
        total,
        currency: 'AMD',
        customerEmail: email || req.user?.email,
        customerPhone: phone || req.user?.phone,
        customerLocale: cart.locale || 'en',
        shippingAddress: shippingAddress || {},
        billingAddress: billingAddress || shippingAddress || {},
        shippingMethod: shippingMethod || 'pickup',
        notes,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        items: orderItems,
        events: [{
          type: 'order.created',
          data: {
            cartId: cartId.toString(),
          },
          userId: req.user?.id || null,
          ipAddress: req.ip,
        }],
        payments: [{
          provider: paymentMethod || 'idram',
          amount: total,
          currency: 'AMD',
          status: 'pending',
        }],
      });

      // Reserve stock
      for (const item of cart.items) {
        await Product.updateOne(
          {
            _id: item.productId,
            'variants._id': item.variantId,
          },
          {
            $inc: {
              'variants.$.stockReserved': item.quantity,
            },
          }
        );
      }

      // TODO: Store idempotency key if needed

      res.status(201).json({
        order: {
          id: order._id.toString(),
          number: order.number,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: Number(order.total),
          currency: order.currency,
          createdAt: order.createdAt,
        },
        payment: {
          provider: paymentMethod || 'idram',
          paymentUrl: null, // TODO: Generate payment URL
          expiresAt: null,
        },
        nextAction: 'redirect',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get user orders list
   * GET /api/v1/orders
   */
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, status = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query = {};
      
      // Only show orders for the authenticated user
      if (req.user?.id) {
        query.userId = req.user.id;
      } else {
        // If not logged in, return empty
        return res.json({
          data: [],
          meta: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
          },
        });
      }

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
          currency: order.currency || 'AMD',
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
   * Get order by number
   * GET /api/v1/orders/:number
   */
  async findByNumber(req, res, next) {
    try {
      const { number } = req.params;

      const order = await Order.findOne({ number })
        .sort({ 'events.createdAt': -1 })
        .limit(10)
        .lean();

      if (!order) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Order not found',
          status: 404,
          detail: `Order with number '${number}' does not exist`,
          instance: req.path,
        });
      }

      // Check if user owns this order
      if (order.userId && order.userId.toString() !== req.user?.id?.toString()) {
        return res.status(403).json({
          type: 'https://api.shop.am/problems/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'You do not have access to this order',
          instance: req.path,
        });
      }

      res.json({
        id: order._id.toString(),
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        items: order.items.map((item) => ({
          id: item._id?.toString() || '',
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          sku: item.sku,
          quantity: item.quantity,
          price: Number(item.price),
          total: Number(item.total),
          image: item.imageUrl,
        })),
        totals: {
          subtotal: Number(order.subtotal),
          discount: Number(order.discountAmount),
          shipping: Number(order.shippingAmount),
          tax: Number(order.taxAmount),
          total: Number(order.total),
          currency: order.currency,
        },
        customer: {
          email: order.customerEmail,
          phone: order.customerPhone,
        },
        shippingAddress: order.shippingAddress,
        shippingMethod: order.shippingMethod,
        trackingNumber: order.trackingNumber,
        timeline: (order.events || []).map((event) => ({
          status: event.type,
          timestamp: event.createdAt,
          note: event.data?.note || '',
        })),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ordersController;
