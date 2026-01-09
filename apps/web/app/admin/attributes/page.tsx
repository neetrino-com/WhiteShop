'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { apiClient } from '../../../lib/api-client';
import { AdminMenuDrawer } from '../../../components/AdminMenuDrawer';
import { getAdminMenuTABS } from '../admin-menu.config';
import { useTranslation } from '../../../lib/i18n-client';

interface AttributeValue {
  id: string;
  value: string;
  label: string;
}

interface Attribute {
  id: string;
  key: string;
  name: string;
  type: string;
  filterable: boolean;
  values: AttributeValue[];
}

function AttributesPageContent() {
  const { t } = useTranslation();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null);
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(new Set());
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
  });
  
  const [newValue, setNewValue] = useState('');
  const [addingValueTo, setAddingValueTo] = useState<string | null>(null);
  const [deletingValue, setDeletingValue] = useState<string | null>(null);

  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📋 [ADMIN] Fetching attributes...');
      const response = await apiClient.get<{ data: Attribute[] }>('/api/v1/admin/attributes');
      setAttributes(response.data || []);
      console.log('✅ [ADMIN] Attributes loaded:', response.data?.length || 0);
    } catch (err) {
      console.error('❌ [ADMIN] Error fetching attributes:', err);
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const handleCreateAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert(t('admin.attributes.fillName'));
      return;
    }

    // Auto-generate key from name
    const autoKey = formData.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    try {
      console.log('🆕 [ADMIN] Creating attribute:', autoKey);
      await apiClient.post('/api/v1/admin/attributes', {
        name: formData.name.trim(),
        key: autoKey,
        type: 'select',
        filterable: true,
        locale: 'en',
      });
      
      console.log('✅ [ADMIN] Attribute created successfully');
      setShowAddForm(false);
      setFormData({ name: '' });
      fetchAttributes();
      alert(t('admin.attributes.createdSuccess'));
    } catch (err: any) {
      console.error('❌ [ADMIN] Error creating attribute:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to create attribute';
      alert(t('admin.attributes.errorCreating').replace('{message}', errorMessage));
    }
  };

  const handleDeleteAttribute = async (attributeId: string, attributeName: string) => {
    if (!confirm(t('admin.attributes.deleteConfirm').replace('{name}', attributeName))) {
      return;
    }

    try {
      console.log(`🗑️ [ADMIN] Deleting attribute: ${attributeName} (${attributeId})`);
      await apiClient.delete(`/api/v1/admin/attributes/${attributeId}`);
      console.log('✅ [ADMIN] Attribute deleted successfully');
      fetchAttributes();
      alert(t('admin.attributes.deletedSuccess'));
    } catch (err: any) {
      console.error('❌ [ADMIN] Error deleting attribute:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to delete attribute';
      alert(t('admin.attributes.errorDeleting').replace('{message}', errorMessage));
    }
  };

  const handleAddValue = async (attributeId: string) => {
    if (!newValue.trim()) {
      alert(t('admin.attributes.enterValue'));
      return;
    }

    try {
      setAddingValueTo(attributeId);
      console.log('➕ [ADMIN] Adding value to attribute:', attributeId, newValue);
      await apiClient.post(`/api/v1/admin/attributes/${attributeId}/values`, {
        label: newValue.trim(),
        locale: 'en',
      });
      
      console.log('✅ [ADMIN] Value added successfully');
      setNewValue('');
      setAddingValueTo(null);
      fetchAttributes();
    } catch (err: any) {
      console.error('❌ [ADMIN] Error adding value:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to add value';
      alert(t('admin.attributes.errorAddingValue').replace('{message}', errorMessage));
      setAddingValueTo(null);
    }
  };

  const handleDeleteValue = async (attributeId: string, valueId: string, valueLabel: string) => {
    if (!confirm(t('admin.attributes.deleteValueConfirm').replace('{label}', valueLabel))) {
      return;
    }

    try {
      setDeletingValue(valueId);
      console.log(`🗑️ [ADMIN] Deleting value: ${valueLabel} (${valueId})`);
      await apiClient.delete(`/api/v1/admin/attributes/${attributeId}/values/${valueId}`);
      console.log('✅ [ADMIN] Value deleted successfully');
      fetchAttributes();
      setDeletingValue(null);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error deleting value:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to delete value';
      alert(t('admin.attributes.errorDeletingValue').replace('{message}', errorMessage));
      setDeletingValue(null);
    }
  };

  const toggleExpand = (attributeId: string) => {
    setExpandedAttributes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(attributeId)) {
        newSet.delete(attributeId);
      } else {
        newSet.add(attributeId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">{t('admin.attributes.loadingAttributes')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('admin.attributes.title')}</h1>
            <p className="text-gray-600 mt-2">{t('admin.attributes.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showAddForm ? t('admin.attributes.cancel') : t('admin.attributes.addAttribute')}
          </button>
        </div>

        {/* Add Attribute Form */}
        {showAddForm && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.attributes.createNewAttribute')}</h2>
            <form onSubmit={handleCreateAttribute} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.attributes.name')} <span className="text-red-500">{t('admin.attributes.required')}</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('admin.attributes.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.attributes.keyAutoGenerated')}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {t('admin.attributes.createAttribute')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData({ name: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('admin.attributes.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Attributes List */}
        {attributes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('admin.attributes.noAttributes')}</h3>
            <p className="text-gray-600 mb-4">{t('admin.attributes.getStarted')}</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {t('admin.attributes.createAttribute')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {attributes.map((attribute) => {
              const isExpanded = expandedAttributes.has(attribute.id);
              return (
                <div
                  key={attribute.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Attribute Header */}
                  <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        onClick={() => toggleExpand(attribute.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{attribute.name}</h3>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {attribute.key}
                          </span>
                          {attribute.filterable && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {t('admin.attributes.filterable')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {attribute.values.length === 1 
                            ? t('admin.attributes.values').replace('{count}', attribute.values.length.toString())
                            : t('admin.attributes.valuesPlural').replace('{count}', attribute.values.length.toString())
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAttribute(attribute.id, attribute.name)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('admin.attributes.deleteAttribute')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Values Section */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {/* Add Value Form */}
                      <div className="mb-4 flex gap-2">
                        <input
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newValue.trim()) {
                              handleAddValue(attribute.id);
                            }
                          }}
                          placeholder={t('admin.attributes.addNewValue')}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleAddValue(attribute.id)}
                          disabled={!newValue.trim() || addingValueTo === attribute.id}
                          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {addingValueTo === attribute.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              {t('admin.attributes.adding')}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {t('admin.attributes.add')}
                            </>
                          )}
                        </button>
                      </div>

                      {/* Values List */}
                      {attribute.values.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">{t('admin.attributes.noValuesYet')}</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {attribute.values.map((value) => (
                            <div
                              key={value.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                            >
                              <span className="text-sm font-medium text-gray-900">{value.label}</span>
                              <button
                                onClick={() => handleDeleteValue(attribute.id, value.id, value.label)}
                                disabled={deletingValue === value.id}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                                title={t('admin.attributes.deleteValue')}
                              >
                                {deletingValue === value.id ? (
                                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttributesPage() {
  const { t } = useTranslation();
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [currentPath, setCurrentPath] = useState(pathname || '/admin/attributes');

  useEffect(() => {
    if (pathname) {
      setCurrentPath(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn || !isAdmin) {
        router.push('/admin');
      }
    }
  }, [isLoggedIn, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">{t('admin.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null; // Will redirect
  }

  const adminTabs = getAdminMenuTABS(t);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Mobile Menu */}
          <div className="lg:hidden mb-6">
            <AdminMenuDrawer tabs={adminTabs} currentPath={currentPath} />
          </div>
          
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <nav className="bg-white border border-gray-200 rounded-lg p-2 space-y-1">
              {adminTabs.map((tab) => {
                const isActive =
                  currentPath === tab.path ||
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
            <AttributesPageContent />
          </div>
        </div>
      </div>
    </div>
  );
}

