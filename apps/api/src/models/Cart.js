const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product.variants',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  priceSnapshot: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  guestToken: {
    type: String,
    unique: true,
    sparse: true,
  },
  locale: {
    type: String,
    default: 'en',
  },
  couponCode: String,
  abandoned: {
    type: Boolean,
    default: false,
  },
  abandonedAt: Date,
  expiresAt: {
    type: Date,
    required: true,
  },
  items: [cartItemSchema],
}, {
  timestamps: true,
});

// Indexes
// guestToken уже имеет unique: true в схеме, что автоматически создает индекс
cartSchema.index({ userId: 1 });
cartSchema.index({ abandoned: 1, abandonedAt: 1 });
cartSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Cart', cartSchema);

