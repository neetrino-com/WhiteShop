'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';
import { AdminMenuDrawer } from '../../../components/AdminMenuDrawer';
import { getAdminMenuTABS } from '../admin-menu.config';
import { useTranslation } from '../../../lib/i18n-client';

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

interface AdminStatsSummary {
  users?: {
    total?: number;
  };
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

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
      fetchAdminStats();
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
      
      console.log('📊 [ADMIN][Analytics] Analytics data loaded:', response);
      setAnalytics(response);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching analytics:', err);
      
      // Extract meaningful error message
      let errorMessage = t('admin.analytics.errorLoading');
      
      if (err.message) {
        // If error message contains HTML, it's likely a 404 page
        if (err.message.includes('<!DOCTYPE') || err.message.includes('<html')) {
          errorMessage = t('admin.analytics.apiNotFound');
        } else if (err.message.includes('Expected JSON')) {
          errorMessage = t('admin.analytics.invalidResponse');
        } else {
          errorMessage = err.message;
        }
      } else if (err.data?.detail) {
        errorMessage = err.data.detail;
      }
      
      alert(`${t('admin.common.error')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch admin summary stats (including total users)
   */
  const fetchAdminStats = async () => {
    try {
      console.log('👥 [ADMIN][Analytics] Fetching admin stats for Total Users card...');
      const stats = await apiClient.get<AdminStatsSummary>('/api/v1/admin/stats');
      const usersCount = stats?.users?.total ?? null;
      setTotalUsers(usersCount);
      console.log('✅ [ADMIN][Analytics] Admin stats loaded for Total Users:', { usersCount });
    } catch (err: any) {
      console.error('❌ [ADMIN][Analytics] Error fetching admin stats:', err);
      setTotalUsers(null);
    }
  };

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
    }).format(date);
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('hy-AM', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // Component for SVG Line Chart - Modern and Beautiful Design
  const LineChart = ({ data }: { data: Array<{ _id: string; count: number; revenue: number }> }) => {
    if (!data || data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const width = 800;
    const height = 300;
    const padding = { top: 30, right: 40, bottom: 50, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - (d.count / maxCount) * chartHeight;
      return { x, y, ...d };
    });

    // Smooth curve using quadratic bezier
    const getSmoothPath = (points: Array<{ x: number; y: number }>) => {
      if (points.length < 2) return '';
      
      let path = `M ${points[0].x} ${points[0].y}`;
      
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        
        if (next) {
          const cp1x = prev.x + (curr.x - prev.x) * 0.5;
          const cp1y = prev.y;
          const cp2x = curr.x - (next.x - curr.x) * 0.5;
          const cp2y = curr.y;
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
        } else {
          path += ` L ${curr.x} ${curr.y}`;
        }
      }
      
      return path;
    };

    const smoothPath = getSmoothPath(points);
    const areaPath = `${smoothPath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    // Y-axis values
    const yAxisSteps = 5;
    const yAxisValues = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
      const value = Math.round((maxCount / yAxisSteps) * (yAxisSteps - i));
      const y = padding.top + (chartHeight / yAxisSteps) * i;
      return { value, y };
    });

