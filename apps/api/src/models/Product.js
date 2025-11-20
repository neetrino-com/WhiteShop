const mongoose = require('mongoose');

const productTranslationSchema = new mongoose.Schema({
  locale: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
  },
  subtitle: String,
  descriptionHtml: String,
  seoTitle: String,
  seoDescription: String,
});

const variantOptionSchema = new mongoose.Schema({
  attributeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attribute',
  },
  attributeKey: String,
  valueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttributeValue',
  },
  value: String,
});

const variantSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
  },
  barcode: String,
  price: {
    type: Number,
    required: true,
  },
  compareAtPrice: Number,
  cost: Number,
  stock: {
    type: Number,
    default: 0,
  },
  stockReserved: {
    type: Number,
    default: 0,
  },
  weightGrams: Number,
  imageUrl: String,
  position: {
    type: Number,
    default: 0,
  },
  published: {
    type: Boolean,
    default: true,
  },
  options: [variantOptionSchema],
}, {
  timestamps: true,
});

const productSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
  },
  skuPrefix: String,
  media: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  published: {
    type: Boolean,
    default: false,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  publishedAt: Date,
  translations: [productTranslationSchema],
  categoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
  primaryCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  attributeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attribute',
  }],
  variants: [variantSchema],
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes
// variants.sku уже имеет unique: true в схеме, что автоматически создает индекс
productSchema.index({ brandId: 1 });
productSchema.index({ published: 1, publishedAt: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ categoryIds: 1 });
productSchema.index({ deletedAt: 1 });
productSchema.index({ 'translations.slug': 1, 'translations.locale': 1 });

module.exports = mongoose.model('Product', productSchema);

