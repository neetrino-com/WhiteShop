/**
 * Скрипт для публикации всех неопубликованных продуктов
 * Использование: node src/scripts/publishAllProducts.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const Product = require('../models/Product');
const { connectDB } = require('../lib/mongodb');

async function publishAllProducts() {
  try {
    console.log('🔌 Подключение к MongoDB...');
    await connectDB();
    console.log('✅ Подключено к MongoDB');

    // Находим все неопубликованные продукты
    const unpublishedProducts = await Product.find({
      published: false,
      deletedAt: null,
    });

    console.log(`\n📊 Найдено неопубликованных продуктов: ${unpublishedProducts.length}`);

    if (unpublishedProducts.length === 0) {
      console.log('✅ Все продукты уже опубликованы!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Публикуем все продукты
    const result = await Product.updateMany(
      {
        published: false,
        deletedAt: null,
      },
      {
        $set: {
          published: true,
          publishedAt: new Date(),
        },
      }
    );

    console.log(`\n✅ Опубликовано продуктов: ${result.modifiedCount}`);
    console.log('✅ Все продукты теперь видны в списке!');

    await mongoose.connection.close();
    console.log('\n🔌 Отключено от MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

publishAllProducts();

