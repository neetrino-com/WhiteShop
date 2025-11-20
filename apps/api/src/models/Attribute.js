const mongoose = require('mongoose');

const attributeTranslationSchema = new mongoose.Schema({
  locale: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

const attributeValueTranslationSchema = new mongoose.Schema({
  locale: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
});

const attributeValueSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true,
  },
  position: {
    type: Number,
    default: 0,
  },
  translations: [attributeValueTranslationSchema],
});

const attributeSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    default: 'select',
  },
  filterable: {
    type: Boolean,
    default: true,
  },
  position: {
    type: Number,
    default: 0,
  },
  translations: [attributeTranslationSchema],
  values: [attributeValueSchema],
}, {
  timestamps: true,
});

// Indexes
// key уже имеет unique: true в схеме, что автоматически создает индекс

module.exports = mongoose.model('Attribute', attributeSchema);

