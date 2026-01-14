'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';
import { useTranslation } from '../../../lib/i18n-client';
import { clearCurrencyRatesCache } from '../../../lib/currency';

interface Settings {
  defaultCurrency?: string;
  globalDiscount?: number;
  categoryDiscounts?: Record<string, number>;
  brandDiscounts?: Record<string, number>;
  currencyRates?: Record<string, number>;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    defaultCurrency: 'USD',
    currencyRates: {
      USD: 1,
      AMD: 400,
      EUR: 0.92,
      RUB: 90,
      GEL: 2.7,
    },
  });

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
      fetchSettings();
    }
  }, [isLoggedIn, isAdmin]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      console.log('⚙️ [ADMIN] Fetching settings...');
      const data = await apiClient.get<Settings>('/api/v1/admin/settings');
      setSettings({
        defaultCurrency: data.defaultCurrency || 'USD',
        globalDiscount: data.globalDiscount,
        categoryDiscounts: data.categoryDiscounts,
        brandDiscounts: data.brandDiscounts,
        currencyRates: data.currencyRates || {
          USD: 1,
          AMD: 400,
          EUR: 0.92,
          RUB: 90,
          GEL: 2.7,
        },
      });
      console.log('✅ [ADMIN] Settings loaded:', data);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching settings:', err);
      // Use defaults if error
      setSettings({
        defaultCurrency: 'USD',
        currencyRates: {
          USD: 1,
          AMD: 400,
          EUR: 0.92,
          RUB: 90,
          GEL: 2.7,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('⚙️ [ADMIN] Saving settings...', settings);

      // Ensure all currency rates have valid values before saving
      const currencyRatesToSave = {
        USD: 1,
        AMD: settings.currencyRates?.AMD ?? 400,
        EUR: settings.currencyRates?.EUR ?? 0.92,
        RUB: settings.currencyRates?.RUB ?? 90,
        GEL: settings.currencyRates?.GEL ?? 2.7,
      };

      await apiClient.put('/api/v1/admin/settings', {
        defaultCurrency: settings.defaultCurrency,
        currencyRates: currencyRatesToSave,
      });
      
      // Clear currency rates cache to force reload
      console.log('🔄 [ADMIN] Clearing currency rates cache...');
      clearCurrencyRatesCache();
      
      // Wait a bit to ensure cache is cleared, then dispatch event again
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log('🔄 [ADMIN] Dispatching currency-rates-updated event...');
          window.dispatchEvent(new Event('currency-rates-updated'));
        }
      }, 100);
      
      alert(t('admin.settings.savedSuccess'));
      console.log('✅ [ADMIN] Settings saved, currency rates:', currencyRatesToSave);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error saving settings:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save settings';
      alert(t('admin.settings.errorSaving').replace('{message}', errorMessage));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('admin.settings.backToAdmin')}
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.settings.title')}</h1>
        </div>

        {/* General Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.settings.generalSettings')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.settings.siteName')}
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={t('admin.settings.siteNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.settings.siteDescription')}
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                defaultValue={t('admin.settings.siteDescriptionPlaceholder')}
              />
            </div>
          </div>
        </Card>

        {/* Payment Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.settings.paymentSettings')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.settings.defaultCurrency')}
              </label>
              <select 
                value={settings.defaultCurrency || 'USD'}
                onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="AMD">{t('admin.settings.amd')}</option>
                <option value="USD">{t('admin.settings.usd')}</option>
                <option value="EUR">{t('admin.settings.eur')}</option>
              </select>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">{t('admin.settings.enableOnlinePayments')}</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Currency Exchange Rates */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('admin.settings.currencyRates')}</h2>
          <p className="text-sm text-gray-600 mb-4">{t('admin.settings.currencyRatesDescription')}</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  USD (US Dollar)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.currencyRates?.USD || 1}
                  onChange={(e) => setSettings({
                    ...settings,
                    currencyRates: {
                      ...settings.currencyRates,
                      USD: parseFloat(e.target.value) || 1,
                    },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.baseCurrency')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AMD (Armenian Dram)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.currencyRates?.AMD ?? ''}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '') {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          AMD: undefined as any,
                        },
                      });
                    } else {
                      const numValue = parseFloat(inputValue);
                      if (!isNaN(numValue) && numValue > 0) {
                        setSettings({
                          ...settings,
                          currencyRates: {
                            ...settings.currencyRates,
                            AMD: numValue,
                          },
                        });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '' && settings.currencyRates?.AMD === undefined) {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          AMD: 400,
                        },
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="400"
                />
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.rateToUSD')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EUR (Euro)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.currencyRates?.EUR ?? ''}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '') {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          EUR: undefined as any,
                        },
                      });
                    } else {
                      const numValue = parseFloat(inputValue);
                      if (!isNaN(numValue) && numValue > 0) {
                        setSettings({
                          ...settings,
                          currencyRates: {
                            ...settings.currencyRates,
                            EUR: numValue,
                          },
                        });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '' && settings.currencyRates?.EUR === undefined) {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          EUR: 0.92,
                        },
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.92"
                />
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.rateToUSD')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUB (Russian Ruble)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.currencyRates?.RUB ?? ''}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '') {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          RUB: undefined as any,
                        },
                      });
                    } else {
                      const numValue = parseFloat(inputValue);
                      if (!isNaN(numValue) && numValue > 0) {
                        setSettings({
                          ...settings,
                          currencyRates: {
                            ...settings.currencyRates,
                            RUB: numValue,
                          },
                        });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '' && settings.currencyRates?.RUB === undefined) {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          RUB: 90,
                        },
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="90"
                />
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.rateToUSD')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GEL (Georgian Lari)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.currencyRates?.GEL ?? ''}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (inputValue === '') {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          GEL: undefined as any,
                        },
                      });
                    } else {
                      const numValue = parseFloat(inputValue);
                      if (!isNaN(numValue) && numValue > 0) {
                        setSettings({
                          ...settings,
                          currencyRates: {
                            ...settings.currencyRates,
                            GEL: numValue,
                          },
                        });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '' && settings.currencyRates?.GEL === undefined) {
                      setSettings({
                        ...settings,
                        currencyRates: {
                          ...settings.currencyRates,
                          GEL: 2.7,
                        },
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2.7"
                />
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.rateToUSD')}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('admin.settings.saving') : t('admin.settings.saveSettings')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/admin')}
            disabled={saving}
          >
            {t('admin.settings.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

