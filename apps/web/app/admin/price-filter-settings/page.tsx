'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';
import { AdminMenuDrawer } from '../../../components/AdminMenuDrawer';
import { getAdminMenuTABS } from '../admin-menu.config';
import { useTranslation } from '../../../lib/i18n-client';

export default function PriceFilterSettingsPage() {
  const { t } = useTranslation();
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [stepSizeUSD, setStepSizeUSD] = useState<string>('');
  const [stepSizeAMD, setStepSizeAMD] = useState<string>('');
  const [stepSizeRUB, setStepSizeRUB] = useState<string>('');
  const [stepSizeGEL, setStepSizeGEL] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Храним предыдущее значение stepSize для расчета разницы
  const prevStepSizeRef = useRef<string>('');
  const isUpdatingRef = useRef<boolean>(false);

  const fetchSettings = useCallback(async () => {
    try {
      console.log('⚙️ [PRICE FILTER SETTINGS] Fetching settings...');
      setLoading(true);
      const response = await apiClient.get<{
        minPrice?: number;
        maxPrice?: number;
        stepSize?: number;
        stepSizePerCurrency?: {
          USD?: number;
          AMD?: number;
          RUB?: number;
          GEL?: number;
        };
      }>('/api/v1/admin/settings/price-filter');
      const minPriceStr = response.minPrice?.toString() || '';
      const maxPriceStr = response.maxPrice?.toString() || '';
      const per = response.stepSizePerCurrency || {};
      const fallbackStep = response.stepSize?.toString() || '';
      
      setMinPrice(minPriceStr);
      setMaxPrice(maxPriceStr);
      setStepSizeUSD(per.USD !== undefined ? per.USD.toString() : fallbackStep);
      setStepSizeAMD(per.AMD !== undefined ? per.AMD.toString() : '');
      setStepSizeRUB(per.RUB !== undefined ? per.RUB.toString() : '');
      setStepSizeGEL(per.GEL !== undefined ? per.GEL.toString() : '');
      prevStepSizeRef.current = fallbackStep;
      
      console.log('✅ [PRICE FILTER SETTINGS] Settings loaded:', response);
    } catch (err: any) {
      console.error('❌ [PRICE FILTER SETTINGS] Error fetching settings:', err);
      // If settings don't exist, use empty values
      setMinPrice('');
      setMaxPrice('');
      setStepSizeUSD('');
      setStepSizeAMD('');
      setStepSizeRUB('');
      setStepSizeGEL('');
      prevStepSizeRef.current = '';
    } finally {
      setLoading(false);
    }
  }, []);

  // Обработчик изменения базового Step Size (USD) - синхронизирует minPrice и maxPrice
  const handleStepSizeChange = (newValue: string) => {
    if (isUpdatingRef.current) return;
    
    const prevStep = prevStepSizeRef.current;
    
    // Если предыдущее значение пустое, просто обновляем
    if (!prevStep) {
      prevStepSizeRef.current = newValue;
      setStepSizeUSD(newValue);
      return;
    }
    
    const prevStepNum = parseFloat(prevStep);
    const newStepNum = parseFloat(newValue);
    
    // Если новое значение невалидно, просто обновляем stepSize
    if (isNaN(newStepNum) || newValue.trim() === '') {
      prevStepSizeRef.current = newValue;
      setStepSizeUSD(newValue);
      return;
    }
    
    // Вычисляем разницу
    const difference = newStepNum - prevStepNum;
    
    // Применяем разницу к minPrice и maxPrice, если они заполнены
    const prevMin = minPrice.trim();
    const prevMax = maxPrice.trim();
    
    if (prevMin && prevMax) {
      const prevMinNum = parseFloat(prevMin);
      const prevMaxNum = parseFloat(prevMax);
      
      if (!isNaN(prevMinNum) && !isNaN(prevMaxNum)) {
        const newMinNum = prevMinNum + difference;
        const newMaxNum = prevMaxNum + difference;
        
        // Обновляем все значения
        isUpdatingRef.current = true;
        setStepSizeUSD(newValue);
        setMinPrice(newMinNum > 0 ? newMinNum.toString() : '');
        setMaxPrice(newMaxNum > 0 ? newMaxNum.toString() : '');
        prevStepSizeRef.current = newValue;
        
        console.log('🔄 [PRICE FILTER] StepSize changed:', {
          prevStep: prevStepNum,
          newStep: newStepNum,
          difference,
          prevMin: prevMinNum,
          newMin: newMinNum,
          prevMax: prevMaxNum,
          newMax: newMaxNum
        });
        
        // Сбрасываем флаг после небольшой задержки
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
        return;
      }
    }
    
    // Если min/max не заполнены, просто обновляем stepSize
    prevStepSizeRef.current = newValue;
    setStepSizeUSD(newValue);
  };

  const handleSave = async () => {
    const minValue = minPrice.trim() ? parseFloat(minPrice) : null;
    const maxValue = maxPrice.trim() ? parseFloat(maxPrice) : null;
    const stepValueUSD = stepSizeUSD.trim() ? parseFloat(stepSizeUSD) : null;
    const stepValueAMD = stepSizeAMD.trim() ? parseFloat(stepSizeAMD) : null;
    const stepValueRUB = stepSizeRUB.trim() ? parseFloat(stepSizeRUB) : null;
    const stepValueGEL = stepSizeGEL.trim() ? parseFloat(stepSizeGEL) : null;

    if (minValue !== null && (isNaN(minValue) || minValue < 0)) {
      alert(t('admin.priceFilter.minPriceInvalid'));
      return;
    }

    if (maxValue !== null && (isNaN(maxValue) || maxValue < 0)) {
      alert(t('admin.priceFilter.maxPriceInvalid'));
      return;
    }

    const validateStep = (value: number | null, label: string) => {
      if (value !== null && (isNaN(value) || value <= 0)) {
        alert(t('admin.priceFilter.stepSizeInvalid').replace('{label}', label));
        return false;
      }
      return true;
    };

    if (!validateStep(stepValueUSD, t('admin.priceFilter.stepSizeUsd'))) return;
    if (!validateStep(stepValueAMD, t('admin.priceFilter.stepSizeAmd'))) return;
    if (!validateStep(stepValueRUB, t('admin.priceFilter.stepSizeRub'))) return;
    if (!validateStep(stepValueGEL, t('admin.priceFilter.stepSizeGel'))) return;

    if (minValue !== null && maxValue !== null && minValue >= maxValue) {
      alert(t('admin.priceFilter.minMustBeLess'));
      return;
    }

    setSaving(true);
    try {
      console.log('⚙️ [PRICE FILTER SETTINGS] Saving settings...', {
        minValue,
        maxValue,
        stepValueUSD,
        stepValueAMD,
        stepValueRUB,
        stepValueGEL,
      });

      const stepSizePerCurrency: {
        USD?: number;
        AMD?: number;
        RUB?: number;
        GEL?: number;
      } = {};

      if (stepValueUSD !== null) stepSizePerCurrency.USD = stepValueUSD;
      if (stepValueAMD !== null) stepSizePerCurrency.AMD = stepValueAMD;
      if (stepValueRUB !== null) stepSizePerCurrency.RUB = stepValueRUB;
      if (stepValueGEL !== null) stepSizePerCurrency.GEL = stepValueGEL;
      await apiClient.put('/api/v1/admin/settings/price-filter', {
        minPrice: minValue,
        maxPrice: maxValue,
        stepSize: stepValueUSD, // keep legacy field for backwards compatibility (USD as base)
        stepSizePerCurrency: Object.keys(stepSizePerCurrency).length ? stepSizePerCurrency : null,
      });
      
      alert(t('admin.priceFilter.savedSuccess'));
      console.log('✅ [PRICE FILTER SETTINGS] Settings saved');
    } catch (err: any) {
      console.error('❌ [PRICE FILTER SETTINGS] Error saving settings:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save';
      alert(t('admin.priceFilter.errorSaving').replace('{message}', errorMessage));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isLoggedIn && isAdmin) {
      fetchSettings();
    }
  }, [isLoading, isLoggedIn, isAdmin, fetchSettings]);

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn) {
        console.log('❌ [PRICE FILTER SETTINGS] User not logged in, redirecting to login...');
        router.push('/login');
        return;
      }
      if (!isAdmin) {
        console.log('❌ [PRICE FILTER SETTINGS] User is not admin, redirecting to home...');
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
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('admin.common.backToAdmin')}
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('admin.priceFilter.title')}</h1>
              <p className="text-gray-600 mt-2">{t('admin.priceFilter.subtitle')}</p>
            </div>
          </div>
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
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.priceFilter.priceFilterDefaultRange')}</h2>
                <p className="text-sm text-gray-600">
                  {t('admin.priceFilter.stepSizeDescription')}
                </p>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-600">{t('admin.priceFilter.loadingSettings')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.priceFilter.stepSizeUsd')}
                      </label>
                      <Input
                        type="number"
                        value={stepSizeUSD}
                        onChange={(e) => handleStepSizeChange(e.target.value)}
                        placeholder="100"
                        min="1"
                        step="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.priceFilter.stepSizeAmd')}
                      </label>
                      <Input
                        type="number"
                        value={stepSizeAMD}
                        onChange={(e) => setStepSizeAMD(e.target.value)}
                        placeholder="5000"
                        min="1"
                        step="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.priceFilter.stepSizeRub')}
                      </label>
                      <Input
                        type="number"
                        value={stepSizeRUB}
                        onChange={(e) => setStepSizeRUB(e.target.value)}
                        placeholder="500"
                        min="1"
                        step="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.priceFilter.stepSizeGel')}
                      </label>
                      <Input
                        type="number"
                        value={stepSizeGEL}
                        onChange={(e) => setStepSizeGEL(e.target.value)}
                        placeholder="10"
                        min="1"
                        step="1"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">{t('admin.priceFilter.howItWorks')}</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                          <li>{t('admin.priceFilter.stepSizeControls')}</li>
                          <li>{t('admin.priceFilter.differentStepSizes')}</li>
                          <li>{t('admin.priceFilter.defaultRange')}</li>
                          <li>{t('admin.priceFilter.usersCanAdjust')}</li>
                          <li>{t('admin.priceFilter.changesTakeEffect')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-6"
                    >
                      {saving ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>{t('admin.priceFilter.saving')}</span>
                        </div>
                      ) : (
                        t('admin.priceFilter.saveSettings')
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMinPrice('');
                        setMaxPrice('');
                        setStepSizeUSD('');
                        setStepSizeAMD('');
                        setStepSizeRUB('');
                        setStepSizeGEL('');
                        prevStepSizeRef.current = '';
                      }}
                    >
                      {t('admin.priceFilter.clear')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

