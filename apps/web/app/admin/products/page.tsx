'use client';

import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';

interface Product {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  featured?: boolean;
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

export default function ProductsPage() {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ProductsResponse['meta'] | null>(null);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt-desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [togglingAllFeatured, setTogglingAllFeatured] = useState(false);

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
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isAdmin, page, search, categorySearch, skuSearch, sortBy, minPrice, maxPrice]);


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

      // Սերվերը հիմա աջակցում է միայն createdAt դաշտով սորտավորում
      if (sortBy && sortBy.startsWith('createdAt')) {
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

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (products.length === 0) return;
    setSelectedIds(prev => {
      const allIds = products.map(p => p.id);
      const hasAll = allIds.every(id => prev.has(id));
      return hasAll ? new Set() : new Set(allIds);
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected products?`)) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map(id => apiClient.delete(`/api/v1/admin/products/${id}`))
      );
      const failed = results.filter(r => r.status === 'rejected');
      setSelectedIds(new Set());
      await fetchProducts();
      alert(`Bulk delete finished. Success: ${ids.length - failed.length}/${ids.length}`);
    } catch (err) {
      console.error('❌ [ADMIN] Bulk delete products error:', err);
      alert('Failed to delete selected products');
    } finally {
      setBulkDeleting(false);
    }
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

  // Լոկալ (client-side) սորտավորում Product / Price սյունակների համար
  const sortedProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];

    // Եթե սորտը createdAt-ով է, թողնում ենք ինչպես սերվերն է բերել
    if (!sortBy || sortBy.startsWith('createdAt')) {
      return products;
    }

    const [field, directionRaw] = sortBy.split('-');
    const direction = directionRaw === 'asc' ? 1 : -1;

    console.log('📊 [ADMIN] Applying client-side sort:', { field, direction: directionRaw });

    const cloned = [...products];

    if (field === 'price') {
      cloned.sort((a, b) => {
        const aPrice = a.price ?? 0;
        const bPrice = b.price ?? 0;
        if (aPrice === bPrice) return 0;
        return aPrice > bPrice ? direction : -direction;
      });
    } else if (field === 'title') {
      cloned.sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        if (aTitle === bTitle) return 0;
        return aTitle > bTitle ? direction : -direction;
      });
    }

    return cloned;
  }, [products, sortBy]);

  /**
   * Սորտավորում սյունակի վերնագրերի սեղմման ժամանակ
   * field === 'price' → price-asc / price-desc
   * field === 'createdAt' → createdAt-asc / createdAt-desc
   * field === 'title' → title-asc / title-desc
   */
  const handleHeaderSort = (field: 'price' | 'createdAt' | 'title') => {
    setPage(1);

    setSortBy((current) => {
      let next = current;

      if (field === 'price') {
        if (current === 'price-asc') {
          next = 'price-desc';
        } else {
          next = 'price-asc';
        }
      }

      if (field === 'createdAt') {
        if (current === 'createdAt-asc') {
          next = 'createdAt-desc';
        } else {
          next = 'createdAt-asc';
        }
      }

      if (field === 'title') {
        if (current === 'title-asc') {
          next = 'title-desc';
        } else {
          next = 'title-asc';
        }
      }

      console.log('📊 [ADMIN] Sort changed from', current, 'to', next, 'by header click');
      return next;
    });
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
      
      // При изменении только статуса published, отправляем только статус
      // Это позволяет избежать проблем с валидацией вариантов (например, требование размеров)
      // Варианты и другие данные останутся без изменений на сервере
      const updateData = {
        published: newStatus,
      };
      
      console.log(`🔄 [ADMIN] Updating product status to ${newStatus ? 'published' : 'draft'}`);
      
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

  const handleToggleFeatured = async (productId: string, currentStatus: boolean, productTitle: string) => {
    try {
      const newStatus = !currentStatus;
      
      const updateData = {
        featured: newStatus,
      };
      
      console.log(`⭐ [ADMIN] Updating product featured status to ${newStatus ? 'featured' : 'not featured'}`);
      
      await apiClient.put(`/api/v1/admin/products/${productId}`, updateData);
      
      console.log(`✅ [ADMIN] Product ${newStatus ? 'marked as featured' : 'removed from featured'} successfully`);
      
      // Refresh products list
      fetchProducts();
    } catch (err: any) {
      console.error('❌ [ADMIN] Error updating product featured status:', err);
      alert(`Error updating featured status: ${err.message || 'Unknown error'}`);
    }
  };

  const handleToggleAllFeatured = async () => {
    if (products.length === 0) return;

    // Check if all products are featured
    const allFeatured = products.every(p => p.featured);
    const newStatus = !allFeatured;

    setTogglingAllFeatured(true);
    try {
      const results = await Promise.allSettled(
        products.map(product => 
          apiClient.put(`/api/v1/admin/products/${product.id}`, { featured: newStatus })
        )
      );
      
      const failed = results.filter(r => r.status === 'rejected');
      const successCount = products.length - failed.length;
      
      console.log(`✅ [ADMIN] Toggle all featured completed: ${successCount}/${products.length} successful`);
      
      // Refresh products list
      await fetchProducts();
      
      if (failed.length > 0) {
        alert(`Featured toggle finished. Success: ${successCount}/${products.length}. Some products failed to update.`);
      }
    } catch (err) {
      console.error('❌ [ADMIN] Toggle all featured error:', err);
      alert('Failed to update featured status for products');
    } finally {
      setTogglingAllFeatured(false);
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
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Enter category ID..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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

        </div>

        {/* Products Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No products found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all products"
                          checked={products.length > 0 && products.every(p => selectedIds.has(p.id))}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort('title')}
                          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800"
                        >
                          <span>Product</span>
                          <span className="flex flex-col leading-none text-[10px] text-gray-400">
                            <span
                              className={
                                sortBy === 'title-asc'
                                  ? 'text-gray-900'
                                  : ''
                              }
                            >
                              ▲
                            </span>
                            <span
                              className={
                                sortBy === 'title-desc'
                                  ? 'text-gray-900'
                                  : ''
                              }
                            >
                              ▼
                            </span>
                          </span>
                        </button> 
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort('price')}
                          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800"
                        >
                          <span>Price</span>
                          <span className="flex flex-col leading-none text-[10px] text-gray-400">
                            <span
                              className={
                                sortBy === 'price-asc'
                                  ? 'text-gray-900'
                                  : ''
                              }
                            >
                              ▲
                            </span>
                            <span
                              className={
                                sortBy === 'price-desc'
                                  ? 'text-gray-900'
                                  : ''
                              }
                            >
                              ▼
                            </span>
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Featured
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleHeaderSort('createdAt')}
                          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800"
                        >
                          <span>Created</span>
                          <span className="flex flex-col leading-none text-[10px] text-gray-400">
                            <span
                              className={
                                sortBy === 'createdAt-asc'
                                  ? 'text-gray-900'
                                  : ''
                              }
                            >
                              ▲
                            </span>
                            <span
                              className={
                                sortBy === 'createdAt-desc'
                                  ? 'text-gray-900'
                                  : ''
                              }
                            >
                              ▼
                            </span>
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Select product ${product.title}`}
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleSelect(product.id)}
                          />
                        </td>
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
                          {product.colorStocks && product.  colorStocks.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {product.colorStocks.map((colorStock) => (
                                <div
                                  key={colorStock.color}
                                  className="px-3 py-1 bg-gray-100 rounded-lg text-sm"
                                >
                                  <span className="font-medium text-gray-900">{colorStock.color}:</span>
                                  <span className="ml-1 text-gray-600">{colorStock.stock} pcs</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">
                              {product.stock > 0 ? `${product.stock} pcs` : '0 pcs'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
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
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleToggleFeatured(product.id, product.featured || false, product.title)}
                            className="inline-flex items-center justify-center w-8 h-8 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                            title={product.featured ? 'Click to remove from featured' : 'Click to mark as featured'}
                          >
                            <svg
                              className={`w-6 h-6 transition-all duration-200 ${
                                product.featured
                                  ? 'fill-blue-500 text-blue-500 drop-shadow-sm'
                                  : 'fill-none stroke-blue-400 text-blue-400 opacity-50 hover:opacity-75'
                              }`}
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </button>
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
              <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">Selected {selectedIds.size} products</div>
                <Button
                  variant="outline"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0 || bulkDeleting}
                >
                  {bulkDeleting ? 'Deleting...' : 'Delete selected'}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

