'use client';

import { Card, Button, Input } from '@shop/ui';
import Link from 'next/link';
import { useTranslation } from '../../lib/i18n-client';

/**
 * Support page - provides customer support options and resources
 */
export default function SupportPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('support.title')}</h1>
      <p className="text-gray-600 mb-8">
        {t('support.description')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('support.contactUs.title')}</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{t('support.contactUs.email')}</p>
              <a
                href="mailto:support@whiteshop.com"
                className="text-blue-600 hover:underline"
              >
                support@whiteshop.com
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{t('support.contactUs.phone')}</p>
              <a
                href="tel:+1234567890"
                className="text-blue-600 hover:underline"
              >
                +1 (234) 567-890
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">{t('support.contactUs.businessHours')}</p>
              <p className="text-gray-600">
                {t('support.contactUs.hours.weekdays')}<br />
                {t('support.contactUs.hours.saturday')}<br />
                {t('support.contactUs.hours.sunday')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('support.quickLinks.title')}</h2>
          <div className="space-y-3">
            <Link
              href="/faq"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              {t('support.quickLinks.faq')}
            </Link>
            <Link
              href="/delivery"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              {t('support.quickLinks.delivery')}
            </Link>
            <Link
              href="/returns"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              {t('support.quickLinks.returns')}
            </Link>
            <Link
              href="/contact"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              {t('support.quickLinks.contact')}
            </Link>
          </div>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('support.sendMessage.title')}</h2>
        <form className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              {t('support.sendMessage.form.name')}
            </label>
            <Input
              id="name"
              type="text"
              placeholder={t('support.sendMessage.form.namePlaceholder')}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              {t('support.sendMessage.form.email')}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t('support.sendMessage.form.emailPlaceholder')}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              {t('support.sendMessage.form.subject')}
            </label>
            <Input
              id="subject"
              type="text"
              placeholder={t('support.sendMessage.form.subjectPlaceholder')}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              {t('support.sendMessage.form.message')}
            </label>
            <textarea
              id="message"
              rows={6}
              placeholder={t('support.sendMessage.form.messagePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button variant="primary" className="w-full">
            {t('support.sendMessage.form.submit')}
          </Button>
        </form>
      </Card>

      <Card className="p-6 bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('support.commonTopics.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('support.commonTopics.orderIssues.title')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('support.commonTopics.orderIssues.items.tracking')}</li>
              <li>• {t('support.commonTopics.orderIssues.items.cancellation')}</li>
              <li>• {t('support.commonTopics.orderIssues.items.modification')}</li>
              <li>• {t('support.commonTopics.orderIssues.items.missing')}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('support.commonTopics.accountHelp.title')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('support.commonTopics.accountHelp.items.password')}</li>
              <li>• {t('support.commonTopics.accountHelp.items.settings')}</li>
              <li>• {t('support.commonTopics.accountHelp.items.history')}</li>
              <li>• {t('support.commonTopics.accountHelp.items.profile')}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('support.commonTopics.paymentBilling.title')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('support.commonTopics.paymentBilling.items.methods')}</li>
              <li>• {t('support.commonTopics.paymentBilling.items.refund')}</li>
              <li>• {t('support.commonTopics.paymentBilling.items.billing')}</li>
              <li>• {t('support.commonTopics.paymentBilling.items.issues')}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('support.commonTopics.productQuestions.title')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('support.commonTopics.productQuestions.items.availability')}</li>
              <li>• {t('support.commonTopics.productQuestions.items.specifications')}</li>
              <li>• {t('support.commonTopics.productQuestions.items.size')}</li>
              <li>• {t('support.commonTopics.productQuestions.items.warranty')}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

