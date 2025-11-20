const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product.variants',
  },
  productTitle: {
    type: String,
    required: true,
  },
  variantTitle: String,
  sku: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  imageUrl: String,
});

const orderEventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  data: mongoose.Schema.Types.Mixed,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  ipAddress: String,
}, {
  timestamps: true,
});

const paymentSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
  },
  providerTransactionId: String,
  method: String,
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'AMD',
  },
  status: {
    type: String,
    default: 'pending',
  },
  cardLast4: String,
  cardBrand: String,
  errorCode: String,
  errorMessage: String,
  providerResponse: mongoose.Schema.Types.Mixed,
  idempotencyKey: String,
  completedAt: Date,
  failedAt: Date,
}, {
  timestamps: true,
});

const orderSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    default: 'pending',
  },
  fulfillmentStatus: {
    type: String,
    default: 'unfulfilled',
  },
  subtotal: {
    type: Number,
    required: true,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  shippingAmount: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'AMD',
  },
  customerEmail: String,
  customerPhone: String,
  customerLocale: {
    type: String,
    default: 'en',
  },
  billingAddress: mongoose.Schema.Types.Mixed,
  shippingAddress: mongoose.Schema.Types.Mixed,
  shippingMethod: String,
  trackingNumber: String,
  notes: String,
  adminNotes: String,
  ipAddress: String,
  userAgent: String,
  paidAt: Date,
  fulfilledAt: Date,
  cancelledAt: Date,
  items: [orderItemSchema],
  payments: [paymentSchema],
  events: [orderEventSchema],
}, {
  timestamps: true,
});

// Indexes
// number уже имеет unique: true в схеме, что автоматически создает индекс
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);

