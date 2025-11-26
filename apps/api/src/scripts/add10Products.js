/**
 * Script to add 10 new products in different categories
 * 
 * Usage: node src/scripts/add10Products.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const mongoose = require('mongoose');
// Use shop database (same as seed.js)
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shop';
const { connectDB } = require('../lib/mongodb');

// Models
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Attribute = require('../models/Attribute');

/**
 * Helper function to get Unsplash image URL
 */
const getImageUrl = (keyword, seed = '') => {
  const seedParam = seed ? `&sig=${seed}` : '';
  return `https://source.unsplash.com/800x800/?${keyword}${seedParam}`;
};

/**
 * Add 10 new products in different categories
 */
async function add10Products() {
  try {
    console.log('🌱 Starting to add 10 new products...\n');
    
    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Get existing categories
    const categories = await Category.find({ published: true }).lean();
    const categoryMap = {};
    categories.forEach(cat => {
      const enTranslation = cat.translations?.find(t => t.locale === 'en');
      if (enTranslation) {
        categoryMap[enTranslation.slug] = cat._id;
      }
    });
    
    console.log('📁 Found categories:', Object.keys(categoryMap).join(', '));
    
    // Get existing brands
    const brands = await Brand.find({ published: true }).lean();
    const brandMap = {};
    brands.forEach(brand => {
      brandMap[brand.slug] = brand._id;
    });
    
    console.log('🏷️  Found brands:', Object.keys(brandMap).join(', '));
    
    // Get attributes
    const [colorAttr, sizeAttr] = await Promise.all([
      Attribute.findOne({ key: 'color' }),
      Attribute.findOne({ key: 'size' }),
    ]);
    
    if (!colorAttr || !sizeAttr) {
      console.error('❌ Attributes not found. Please run seed.js first.');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    // Check if we have categories and brands
    if (Object.keys(categoryMap).length === 0) {
      console.error('❌ No categories found. Please run seed.js first to create categories.');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    if (Object.keys(brandMap).length === 0) {
      console.warn('⚠️  No brands found. Products will be created without brands.');
    }
    
    // Define 10 new products in different categories
    const newProducts = [
      // 1. Gaming Laptop (Electronics > Laptops)
      {
        brandId: brandMap.dell || null,
        skuPrefix: 'GAME-LAP',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.laptops],
        primaryCategoryId: categoryMap.laptops,
        attributeIds: [colorAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Gaming Laptop Pro',
            slug: 'gaming-laptop-pro',
            subtitle: 'High-performance gaming machine',
            descriptionHtml: '<p>Gaming Laptop Pro features powerful GPU and high refresh rate display for ultimate gaming experience.</p>',
            seoTitle: 'Gaming Laptop Pro - Gaming Laptop',
            seoDescription: 'Buy Gaming Laptop Pro for gaming',
          },
          {
            locale: 'hy',
            title: 'Խաղային Լապտոպ Pro',
            slug: 'gaming-laptop-pro',
            subtitle: 'Բարձր արտադրողականության խաղային մեքենա',
            descriptionHtml: '<p>Խաղային Լապտոպ Pro-ն ունի հզոր GPU և բարձր թարմացման արագությամբ էկրան վերջնական խաղային փորձի համար:</p>',
            seoTitle: 'Խաղային Լապտոպ Pro - Խաղային լապտոպ',
            seoDescription: 'Գնեք Խաղային Լապտոպ Pro խաղերի համար',
          },
        ],
        variants: [
          {
            sku: `GAME-LAP-${Date.now()}-1`,
            price: 1599000,
            compareAtPrice: 1799000,
            stock: 8,
            imageUrl: getImageUrl('gaming-laptop', 'gaminglaptop1'),
            position: 1,
            options: [
              {
                attributeId: colorAttr._id,
                attributeKey: 'color',
                value: 'black',
              },
            ],
          },
        ],
      },
      
      // 2. Wireless Mouse (Electronics)
      {
        brandId: brandMap.sony || null,
        skuPrefix: 'MOUSE-WL',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.electronics],
        primaryCategoryId: categoryMap.electronics,
        attributeIds: [colorAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Wireless Gaming Mouse',
            slug: 'wireless-gaming-mouse',
            subtitle: 'Precision and speed',
            descriptionHtml: '<p>Wireless Gaming Mouse offers precision tracking and fast response time for gaming.</p>',
            seoTitle: 'Wireless Gaming Mouse - Computer Accessories',
            seoDescription: 'Buy Wireless Gaming Mouse',
          },
          {
            locale: 'hy',
            title: 'Անլար Խաղային Մկնիկ',
            slug: 'wireless-gaming-mouse',
            subtitle: 'Ճշգրտություն և արագություն',
            descriptionHtml: '<p>Անլար Խաղային Մկնիկը առաջարկում է ճշգրտ հետևում և արագ արձագանքման ժամանակ խաղերի համար:</p>',
            seoTitle: 'Անլար Խաղային Մկնիկ - Համակարգչային պարագաներ',
            seoDescription: 'Գնեք Անլար Խաղային Մկնիկ',
          },
        ],
        variants: [
          {
            sku: `MOUSE-WL-${Date.now()}-1`,
            price: 35000,
            compareAtPrice: 45000,
            stock: 25,
            imageUrl: getImageUrl('mouse', 'gamingmouse1'),
            position: 1,
            options: [
              {
                attributeId: colorAttr._id,
                attributeKey: 'color',
                value: 'black',
              },
            ],
          },
        ],
      },
      
      // 3. Running Shorts (Clothing > Sportswear)
      {
        brandId: brandMap.nike || null,
        skuPrefix: 'NIKE-SH',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.sportswear],
        primaryCategoryId: categoryMap.sportswear,
        attributeIds: [sizeAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Nike Running Shorts',
            slug: 'nike-running-shorts',
            subtitle: 'Lightweight and breathable',
            descriptionHtml: '<p>Nike Running Shorts are lightweight and breathable for comfortable running.</p>',
            seoTitle: 'Nike Running Shorts - Sportswear',
            seoDescription: 'Buy Nike Running Shorts',
          },
          {
            locale: 'hy',
            title: 'Nike Վազքի Շորտեր',
            slug: 'nike-running-shorts',
            subtitle: 'Թեթև և օդափոխվող',
            descriptionHtml: '<p>Nike Վազքի Շորտերը թեթև են և օդափոխվող հարմարավետ վազքի համար:</p>',
            seoTitle: 'Nike Վազքի Շորտեր - Սպորտային հագուստ',
            seoDescription: 'Գնեք Nike Վազքի Շորտեր',
          },
        ],
        variants: [
          {
            sku: `NIKE-SH-${Date.now()}-1`,
            price: 22000,
            compareAtPrice: 28000,
            stock: 30,
            imageUrl: getImageUrl('shorts', 'nikerunningshorts1'),
            position: 1,
            options: [
              {
                attributeId: sizeAttr._id,
                attributeKey: 'size',
                value: 'm',
              },
            ],
          },
        ],
      },
      
      // 4. Desk Lamp (Home & Living)
      {
        brandId: null,
        skuPrefix: 'LAMP-DSK',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.home],
        primaryCategoryId: categoryMap.home,
        attributeIds: [colorAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Modern Desk Lamp',
            slug: 'modern-desk-lamp',
            subtitle: 'Adjustable LED lighting',
            descriptionHtml: '<p>Modern Desk Lamp features adjustable LED lighting for your workspace.</p>',
            seoTitle: 'Modern Desk Lamp - Home Decor',
            seoDescription: 'Buy Modern Desk Lamp',
          },
          {
            locale: 'hy',
            title: 'Ժամանակակից Գրասեղանի Լամպ',
            slug: 'modern-desk-lamp',
            subtitle: 'Կարգավորելի LED լուսավորություն',
            descriptionHtml: '<p>Ժամանակակից Գրասեղանի Լամպը ունի կարգավորելի LED լուսավորություն ձեր աշխատատեղի համար:</p>',
            seoTitle: 'Ժամանակակից Գրասեղանի Լամպ - Տան դեկոր',
            seoDescription: 'Գնեք Ժամանակակից Գրասեղանի Լամպ',
          },
        ],
        variants: [
          {
            sku: `LAMP-DSK-${Date.now()}-1`,
            price: 28000,
            compareAtPrice: 35000,
            stock: 20,
            imageUrl: getImageUrl('lamp', 'desklamp1'),
            position: 1,
            options: [
              {
                attributeId: colorAttr._id,
                attributeKey: 'color',
                value: 'white',
              },
            ],
          },
        ],
      },
      
      // 5. Lipstick (Beauty & Cosmetics)
      {
        brandId: brandMap.loreal || null,
        skuPrefix: 'LIP-STK',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.beauty],
        primaryCategoryId: categoryMap.beauty,
        attributeIds: [colorAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Long-Lasting Lipstick',
            slug: 'long-lasting-lipstick',
            subtitle: '24-hour color',
            descriptionHtml: '<p>Long-Lasting Lipstick provides vibrant color that lasts up to 24 hours.</p>',
            seoTitle: 'Long-Lasting Lipstick - Makeup',
            seoDescription: 'Buy Long-Lasting Lipstick',
          },
          {
            locale: 'hy',
            title: 'Երկարատև Սնկեր',
            slug: 'long-lasting-lipstick',
            subtitle: '24-ժամյա գույն',
            descriptionHtml: '<p>Երկարատև Սնկերը ապահովում է վառ գույն, որը տևում է մինչև 24 ժամ:</p>',
            seoTitle: 'Երկարատև Սնկեր - Մեյք-ափ',
            seoDescription: 'Գնեք Երկարատև Սնկեր',
          },
        ],
        variants: [
          {
            sku: `LIP-STK-${Date.now()}-1`,
            price: 12000,
            compareAtPrice: 15000,
            stock: 45,
            imageUrl: getImageUrl('lipstick', 'lipstick1'),
            position: 1,
            options: [
              {
                attributeId: colorAttr._id,
                attributeKey: 'color',
                value: 'red',
              },
            ],
          },
        ],
      },
      
      // 6. Mystery Novel (Books)
      {
        brandId: null,
        skuPrefix: 'BOOK-MYS',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.books],
        primaryCategoryId: categoryMap.books,
        attributeIds: [],
        translations: [
          {
            locale: 'en',
            title: 'Mystery Thriller Novel',
            slug: 'mystery-thriller-novel',
            subtitle: 'Gripping suspense story',
            descriptionHtml: '<p>Mystery Thriller Novel takes you on a thrilling journey with unexpected twists.</p>',
            seoTitle: 'Mystery Thriller Novel - Books',
            seoDescription: 'Buy Mystery Thriller Novel',
          },
          {
            locale: 'hy',
            title: 'Դետեկտիվ Թրիլեր',
            slug: 'mystery-thriller-novel',
            subtitle: 'Գրավիչ սասպենս պատմություն',
            descriptionHtml: '<p>Դետեկտիվ Թրիլերը ձեզ տանում է արկածային ճանապարհորդության անսպասելի շրջադարձերով:</p>',
            seoTitle: 'Դետեկտիվ Թրիլեր - Գրքեր',
            seoDescription: 'Գնեք Դետեկտիվ Թրիլեր',
          },
        ],
        variants: [
          {
            sku: `BOOK-MYS-${Date.now()}-1`,
            price: 9500,
            compareAtPrice: 12000,
            stock: 55,
            imageUrl: getImageUrl('book', 'mysterybook1'),
            position: 1,
            options: [],
          },
        ],
      },
      
      // 7. Yoga Mat (Home & Living / Sportswear)
      {
        brandId: brandMap.puma || null,
        skuPrefix: 'YOGA-MAT',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.sportswear],
        primaryCategoryId: categoryMap.sportswear,
        attributeIds: [colorAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Premium Yoga Mat',
            slug: 'premium-yoga-mat',
            subtitle: 'Non-slip and comfortable',
            descriptionHtml: '<p>Premium Yoga Mat provides excellent grip and cushioning for yoga practice.</p>',
            seoTitle: 'Premium Yoga Mat - Fitness',
            seoDescription: 'Buy Premium Yoga Mat',
          },
          {
            locale: 'hy',
            title: 'Պրեմիում Յոգայի Գորգ',
            slug: 'premium-yoga-mat',
            subtitle: 'Ոչ սահող և հարմարավետ',
            descriptionHtml: '<p>Պրեմիում Յոգայի Գորգը ապահովում է գերազանց բռնում և բարձիկավորում յոգայի պրակտիկայի համար:</p>',
            seoTitle: 'Պրեմիում Յոգայի Գորգ - Ֆիտնես',
            seoDescription: 'Գնեք Պրեմիում Յոգայի Գորգ',
          },
        ],
        variants: [
          {
            sku: `YOGA-MAT-${Date.now()}-1`,
            price: 18000,
            compareAtPrice: 25000,
            stock: 35,
            imageUrl: getImageUrl('yoga', 'yogamat1'),
            position: 1,
            options: [
              {
                attributeId: colorAttr._id,
                attributeKey: 'color',
                value: 'blue',
              },
            ],
          },
        ],
      },
      
      // 8. Smart TV (Electronics)
      {
        brandId: brandMap.samsung || null,
        skuPrefix: 'TV-SMART',
        published: true,
        featured: true,
        publishedAt: new Date(),
        categoryIds: [categoryMap.electronics],
        primaryCategoryId: categoryMap.electronics,
        attributeIds: [],
        translations: [
          {
            locale: 'en',
            title: '55" Smart TV',
            slug: '55-smart-tv',
            subtitle: '4K Ultra HD display',
            descriptionHtml: '<p>55" Smart TV features 4K Ultra HD display and smart features for streaming.</p>',
            seoTitle: '55" Smart TV - Electronics',
            seoDescription: 'Buy 55" Smart TV',
          },
          {
            locale: 'hy',
            title: '55" Սմարթ TV',
            slug: '55-smart-tv',
            subtitle: '4K Ultra HD էկրան',
            descriptionHtml: '<p>55" Սմարթ TV-ն ունի 4K Ultra HD էկրան և սմարթ հնարավորություններ սթրիմինգի համար:</p>',
            seoTitle: '55" Սմարթ TV - Էլեկտրոնիկա',
            seoDescription: 'Գնեք 55" Սմարթ TV',
          },
        ],
        variants: [
          {
            sku: `TV-SMART-${Date.now()}-1`,
            price: 499000,
            compareAtPrice: 599000,
            stock: 12,
            imageUrl: getImageUrl('tv', 'smarttv1'),
            position: 1,
            options: [],
          },
        ],
      },
      
      // 9. Winter Jacket (Clothing)
      {
        brandId: brandMap.adidas || null,
        skuPrefix: 'JACKET-W',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.clothing],
        primaryCategoryId: categoryMap.clothing,
        attributeIds: [colorAttr._id, sizeAttr._id],
        translations: [
          {
            locale: 'en',
            title: 'Winter Warm Jacket',
            slug: 'winter-warm-jacket',
            subtitle: 'Insulated and waterproof',
            descriptionHtml: '<p>Winter Warm Jacket provides excellent insulation and waterproof protection.</p>',
            seoTitle: 'Winter Warm Jacket - Clothing',
            seoDescription: 'Buy Winter Warm Jacket',
          },
          {
            locale: 'hy',
            title: 'Ձմեռային Ջերմ Բաճկոն',
            slug: 'winter-warm-jacket',
            subtitle: 'Մեկուսացված և ջրակայուն',
            descriptionHtml: '<p>Ձմեռային Ջերմ Բաճկոնը ապահովում է գերազանց մեկուսացում և ջրակայուն պաշտպանություն:</p>',
            seoTitle: 'Ձմեռային Ջերմ Բաճկոն - Հագուստ',
            seoDescription: 'Գնեք Ձմեռային Ջերմ Բաճկոն',
          },
        ],
        variants: [
          {
            sku: `JACKET-W-${Date.now()}-1`,
            price: 85000,
            compareAtPrice: 110000,
            stock: 18,
            imageUrl: getImageUrl('jacket', 'winterjacket1'),
            position: 1,
            options: [
              {
                attributeId: colorAttr._id,
                attributeKey: 'color',
                value: 'black',
              },
              {
                attributeId: sizeAttr._id,
                attributeKey: 'size',
                value: 'l',
              },
            ],
          },
        ],
      },
      
      // 10. Face Cream (Beauty & Cosmetics)
      {
        brandId: brandMap.loreal || null,
        skuPrefix: 'CREAM-FC',
        published: true,
        featured: false,
        publishedAt: new Date(),
        categoryIds: [categoryMap.beauty],
        primaryCategoryId: categoryMap.beauty,
        attributeIds: [],
        translations: [
          {
            locale: 'en',
            title: 'Anti-Aging Face Cream',
            slug: 'anti-aging-face-cream',
            subtitle: 'Hydrating and rejuvenating',
            descriptionHtml: '<p>Anti-Aging Face Cream provides deep hydration and helps reduce fine lines.</p>',
            seoTitle: 'Anti-Aging Face Cream - Skincare',
            seoDescription: 'Buy Anti-Aging Face Cream',
          },
          {
            locale: 'hy',
            title: 'Հակա-Տարիքային Դեմքի Կրեմ',
            slug: 'anti-aging-face-cream',
            subtitle: 'Հիդրատացնող և վերակենդանացնող',
            descriptionHtml: '<p>Հակա-Տարիքային Դեմքի Կրեմը ապահովում է խորը հիդրատացում և օգնում է նվազեցնել նուրբ գծերը:</p>',
            seoTitle: 'Հակա-Տարիքային Դեմքի Կրեմ - Մաշկի խնամք',
            seoDescription: 'Գնեք Հակա-Տարիքային Դեմքի Կրեմ',
          },
        ],
        variants: [
          {
            sku: `CREAM-FC-${Date.now()}-1`,
            price: 25000,
            compareAtPrice: 32000,
            stock: 40,
            imageUrl: getImageUrl('cream', 'facecream1'),
            position: 1,
            options: [],
          },
        ],
      },
    ];
    
    // Insert products
    const createdProducts = await Product.insertMany(newProducts);
    console.log(`\n✅ Successfully created ${createdProducts.length} new products!`);
    
    // Summary
    console.log('\n📊 New Products Summary:');
    createdProducts.forEach((product, index) => {
      const enTranslation = product.translations?.find(t => t.locale === 'en');
      console.log(`   ${index + 1}. ${enTranslation?.title || 'N/A'} (${enTranslation?.slug || 'N/A'})`);
    });
    
    console.log('\n✅ All products added successfully!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error adding products:', error);
    console.error('Stack trace:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run script
add10Products();

