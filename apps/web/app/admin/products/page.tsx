'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';

interface Product {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  price: number;
  stock: number;
  colorStocks?: Array<{
    color: string;
    stock: number;
  }>;
  image: string | null;
  createdAt: string;
}

interface ProductsResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface Category {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
}

export default function ProductsPage() {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ProductsResponse['meta'] | null>(null);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt-desc');

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn || !isAdmin) {
        router.push('/admin');
        return;
      }
    }
  }, [isLoggedIn, isAdmin, isLoading, router]);

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      fetchCategories();
    }
  }, [isLoggedIn, isAdmin]);

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isAdmin, page, search, categorySearch, skuSearch, sortBy, minPrice, maxPrice]);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get<{ data: Category[] }>('/api/v1/admin/categories');
      setCategories(response.data || []);
    } catch (err) {
      console.error('❌ [ADMIN] Error fetching categories:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };
      
      if (search.trim()) {
        params.search = search.trim();
      }

      if (categorySearch.trim()) {
        params.category = categorySearch.trim();
      }

      if (skuSearch.trim()) {
        params.sku = skuSearch.trim();
      }

      if (minPrice.trim()) {
        params.minPrice = minPrice.trim();
      }

      if (maxPrice.trim()) {
        params.maxPrice = maxPrice.trim();
      }

      if (sortBy) {
        params.sort = sortBy;
      }

      const response = await apiClient.get<ProductsResponse>('/api/v1/admin/products', {
        params,
      });
      
      setProducts(response.data || []);
      setMeta(response.meta || null);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching products:', err);
      alert(`Error loading products: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handlePriceFilter = () => {
    setPage(1);
    fetchProducts();
  };

  const handleClearPriceFilter = () => {
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
    // fetchProducts will be called automatically by useEffect
  };

  const handleDeleteProduct = async (productId: string, productTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${productTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/admin/products/${productId}`);
      console.log('✅ [ADMIN] Product deleted successfully');
      
      // Refresh products list
      fetchProducts();
      
      alert('Product deleted successfully');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error deleting product:', err);
      alert(`Error deleting product: ${err.message || 'Unknown error'}`);
    }
  };

  const handleTogglePublished = async (productId: string, currentStatus: boolean, productTitle: string) => {
    try {
      const newStatus = !currentStatus;
      
      // Получаем полный продукт, чтобы сохранить все его данные, включая media
      let existingMedia: string[] = [];
      try {
        const fullProduct = await apiClient.get(`/api/v1/admin/products/${productId}`);
        if (fullProduct.media && Array.isArray(fullProduct.media)) {
          existingMedia = fullProduct.media;
          console.log('📸 [ADMIN] Found existing media:', existingMedia);
        }
      } catch (fetchErr) {
        console.warn('⚠️ [ADMIN] Could not fetch full product, using current product data:', fetchErr);
        // Если не удалось получить полный продукт, используем данные из списка
        const currentProduct = products.find(p => p.id === productId);
        if (currentProduct?.image) {
          existingMedia = [currentProduct.image];
        }
      }
      
      // Подготавливаем данные для обновления
      const updateData: any = {
        published: newStatus,
      };
      
      // Сохраняем существующие media, чтобы они не пропали
      if (existingMedia.length > 0) {
        updateData.media = existingMedia;
        console.log('📸 [ADMIN] Preserving media:', existingMedia);
      }
      
      await apiClient.put(`/api/v1/admin/products/${productId}`, updateData);
      
      console.log(`✅ [ADMIN] Product ${newStatus ? 'published' : 'unpublished'} successfully`);
      
      // Refresh products list
      fetchProducts();
      
      if (newStatus) {
        alert(`Product "${productTitle}" is now published and visible!`);
      } else {
        alert(`Product "${productTitle}" is now draft and hidden.`);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN] Error updating product status:', err);
      alert(`Error updating product status: ${err.message || 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin Panel
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <Button
              variant="primary"
              onClick={() => router.push('/admin/products/add')}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Product
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <Card className="p-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or slug..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button type="submit" variant="primary">
                  Search
                </Button>
                {(search || categorySearch || skuSearch) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSearch('');
                      setCategorySearch('');
                      setSkuSearch('');
                      setPage(1);
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </div>
              
              {/* Category and SKU Search */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search by Category
                  </label>
                  <select
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search by SKU
                  </label>
                  <input
                    type="text"
                    value={skuSearch}
                    onChange={(e) => {
                      setSkuSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Enter SKU code..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </form>
          </Card>

          {/* Sort Options */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Sort Products</h3>
            <div className="flex items-center gap-3">
              <label className="block text-xs font-medium text-gray-700">
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="title-asc">Title: A to Z</option>
                <option value="title-desc">Title: Z to A</option>
              </select>
            </div>
          </Card>

          {/* Analytics */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Analytics</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Price (AMD)
                </label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="100"
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max Price (AMD)
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="1000"
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handlePriceFilter}
                disabled={!minPrice && !maxPrice}
              >
                Apply Filter
              </Button>
              {(minPrice || maxPrice) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearPriceFilter}
                >
                  Clear
                </Button>
              )}
            </div>
            {(minPrice || maxPrice) && (
              <div className="mt-2 text-xs text-gray-600">
                Filtering by price range: {minPrice || '0'} - {maxPrice || '∞'} AMD
              </div>
            )}
          </Card>
        </div>

        {/* Products Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No products found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Colors & Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {product.image && (
                              <img
                                src={product.image}
                                alt={product.title}
                                className="h-12 w-12 rounded object-cover mr-3"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.title}</div>
                              <div className="text-sm text-gray-500">{product.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {product.colorStocks && product.colorStocks.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {product.colorStocks.map((colorStock) => (
                                <div
                                  key={colorStock.color}
                                  className="px-3 py-1 bg-gray-100 rounded-lg text-sm"
                                >
                                  <span className="font-medium text-gray-900">{colorStock.color}:</span>
                                  <span className="ml-1 text-gray-600">{colorStock.stock} հատ</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">
                              {product.stock > 0 ? `${product.stock} հատ` : '0 հատ'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Intl.NumberFormat('hy-AM', {
                              style: 'currency',
                              currency: 'AMD',
                              minimumFractionDigits: 0,
                            }).format(product.price)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            onClick={() => handleTogglePublished(product.id, product.published, product.title)}
                            className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer transition-all duration-200 ${
                              product.published
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                            title={product.published ? 'Click to unpublish' : 'Click to publish'}
                          >
                            {product.published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(product.createdAt).toLocaleDateString('hy-AM')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/admin/products/add?id=${product.id}`)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProduct(product.id, product.title)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing page {meta.page} of {meta.totalPages} ({meta.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                      disabled={page === meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

