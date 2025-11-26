'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';

interface AnalyticsData {
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
  orders: {
    totalOrders: number;
    totalRevenue: number;
    paidOrders: number;
    pendingOrders: number;
    completedOrders: number;
  };
  topProducts: Array<{
    variantId: string;
    productId: string;
    title: string;
    sku: string;
    totalQuantity: number;
    totalRevenue: number;
    orderCount: number;
    image?: string | null;
  }>;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    totalQuantity: number;
    totalRevenue: number;
    orderCount: number;
  }>;
  ordersByDay: Array<{
    _id: string;
    count: number;
    revenue: number;
  }>;
}

export default function AnalyticsPage() {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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
      fetchAnalytics();
    }
  }, [isLoggedIn, isAdmin, period, startDate, endDate]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        period,
      };
      
      if (period === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const response = await apiClient.get<AnalyticsData>('/api/v1/admin/analytics', {
        params,
      });
      
      setAnalytics(response);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching analytics:', err);
      alert(`Error loading analytics: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'AMD') => {
    return new Intl.NumberFormat('hy-AM', {
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
    }).format(date);
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('hy-AM', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // Component for SVG Line Chart
  const LineChart = ({ data }: { data: Array<{ _id: string; count: number; revenue: number }> }) => {
    if (!data || data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    const width = 100;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - (d.count / maxCount) * chartHeight;
      return { x, y, ...d };
    });

    const pathData = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');

    const areaPath = `${pathData} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    return (
      <div className="w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={padding.left}
              y1={padding.top + chartHeight * ratio}
              x2={width - padding.right}
              y2={padding.top + chartHeight * ratio}
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          ))}
          
          {/* Area under line */}
          <path
            d={areaPath}
            fill="url(#gradient)"
            opacity="0.2"
          />
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {points.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r="2"
                fill="#2563eb"
                className="hover:r-3 transition-all"
              />
              <title>
                {formatDateShort(point._id)}: {point.count} orders, {formatCurrency(point.revenue)}
              </title>
            </g>
          ))}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-xs text-gray-500 px-2">
          {data.length <= 7 ? (
            data.map((d, i) => (
              <span key={i} className="transform -rotate-45 origin-left">
                {formatDateShort(d._id)}
              </span>
            ))
          ) : (
            <>
              <span>{formatDateShort(data[0]._id)}</span>
              <span>{formatDateShort(data[Math.floor(data.length / 2)]._id)}</span>
              <span>{formatDateShort(data[data.length - 1]._id)}</span>
            </>
          )}
        </div>
      </div>
    );
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
      id: 'analytics',
      label: 'Analytics',
      path: '/admin/analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
      id: 'price-filter-settings',
      label: 'Filter by Price',
      path: '/admin/price-filter-settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
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
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center transition-colors duration-200 group"
          >
            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin Panel
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics</h1>
              <p className="text-gray-600">Track your business performance and insights</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <nav className="bg-white border border-gray-200 rounded-lg p-2 space-y-1">
              {adminTabs.map((tab) => {
                const isActive = pathname === tab.path || 
                  (tab.path === '/admin' && pathname === '/admin') ||
                  (tab.path !== '/admin' && pathname?.startsWith(tab.path));
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
            {/* Period Selector */}
            <Card className="p-6 mb-6 bg-white shadow-sm border border-gray-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Time Period</h2>
                {analytics && (
                  <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                    {formatDate(analytics.dateRange.start)} - {formatDate(analytics.dateRange.end)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period
                  </label>
                  <select
                    value={period}
                    onChange={(e) => {
                      setPeriod(e.target.value);
                      if (e.target.value !== 'custom') {
                        setStartDate('');
                        setEndDate('');
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  >
                    <option value="day">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="year">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {period === 'custom' && (
                  <>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading analytics...</p>
              </div>
            ) : analytics ? (
              <>
                {/* Orders Overview - Modern Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                  <Card 
                    className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg hover:scale-105 hover:border-blue-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders')}
                    title="Click to view all orders"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-blue-700 mb-1">Total Orders</p>
                    <p className="text-3xl font-bold text-blue-900">
                      {analytics.orders.totalOrders}
                    </p>
                  </Card>

                  <Card 
                    className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg hover:scale-105 hover:border-green-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders?paymentStatus=paid')}
                    title="Click to view paid orders"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-green-700 mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(analytics.orders.totalRevenue)}
                    </p>
                  </Card>

                  <Card 
                    className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-lg hover:scale-105 hover:border-emerald-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders?paymentStatus=paid')}
                    title="Click to view paid orders"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-emerald-700 mb-1">Paid Orders</p>
                    <p className="text-3xl font-bold text-emerald-900">
                      {analytics.orders.paidOrders}
                    </p>
                  </Card>

                  <Card 
                    className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg hover:scale-105 hover:border-yellow-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders?status=pending')}
                    title="Click to view pending orders"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4 text-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-yellow-700 mb-1">Pending Orders</p>
                    <p className="text-3xl font-bold text-yellow-900">
                      {analytics.orders.pendingOrders}
                    </p>
                  </Card>

                  <Card 
                    className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 hover:shadow-lg hover:scale-105 hover:border-indigo-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders?status=completed')}
                    title="Click to view completed orders"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-indigo-700 mb-1">Completed</p>
                    <p className="text-3xl font-bold text-indigo-900">
                      {analytics.orders.completedOrders}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Top Products */}
                  <Card className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Top Selling Products</h2>
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {analytics.topProducts.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500">No sales data available</p>
                        </div>
                      ) : (
                        analytics.topProducts.map((product, index) => (
                          <div
                            key={product.variantId}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-gray-50 hover:bg-white group"
                          >
                            <div className="flex-shrink-0">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                                index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                index === 1 ? 'bg-gray-300 text-gray-700' :
                                index === 2 ? 'bg-orange-300 text-orange-900' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {index + 1}
                              </div>
                            </div>
                            {product.image && (
                              <div className="flex-shrink-0">
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  className="w-14 h-14 object-cover rounded-lg border border-gray-200 group-hover:scale-105 transition-transform"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate mb-1">{product.title}</p>
                              <p className="text-xs text-gray-500 mb-1">SKU: {product.sku}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  {product.totalQuantity} sold
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  {product.orderCount} orders
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-gray-900">
                                {formatCurrency(product.totalRevenue)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  {/* Top Categories */}
                  <Card className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Top Categories</h2>
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {analytics.topCategories.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500">No category data available</p>
                        </div>
                      ) : (
                        analytics.topCategories.map((category, index) => (
                          <div
                            key={category.categoryId}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all duration-200 bg-gray-50 hover:bg-white group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                                index === 0 ? 'bg-purple-400 text-purple-900' :
                                index === 1 ? 'bg-gray-300 text-gray-700' :
                                index === 2 ? 'bg-pink-300 text-pink-900' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 mb-1">{category.categoryName}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    {category.totalQuantity} items
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    {category.orderCount} orders
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-gray-900">
                                {formatCurrency(category.totalRevenue)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>

                {/* Orders by Day Chart */}
                <Card className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-1">Orders by Day</h2>
                      <p className="text-sm text-gray-500">Daily order trends and revenue</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  
                  {analytics.ordersByDay.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-500">No data available for this period</p>
                    </div>
                  ) : (
                    <>
                      {/* SVG Line Chart */}
                      <div className="mb-6 bg-gray-50 rounded-xl p-4">
                        <LineChart data={analytics.ordersByDay} />
                      </div>
                      
                      {/* Detailed List */}
                      <div className="space-y-2">
                        {analytics.ordersByDay.map((day) => {
                          const maxCount = Math.max(...analytics.ordersByDay.map(d => d.count), 1);
                          const percentage = (day.count / maxCount) * 100;
                          
                          return (
                            <div key={day._id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="w-28 text-sm font-medium text-gray-700">
                                {formatDateShort(day._id)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                                    <div
                                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    >
                                      <span className="text-xs text-white font-semibold">{day.count}</span>
                                    </div>
                                  </div>
                                  <div className="w-32 text-sm font-semibold text-gray-900 text-right">
                                    {formatCurrency(day.revenue)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </Card>
              </>
            ) : (
              <Card className="p-6">
                <p className="text-gray-600 text-center">No analytics data available</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

