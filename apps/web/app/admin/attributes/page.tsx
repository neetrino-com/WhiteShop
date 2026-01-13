'use client';

import { useEffect, useState, useCallback, useRef, ChangeEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { apiClient } from '../../../lib/api-client';
import { AdminMenuDrawer } from '../../../components/AdminMenuDrawer';
import { getAdminMenuTABS } from '../admin-menu.config';
import { useTranslation } from '../../../lib/i18n-client';
import { showToast } from '../../../components/Toast';
import { ColorPaletteSelector } from '../../../components/ColorPaletteSelector';
import { getColorHex } from '../../../lib/colorMap';

interface AttributeValue {
  id: string;
  value: string;
  label: string;
  colors?: string[];
  imageUrl?: string | null;
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
  const [editingValue, setEditingValue] = useState<{ attributeId: string; value: AttributeValue } | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);
  const [expandedValueId, setExpandedValueId] = useState<string | null>(null);
  
  // Inline edit form states
  const [editingLabel, setEditingLabel] = useState('');
  const [editingColors, setEditingColors] = useState<string[]>([]);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [savingValue, setSavingValue] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      showToast(t('admin.attributes.fillName'), 'warning');
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
      showToast(t('admin.attributes.createdSuccess'), 'success');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error creating attribute:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to create attribute';
      showToast(t('admin.attributes.errorCreating').replace('{message}', errorMessage), 'error');
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
      showToast(t('admin.attributes.deletedSuccess'), 'success');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error deleting attribute:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to delete attribute';
      showToast(t('admin.attributes.errorDeleting').replace('{message}', errorMessage), 'error');
    }
  };

  const handleAddValue = async (attributeId: string) => {
    const trimmedValue = newValue.trim();
    
    if (!trimmedValue) {
      showToast(t('admin.attributes.enterValue'), 'warning');
      setValueError(t('admin.attributes.enterValue'));
      return;
    }

    // Find the attribute
    const attribute = attributes.find((attr) => attr.id === attributeId);
    if (!attribute) {
      showToast(t('admin.attributes.attributeNotFound'), 'error');
      return;
    }

    // Check for duplicates on frontend (case-insensitive, normalized)
    const normalizedNewValue = trimmedValue.toLowerCase().trim();
    const existingValue = attribute.values.find((val) => {
      const normalizedExisting = val.label.toLowerCase().trim();
      return normalizedExisting === normalizedNewValue;
    });

    if (existingValue) {
      const errorMsg = t('admin.attributes.valueAlreadyExists').replace('{value}', trimmedValue);
      showToast(errorMsg, 'error', 5000);
      setValueError(errorMsg);
      return;
    }

    // Clear any previous errors
    setValueError(null);

    try {
      setAddingValueTo(attributeId);
      console.log('➕ [ADMIN] Adding value to attribute:', attributeId, trimmedValue);
      await apiClient.post(`/api/v1/admin/attributes/${attributeId}/values`, {
        label: trimmedValue,
        locale: 'en',
      });
      
      console.log('✅ [ADMIN] Value added successfully');
      setNewValue('');
      setValueError(null);
      setAddingValueTo(null);
      showToast(t('admin.attributes.valueAddedSuccess'), 'success');
      fetchAttributes();
    } catch (err: any) {
      console.error('❌ [ADMIN] Error adding value:', err);
      const errorMessage = err?.data?.detail || err?.message || t('admin.attributes.failedToAddValue');
      
      // Check if it's a duplicate error from backend
      if (errorMessage.includes('already exists') || errorMessage.includes('уже существует')) {
        const duplicateMsg = t('admin.attributes.valueAlreadyExists').replace('{value}', trimmedValue);
        showToast(duplicateMsg, 'error', 5000);
        setValueError(duplicateMsg);
      } else {
        showToast(errorMessage, 'error', 5000);
        setValueError(errorMessage);
      }
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
      showToast(t('admin.attributes.valueDeletedSuccess'), 'success');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error deleting value:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to delete value';
      showToast(t('admin.attributes.errorDeletingValue').replace('{message}', errorMessage), 'error');
      setDeletingValue(null);
    }
  };

  const handleUpdateValue = async (data: {
    label?: string;
    colors?: string[];
    imageUrl?: string | null;
  }) => {
    if (!editingValue) return;

    try {
      console.log('✏️ [ADMIN] Updating value:', { valueId: editingValue.value.id, data });
      await apiClient.patch(`/api/v1/admin/attributes/${editingValue.attributeId}/values/${editingValue.value.id}`, {
        ...data,
        locale: 'en',
      });
      console.log('✅ [ADMIN] Value updated successfully');
      fetchAttributes();
      showToast(t('admin.attributes.valueUpdatedSuccess'), 'success');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error updating value:', err);
      const errorMessage = err?.data?.detail || err?.message || 'Failed to update value';
      showToast(t('admin.attributes.errorUpdatingValue')?.replace('{message}', errorMessage) || errorMessage, 'error');
      throw err;
    }
  };

  const toggleValueEdit = (attributeId: string, value: AttributeValue) => {
    if (expandedValueId === value.id) {
      // Close
      setExpandedValueId(null);
      setEditingValue(null);
      setEditingLabel('');
      setEditingColors([]);
      setEditingImageUrl(null);
    } else {
      // Open
      setExpandedValueId(value.id);
      setEditingValue({ attributeId, value });
      setEditingLabel(value.label);
      setEditingColors(value.colors || []);
      setEditingImageUrl(value.imageUrl || null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const imageFile = files.find((file) => file.type.startsWith('image/'));
    if (!imageFile) {
      showToast(t('admin.attributes.valueModal.selectImageFile'), 'warning');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    try {
      setImageUploading(true);
      const base64 = await fileToBase64(imageFile);
      setEditingImageUrl(base64);
    } catch (error: any) {
      console.error('❌ [ADMIN] Error uploading image:', error);
      showToast(error?.message || t('admin.attributes.valueModal.failedToProcessImage'), 'error');
    } finally {
      setImageUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setEditingImageUrl(null);
  };

  const handleSaveInlineValue = async () => {
    if (!editingValue) return;

    try {
      setSavingValue(true);
      await handleUpdateValue({
        label: editingLabel.trim() !== editingValue.value.label ? editingLabel.trim() : undefined,
        colors: editingColors.length > 0 ? editingColors : undefined,
        imageUrl: editingImageUrl,
      });
      // Close the expanded form
      setExpandedValueId(null);
      setEditingValue(null);
      setEditingLabel('');
      setEditingColors([]);
      setEditingImageUrl(null);
    } catch (error: any) {
      console.error('❌ [ADMIN] Error saving value:', error);
    } finally {
      setSavingValue(false);
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
                      <div className="mb-4">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={newValue}
                              onChange={(e) => {
                                setNewValue(e.target.value);
                                // Clear error when user starts typing
                                if (valueError) {
                                  setValueError(null);
                                }
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && newValue.trim()) {
                                  handleAddValue(attribute.id);
                                }
                              }}
                              placeholder={t('admin.attributes.addNewValue')}
                              className={`
                                w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors
                                ${valueError 
                                  ? 'border-red-300 bg-red-50 focus:ring-red-500' 
                                  : 'border-gray-300 focus:ring-gray-900'
                                }
                              `}
                            />
                            {valueError && (
                              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {valueError}
                              </p>
                            )}
                          </div>
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
                      </div>

                      {/* Values List */}
                      {attribute.values.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">{t('admin.attributes.noValuesYet')}</p>
                      ) : (
                        <div className="space-y-2">
                          {attribute.values.map((value) => {
                            const isExpanded = expandedValueId === value.id;
                            return (
                              <div key={value.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                {/* Value Card */}
                                <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center gap-2 flex-1">
                                    {/* Color swatch or image */}
                                    {value.colors && value.colors.length > 0 ? (
                                      <span
                                        className="inline-block w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                                        style={{ backgroundColor: value.colors[0] }}
                                        title={value.colors[0]}
                                      />
                                    ) : value.imageUrl ? (
                                      <img
                                        src={value.imageUrl}
                                        alt={value.label}
                                        className="w-5 h-5 object-cover rounded border border-gray-300 flex-shrink-0"
                                      />
                                    ) : null}
                                    <span className="text-sm font-medium text-gray-900">{value.label}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => toggleValueEdit(attribute.id, value)}
                                      className="text-gray-600 hover:text-gray-900 transition-colors"
                                      title={t('admin.attributes.configureValue') || 'Configure value'}
                                    >
                                      <svg
                                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
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
                                </div>

                                {/* Inline Edit Form */}
                                {isExpanded && (
                                  <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                                    {/* Label */}
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {t('admin.attributes.valueModal.label')}
                                      </label>
                                      <input
                                        type="text"
                                        value={editingLabel}
                                        onChange={(e) => setEditingLabel(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                        placeholder={t('admin.attributes.valueModal.labelPlaceholder')}
                                      />
                                    </div>

                                    {/* Colors and Image Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Colors Section */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                          {t('admin.attributes.valueModal.colors')}
                                        </label>
                                        <ColorPaletteSelector colors={editingColors} onColorsChange={setEditingColors} />
                                      </div>

                                      {/* Image Section */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                          {t('admin.attributes.valueModal.image')}
                                        </label>
                                        {editingImageUrl ? (
                                          <div className="space-y-3">
                                            <div className="relative inline-block">
                                              <img
                                                src={editingImageUrl}
                                                alt={t('admin.attributes.valueModal.imagePreview')}
                                                className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                                              />
                                              <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors flex items-center justify-center"
                                                title={t('admin.attributes.valueModal.removeImage')}
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => fileInputRef.current?.click()}
                                              disabled={imageUploading}
                                              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {imageUploading ? t('admin.attributes.valueModal.uploading') : t('admin.attributes.valueModal.changeImage')}
                                            </button>
                                          </div>
                                        ) : (
                                          <div>
                                            <button
                                              type="button"
                                              onClick={() => fileInputRef.current?.click()}
                                              disabled={imageUploading}
                                              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                              {imageUploading ? (
                                                <>
                                                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                                                  {t('admin.attributes.valueModal.uploading')}
                                                </>
                                              ) : (
                                                <>
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                  </svg>
                                                  {t('admin.attributes.valueModal.uploadImage')}
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        )}
                                        <input
                                          ref={fileInputRef}
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={handleImageUpload}
                                        />
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => toggleValueEdit(attribute.id, value)}
                                        disabled={savingValue}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {t('admin.attributes.valueModal.cancel')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSaveInlineValue}
                                        disabled={savingValue || !editingLabel.trim()}
                                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >
                                        {savingValue ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {t('admin.attributes.valueModal.saving')}
                                          </>
                                        ) : (
                                          t('admin.attributes.valueModal.save')
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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

