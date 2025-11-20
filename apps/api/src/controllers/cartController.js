const Cart = require('../models/Cart');
const Product = require('../models/Product');

const cartController = {
  /**
   * Get user's cart
   * GET /api/v1/cart
   */
  async getCart(req, res, next) {
    try {
      let cart = await Cart.findOne({
        userId: req.user.id,
      })
        .populate({
          path: 'items.productId',
          select: 'translations media',
        })
        .lean();

      if (!cart) {
        cart = await Cart.create({
          userId: req.user.id,
          locale: req.user.locale || 'en',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          items: [],
        });
      }

      // Get variant details for each item
      const itemsWithDetails = await Promise.all(
        (cart.items || []).map(async (item) => {
          const product = await Product.findOne({
            _id: item.productId,
            'variants._id': item.variantId,
          })
            .select('translations variants media')
            .lean();

          const variant = product?.variants?.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
          const translation = product?.translations?.find(
            (t) => t.locale === (req.user.locale || 'en')
          ) || product?.translations?.[0];

          // Extract first image from media
          let imageUrl = null;
          if (product?.media && product.media.length > 0) {
            const firstMedia = product.media[0];
            if (typeof firstMedia === 'string') {
              imageUrl = firstMedia;
            } else if (firstMedia?.url) {
              imageUrl = firstMedia.url;
            } else if (firstMedia?.src) {
              imageUrl = firstMedia.src;
            }
          }

          return {
            id: item._id.toString(),
            variant: {
              id: variant?._id?.toString() || item.variantId.toString(),
              sku: variant?.sku || '',
              product: {
                id: product?._id?.toString() || '',
                title: translation?.title || '',
                slug: translation?.slug || '',
                image: imageUrl,
              },
            },
            quantity: item.quantity,
            price: Number(item.priceSnapshot),
            total: Number(item.priceSnapshot) * item.quantity,
          };
        })
      );

      // Calculate totals
      const subtotal = itemsWithDetails.reduce(
        (sum, item) => sum + item.total,
        0
      );

      res.json({
        cart: {
          id: cart._id.toString(),
          items: itemsWithDetails,
          totals: {
            subtotal,
            discount: 0,
            shipping: 0,
            tax: 0,
            total: subtotal,
            currency: 'AMD',
          },
          itemsCount: itemsWithDetails.reduce((sum, item) => sum + item.quantity, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add item to cart
   * POST /api/v1/cart/items
   */
  async addItem(req, res, next) {
    try {
      const { variantId, productId, quantity = 1 } = req.body;

      if (!variantId || !productId) {
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'variantId and productId are required',
          instance: req.path,
        });
      }

      // Get or create cart
      let cart = await Cart.findOne({
        userId: req.user.id,
      });

      if (!cart) {
        cart = await Cart.create({
          userId: req.user.id,
          locale: req.user.locale || 'en',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          items: [],
        });
      }

      // Get variant from product
      const product = await Product.findOne({
        _id: productId,
        'variants._id': variantId,
      });

      if (!product) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Variant not found',
          status: 404,
          instance: req.path,
        });
      }

      const variant = product.variants.find(
        (v) => v._id.toString() === variantId.toString()
      );

      if (!variant || !variant.published) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Variant not found',
          status: 404,
          instance: req.path,
        });
      }

      if (variant.stock < quantity) {
        return res.status(422).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Insufficient stock',
          status: 422,
          detail: `Requested quantity (${quantity}) exceeds available stock (${variant.stock})`,
          instance: req.path,
        });
      }

      // Add or update cart item
      const existingItemIndex = cart.items.findIndex(
        (item) => item.variantId.toString() === variantId.toString()
      );

      if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        cart.items.push({
          variantId,
          productId,
          quantity,
          priceSnapshot: variant.price,
        });
      }

      await cart.save();

      const item = cart.items[existingItemIndex >= 0 ? existingItemIndex : cart.items.length - 1];

      res.status(201).json({
        item: {
          id: item._id.toString(),
          variantId: variantId.toString(),
          quantity: item.quantity,
          price: Number(item.priceSnapshot),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update cart item
   * PATCH /api/v1/cart/items/:id
   */
  async updateItem(req, res, next) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'quantity must be at least 1',
          instance: req.path,
        });
      }

      const cart = await Cart.findOne({
        userId: req.user.id,
        'items._id': id,
      });

      if (!cart) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Cart item not found',
          status: 404,
          instance: req.path,
        });
      }

      const item = cart.items.id(id);
      const product = await Product.findOne({
        _id: item.productId,
        'variants._id': item.variantId,
      });

      const variant = product?.variants?.find(
        (v) => v._id.toString() === item.variantId.toString()
      );

      if (!variant || variant.stock < quantity) {
        return res.status(422).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Insufficient stock',
          status: 422,
          detail: `Requested quantity (${quantity}) exceeds available stock (${variant?.stock || 0})`,
          instance: req.path,
        });
      }

      item.quantity = quantity;
      await cart.save();

      res.json({
        item: {
          id: item._id.toString(),
          quantity: item.quantity,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Remove item from cart
   * DELETE /api/v1/cart/items/:id
   */
  async removeItem(req, res, next) {
    try {
      const { id } = req.params;

      const cart = await Cart.findOne({
        userId: req.user.id,
        'items._id': id,
      });

      if (!cart) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Cart item not found',
          status: 404,
          instance: req.path,
        });
      }

      // Use pull() method which is more reliable for removing subdocuments
      const item = cart.items.id(id);
      if (!item) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Cart item not found',
          status: 404,
          instance: req.path,
        });
      }

      cart.items.pull(id);
      await cart.save();

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};

module.exports = cartController;
