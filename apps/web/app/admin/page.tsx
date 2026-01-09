'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthContext';
import { Card, Button } from '@shop/ui';
import { apiClient } from '../../lib/api-client';
import { AdminMenuDrawer } from '../../components/AdminMenuDrawer';
import { getAdminMenuTABS } from './admin-menu.config';
import { useTranslation } from '../../lib/i18n-client';



interface Stats {
  users: { total: number };
  products: { total: number; lowStock: number };
  orders: { total: number; recent: number; pending: number };
  revenue: { total: number; currency: string };
}

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface RecentOrder {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  customerEmail?: string;
  customerPhone?: string;
  itemsCount: number;
  createdAt: string;
}

interface TopProduct {
  variantId: string;
  productId: string;
  title: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  image?: string | null;
}

interface UserActivity {
  recentRegistrations: Array<{
    id: string;
    email?: string;
    phone?: string;
    name: string;
    registeredAt: string;
    lastLoginAt?: string;
  }>;
  activeUsers: Array<{
    id: string;
    email?: string;
    phone?: string;
    name: string;
    orderCount: number;
    totalSpent: number;
    lastOrderDate: string;
    lastLoginAt?: string;
  }>;
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const { isLoggedIn, isAdmin, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats | null>(null);
  // Activity state - used in fetchActivity function (setActivity/setActivityLoading)
  // eslint-disable-next-line no-unused-vars
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [activityLoading, setActivityLoading] = useState(true);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(true);
  const [topProductsLoading, setTopProductsLoading] = useState(true);
  const [userActivityLoading, setUserActivityLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      console.log('📊 [ADMIN] Fetching statistics...');
      setStatsLoading(true);
      
      const data = await apiClient.get<Stats>('/api/v1/admin/stats');
      console.log('✅ [ADMIN] Statistics fetched:', data);
      
      // Validate response structure
      if (data && typeof data === 'object') {
        setStats(data);
      } else {
        console.warn('⚠️ [ADMIN] Invalid response format from server');
        setStats(null);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching stats:', err);
      console.error('❌ [ADMIN] Error details:', {
        message: err.message,
        stack: err.stack,
        status: err.status,
      });
      // Don't show error, just set stats to null
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      console.log('📋 [ADMIN] Fetching recent activity...');
      setActivityLoading(true);
      
      const response = await apiClient.get<{ data: ActivityItem[] }>('/api/v1/admin/activity', {
        params: { limit: '10' },
      });
      console.log('✅ [ADMIN] Activity fetched:', response);
      
      // Validate response structure
      if (response && response.data && Array.isArray(response.data)) {
        setActivity(response.data);
      } else {
        console.warn('⚠️ [ADMIN] Invalid activity response format:', response);
        setActivity([]);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching activity:', err);
      console.error('❌ [ADMIN] Activity error details:', {
        message: err.message,
        status: err.status,
      });
      // Don't show error for activity, just set empty array
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    try {
      console.log('📋 [ADMIN] Fetching recent orders...');
      setRecentOrdersLoading(true);
      const response = await apiClient.get<{ data: RecentOrder[] }>('/api/v1/admin/dashboard/recent-orders', {
        params: { limit: '5' },
      });
      if (response?.data && Array.isArray(response.data)) {
        setRecentOrders(response.data);
      } else {
        setRecentOrders([]);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching recent orders:', err);
      setRecentOrders([]);
    } finally {
      setRecentOrdersLoading(false);
    }
  }, []);

  const fetchTopProducts = useCallback(async () => {
    try {
      console.log('📊 [ADMIN] Fetching top products...');
      setTopProductsLoading(true);
      const response = await apiClient.get<{ data: TopProduct[] }>('/api/v1/admin/dashboard/top-products', {
        params: { limit: '5' },
      });
      if (response?.data && Array.isArray(response.data)) {
        setTopProducts(response.data);
      } else {
        setTopProducts([]);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching top products:', err);
      setTopProducts([]);
    } finally {
      setTopProductsLoading(false);
    }
  }, []);

  const fetchUserActivity = useCallback(async () => {
    try {
      console.log('👥 [ADMIN] Fetching user activity...');
      setUserActivityLoading(true);
      const response = await apiClient.get<{ data: UserActivity }>('/api/v1/admin/dashboard/user-activity', {
        params: { limit: '10' },
      });
      if (response?.data) {
        setUserActivity(response.data);
      } else {
        setUserActivity(null);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching user activity:', err);
      setUserActivity(null);
    } finally {
      setUserActivityLoading(false);
    }
  }, []);


  // Fetch stats and activity
  useEffect(() => {
    if (!isLoading && isLoggedIn && isAdmin) {
      fetchStats();
      fetchActivity();
      fetchRecentOrders();
      fetchTopProducts();
      fetchUserActivity();
    }
  }, [isLoading, isLoggedIn, isAdmin, fetchStats, fetchActivity, fetchRecentOrders, fetchTopProducts, fetchUserActivity]);

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn) {
        console.log('❌ [ADMIN] User not logged in, redirecting to login...');
        router.push('/login');
        return;
      }
      if (!isAdmin) {
        console.log('❌ [ADMIN] User is not admin, redirecting to home...');
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

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('hy-AM', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null; // Will redirect
  }

  const adminTabs = getAdminMenuTABS(t);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.dashboard.title')}</h1>
          <p className="text-gray-600 mt-2">{t('admin.dashboard.welcome').replace('{name}', user?.firstName || t('admin.dashboard.title'))}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:hidden mb-6">
            <AdminMenuDrawer tabs={adminTabs} currentPath={currentPath} />
          </div>
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
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
                      tab.isSubCategory ? 'pl-12' : ''
                    } ${
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className="p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
            onClick={() => router.push('/admin/users')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.totalUsers')}</p>
                {statsLoading ? (
                  <div className="animate-pulse h-8 w-16 bg-gray-200 rounded mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats?.users.total ?? 0}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
            onClick={() => router.push('/admin/products')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.totalProducts')}</p>
                {statsLoading ? (
                  <div className="animate-pulse h-8 w-16 bg-gray-200 rounded mt-1"></div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stats?.products.total ?? 0}
                    </p>
                    {stats && stats.products.lowStock > 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        {t('admin.dashboard.lowStock').replace('{count}', stats.products.lowStock.toString())}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
            onClick={() => router.push('/admin/orders')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.totalOrders')}</p>
                {statsLoading ? (
                  <div className="animate-pulse h-8 w-16 bg-gray-200 rounded mt-1"></div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stats?.orders.total ?? 0}
                    </p>
                    {stats && stats.orders.pending > 0 && (
                      <p className="text-xs text-yellow-600 mt-1">
                        {t('admin.dashboard.pending').replace('{count}', stats.orders.pending.toString())}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
            onClick={() => router.push('/admin/orders?filter=paid')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.revenue')}</p>
                {statsLoading ? (
                  <div className="animate-pulse h-8 w-24 bg-gray-200 rounded mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats ? formatCurrency(stats.revenue.total, stats.revenue.currency) : '0 USD'}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Orders */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{t('admin.dashboard.recentOrders')}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/orders')}
              >
                {t('admin.dashboard.viewAll')}
              </Button>
            </div>
            <div className="space-y-4">
              {recentOrdersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-sm text-gray-600 text-center py-8">
                  <p>{t('admin.dashboard.noRecentOrders')}</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/orders?search=${order.number}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">#{order.number}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                            order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.paymentStatus}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {order.customerEmail || order.customerPhone || t('admin.dashboard.guest')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {order.itemsCount === 1 
                            ? t('admin.dashboard.items').replace('{count}', order.itemsCount.toString())
                            : t('admin.dashboard.itemsPlural').replace('{count}', order.itemsCount.toString())
                          } • {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(order.total, order.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Top Selling Products */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{t('admin.dashboard.topSellingProducts')}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/products')}
              >
                {t('admin.dashboard.viewAll')}
              </Button>
            </div>
            <div className="space-y-4">
              {topProductsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : topProducts.length === 0 ? (
                <div className="text-sm text-gray-600 text-center py-8">
                  <p>{t('admin.dashboard.noSalesData')}</p>
                </div>
              ) : (
                topProducts.map((product, index) => (
                  <div
                    key={product.variantId}
                    className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/products/${product.productId}`)}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                        {index + 1}
                      </div>
                    </div>
                    {product.image && (
                      <div className="flex-shrink-0">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.title}</p>
                      <p className="text-xs text-gray-600">SKU: {product.sku}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('admin.dashboard.sold').replace('{count}', product.totalQuantity.toString())} • {t('admin.dashboard.orders').replace('{count}', product.orderCount.toString())}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(product.totalRevenue, 'USD')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>


        {/* User Activity */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('admin.dashboard.userActivity')}</h2>
          {userActivityLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-32 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : userActivity ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Registrations */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t('admin.dashboard.recentRegistrations')}</h3>
                <div className="space-y-3">
                  {userActivity.recentRegistrations.length === 0 ? (
                    <p className="text-sm text-gray-600">{t('admin.dashboard.noRecentRegistrations')}</p>
                  ) : (
                    userActivity.recentRegistrations.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-600">{user.email || user.phone || 'N/A'}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatDate(user.registeredAt)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Active Users */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t('admin.dashboard.mostActiveUsers')}</h3>
                <div className="space-y-3">
                  {userActivity.activeUsers.length === 0 ? (
                    <p className="text-sm text-gray-600">{t('admin.dashboard.noActiveUsers')}</p>
                  ) : (
                    userActivity.activeUsers.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-600">{user.email || user.phone || 'N/A'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('admin.dashboard.ordersCount').replace('{count}', user.orderCount.toString())} • {formatCurrency(user.totalSpent, 'USD')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">{t('admin.dashboard.noUserActivityData')}</p>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/products/add')}
              className="justify-start h-auto py-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('admin.dashboard.addProduct')}</p>
                  <p className="text-xs text-gray-500">{t('admin.dashboard.createNewProduct')}</p>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/orders')}
              className="justify-start h-auto py-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('admin.dashboard.manageOrders')}</p>
                  <p className="text-xs text-gray-500">{t('admin.dashboard.viewAllOrders')}</p>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/users')}
              className="justify-start h-auto py-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('admin.dashboard.manageUsers')}</p>
                  <p className="text-xs text-gray-500">{t('admin.dashboard.viewAllUsers')}</p>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/settings')}
              className="justify-start h-auto py-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{t('admin.dashboard.settings')}</p>
                  <p className="text-xs text-gray-500">{t('admin.dashboard.configureSystem')}</p>
                </div>
              </div>
            </Button>
          </div>
        </Card>

        {/* Admin Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.dashboard.adminInformation')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.email')}</p>
              <p className="text-gray-900">{user?.email || t('admin.dashboard.na')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.phone')}</p>
              <p className="text-gray-900">{user?.phone || t('admin.dashboard.na')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.roles')}</p>
              <div className="flex gap-2 mt-1">
                {user?.roles?.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                  >
                    {role}
                  </span>
                )) || <span className="text-gray-900">{t('admin.dashboard.customer')}</span>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.userId')}</p>
              <p className="text-gray-900 font-mono text-sm">{user?.id || t('admin.dashboard.na')}</p>
            </div>
          </div>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

