/**
 * Script to fix MongoDB index for variants.sku
 * This script drops the old unique index and creates a new sparse unique index
 * that allows multiple null values
 * 
 * Run: node apps/api/src/scripts/fixSkuIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';

async function fixSkuIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('products');

    // Check existing indexes
    console.log('📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));

    // Try to drop the old index if it exists
    try {
      console.log('🗑️  Attempting to drop old index variants.sku_1...');
      await collection.dropIndex('variants.sku_1');
      console.log('✅ Old index dropped successfully');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('ℹ️  Old index does not exist, skipping drop');
      } else {
        console.error('❌ Error dropping old index:', err.message);
        throw err;
      }
    }

    // Create new partial unique index (allows null values)
    console.log('🔨 Creating new partial unique index (allows null values)...');
    // MongoDB partial indexes don't support $ne, so we use $exists and $type
    // This will index only string SKUs, allowing null/undefined values
    await collection.createIndex(
      { 'variants.sku': 1 },
      {
        unique: true,
        // Partial filter: only index string type SKUs (excludes null/undefined)
        partialFilterExpression: {
          'variants.sku': { $type: 'string' }
        },
        name: 'variants.sku_1',
        background: true
      }
    );
    console.log('✅ New partial unique index created successfully');

    // Verify the new index
    console.log('🔍 Verifying new index...');
    const newIndexes = await collection.indexes();
    const skuIndex = newIndexes.find(idx => idx.name === 'variants.sku_1');
    if (skuIndex) {
      console.log('✅ Index verified:', {
        name: skuIndex.name,
        unique: skuIndex.unique,
        partialFilterExpression: skuIndex.partialFilterExpression,
        key: skuIndex.key
      });
    } else {
      console.error('❌ Index not found after creation!');
    }

    console.log('✅ Index fix completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing index:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  fixSkuIndex()
    .then(() => {
      console.log('✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSkuIndex };

