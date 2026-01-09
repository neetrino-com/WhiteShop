'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../lib/i18n-client';

const heroImages = [
  'https://images.pexels.com/photos/67102/pexels-photo-67102.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
  'https://images.pexels.com/photos/266688/pexels-photo-266688.jpeg',
  'https://images.pexels.com/photos/3217852/pexels-photo-3217852.jpeg',
];

export function HeroCarousel() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, []); // Auto-advance every 5 seconds

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? heroImages.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handleShopNow = () => {
    router.push('/products');
  };

  const handleBrowseCategories = () => {
    router.push('/categories');
  };

  return (
    <div className="relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden">
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent z-10" />
      
      {/* Images */}
      <div className="relative w-full h-full">
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image}
              alt={`Hero image ${index + 1}`}
              fill
              className="object-cover"
              priority={index === 0}
              unoptimized
            />
          </div>
        ))}
      </div>

      {/* Overlay Content - Text and Buttons */}
      <div className="absolute inset-0 flex flex-col items-start justify-center z-20 px-4 sm:px-6 md:px-12 lg:px-20 xl:px-32 pointer-events-none">
        <div className="text-left pointer-events-auto max-w-2xl">
          {/* Background overlay for better text readability */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 md:p-10 lg:p-12 shadow-2xl border border-white/5">
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              {t('home.hero_title')}
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-gray-700 mb-8 leading-relaxed">
              {t('home.hero_subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleShopNow}
                className="px-10 py-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {t('home.hero_button_products')}
              </button>
              <button
                onClick={handleBrowseCategories}
                className="px-10 py-4 bg-white text-gray-900 border-2 border-gray-900 rounded-lg hover:bg-gray-50 transition-all font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {t('home.hero_button_view_more')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-6 md:left-8 top-1/2 transform -translate-y-1/2 bg-white/50 hover:bg-white/70 text-gray-900 p-2 md:p-3 rounded-full shadow-lg transition-all z-30 cursor-pointer hover:scale-110"
        aria-label="Previous image"
      >
        <svg
          className="w-4 h-4 md:w-6 md:h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <button
        onClick={goToNext}
        className="absolute right-6 md:right-8 top-1/2 transform -translate-y-1/2 bg-white/50 hover:bg-white/70 text-gray-900 p-2 md:p-3 rounded-full shadow-lg transition-all z-30 cursor-pointer hover:scale-110"
        aria-label="Next image"
      >
        <svg
          className="w-4 h-4 md:w-6 md:h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 md:bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-30">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-white w-10'
                : 'bg-white/50 hover:bg-white/75 w-2'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

