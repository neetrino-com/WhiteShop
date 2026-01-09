'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Card } from '@shop/ui';
import { useAuth } from '../../lib/auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { formatPrice, type CurrencyCode } from '../../lib/currency';
import { ProfileMenuDrawer } from '../../components/ProfileMenuDrawer';
import { UserAvatar } from '../../components/UserAvatar';
import { useTranslation } from '../../lib/i18n-client';

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

interface OrderItem {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  imageUrl?: string;
  variantOptions?: Array<{
    attributeKey?: string;
    value?: string;
  }>;
}

interface OrderDetails {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  items: OrderItem[];
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  customer?: {
    email?: string;
    phone?: string;
  };
  shippingAddress?: any;
  shippingMethod: string;
  trackingNumber?: string;
  timeline?: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

function ProfilePageContent() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading, user: authUser } = useAuth();
  const { t } = useTranslation();
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

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);


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
      setError(err.message || t('profile.orders.failedToLoad'));
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
      setError(err.message || t('profile.dashboard.failedToLoad'));
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
      setError(err.message || t('profile.personal.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonalInfo = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await apiClient.put<UserProfile>('/api/v1/users/profile', personalInfo);
      setProfile(updated);
      setSuccess(t('profile.personal.updatedSuccess'));
      
      // Update auth context user if needed
      if (authUser) {
        window.dispatchEvent(new Event('auth-updated'));
      }
    } catch (err: any) {
      setError(err.message || t('profile.personal.failedToUpdate'));
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveAddress = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingAddress?._id) {
        // Update existing address
        await apiClient.put(`/api/v1/users/addresses/${editingAddress._id}`, addressForm);
        setSuccess(t('profile.addresses.updatedSuccess'));
      } else {
        // Add new address
        await apiClient.post('/api/v1/users/addresses', addressForm);
        setSuccess(t('profile.addresses.addedSuccess'));
      }
      
      await loadProfile();
      setShowAddressForm(false);
      setEditingAddress(null);
      resetAddressForm();
    } catch (err: any) {
      setError(err.message || t('profile.addresses.failedToSave'));
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm(t('profile.addresses.deleteConfirm'))) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/users/addresses/${addressId}`);
      setSuccess(t('profile.addresses.deletedSuccess'));
      await loadProfile();
    } catch (err: any) {
      setError(err.message || t('profile.addresses.failedToDelete'));
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await apiClient.patch(`/api/v1/users/addresses/${addressId}/default`);
      setSuccess(t('profile.addresses.defaultUpdatedSuccess'));
      await loadProfile();
    } catch (err: any) {
      setError(err.message || t('profile.addresses.failedToSetDefault'));
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

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setError(null);
    setSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t('profile.password.passwordsDoNotMatch'));
      setSavingPassword(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError(t('profile.password.passwordMinLength'));
      setSavingPassword(false);
      return;
    }

    try {
      await apiClient.put('/api/v1/users/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setSuccess(t('profile.password.changedSuccess'));
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(err.message || t('profile.password.failedToChange'));
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

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to get color hex/rgb from color name
  const getColorValue = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      'beige': '#F5F5DC',
      'black': '#000000',
      'blue': '#0000FF',
      'brown': '#A52A2A',
      'gray': '#808080',
      'grey': '#808080',
      'green': '#008000',
      'red': '#FF0000',
      'white': '#FFFFFF',
      'yellow': '#FFFF00',
      'orange': '#FFA500',
      'pink': '#FFC0CB',
      'purple': '#800080',
      'navy': '#000080',
      'maroon': '#800000',
      'olive': '#808000',
      'teal': '#008080',
      'cyan': '#00FFFF',
      'magenta': '#FF00FF',
      'lime': '#00FF00',
      'silver': '#C0C0C0',
      'gold': '#FFD700',
    };
    
    const normalizedName = colorName.toLowerCase().trim();
    return colorMap[normalizedName] || '#CCCCCC';
  };

  const loadOrderDetails = async (orderNumber: string) => {
    try {
      setOrderDetailsLoading(true);
      setOrderDetailsError(null);
      const data = await apiClient.get<OrderDetails>(`/api/v1/orders/${orderNumber}`);
      setSelectedOrder(data);
    } catch (err: any) {
      console.error('Error loading order details:', err);
      setOrderDetailsError(err.message || t('profile.orderDetails.failedToLoad'));
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  const handleOrderClick = (orderNumber: string, e: MouseEvent<HTMLAnchorElement>) => {
    // Only open modal on desktop (screen width >= 1024px)
    if (window.innerWidth >= 1024) {
      e.preventDefault();
      loadOrderDetails(orderNumber);
    }
    // On mobile, let the Link navigate normally
  };

  const handleReOrder = async () => {
    if (!selectedOrder || !isLoggedIn) {
      router.push('/login?redirect=/profile?tab=orders');
      return;
    }

    setIsReordering(true);
    try {
      console.log('[Profile][ReOrder] Starting re-order for order:', selectedOrder.number);
      
      let addedCount = 0;
      let skippedCount = 0;

      // Add each item from the order to cart
      for (const item of selectedOrder.items) {
        try {
          // Get variant details to find productId
          interface VariantDetails {
            id: string;
            productId: string;
            stock: number;
            available: boolean;
          }

          const variantDetails = await apiClient.get<VariantDetails>(`/api/v1/products/variants/${item.variantId}`);
          
          if (!variantDetails.available || variantDetails.stock < item.quantity) {
            console.warn(`[Profile][ReOrder] Item ${item.productTitle} is not available or insufficient stock`);
            skippedCount++;
            continue;
          }

          await apiClient.post('/api/v1/cart/items', {
            productId: variantDetails.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          });
          addedCount++;
          console.log('[Profile][ReOrder] Added item to cart:', item.productTitle);
        } catch (error: any) {
          console.error('[Profile][ReOrder] Error adding item to cart:', error);
          skippedCount++;
          // Continue with other items even if one fails
        }
      }

      // Trigger cart update
      window.dispatchEvent(new Event('cart-updated'));
      
      // Show success message
      if (addedCount > 0) {
        const skippedText = skippedCount > 0 ? `, ${skippedCount} ${t('profile.orderDetails.skipped')}` : '';
        setSuccess(`${addedCount} ${t('profile.orderDetails.itemsAdded')}${skippedText}`);
        setTimeout(() => {
          router.push('/cart');
        }, 1500);
      } else {
        setError(t('profile.orderDetails.failedToAdd'));
      }
    } catch (error: any) {
      console.error('[Profile][ReOrder] Error during re-order:', error);
      setError(t('profile.orderDetails.failedToAdd'));
    } finally {
      setIsReordering(false);
    }
  };



  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-gray-600">{t('profile.common.loadingProfile')}</p>
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
      label: t('profile.tabs.dashboard'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'personal' as const,
      label: t('profile.tabs.personal'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'addresses' as const,
      label: t('profile.tabs.addresses'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'orders' as const,
      label: t('profile.tabs.orders'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: 'password' as const,
      label: t('profile.tabs.password'),
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
      {/* Profile Header Section */}
      <Card className="mb-8 p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <UserAvatar
            firstName={profile?.firstName}
            lastName={profile?.lastName}
            size="xl"
            className="mx-auto sm:mx-0"
          />
          
          {/* User Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {profile?.firstName && profile?.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : profile?.firstName
                ? profile.firstName
                : profile?.lastName
                ? profile.lastName
                : t('profile.myProfile')}
            </h1>
            {profile?.email && (
              <p className="text-gray-600 text-lg mb-1">{profile.email}</p>
            )}
            {profile?.phone && (
              <p className="text-gray-500 text-sm">{profile.phone}</p>
            )}
            <p className="text-gray-600 mt-3 text-sm">
              {t('profile.subtitle')}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:hidden mb-6">
          <ProfileMenuDrawer
            tabs={tabs}
            activeTab={activeTab}
            onSelect={(tabId) => handleTabChange(tabId as typeof activeTab)}
          />
        </div>

        {/* Sidebar Navigation */}
        <aside className="hidden lg:block lg:w-64 flex-shrink-0">
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
              <p className="text-gray-600">{t('profile.dashboard.loading')}</p>
            </div>
          ) : dashboardData ? (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('profile.dashboard.totalOrders')}</p>
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-gray-600">{t('profile.dashboard.totalSpent')}</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words overflow-wrap-anywhere">
                        {formatPrice(dashboardData.stats.totalSpent, 'AMD')}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('profile.dashboard.pendingOrders')}</p>
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
                      <p className="text-sm font-medium text-gray-600">{t('profile.dashboard.savedAddresses')}</p>
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
                  <h2 className="text-xl font-semibold text-gray-900">{t('profile.dashboard.recentOrders')}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange('orders')}
                  >
                    {t('profile.dashboard.viewAll')}
                  </Button>
                </div>
                {dashboardData.recentOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 mb-4">{t('profile.dashboard.noOrders')}</p>
                    <Link href="/products">
                      <Button variant="primary">{t('profile.dashboard.startShopping')}</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.number}`}
                        onClick={(e) => handleOrderClick(order.number, e)}
                        className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-6 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{t('profile.orders.orderNumber')}{order.number}</h3>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">{t('profile.dashboard.orderStatus')}</p>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </span>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">{t('profile.dashboard.paymentStatus')}</p>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getPaymentStatusColor(order.paymentStatus)}`}>
                                  {order.paymentStatus}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              {order.itemsCount} {order.itemsCount !== 1 ? t('profile.orders.items') : t('profile.orders.item')} • {t('profile.dashboard.placedOn')} {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-bold text-gray-900">
                              {formatPrice(order.total, (order.currency || 'AMD') as CurrencyCode)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{t('profile.dashboard.viewDetails')}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('profile.dashboard.quickActions')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handleTabChange('orders')}
                    className="justify-start"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {t('profile.dashboard.viewAllOrders')}
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
                    {t('profile.dashboard.manageAddresses')}
                  </Button>
                  <Link href="/products">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      {t('profile.dashboard.continueShopping')}
                    </Button>
                  </Link>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6">
              <p className="text-gray-600 text-center py-8">{t('profile.dashboard.failedToLoad')}</p>
            </Card>
          )}
        </div>
      )}

      {/* Personal Information Tab */}
      {activeTab === 'personal' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('profile.personal.title')}</h2>
          <form onSubmit={handleSavePersonalInfo} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('profile.personal.firstName')}
                value={personalInfo.firstName}
                onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                placeholder={t('profile.personal.firstNamePlaceholder')}
              />
              <Input
                label={t('profile.personal.lastName')}
                value={personalInfo.lastName}
                onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                placeholder={t('profile.personal.lastNamePlaceholder')}
              />
            </div>
            <Input
              label={t('profile.personal.email')}
              type="email"
              value={personalInfo.email}
              onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
              placeholder={t('profile.personal.emailPlaceholder')}
            />
            <Input
              label={t('profile.personal.phone')}
              type="tel"
              value={personalInfo.phone}
              onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
              placeholder={t('profile.personal.phonePlaceholder')}
            />
            <div className="flex items-center gap-2 pt-4">
              <Button type="submit" variant="primary" disabled={savingPersonal}>
                {savingPersonal ? t('profile.personal.saving') : t('profile.personal.save')}
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
                {t('profile.personal.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Addresses Tab */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('profile.addresses.title')}</h2>
              <Button
                variant="primary"
                onClick={() => {
                  resetAddressForm();
                  setShowAddressForm(!showAddressForm);
                  setEditingAddress(null);
                }}
              >
                {showAddressForm ? t('profile.addresses.form.cancel') : `+ ${t('profile.addresses.addNew')}`}
              </Button>
            </div>

            {/* Address Form */}
            {showAddressForm && (
              <form onSubmit={handleSaveAddress} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900">
                  {editingAddress ? t('profile.addresses.form.editTitle') : t('profile.addresses.form.addTitle')}
                </h3>
                <Input
                  label={t('profile.addresses.form.addressLine1')}
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label={t('profile.addresses.form.city')}
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    required
                  />
                  <Input
                    label={t('profile.addresses.form.state')}
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  />
                  <Input
                    label={t('profile.addresses.form.postalCode')}
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.addresses.country')}
                  </label>
                  <select
                    value={addressForm.countryCode}
                    onChange={(e) => setAddressForm({ ...addressForm, countryCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="AM">{t('profile.addresses.countryArmenia')}</option>
                    <option value="US">{t('profile.addresses.countryUS')}</option>
                    <option value="RU">{t('profile.addresses.countryRU')}</option>
                    <option value="GE">{t('profile.addresses.countryGE')}</option>
                  </select>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-700">{t('profile.addresses.form.isDefault')}</span>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={savingAddress}>
                    {savingAddress ? t('profile.addresses.form.saving') : editingAddress ? t('profile.addresses.form.update') : t('profile.addresses.form.add')}
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
                    {t('profile.addresses.form.cancel')}
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
                          {address.isDefault && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                              {t('profile.addresses.default')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">
                          {address.addressLine1}
                        </p>
                        <p className="text-sm text-gray-700">
                          {address.city}
                          {address.state && `, ${address.state}`}
                          {address.postalCode && ` ${address.postalCode}`}
                        </p>
                        <p className="text-sm text-gray-700">{address.countryCode}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!address.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefaultAddress(address._id!)}
                          >
                            {t('profile.addresses.setDefault')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAddress(address)}
                        >
                          {t('profile.addresses.edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAddress(address._id!)}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          {t('profile.addresses.delete')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">{t('profile.addresses.noAddresses')}</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('profile.orders.title')}</h2>
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
              <p className="text-gray-600 mb-4">{t('profile.orders.noOrders')}</p>
              <Link href="/products">
                <Button variant="primary">{t('profile.dashboard.startShopping')}</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.number}`}
                  onClick={(e) => handleOrderClick(order.number, e)}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-6 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{t('profile.orders.orderNumber')}{order.number}</h3>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">{t('profile.dashboard.orderStatus')}</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">{t('profile.dashboard.paymentStatus')}</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getPaymentStatusColor(order.paymentStatus)}`}>
                            {order.paymentStatus}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        {order.itemsCount} {order.itemsCount !== 1 ? t('profile.orders.items') : t('profile.orders.item')} • {t('profile.dashboard.placedOn')} {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-gray-900">
                        {formatPrice(order.total, (order.currency || 'AMD') as CurrencyCode)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{t('profile.dashboard.viewDetails')}</p>
                    </div>
                  </div>
                </Link>
              ))}
              
              {/* Pagination */}
              {ordersMeta && ordersMeta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    {t('profile.orders.page')} {ordersMeta.page} {t('profile.orders.of')} {ordersMeta.totalPages} • {ordersMeta.total} {t('profile.orders.totalOrders')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage(prev => Math.max(1, prev - 1))}
                      disabled={ordersPage === 1 || ordersLoading}
                    >
                      {t('profile.orders.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage(prev => Math.min(ordersMeta.totalPages, prev + 1))}
                      disabled={ordersPage === ordersMeta.totalPages || ordersLoading}
                    >
                      {t('profile.orders.next')}
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
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('profile.password.title')}</h2>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-2xl">
            <Input
              label={t('profile.password.currentPassword')}
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              placeholder={t('profile.password.currentPasswordPlaceholder')}
              required
            />
            <Input
              label={t('profile.password.newPassword')}
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder={t('profile.password.newPasswordPlaceholder')}
              required
            />
            <Input
              label={t('profile.password.confirmPassword')}
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              placeholder={t('profile.password.confirmPasswordPlaceholder')}
              required
            />
            <div className="pt-4">
              <Button type="submit" variant="primary" disabled={savingPassword}>
                {savingPassword ? t('profile.password.changing') : t('profile.password.change')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={() => setSelectedOrder(null)}
          ></div>

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('profile.orderDetails.title')}{selectedOrder.number}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('profile.orderDetails.placedOn')} {new Date(selectedOrder.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleReOrder}
                    disabled={isReordering}
                    variant="primary"
                    size="sm"
                  >
                    {isReordering ? t('profile.orderDetails.adding') : t('profile.orderDetails.reorder')}
                  </Button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    aria-label={t('profile.orderDetails.close')}
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                {orderDetailsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">{t('profile.orderDetails.loading')}</p>
                  </div>
                ) : orderDetailsError ? (
                  <div className="text-center py-12">
                    <p className="text-red-600 mb-4">{orderDetailsError}</p>
                    <Button onClick={() => setSelectedOrder(null)} variant="outline">{t('profile.orderDetails.close')}</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Order Details */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Status */}
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.orderDetails.orderStatus')}</h3>
                        <div className="flex flex-wrap items-center gap-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
                            {selectedOrder.status}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                            {t('profile.orderDetails.payment')}: {selectedOrder.paymentStatus}
                          </span>
                        </div>
                      </Card>

                      {/* Order Items */}
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.orderDetails.orderItems')}</h3>
                        <div className="space-y-4">
                          {selectedOrder.items.map((item, index) => {
                            // Extract color and size from variant options (case-insensitive matching)
                            const colorOption = item.variantOptions?.find(opt => {
                              const key = opt.attributeKey?.toLowerCase()?.trim();
                              return key === 'color' || key === 'colour';
                            });
                            const sizeOption = item.variantOptions?.find(opt => {
                              const key = opt.attributeKey?.toLowerCase()?.trim();
                              return key === 'size';
                            });
                            const color = colorOption?.value;
                            const size = sizeOption?.value;
                            
                            return (
                              <div key={index} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                                {item.imageUrl && (
                                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                    <img 
                                      src={item.imageUrl} 
                                      alt={item.productTitle}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <h4 className="text-lg font-semibold text-gray-900 mb-1">{item.productTitle}</h4>
                                  
                                  {/* Display variation options (color and size) */}
                                  {(color || size) && (
                                    <div className="flex flex-wrap gap-3 mt-2 mb-2">
                                      {color && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-700">{t('profile.orderDetails.color')}:</span>
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-5 h-5 rounded-full border border-gray-300"
                                              style={{ 
                                                backgroundColor: getColorValue(color),
                                              }}
                                              title={color}
                                            />
                                            <span className="text-sm text-gray-900 capitalize">{color}</span>
                                          </div>
                                        </div>
                                      )}
                                      {size && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-700">{t('profile.orderDetails.size')}:</span>
                                          <span className="text-sm text-gray-900 uppercase">{size}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  <p className="text-sm text-gray-600">{t('profile.orderDetails.sku')}: {item.sku}</p>
                                  <p className="text-sm text-gray-600 mt-2">
                                    {t('profile.orderDetails.quantity')}: {item.quantity} × {formatPrice(item.price, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)} = {formatPrice(item.total, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>

                    </div>

                    {/* Order Summary + Shipping */}
                    <div className="space-y-4">
                      <Card className="p-6 sticky top-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.orderDetails.orderSummary')}</h3>
                        <div className="space-y-4 mb-6">
                          {selectedOrder.totals ? (
                            <>
                              <div className="flex justify-between text-gray-600">
                                <span>{t('profile.orderDetails.subtotal')}</span>
                                <span>{formatPrice(selectedOrder.totals.subtotal, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)}</span>
                              </div>
                              {selectedOrder.totals.discount > 0 && (
                                <div className="flex justify-between text-gray-600">
                                  <span>{t('profile.orderDetails.discount')}</span>
                                  <span>-{formatPrice(selectedOrder.totals.discount, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-gray-600">
                                <span>{t('profile.orderDetails.shipping')}</span>
                                <span>{formatPrice(selectedOrder.totals.shipping, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>{t('profile.orderDetails.tax')}</span>
                                <span>{formatPrice(selectedOrder.totals.tax, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)}</span>
                              </div>
                              <div className="border-t border-gray-200 pt-4">
                                <div className="flex justify-between text-lg font-bold text-gray-900">
                                  <span>{t('profile.orderDetails.total')}</span>
                                  <span>{formatPrice(selectedOrder.totals.total, (selectedOrder.totals.currency || 'AMD') as CurrencyCode)}</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-600">{t('profile.orderDetails.loadingTotals')}</div>
                          )}
                        </div>
                      </Card>

                      {/* Shipping Method */}
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.orderDetails.shippingMethod')}</h3>
                        <div className="text-gray-700 space-y-3">
                          <div>
                            <span className="font-medium">{t('profile.orderDetails.method')}: </span>
                            <span className="capitalize">
                              {selectedOrder.shippingMethod === 'delivery' ? t('profile.orderDetails.delivery') : 
                               selectedOrder.shippingMethod === 'pickup' ? t('profile.orderDetails.pickup') : 
                               selectedOrder.shippingMethod || t('profile.orderDetails.notSpecified')}
                            </span>
                          </div>
                          {selectedOrder.shippingMethod === 'delivery' && selectedOrder.shippingAddress && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="font-medium text-gray-900 mb-2">{t('profile.orderDetails.deliveryAddress')}:</p>
                              <div className="text-gray-600">
                                {selectedOrder.shippingAddress.firstName && selectedOrder.shippingAddress.lastName && (
                                  <p>{selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}</p>
                                )}
                                {selectedOrder.shippingAddress.addressLine1 && <p>{selectedOrder.shippingAddress.addressLine1}</p>}
                                {selectedOrder.shippingAddress.addressLine2 && <p>{selectedOrder.shippingAddress.addressLine2}</p>}
                                {selectedOrder.shippingAddress.city && (
                                  <p>
                                    {selectedOrder.shippingAddress.city}
                                    {selectedOrder.shippingAddress.postalCode && `, ${selectedOrder.shippingAddress.postalCode}`}
                                  </p>
                                )}
                                {selectedOrder.shippingAddress.countryCode && <p>{selectedOrder.shippingAddress.countryCode}</p>}
                                {selectedOrder.shippingAddress.phone && <p className="mt-2">{t('profile.orderDetails.phone')}: {selectedOrder.shippingAddress.phone}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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

