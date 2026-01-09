'use client';

import { Card } from '@shop/ui';
import { useTranslation } from '../../lib/i18n-client';

/**
 * Delivery Terms page - describes shipping and delivery conditions
 */
export default function DeliveryTermsPage() {
  const { t } = useTranslation();
  return (
    <div className="policy-page">
      <div className="policy-page-inner">
        <h1 className="text-4xl font-bold text-gray-900">{t('delivery-terms.title')}</h1>
        <p className="text-gray-600">
          {t('delivery-terms.lastUpdated')}{' '}
          {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="mt-8 space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.overview.title')}</h2>
            <p className="text-gray-600">
              {t('delivery-terms.overview.description')}
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.shippingOptions.title')}</h2>
            <p className="text-gray-600">{t('delivery-terms.shippingOptions.description')}</p>
            <ul className="list-disc list-inside text-gray-600 ml-4">
              <li>{t('delivery-terms.shippingOptions.options.standard')}</li>
              <li>{t('delivery-terms.shippingOptions.options.express')}</li>
              <li>{t('delivery-terms.shippingOptions.options.pickup')}</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.processingTimes.title')}</h2>
            <ul className="list-disc list-inside text-gray-600 ml-4">
              <li>{t('delivery-terms.processingTimes.items.typical')}</li>
              <li>{t('delivery-terms.processingTimes.items.weekends')}</li>
              <li>{t('delivery-terms.processingTimes.items.preorder')}</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.deliveryTimeframes.title')}</h2>
            <p className="text-gray-600">
              {t('delivery-terms.deliveryTimeframes.description')}
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.shippingFees.title')}</h2>
            <ul className="list-disc list-inside text-gray-600 ml-4">
              <li>{t('delivery-terms.shippingFees.items.costs')}</li>
              <li>
                {t('delivery-terms.shippingFees.items.duties')}
              </li>
              <li>{t('delivery-terms.shippingFees.items.promotional')}</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.delaysDamageLoss.title')}</h2>
            <ul className="list-disc list-inside text-gray-600 ml-4">
              <li>{t('delivery-terms.delaysDamageLoss.items.delays')}</li>
              <li>
                {t('delivery-terms.delaysDamageLoss.items.damage')}
              </li>
              <li>
                {t('delivery-terms.delaysDamageLoss.items.loss')}
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900">{t('delivery-terms.contact.title')}</h2>
            <p className="text-gray-600">
              {t('delivery-terms.contact.description')}{' '}
              <a href="mailto:shipping@whiteshop.com" className="text-blue-600 hover:underline">
                shipping@whiteshop.com
              </a>
              .
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

