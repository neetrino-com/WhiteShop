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
    // Note: unique index is created at productSchema level, not here
    // This allows multiple null values across different products
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

const productLabelSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'percentage'],
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    default: 'top-left',
  },
  color: {
    type: String,
    default: null, // null = default color based on type
  },
}, {
  _id: true,
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
  labels: [productLabelSchema],
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes
// Unique ինդեքս variant-ի SKU-ի համար
// Կարևոր նշում.
// - MongoDB-ում `sparse: true` չի լուծում null արժեքների կրկնության խնդիրը,
//   քանի որ դաշտը գոյություն ունենալու դեպքում null-ը նույնպես ինդեքսավորվում է:
// - Որպեսզի թույլ տանք null/դատարկ արժեքներ, բայց պահենք uniqueness միայն
//   իրական (ոչ դատարկ) SKU-ների համար, օգտագործում ենք partialFilterExpression:
// 
// ✴ Համոզվեք, որ հին ինդեքսը ջնջված է, որ սա աշխատի ճիշտ.
//   db.products.dropIndex("variants.sku_1")
productSchema.index(
  { 'variants.sku': 1 },
  {
    unique: true,
    // Ինդեքսավորում ենք միայն այն variant-ները, որտեղ SKU-ն string տիպի է
    // MongoDB partial indexes-ը չի աջակցում $ne, ուստի օգտագործում ենք միայն $type
    // Սա թույլ կտա null/undefined արժեքներ, բայց պահպանում է uniqueness string SKU-ների համար
    partialFilterExpression: {
      'variants.sku': { $type: 'string' }
    },
    name: 'variants.sku_1',
  }
);
productSchema.index({ brandId: 1 });
productSchema.index({ published: 1, publishedAt: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ categoryIds: 1 });
productSchema.index({ deletedAt: 1 });
productSchema.index({ 'translations.slug': 1, 'translations.locale': 1 });

module.exports = mongoose.model('Product', productSchema);

