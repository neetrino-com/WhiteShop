const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  passwordHash: {
    type: String,
  },
  firstName: String,
  lastName: String,
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  locale: {
    type: String,
    default: 'en',
  },
  blocked: {
    type: Boolean,
    default: false,
  },
  roles: [{
    type: String,
    default: 'customer',
  }],
  addresses: [{
    firstName: String,
    lastName: String,
    company: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    countryCode: {
      type: String,
      default: 'AM',
    },
    phone: String,
    isDefault: {
      type: Boolean,
      default: false,
    },
  }],
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes
// email и phone уже имеют unique: true в схеме, что автоматически создает индексы
userSchema.index({ deletedAt: 1 });

// Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

