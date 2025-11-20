const Category = require('../models/Category');
const { safeRedis } = require('../lib/redis');

const categoriesController = {
  /**
   * Get category tree
   * GET /api/v1/categories/tree?lang=
   */
  async getTree(req, res, next) {
    try {
      const { lang = 'en' } = req.query;

      const cacheKey = `categories:tree:${lang}`;
      const cached = await safeRedis.get(cacheKey);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const categories = await Category.find({
        published: true,
        deletedAt: null,
      })
        .sort({ position: 1 })
        .lean();

      // Build tree structure
      const categoryMap = new Map();
      const rootCategories = [];

      categories.forEach((category) => {
        const translation = category.translations?.find((t) => t.locale === lang) || category.translations?.[0];
        if (!translation) return;

        const categoryData = {
          id: category._id.toString(),
          slug: translation.slug,
          title: translation.title,
          fullPath: translation.fullPath,
          children: [],
        };

        categoryMap.set(category._id.toString(), categoryData);

        if (!category.parentId) {
          rootCategories.push(categoryData);
        }
      });

      // Build parent-child relationships
      categories.forEach((category) => {
        if (category.parentId) {
          const parent = categoryMap.get(category.parentId.toString());
          const child = categoryMap.get(category._id.toString());
          if (parent && child) {
            parent.children.push(child);
          }
        }
      });

      const response = {
        data: rootCategories,
      };

      // Cache for 1 hour
      await safeRedis.setex(cacheKey, 3600, JSON.stringify(response));

      res.json(response);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get category by slug
   * GET /api/v1/categories/:slug?lang=
   */
  async findBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const { lang = 'en' } = req.query;

      const cacheKey = `category:${slug}:${lang}`;
      const cached = await safeRedis.get(cacheKey);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const category = await Category.findOne({
        'translations.slug': slug,
        'translations.locale': lang,
        published: true,
        deletedAt: null,
      })
        .populate('parentId')
        .lean();

      if (!category) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Category not found',
          status: 404,
          detail: `Category with slug '${slug}' does not exist or is not published`,
          instance: req.path,
        });
      }

      const translation = category.translations?.find((t) => t.locale === lang) || category.translations?.[0];
      const parentTranslation = category.parentId?.translations?.find((t) => t.locale === lang) || category.parentId?.translations?.[0];

      const response = {
        id: category._id.toString(),
        slug: translation?.slug || '',
        title: translation?.title || '',
        description: translation?.description,
        fullPath: translation?.fullPath || '',
        seo: {
          title: translation?.seoTitle || translation?.title,
          description: translation?.seoDescription,
        },
        parent: category.parentId
          ? {
              id: category.parentId._id.toString(),
              slug: parentTranslation?.slug || '',
              title: parentTranslation?.title || '',
            }
          : null,
      };

      // Cache for 1 hour
      await safeRedis.setex(cacheKey, 3600, JSON.stringify(response));

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = categoriesController;
