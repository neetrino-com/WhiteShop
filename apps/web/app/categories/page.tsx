'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@shop/ui';
import { apiClient } from '../../lib/api-client';
import { getStoredLanguage } from '../../lib/language';
import { useTranslation } from '../../lib/i18n-client';

interface Category {
  id: string;
  slug: string;
  title: string;
  fullPath: string;
  children: Category[];
}

interface CategoriesResponse {
  data: Category[];
}

interface ProductsResponse {
  data: unknown[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function CategoriesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const language = getStoredLanguage();
      const response = await apiClient.get<CategoriesResponse>('/api/v1/categories/tree', {
        params: { lang: language },
      });

      const categoriesList = response.data || [];
      setCategories(categoriesList);

      // Fetch product counts for each category
      const counts: Record<string, number> = {};
      for (const category of categoriesList) {
        try {
          const productsResponse = await apiClient.get<ProductsResponse>('/api/v1/products', {
            params: {
              category: category.slug,
              limit: '1',
              lang: language,
            },
          });
          counts[category.slug] = productsResponse.meta?.total || 0;
        } catch (err) {
          console.error(`Error fetching products for category ${category.slug}:`, err);
          counts[category.slug] = 0;
        }
      }
      setProductCounts(counts);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categorySlug: string) => {
    router.push(`/products?category=${categorySlug}`);
  };

  // Flatten categories tree to show all categories
  const flattenCategories = (cats: Category[]): Category[] => {
    const result: Category[] = [];
    cats.forEach((cat) => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children));
      }
    });
    return result;
  };

  const allCategories = flattenCategories(categories);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('categories.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('categories.title')}</h1>
      <p className="text-gray-600 mb-8">
        {t('categories.description')}
      </p>
      
      {allCategories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">{t('categories.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allCategories.map((category) => (
            <Card
              key={category.id}
              onClick={() => handleCategoryClick(category.slug)}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {category.title}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {productCounts[category.slug] || 0} {t('categories.productsCount')}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

