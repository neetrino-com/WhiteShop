'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Card } from '@shop/ui';
import { useAuth } from '../../lib/auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../lib/currency';

interface Address {
  _id?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  phone?: string;
  isDefault?: boolean;
}

interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  addresses?: Address[];
  createdAt?: string;
  updatedAt?: string;
}

function ProfilePageContent() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading, user: authUser, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'dashboard' | 'personal' | 'addresses' | 'password' | 'orders') || 'dashboard';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personal' | 'addresses' | 'password' | 'orders'>(initialTab);

  // Personal info form
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState<Address>({
    firstName: '',
    lastName: '',
    company: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'AM',
    phone: '',
    isDefault: false,
  });
  const [savingAddress, setSavingAddress] = useState(false);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Dashboard
  const [dashboardData, setDashboardData] = useState<{
    stats: {
      totalOrders: number;
      pendingOrders: number;
      completedOrders: number;
      totalSpent: number;
      addressesCount: number;
      ordersByStatus: Record<string, number>;
    };
    recentOrders: Array<{
      id: string;
      number: string;
      status: string;
      paymentStatus: string;
      fulfillmentStatus: string;
      total: number;
      currency: string;
      itemsCount: number;
      createdAt: string;
    }>;
  } | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Orders
  const [orders, setOrders] = useState<Array<{
    id: string;
    number: string;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    total: number;
    currency: string;
    itemsCount: number;
    createdAt: string;
  }>>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersMeta, setOrdersMeta] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null>(null);


  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/login?redirect=/profile');
    }
  }, [isLoggedIn, authLoading, router]);

  // Update tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['dashboard', 'personal', 'addresses', 'password', 'orders'].includes(tab)) {
      setActiveTab(tab as typeof activeTab);
    }
  }, [searchParams]);

  // Load profile data
  useEffect(() => {
    if (isLoggedIn && !authLoading) {
      loadProfile();
    }
  }, [isLoggedIn, authLoading]);

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setError(null);
      const response = await apiClient.get<{
        data: typeof orders;
        meta: typeof ordersMeta;
      }>('/api/v1/orders', {
        params: {
          page: ordersPage.toString(),
          limit: '20',
        },
      });
      setOrders(response.data || []);
      setOrdersMeta(response.meta || null);
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [ordersPage]);

  // Load orders when orders tab is active
  useEffect(() => {
    if (isLoggedIn && !authLoading && activeTab === 'orders') {
      loadOrders();
    }
  }, [isLoggedIn, authLoading, activeTab, loadOrders]);

  const loadDashboard = useCallback(async () => {
    try {
      console.log('📊 [PROFILE] Loading dashboard data...');
      setDashboardLoading(true);
      setError(null);
      const data = await apiClient.get<{
        stats: {
          totalOrders: number;
          pendingOrders: number;
          completedOrders: number;
          totalSpent: number;
          addressesCount: number;
          ordersByStatus: Record<string, number>;
        };
        recentOrders: Array<{
          id: string;
          number: string;
          status: string;
          paymentStatus: string;
          fulfillmentStatus: string;
          total: number;
          currency: string;
          itemsCount: number;
          createdAt: string;
        }>;
      }>('/api/v1/users/dashboard');
      console.log('✅ [PROFILE] Dashboard data loaded:', data);
      setDashboardData(data);
    } catch (err: any) {
      console.error('❌ [PROFILE] Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Load dashboard when dashboard tab is active
  useEffect(() => {
    if (isLoggedIn && !authLoading && activeTab === 'dashboard') {
      loadDashboard();
    }
  }, [isLoggedIn, authLoading, activeTab, loadDashboard]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<UserProfile>('/api/v1/users/profile');
      setProfile(data);
      setPersonalInfo({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
      });
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await apiClient.put<UserProfile>('/api/v1/users/profile', personalInfo);
      setProfile(updated);
      setSuccess('Personal information updated successfully');
      
      // Update auth context user if needed
      if (authUser) {
        window.dispatchEvent(new Event('auth-updated'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update personal information');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingAddress?._id) {
        // Update existing address
        await apiClient.put(`/api/v1/users/addresses/${editingAddress._id}`, addressForm);
        setSuccess('Address updated successfully');
      } else {
        // Add new address
        await apiClient.post('/api/v1/users/addresses', addressForm);
        setSuccess('Address added successfully');
      }
      
      await loadProfile();
      setShowAddressForm(false);
      setEditingAddress(null);
      resetAddressForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/users/addresses/${addressId}`);
      setSuccess('Address deleted successfully');
      await loadProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await apiClient.patch(`/api/v1/users/addresses/${addressId}/default`);
      setSuccess('Default address updated successfully');
      await loadProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to set default address');
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      firstName: address.firstName || '',
      lastName: address.lastName || '',
      company: address.company || '',
      addressLine1: address.addressLine1 || '',
      addressLine2: address.addressLine2 || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      countryCode: address.countryCode || 'AM',
      phone: address.phone || '',
      isDefault: address.isDefault || false,
    });
    setShowAddressForm(true);
  };

  const resetAddressForm = () => {
    setAddressForm({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      company: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      countryCode: 'AM',
      phone: profile?.phone || '',
      isDefault: false,
    });
    setEditingAddress(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setError(null);
    setSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      setSavingPassword(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setSavingPassword(false);
      return;
    }

    try {
      await apiClient.put('/api/v1/users/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setSuccess('Password changed successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-purple-100 text-purple-800';
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800';
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  // Tab configuration with icons
  const tabs = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'personal' as const,
      label: 'Personal Information',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'addresses' as const,
      label: 'Addresses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'orders' as const,
      label: 'Orders',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: 'password' as const,
      label: 'Password',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
    router.push(`/profile?tab=${tab}`, { scroll: false });
    if (tab !== 'addresses') {
      setShowAddressForm(false);
      setEditingAddress(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600 mt-2">Manage your account information and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="bg-white border border-gray-200 rounded-lg p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-500'}`}>
                  {tab.icon}
                </span>
                <span className="text-left">{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Alert messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {dashboardLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading dashboard...</p>
            </div>
          ) : dashboardData ? (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {dashboardData.stats.totalOrders}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Spent</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatPrice(dashboardData.stats.totalSpent, 'AMD')}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {dashboardData.stats.pendingOrders}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Saved Addresses</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {dashboardData.stats.addressesCount}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Recent Orders */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange('orders')}
                  >
                    View All
                  </Button>
                </div>
                {dashboardData.recentOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 mb-4">You haven't placed any orders yet</p>
                    <Link href="/products">
                      <Button variant="primary">Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.number}`}
                        className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">Order #{order.number}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.paymentStatus}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {order.itemsCount} item{order.itemsCount !== 1 ? 's' : ''} • Placed on {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-bold text-gray-900">
                              {formatPrice(order.total, order.currency || 'AMD')}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">View Details →</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handleTabChange('orders')}
                    className="justify-start"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    View All Orders
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTabChange('addresses')}
                    className="justify-start"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage Addresses
                  </Button>
                  <Link href="/products">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6">
              <p className="text-gray-600 text-center py-8">Failed to load dashboard data</p>
            </Card>
          )}
        </div>
      )}

      {/* Personal Information Tab */}
      {activeTab === 'personal' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
          <form onSubmit={handleSavePersonalInfo} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={personalInfo.firstName}
                onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                placeholder="John"
              />
              <Input
                label="Last Name"
                value={personalInfo.lastName}
                onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={personalInfo.email}
              onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
              placeholder="your@email.com"
            />
            <Input
              label="Phone"
              type="tel"
              value={personalInfo.phone}
              onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
              placeholder="+374 XX XXX XXX"
            />
            <div className="flex items-center gap-2 pt-4">
              <Button type="submit" variant="primary" disabled={savingPersonal}>
                {savingPersonal ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPersonalInfo({
                    firstName: profile?.firstName || '',
                    lastName: profile?.lastName || '',
                    email: profile?.email || '',
                    phone: profile?.phone || '',
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Account Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Email Verified:</span>
                <span className={`ml-2 font-medium ${profile?.emailVerified ? 'text-green-600' : 'text-gray-400'}`}>
                  {profile?.emailVerified ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Phone Verified:</span>
                <span className={`ml-2 font-medium ${profile?.phoneVerified ? 'text-green-600' : 'text-gray-400'}`}>
                  {profile?.phoneVerified ? 'Yes' : 'No'}
                </span>
              </div>
              {profile?.createdAt && (
                <div>
                  <span className="text-gray-600">Member Since:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Addresses Tab */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Saved Addresses</h2>
              <Button
                variant="primary"
                onClick={() => {
                  resetAddressForm();
                  setShowAddressForm(!showAddressForm);
                  setEditingAddress(null);
                }}
              >
                {showAddressForm ? 'Cancel' : '+ Add New Address'}
              </Button>
            </div>

            {/* Address Form */}
            {showAddressForm && (
              <form onSubmit={handleSaveAddress} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={addressForm.firstName}
                    onChange={(e) => setAddressForm({ ...addressForm, firstName: e.target.value })}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={addressForm.lastName}
                    onChange={(e) => setAddressForm({ ...addressForm, lastName: e.target.value })}
                    required
                  />
                </div>
                <Input
                  label="Company (Optional)"
                  value={addressForm.company}
                  onChange={(e) => setAddressForm({ ...addressForm, company: e.target.value })}
                />
                <Input
                  label="Address Line 1"
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                  required
                />
                <Input
                  label="Address Line 2 (Optional)"
                  value={addressForm.addressLine2}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    required
                  />
                  <Input
                    label="State/Province (Optional)"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  />
                  <Input
                    label="Postal Code"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <select
                      value={addressForm.countryCode}
                      onChange={(e) => setAddressForm({ ...addressForm, countryCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="AM">Armenia</option>
                      <option value="US">United States</option>
                      <option value="RU">Russia</option>
                      <option value="GE">Georgia</option>
                    </select>
                  </div>
                  <Input
                    label="Phone"
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                  />
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as default address</span>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={savingAddress}>
                    {savingAddress ? 'Saving...' : editingAddress ? 'Update Address' : 'Add Address'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddressForm(false);
                      setEditingAddress(null);
                      resetAddressForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Addresses List */}
            <div className="space-y-4">
              {profile?.addresses && profile.addresses.length > 0 ? (
                profile.addresses.map((address, index) => (
                  <div
                    key={address._id || index}
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {address.firstName} {address.lastName}
                          </h3>
                          {address.isDefault && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {address.company && (
                          <p className="text-sm text-gray-600 mb-1">{address.company}</p>
                        )}
                        <p className="text-sm text-gray-700">
                          {address.addressLine1}
                          {address.addressLine2 && `, ${address.addressLine2}`}
                        </p>
                        <p className="text-sm text-gray-700">
                          {address.city}
                          {address.state && `, ${address.state}`}
                          {address.postalCode && ` ${address.postalCode}`}
                        </p>
                        <p className="text-sm text-gray-700">{address.countryCode}</p>
                        {address.phone && (
                          <p className="text-sm text-gray-600 mt-1">Phone: {address.phone}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!address.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefaultAddress(address._id!)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAddress(address)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAddress(address._id!)}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No addresses saved yet</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">My Orders</h2>
          {ordersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">You haven't placed any orders yet</p>
              <Link href="/products">
                <Button variant="primary">Start Shopping</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.number}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">Order #{order.number}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                          order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {order.itemsCount} item{order.itemsCount !== 1 ? 's' : ''} • Placed on {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-gray-900">
                        {formatPrice(order.total, order.currency || 'AMD')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">View Details →</p>
                    </div>
                  </div>
                </Link>
              ))}
              
              {/* Pagination */}
              {ordersMeta && ordersMeta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Page {ordersMeta.page} of {ordersMeta.totalPages} • {ordersMeta.total} total orders
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage(prev => Math.max(1, prev - 1))}
                      disabled={ordersPage === 1 || ordersLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage(prev => Math.min(ordersMeta.totalPages, prev + 1))}
                      disabled={ordersPage === ordersMeta.totalPages || ordersLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-2xl">
            <Input
              label="Current Password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              placeholder="Enter your current password"
              required
            />
            <Input
              label="New Password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="Enter new password (min. 6 characters)"
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              required
            />
            <div className="pt-4">
              <Button type="submit" variant="primary" disabled={savingPassword}>
                {savingPassword ? 'Changing Password...' : 'Change Password'}
              </Button>
            </div>
          </form>
        </Card>
      )}

        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