    return (
      <div className="w-full relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Modern gradient for area */}
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
            
            {/* Gradient for line */}
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            
            {/* Shadow filter for depth */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Glow effect for points */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background grid lines - subtle and modern */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={padding.left}
              y1={padding.top + chartHeight * ratio}
              x2={width - padding.right}
              y2={padding.top + chartHeight * ratio}
              stroke="#f1f5f9"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}
          
          {/* Y-axis grid lines */}
          {points.map((point, i) => {
            if (i === 0 || i === points.length - 1) return null;
            return (
              <line
                key={`y-grid-${i}`}
                x1={point.x}
                y1={padding.top}
                x2={point.x}
                y2={padding.top + chartHeight}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
            );
          })}
          
          {/* Area under line with gradient */}
          <path
            d={areaPath}
            fill="url(#chartGradient)"
            opacity="0.6"
          />
          
          {/* Main line with gradient and shadow */}
          <path
            d={smoothPath}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#shadow)"
          />
          
          {/* Y-axis labels */}
          {yAxisValues.map(({ value, y }, i) => (
            <g key={`y-label-${i}`}>
              <line
                x1={padding.left - 5}
                y1={y}
                x2={padding.left}
                y2={y}
                stroke="#64748b"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
                fontWeight="500"
              >
                {value}
              </text>
            </g>
          ))}
          
          {/* Data points with hover effect */}
          {points.map((point, i) => (
            <g key={i} className="cursor-pointer group">
              {/* Hover circle (invisible but interactive) */}
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="transparent"
                className="hover:fill-blue-100 hover:fill-opacity-30 transition-all duration-200"
              />
              
              {/* Outer glow circle */}
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#3b82f6"
                opacity="0.3"
                className="group-hover:opacity-0.6 group-hover:r-7 transition-all duration-200"
              />
              
              {/* Main point */}
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="white"
                stroke="#3b82f6"
                strokeWidth="3"
                className="group-hover:r-5 group-hover:stroke-[#6366f1] transition-all duration-200"
                filter="url(#glow)"
              />
              
              {/* Inner dot */}
              <circle
                cx={point.x}
                cy={point.y}
                r="2"
                fill="#3b82f6"
                className="group-hover:fill-[#6366f1] transition-all duration-200"
              />
              
              {/* Tooltip on hover */}
              <title>
                {formatDateShort(point._id)}: {t('admin.analytics.ordersLabel').replace('{count}', point.count.toString())}, {formatCurrency(point.revenue)}
              </title>
            </g>
          ))}
          
          {/* X-axis line */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#cbd5e1"
            strokeWidth="2"
          />
        </svg>
        
        {/* X-axis labels - Modern styling */}
        <div className="flex justify-between mt-4 px-2">
          {data.length <= 10 ? (
            data.map((d, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-xs font-medium text-gray-600 transform -rotate-45 origin-center whitespace-nowrap">
                  {formatDateShort(d._id)}
                </span>
              </div>
            ))
          ) : (
            <>
              <div className="flex flex-col items-center">
                <span className="text-xs font-medium text-gray-600">
                  {formatDateShort(data[0]._id)}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-medium text-gray-600">
                  {formatDateShort(data[Math.floor(data.length / 2)]._id)}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-medium text-gray-600">
                  {formatDateShort(data[data.length - 1]._id)}
                </span>
              </div>
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
          <p className="text-gray-600">{t('admin.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null;
  }

  const adminTabs = getAdminMenuTABS(t);

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
            {t('admin.analytics.backToAdmin')}
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('admin.analytics.title')}</h1>
              <p className="text-gray-600">{t('admin.analytics.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:hidden mb-6">
            <AdminMenuDrawer tabs={adminTabs} currentPath={pathname || '/admin/analytics'} />
          </div>
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
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
            {/* Period Selector */}
            <Card className="p-6 mb-6 bg-white shadow-sm border border-gray-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{t('admin.analytics.timePeriod')}</h2>
                {analytics && (
                  <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                    {formatDate(analytics.dateRange.start)} - {formatDate(analytics.dateRange.end)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.analytics.period')}
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
                    <option value="day">{t('admin.analytics.today')}</option>
                    <option value="week">{t('admin.analytics.last7Days')}</option>
                    <option value="month">{t('admin.analytics.last30Days')}</option>
                    <option value="year">{t('admin.analytics.lastYear')}</option>
                    <option value="custom">{t('admin.analytics.customRange')}</option>
                  </select>
                </div>
                {period === 'custom' && (
                  <>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.analytics.startDate')}
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
                        {t('admin.analytics.endDate')}
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
                <p className="text-gray-600">{t('admin.analytics.loadingAnalytics')}</p>
              </div>
            ) : analytics ? (
              <>
                {/* Orders & Users Overview - Modern Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <Card 
                    className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg hover:scale-105 hover:border-blue-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders')}
                    title={t('admin.analytics.clickToViewAllOrders')}
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
                    <p className="text-sm font-medium text-blue-700 mb-1">{t('admin.analytics.totalOrders')}</p>
                    <p className="text-3xl font-bold text-blue-900">
                      {analytics.orders.totalOrders}
                    </p>
                  </Card>

                  <Card 
                    className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg hover:scale-105 hover:border-green-400 transition-all duration-200 group cursor-pointer relative"
                    onClick={() => router.push('/admin/orders?paymentStatus=paid')}
                    title={t('admin.analytics.clickToViewPaidOrders')}
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
                    <p className="text-sm font-medium text-green-700 mb-1">{t('admin.analytics.totalRevenue')}</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(analytics.orders.totalRevenue)}
                    </p>
                  </Card>

                  <Card 
                    className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 hover:shadow-lg hover:scale-105 hover:border-indigo-400 transition-all duration-200 group cursor-default relative"
                    title={t('admin.analytics.totalRegisteredUsers')}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-1a4 4 0 00-4-4h-1M7 20H2v-1a4 4 0 014-4h1m4-9a3 3 0 110 6 3 3 0 010-6zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-indigo-700 mb-1">{t('admin.analytics.totalUsers')}</p>
                    <p className="text-3xl font-bold text-indigo-900">
                      {totalUsers !== null ? totalUsers : '—'}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Top Products */}
                  <Card className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">{t('admin.analytics.topSellingProducts')}</h2>
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {analytics.topProducts.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500">{t('admin.analytics.noSalesDataAvailable')}</p>
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
                              <p className="text-xs text-gray-500 mb-1">{t('admin.analytics.skuLabel')}: {product.sku}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  {t('admin.analytics.sold').replace('{count}', product.totalQuantity.toString())}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  {t('admin.analytics.orders').replace('{count}', product.orderCount.toString())}
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
                      <h2 className="text-xl font-semibold text-gray-900">{t('admin.analytics.topCategories')}</h2>
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {analytics.topCategories.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500">{t('admin.analytics.noCategoryDataAvailable')}</p>
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
                                    {t('admin.analytics.items').replace('{count}', category.totalQuantity.toString())}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    {t('admin.analytics.orders').replace('{count}', category.orderCount.toString())}
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
                <Card className="p-8 bg-white shadow-lg border border-gray-200 rounded-2xl hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('admin.analytics.ordersByDay')}</h2>
                      <p className="text-sm text-gray-500 font-medium">{t('admin.analytics.dailyOrderTrends')}</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  
                  {analytics.ordersByDay.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-500">{t('admin.analytics.noDataAvailable')}</p>
                    </div>
                  ) : (
                    <>
                      {/* SVG Line Chart - Modern Container */}
                      <div className="mb-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-inner">
                        <LineChart data={analytics.ordersByDay} />
                      </div>
                      
                      {/* Detailed List - Modern Design */}
                      <div className="space-y-3">
                        {analytics.ordersByDay.map((day) => {
                          const maxCount = Math.max(...analytics.ordersByDay.map(d => d.count), 1);
                          const percentage = (day.count / maxCount) * 100;
                          
                          return (
                            <div 
                              key={day._id} 
                              className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-300 group"
                            >
                              <div className="w-32 text-sm font-semibold text-gray-700 flex-shrink-0">
                                {formatDateShort(day._id)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1 bg-gray-200 rounded-full h-10 relative overflow-hidden shadow-inner">
                                    <div
                                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-10 rounded-full flex items-center justify-between px-4 transition-all duration-700 group-hover:shadow-lg"
                                      style={{ width: `${percentage}%` }}
                                    >
                                      <span className="text-xs text-white font-bold">{t('admin.analytics.ordersLabel').replace('{count}', day.count.toString())}</span>
                                      <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
                                    </div>
                                  </div>
                                  <div className="w-36 text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-gray-900">
                                      {formatCurrency(day.revenue)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">{t('admin.analytics.revenue')}</p>
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
                <p className="text-gray-600 text-center">{t('admin.analytics.noAnalyticsData')}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

