'use client';

import { Card } from '@shop/ui';
import Link from 'next/link';
import { useTranslation } from '../../lib/i18n-client';
import { loadTranslation } from '../../lib/i18n';
import { getStoredLanguage } from '../../lib/language';

/**
 * FAQ page - displays frequently asked questions
 */
export default function FAQPage() {
  const { t } = useTranslation();
  const lang = getStoredLanguage();
  const faqData = loadTranslation(lang, 'faq');
  
  const faqs = [
    {
      category: faqData?.categories?.ordersShipping?.title || 'Orders & Shipping',
      questions: [
        {
          q: faqData?.categories?.ordersShipping?.questions?.shippingTime?.q || '',
          a: faqData?.categories?.ordersShipping?.questions?.shippingTime?.a || '',
        },
        {
          q: faqData?.categories?.ordersShipping?.questions?.internationalShipping?.q || '',
          a: faqData?.categories?.ordersShipping?.questions?.internationalShipping?.a || '',
        },
        {
          q: faqData?.categories?.ordersShipping?.questions?.trackOrder?.q || '',
          a: faqData?.categories?.ordersShipping?.questions?.trackOrder?.a || '',
        },
        {
          q: faqData?.categories?.ordersShipping?.questions?.damagedOrder?.q || '',
          a: faqData?.categories?.ordersShipping?.questions?.damagedOrder?.a || '',
        },
      ],
    },
    {
      category: faqData?.categories?.returnsRefunds?.title || 'Returns & Refunds',
      questions: [
        {
          q: faqData?.categories?.returnsRefunds?.questions?.returnPolicy?.q || '',
          a: faqData?.categories?.returnsRefunds?.questions?.returnPolicy?.a || '',
        },
        {
          q: faqData?.categories?.returnsRefunds?.questions?.howToReturn?.q || '',
          a: faqData?.categories?.returnsRefunds?.questions?.howToReturn?.a || '',
        },
        {
          q: faqData?.categories?.returnsRefunds?.questions?.refundTime?.q || '',
          a: faqData?.categories?.returnsRefunds?.questions?.refundTime?.a || '',
        },
        {
          q: faqData?.categories?.returnsRefunds?.questions?.returnShipping?.q || '',
          a: faqData?.categories?.returnsRefunds?.questions?.returnShipping?.a || '',
        },
      ],
    },
    {
      category: faqData?.categories?.payment?.title || 'Payment',
      questions: [
        {
          q: faqData?.categories?.payment?.questions?.paymentMethods?.q || '',
          a: faqData?.categories?.payment?.questions?.paymentMethods?.a || '',
        },
        {
          q: faqData?.categories?.payment?.questions?.paymentSecurity?.q || '',
          a: faqData?.categories?.payment?.questions?.paymentSecurity?.a || '',
        },
        {
          q: faqData?.categories?.payment?.questions?.multiplePayment?.q || '',
          a: faqData?.categories?.payment?.questions?.multiplePayment?.a || '',
        },
      ],
    },
    {
      category: faqData?.categories?.accountPrivacy?.title || 'Account & Privacy',
      questions: [
        {
          q: faqData?.categories?.accountPrivacy?.questions?.createAccount?.q || '',
          a: faqData?.categories?.accountPrivacy?.questions?.createAccount?.a || '',
        },
        {
          q: faqData?.categories?.accountPrivacy?.questions?.resetPassword?.q || '',
          a: faqData?.categories?.accountPrivacy?.questions?.resetPassword?.a || '',
        },
        {
          q: faqData?.categories?.accountPrivacy?.questions?.privacyProtection?.q || '',
          a: faqData?.categories?.accountPrivacy?.questions?.privacyProtection?.a || '',
        },
      ],
    },
    {
      category: faqData?.categories?.products?.title || 'Products',
      questions: [
        {
          q: faqData?.categories?.products?.questions?.authenticProducts?.q || '',
          a: faqData?.categories?.products?.questions?.authenticProducts?.a || '',
        },
        {
          q: faqData?.categories?.products?.questions?.outOfStock?.q || '',
          a: faqData?.categories?.products?.questions?.outOfStock?.a || '',
        },
        {
          q: faqData?.categories?.products?.questions?.warranties?.q || '',
          a: faqData?.categories?.products?.questions?.warranties?.a || '',
        },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('faq.title')}</h1>
      <p className="text-gray-600 mb-8">
        {t('faq.description')}
      </p>

      <div className="space-y-8">
        {faqs.map((section, sectionIndex) => (
          <Card key={sectionIndex} className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{section.category}</h2>
            <div className="space-y-6">
              {section.questions.map((faq, faqIndex) => (
                <div key={faqIndex} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h3>
                  <p className="text-gray-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Card className="p-6 bg-blue-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('faq.stillHaveQuestions.title')}</h2>
          <p className="text-gray-600 mb-4">
            {t('faq.stillHaveQuestions.description')}
          </p>
          <div className="flex gap-4">
            <Link
              href="/contact"
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              {t('faq.stillHaveQuestions.contactUs')}
            </Link>
            <Link
              href="/support"
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              {t('faq.stillHaveQuestions.getSupport')}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

