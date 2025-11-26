'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../../lib/api-client';

interface Settings {
  globalDiscount: number;
}

export default function SettingsPage() {
  const { isLoggedIn, isAdmin, isLoading, user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    globalDiscount: 0,
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
        globalDiscount: data.globalDiscount || 0,
      });
      console.log('✅ [ADMIN] Settings loaded:', data);
    } catch (err: any) {
      console.error('❌ [ADMIN] Error fetching settings:', err);
      // Use defaults if error
      setSettings({ globalDiscount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('⚙️ [ADMIN] Saving settings...', settings);
      
      // Validate globalDiscount
      const discountValue = parseFloat(settings.globalDiscount.toString());
      if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
        alert('Global discount must be a number between 0 and 100');
        setSaving(false);
        return;
      }

      await apiClient.put('/api/v1/admin/settings', {
        globalDiscount: discountValue,
      });
      
      alert('Settings saved successfully!');
      console.log('✅ [ADMIN] Settings saved');
    } catch (err: any) {
      console.error('❌ [ADMIN] Error saving settings:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save settings';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
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
            Back to Admin Panel
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        {/* General Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue="My Shop"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site Description
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                defaultValue="Your shop description"
              />
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Enable maintenance mode</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Email Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMTP Host
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMTP Port
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="587"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="noreply@example.com"
              />
            </div>
          </div>
        </Card>

        {/* Discount Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Discount Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Global Discount Percentage
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.globalDiscount}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSettings((prev) => ({
                      ...prev,
                      globalDiscount: value === '' ? 0 : parseFloat(value) || 0,
                    }));
                  }}
                  className="w-32"
                  placeholder="0"
                />
                <span className="text-sm text-gray-600">%</span>
                <span className="text-sm text-gray-500">
                  (Applied to all products)
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Enter a percentage (0-100) to apply a global discount to all products. 
                For example, enter 10 for 10% discount or 50 for 50% discount.
              </p>
              {settings.globalDiscount > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Active:</strong> All products will have a {settings.globalDiscount}% discount applied.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Payment Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Currency
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="AMD">AMD - Armenian Dram</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Enable online payments</span>
              </label>
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
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/admin')}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

