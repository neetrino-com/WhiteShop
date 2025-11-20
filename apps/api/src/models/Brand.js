const mongoose = require('mongoose');

const brandTranslationSchema = new mongoose.Schema({
  locale: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
});

const brandSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  logoUrl: String,
  published: {
    type: Boolean,
    default: false,
  },
  translations: [brandTranslationSchema],
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes
// slug уже имеет unique: true в схеме, что автоматически создает индекс
brandSchema.index({ published: 1 });
brandSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('Brand', brandSchema);

