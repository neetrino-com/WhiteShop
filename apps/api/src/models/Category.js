const mongoose = require('mongoose');

const categoryTranslationSchema = new mongoose.Schema({
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
  fullPath: {
    type: String,
    required: true,
  },
  description: String,
  seoTitle: String,
  seoDescription: String,
});

const categorySchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  position: {
    type: Number,
    default: 0,
  },
  published: {
    type: Boolean,
    default: false,
  },
  media: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  translations: [categoryTranslationSchema],
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes
categorySchema.index({ parentId: 1 });
categorySchema.index({ published: 1 });
categorySchema.index({ deletedAt: 1 });
categorySchema.index({ 'translations.slug': 1, 'translations.locale': 1 });

module.exports = mongoose.model('Category', categorySchema);

