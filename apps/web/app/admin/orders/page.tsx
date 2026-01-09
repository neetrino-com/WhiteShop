'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';
import { useTranslation } from '../../../lib/i18n-client';

interface Order {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: number;
  currency: string;
  customerEmail: string;
  customerPhone: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerId?: string | null;
  itemsCount: number;
  createdAt: string;
}

interface OrdersResponse {
  data: Order[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function OrdersPage() {
  const { t } = useTranslation();
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<OrdersResponse['meta'] | null>(null);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [updatingStatuses, setUpdatingStatuses] = useState<Set<string>>(new Set());
  const [updatingPaymentStatuses, setUpdatingPaymentStatuses] = useState<Set<string>>(new Set());
  const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Initialize filters from URL params on mount and when URL changes
  useEffect(() => {
    if (searchParams) {
      const status = searchParams.get('status') || '';
      const paymentStatus = searchParams.get('paymentStatus') || '';
      setStatusFilter(status);
      setPaymentStatusFilter(paymentStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn || !isAdmin) {
        router.push('/admin');
        return;
      }
    }
  }, [isLoggedIn, isAdmin, isLoading, router]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📦 [ADMIN] Fetching orders...', { page, statusFilter, paymentStatusFilter, sortBy, sortOrder });
      
      const response = await apiClient.get<OrdersResponse>('/api/v1/admin/orders', {
        params: {
          page: page.toString(),
          limit: '20',
          status: statusFilter || '',
          paymentStatus: paymentStatusFilter || '',
          sortBy: sortBy || '',
          sortOrder: sortOrder || '',
        },
      });

      console.log('✅ [ADMIN] Orders fetched:', response);
      setOrders(response.data || []);
      setMeta(response.meta || null);
    } catch (err) {
      console.error('❌ [ADMIN] Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentStatusFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isAdmin, page, statusFilter, paymentStatusFilter, sortBy, sortOrder]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (orders.length === 0) return;
    setSelectedIds(prev => {
      const allIds = orders.map(o => o.id);
      const hasAll = allIds.every(id => prev.has(id));
      return hasAll ? new Set() : new Set(allIds);
    });
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order if same column
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to descending
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1); // Reset to first page when sorting changes
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('admin.orders.deleteConfirm').replace('{count}', selectedIds.size.toString()))) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      console.log('🗑️ [ADMIN] Starting bulk delete for orders:', ids);
      
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          try {
            const response = await apiClient.delete(`/api/v1/admin/orders/${id}`);
            console.log('✅ [ADMIN] Order deleted successfully:', id, response);
            return { id, success: true };
          } catch (error: any) {
            console.error('❌ [ADMIN] Failed to delete order:', id, error);
            return { id, success: false, error: error.message || t('admin.common.unknownErrorFallback') };
          }
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
      
      console.log('📊 [ADMIN] Bulk delete results:', {
        total: ids.length,
        successful: successful.length,
        failed: failed.length,
      });
      
      setSelectedIds(new Set());
      await fetchOrders();
      
      if (failed.length > 0) {
        const failedIds = failed.map(r => 
          r.status === 'fulfilled' ? r.value.id : 'unknown'
        );
        alert(t('admin.orders.bulkDeleteFailed').replace('{success}', successful.length.toString()).replace('{total}', ids.length.toString()).replace('{failed}', failedIds.join(', ')));
      } else {
        alert(t('admin.orders.bulkDeleteFinished').replace('{success}', successful.length.toString()).replace('{total}', ids.length.toString()));
      }
    } catch (err) {
      console.error('❌ [ADMIN] Bulk delete orders error:', err);
      alert(t('admin.orders.failedToDelete'));
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      console.log('📝 [ADMIN] Changing order status:', { orderId, newStatus });
      
      // Add to updating set
      setUpdatingStatuses((prev) => new Set(prev).add(orderId));
      setUpdateMessage(null);

      // Update order status via API
      await apiClient.put(`/api/v1/admin/orders/${orderId}`, {
        status: newStatus,
      });

      console.log('✅ [ADMIN] Order status updated successfully');

      // Update local state
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      // Show success message
      setUpdateMessage({ type: 'success', text: t('admin.orders.statusUpdated') });
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (err) {
      console.error('❌ [ADMIN] Error updating order status:', err);
      setUpdateMessage({ 
        type: 'error', 
        text: t('admin.orders.failedToUpdateStatus')
      });
      setTimeout(() => setUpdateMessage(null), 5000);
    } finally {
      // Remove from updating set
      setUpdatingStatuses((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handlePaymentStatusChange = async (orderId: string, newPaymentStatus: string) => {
    try {
      console.log('📝 [ADMIN] Changing order payment status:', { orderId, newPaymentStatus });
      
      // Add to updating set
      setUpdatingPaymentStatuses((prev) => new Set(prev).add(orderId));
      setUpdateMessage(null);

      // Update order payment status via API
      await apiClient.put(`/api/v1/admin/orders/${orderId}`, {
        paymentStatus: newPaymentStatus,
      });

      console.log('✅ [ADMIN] Order payment status updated successfully');

      // Update local state
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, paymentStatus: newPaymentStatus } : order
        )
      );

      // Show success message
      setUpdateMessage({ type: 'success', text: t('admin.orders.paymentStatusUpdated') });
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (err) {
      console.error('❌ [ADMIN] Error updating order payment status:', err);
      setUpdateMessage({ 
        type: 'error', 
        text: t('admin.orders.failedToUpdatePaymentStatus')
      });
      setTimeout(() => setUpdateMessage(null), 5000);
    } finally {
      // Remove from updating set
      setUpdatingPaymentStatuses((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.orders.loading')}</p>
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
            {t('admin.orders.backToAdmin')}
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.orders.title')}</h1>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex gap-4 items-center flex-wrap">
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => {
                const newStatus = e.target.value;
                setStatusFilter(newStatus);
                setPage(1);
                // Update URL without causing navigation
                const params = new URLSearchParams(searchParams?.toString() || '');
                if (newStatus) {
                  params.set('status', newStatus);
                } else {
                  params.delete('status');
                }
                const newUrl = params.toString() ? `/admin/orders?${params.toString()}` : '/admin/orders';
                router.push(newUrl, { scroll: false });
              }}
            >
              <option value="">{t('admin.orders.allStatuses')}</option>
              <option value="pending">{t('admin.orders.pending')}</option>
              <option value="processing">{t('admin.orders.processing')}</option>
              <option value="completed">{t('admin.orders.completed')}</option>
              <option value="cancelled">{t('admin.orders.cancelled')}</option>
            </select>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={paymentStatusFilter}
              onChange={(e) => {
                const newPaymentStatus = e.target.value;
                setPaymentStatusFilter(newPaymentStatus);
                setPage(1);
                // Update URL without causing navigation
                const params = new URLSearchParams(searchParams?.toString() || '');
                if (newPaymentStatus) {
                  params.set('paymentStatus', newPaymentStatus);
                } else {
                  params.delete('paymentStatus');
                }
                const newUrl = params.toString() ? `/admin/orders?${params.toString()}` : '/admin/orders';
                router.push(newUrl, { scroll: false });
              }}
            >
              <option value="">{t('admin.orders.allPaymentStatuses')}</option>
              <option value="paid">{t('admin.orders.paid')}</option>
              <option value="pending">{t('admin.orders.pendingPayment')}</option>
              <option value="failed">{t('admin.orders.failed')}</option>
            </select>
            {updateMessage && (
              <div
                className={`px-4 py-2 rounded-md text-sm ${
                  updateMessage.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {updateMessage.text}
              </div>
            )}
          </div>
        </Card>

        {/* Selection Controls */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {t('admin.orders.selectedOrders').replace('{count}', selectedIds.size.toString())}
            </div>
            <Button
              variant="outline"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkDeleting}
            >
              {bulkDeleting ? t('admin.orders.deleting') : t('admin.orders.deleteSelected')}
            </Button>
          </div>
        </Card>

        {/* Orders Table */}
        <Card className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('admin.orders.loadingOrders')}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">{t('admin.orders.noOrders')}</p>
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
                          aria-label={t('admin.orders.selectAllOrders')}
                          checked={orders.length > 0 && orders.every(o => selectedIds.has(o.id))}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('admin.orders.orderNumber')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('admin.orders.customer')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('admin.orders.status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('admin.orders.payment')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('total')}
                      >
                        <div className="flex items-center gap-1">
                          {t('admin.orders.total')}
                          <div className="flex flex-col">
                            <svg 
                              className={`w-3 h-3 ${sortBy === 'total' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                            <svg 
                              className={`w-3 h-3 -mt-1 ${sortBy === 'total' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('admin.orders.items')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-1">
                          {t('admin.orders.date')}
                          <div className="flex flex-col">
                            <svg 
                              className={`w-3 h-3 ${sortBy === 'createdAt' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                            <svg 
                              className={`w-3 h-3 -mt-1 ${sortBy === 'createdAt' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            aria-label={t('admin.orders.selectOrder').replace('{number}', order.number)}
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{order.number}</div>
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            console.log('📂 [ADMIN][Orders] Navigate to order details page', {
                              orderId: order.id,
                            });
                            router.push(`/admin/orders/${order.id}`);
                          }}
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {[order.customerFirstName, order.customerLastName].filter(Boolean).join(' ') || t('admin.orders.unknownCustomer')}
                          </div>
                          {order.customerPhone && (
                            <div className="text-sm text-gray-500">{order.customerPhone}</div>
                          )}
                          <div className="mt-1 text-xs text-blue-600">{t('admin.orders.viewOrderDetails')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {updatingStatuses.has(order.id) ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                <span className="text-xs text-gray-500">{t('admin.orders.updating')}</span>
                              </div>
                            ) : (
                              <select
                                value={order.status}
                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                className={`px-2 py-1 text-xs font-medium rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${getStatusColor(order.status)}`}
                              >
                                <option value="pending">{t('admin.orders.pending')}</option>
                                <option value="processing">{t('admin.orders.processing')}</option>
                                <option value="completed">{t('admin.orders.completed')}</option>
                                <option value="cancelled">{t('admin.orders.cancelled')}</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {updatingPaymentStatuses.has(order.id) ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                <span className="text-xs text-gray-500">{t('admin.orders.updating')}</span>
                              </div>
                            ) : (
                              <select
                                value={order.paymentStatus}
                                onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                                className={`px-2 py-1 text-xs font-medium rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${getPaymentStatusColor(order.paymentStatus)}`}
                              >
                                <option value="paid">{t('admin.orders.paid')}</option>
                                <option value="pending">{t('admin.orders.pendingPayment')}</option>
                                <option value="failed">{t('admin.orders.failed')}</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(order.total, order.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.itemsCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    {t('admin.orders.showingPage').replace('{page}', meta.page.toString()).replace('{totalPages}', meta.totalPages.toString()).replace('{total}', meta.total.toString())}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {t('admin.orders.previous')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                      disabled={page === meta.totalPages}
                    >
                      {t('admin.orders.next')}
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

