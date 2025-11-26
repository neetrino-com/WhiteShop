const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  description: String,
}, {
  timestamps: true,
});

// Index
settingsSchema.index({ key: 1 });

module.exports = mongoose.model('Settings', settingsSchema);

