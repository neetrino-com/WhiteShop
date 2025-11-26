'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';

export default function QuickSettingsPage() {
  const { isLoggedIn, isAdmin, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productDiscounts, setProductDiscounts] = useState<Record<string, number>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      console.log('⚙️ [QUICK SETTINGS] Fetching settings...');
      setDiscountLoading(true);
      const settings = await apiClient.get<{ globalDiscount: number }>('/api/v1/admin/settings');
      setGlobalDiscount(settings.globalDiscount || 0);
      console.log('✅ [QUICK SETTINGS] Settings loaded:', settings);
    } catch (err: any) {
      console.error('❌ [QUICK SETTINGS] Error fetching settings:', err);
      setGlobalDiscount(0);
    } finally {
      setDiscountLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      console.log('📦 [QUICK SETTINGS] Fetching products...');
      setProductsLoading(true);
      const response = await apiClient.get<{ data: any[] }>('/api/v1/admin/products', {
        params: { limit: '1000' }, // Get all products
      });
      if (response?.data && Array.isArray(response.data)) {
        setProducts(response.data);
        // Initialize product discounts from API data
        const discounts: Record<string, number> = {};
        response.data.forEach((product: any) => {
          discounts[product.id] = product.discountPercent || 0;
        });
        setProductDiscounts(discounts);
        console.log('✅ [QUICK SETTINGS] Products loaded:', response.data.length);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('❌ [QUICK SETTINGS] Error fetching products:', err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const handleDiscountSave = async () => {
    const discountValue = parseFloat(globalDiscount.toString());
    if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
      alert('Discount must be between 0-100');
      return;
    }

    setDiscountSaving(true);
    try {
      console.log('⚙️ [QUICK SETTINGS] Saving global discount...', discountValue);
      await apiClient.put('/api/v1/admin/settings', {
        globalDiscount: discountValue,
      });
      
      // Refresh products to get updated labels with new discount percentage
      await fetchProducts();
      
      alert('Discount saved successfully!');
      console.log('✅ [QUICK SETTINGS] Global discount saved');
    } catch (err: any) {
      console.error('❌ [QUICK SETTINGS] Error saving discount:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save';
      alert(`Error: ${errorMessage}`);
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleProductDiscountSave = async (productId: string) => {
    const discountValue = productDiscounts[productId] || 0;
    if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
      alert('Discount must be between 0-100');
      return;
    }

    setSavingProductId(productId);
    try {
      console.log('⚙️ [QUICK SETTINGS] Saving product discount only...', productId, discountValue);
      
      // Используем специальный endpoint, который обновляет только discountPercent
      // Это гарантирует, что все остальные поля (media, variants, price и т.д.) останутся без изменений
      const updateData = {
        discountPercent: discountValue,
      };
      
      console.log('📤 [QUICK SETTINGS] Sending update data to discount endpoint:', updateData);
      
      await apiClient.patch(`/api/v1/admin/products/${productId}/discount`, updateData);
      
      // Refresh products to get updated labels with new discount percentage
      await fetchProducts();
      
      alert('Product discount saved successfully!');
      console.log('✅ [QUICK SETTINGS] Product discount saved');
    } catch (err: any) {
      console.error('❌ [QUICK SETTINGS] Error saving product discount:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSavingProductId(null);
    }
  };

  useEffect(() => {
    if (!isLoading && isLoggedIn && isAdmin) {
      fetchSettings();
      fetchProducts();
    }
  }, [isLoading, isLoggedIn, isAdmin, fetchSettings, fetchProducts]);

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn) {
        console.log('❌ [QUICK SETTINGS] User not logged in, redirecting to login...');
        router.push('/login');
        return;
      }
      if (!isAdmin) {
        console.log('❌ [QUICK SETTINGS] User is not admin, redirecting to home...');
        router.push('/');
        return;
      }
    }
  }, [isLoggedIn, isAdmin, isLoading, router]);

  // Get current path to highlight active tab
  const [currentPath, setCurrentPath] = useState(pathname || '/admin');
  
  useEffect(() => {
    if (pathname) {
      setCurrentPath(pathname);
    }
  }, [pathname]);

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
    return null; // Will redirect
  }

  const adminTabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/admin',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'orders',
      label: 'Orders',
      path: '/admin/orders',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: 'products',
      label: 'Products',
      path: '/admin/products',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'users',
      label: 'Users',
      path: '/admin/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'quick-settings',
      label: 'Quick Settings',
      path: '/admin/quick-settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/admin/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quick Settings</h1>
          <p className="text-gray-600 mt-2">Quick settings and discount management</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <nav className="bg-white border border-gray-200 rounded-lg p-2 space-y-1">
              {adminTabs.map((tab) => {
                const isActive = currentPath === tab.path || 
                  (tab.path === '/admin' && currentPath === '/admin') ||
                  (tab.path !== '/admin' && currentPath.startsWith(tab.path));
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      router.push(tab.path);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`}>
                      {tab.icon}
                    </span>
                    <span className="text-left">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Quick Settings - Discount Management */}
            <Card className="p-6 mb-8 bg-white border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Quick Settings</h2>
                  <p className="text-sm text-gray-600 mt-1">Quick settings and discount management</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Global Discount */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Global Discount</h3>
                      <p className="text-xs text-gray-500">For all products</p>
                    </div>
                  </div>
                  
                  {discountLoading ? (
                    <div className="animate-pulse">
                      <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={globalDiscount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setGlobalDiscount(value === '' ? 0 : parseFloat(value) || 0);
                          }}
                          className="flex-1"
                          placeholder="0"
                        />
                        <span className="text-sm font-medium text-gray-700 w-8">%</span>
                        <Button
                          variant="primary"
                          onClick={handleDiscountSave}
                          disabled={discountSaving}
                          className="px-6"
                        >
                          {discountSaving ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Saving...</span>
                            </div>
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                      
                      {globalDiscount > 0 ? (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800">
                            <strong>Active:</strong> {globalDiscount}% discount is applied to all products
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                          <p className="text-sm text-gray-600">
                            No global discount. Enter a percentage (0-100) to give a discount to all products
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGlobalDiscount(10)}
                          className="flex-1"
                        >
                          10%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGlobalDiscount(20)}
                          className="flex-1"
                        >
                          20%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGlobalDiscount(30)}
                          className="flex-1"
                        >
                          30%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGlobalDiscount(50)}
                          className="flex-1"
                        >
                          50%
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGlobalDiscount(0)}
                          className="px-3"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Info */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Useful Information</h3>
                      <p className="text-xs text-gray-500">About discounts</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <p>The discount applies to the prices of all products</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <p>Example: 10% = all prices will decrease by 10%</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <p>0% = no discount, original prices are displayed</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <p>Changes are applied immediately</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/admin/settings')}
                      className="w-full"
                    >
                      More settings →
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Products List with Individual Discounts */}
            <Card className="p-6 bg-white border-gray-200">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Discounts</h2>
                <p className="text-sm text-gray-600">Set individual discount percentage for each product</p>
              </div>

              {productsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No products found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 p-4 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition-colors bg-blue-50/30"
                    >
                      {/* Product Image */}
                      {product.image && (
                        <div className="flex-shrink-0">
                          <img
                            src={product.image}
                            alt={product.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        </div>
                      )}

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{product.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {(() => {
                            // Get current discount from state (real-time)
                            // Use nullish coalescing to ensure we always have a number
                            const currentDiscount = Number(productDiscounts[product.id] ?? product.discountPercent ?? 0);
                            // product.price is the original price from API
                            const originalPrice = product.price || 0;
                            // Calculate discounted price in real-time
                            const discountedPrice = currentDiscount > 0 && originalPrice > 0
                              ? Math.round(originalPrice * (1 - currentDiscount / 100))
                              : originalPrice;
                            
                            return (
                              <>
                                {currentDiscount > 0 && originalPrice > 0 ? (
                                  <>
                                    <span className="text-xs font-semibold text-blue-600">
                                      {new Intl.NumberFormat('hy-AM', {
                                        style: 'currency',
                                        currency: 'AMD',
                                        minimumFractionDigits: 0,
                                      }).format(discountedPrice)}
                                    </span>
                                    <span className="text-xs text-gray-400 line-through">
                                      {new Intl.NumberFormat('hy-AM', {
                                        style: 'currency',
                                        currency: 'AMD',
                                        minimumFractionDigits: 0,
                                      }).format(originalPrice)}
                                    </span>
                                    <span className="text-xs text-red-600 font-medium">
                                      -{currentDiscount}%
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    {originalPrice > 0 ? new Intl.NumberFormat('hy-AM', {
                                      style: 'currency',
                                      currency: 'AMD',
                                      minimumFractionDigits: 0,
                                    }).format(originalPrice) : 'N/A'}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Discount Input */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={productDiscounts[product.id] ?? product.discountPercent ?? 0}
                          onChange={(e) => {
                            const value = e.target.value;
                            const discountValue = value === '' ? 0 : parseFloat(value) || 0;
                            console.log(`🔄 [QUICK SETTINGS] Updating discount for product ${product.id}: ${discountValue}%`);
                            setProductDiscounts((prev) => {
                              const updated = {
                                ...prev,
                                [product.id]: discountValue,
                              };
                              console.log(`✅ [QUICK SETTINGS] Updated productDiscounts:`, updated);
                              return updated;
                            });
                          }}
                          className="w-20"
                          placeholder="0"
                        />
                        <span className="text-sm font-medium text-gray-700 w-6">%</span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleProductDiscountSave(product.id)}
                          disabled={savingProductId === product.id}
                          className="px-4"
                        >
                          {savingProductId === product.id ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
