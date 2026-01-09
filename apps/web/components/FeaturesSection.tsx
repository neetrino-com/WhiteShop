'use client';

import Link from 'next/link';
import { useTranslation } from '../lib/i18n-client';

/**
 * Features Section Component
 * Displays three key service features: Fast Delivery, Best Quality, and Free Return
 * Clean, minimalist design matching the reference image
 * Each feature card is clickable and navigates to the corresponding page
 */
export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('home.features_title')}
          </h2>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            {t('home.features_subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Fast Delivery */}
          <Link
            href="/delivery"
            className="text-center group cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src="https://img.freepik.com/premium-vector/vector-fast-delivery-icon-illustration_723554-1032.jpg"
                  alt="Fast Delivery"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-gray-700 transition-colors">
              {t('home.feature_fast_delivery_title')}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('home.feature_fast_delivery_description')}
            </p>
          </Link>

          {/* Best Quality */}
          <Link
            href="/about"
            className="text-center group cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src="https://www.shutterstock.com/image-vector/best-quality-stamp-sticker-icon-600w-1922730422.jpg"
                  alt="Best Quality"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-gray-700 transition-colors">
              {t('home.feature_best_quality_title')}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('home.feature_best_quality_description')}
            </p>
          </Link>

          {/* Free Return */}
          <Link
            href="/returns"
            className="text-center group cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSgoxSEhKJM1oLGZSKnh1mVW4wTQcQl_DV1Q&s"
                  alt="Free Return"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-gray-700 transition-colors">
              {t('home.feature_free_return_title')}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('home.feature_free_return_description')}
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}

