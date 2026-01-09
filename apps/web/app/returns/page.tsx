'use client';

import { Card } from '@shop/ui';
import Link from 'next/link';
import { useTranslation } from '../../lib/i18n-client';

/**
 * Returns page - displays return policy information
 */
export default function ReturnsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">{t('returns.title')}</h1>
      
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('returns.returnPolicy.title')}</h2>
          <p className="text-gray-600 mb-4">
            {t('returns.returnPolicy.description')}
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('returns.returnConditions.title')}</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>{t('returns.returnConditions.items.unworn')}</li>
            <li>{t('returns.returnConditions.items.tags')}</li>
            <li>{t('returns.returnConditions.items.saleable')}</li>
            <li>{t('returns.returnConditions.items.proof')}</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('returns.howToReturn.title')}</h2>
          <ol className="list-decimal list-inside text-gray-600 space-y-2">
            <li>{t('returns.howToReturn.steps.contact')}</li>
            <li>{t('returns.howToReturn.steps.authorization')}</li>
            <li>{t('returns.howToReturn.steps.package')}</li>
            <li>{t('returns.howToReturn.steps.ship')}</li>
            <li>{t('returns.howToReturn.steps.process')}</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('returns.refundProcess.title')}</h2>
          <p className="text-gray-600 mb-4">
            {t('returns.refundProcess.description')}
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('returns.nonReturnable.title')}</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>{t('returns.nonReturnable.items.personalized')}</li>
            <li>{t('returns.nonReturnable.items.packaging')}</li>
            <li>{t('returns.nonReturnable.items.damaged')}</li>
            <li>{t('returns.nonReturnable.items.sale')}</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('returns.needMoreInfo.title')}</h2>
          <p className="text-gray-600 mb-4">
            {t('returns.needMoreInfo.description1')}{' '}
            <Link href="/delivery" className="text-blue-600 hover:underline">
              {t('returns.needMoreInfo.deliveryLink')}
            </Link>
            .
          </p>
          <p className="text-gray-600">
            {t('returns.needMoreInfo.description2')}{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">
              {t('returns.needMoreInfo.contactLink')}
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}

