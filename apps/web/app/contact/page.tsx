'use client';

import { Button, Input } from '@shop/ui';
import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { getStoredLanguage } from '@/lib/language';
import { useTranslation } from '../../lib/i18n-client';
import contactData from '../../../../config/contact.json';

// Icons
const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7292C21.7209 20.9842 21.5573 21.2131 21.3523 21.4011C21.1473 21.5891 20.9053 21.732 20.6393 21.8207C20.3733 21.9094 20.0892 21.9418 19.81 21.9159C16.7428 21.5811 13.787 20.5306 11.19 18.8499C8.77382 17.3147 6.72533 15.2662 5.19 12.8499C3.49997 10.2412 2.44824 7.27099 2.12 4.18994C2.09413 3.91078 2.12653 3.62669 2.21523 3.36069C2.30393 3.09469 2.44684 2.85273 2.63482 2.64773C2.8228 2.44273 3.05172 2.27912 3.30672 2.16753C3.56172 2.05594 3.83743 1.99899 4.116 1.99994H7.116C7.68157 1.98944 8.23512 2.16393 8.69506 2.49952C9.155 2.83512 9.49782 3.31473 9.676 3.86994C9.94479 4.78626 10.3155 5.67019 10.78 6.50994C10.9867 6.89183 11.0672 7.33164 11.01 7.76494C10.9528 8.19824 10.7608 8.60612 10.46 8.93994L9.09 10.3099C10.5144 12.7895 12.7305 15.0056 15.21 16.4299L16.58 15.0599C16.9138 14.7592 17.3217 14.5672 17.755 14.51C18.1883 14.4528 18.6281 14.5333 19.01 14.7399C19.8498 15.2045 20.7337 15.5752 21.65 15.8439C22.2052 16.0221 22.6848 16.365 23.0204 16.8249C23.356 17.2849 23.5305 17.8384 23.52 18.4039L22 16.92Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EnvelopeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MapPinIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function ContactPage() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<'en' | 'ru' | 'am'>('en');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    const storedLang = getStoredLanguage();
    const mappedLang = storedLang === 'hy' ? 'am' : (storedLang === 'ka' ? 'en' : storedLang);
    if (mappedLang === 'am' || mappedLang === 'ru' || mappedLang === 'en') {
      setLanguage(mappedLang as 'en' | 'ru' | 'am');
    } else {
      setLanguage('en');
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
    // You can add API call here
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const address = contactData.address[language] || contactData.address.en;

  return (
    <div className="bg-white">
      {/* Top Section: Contact Info and Form */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Side: Contact Information */}
          <div className="space-y-8">
            {/* Call to Us */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                  <PhoneIcon />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{t('contact.callToUs.title')}</h3>
              </div>
              <p className="text-gray-600 mb-2">{t('contact.callToUs.description')}</p>
              <a href={`tel:${contactData.phone}`} className="text-orange-500 hover:text-orange-600 font-medium">
                {contactData.phone}
              </a>
            </div>

            {/* Write to Us */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                  <EnvelopeIcon />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{t('contact.writeToUs.title')}</h3>
              </div>
              <p className="text-gray-600 mb-2">{t('contact.writeToUs.description')}</p>
              <a href={`mailto:${contactData.email}`} className="text-orange-500 hover:text-orange-600 font-medium">
                {t('contact.writeToUs.emailLabel')} {contactData.email}
              </a>
            </div>

            {/* Headquarter */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                  <MapPinIcon />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{t('contact.headquarter.title')}</h3>
              </div>
              <div className="text-gray-600 mb-2 space-y-1">
                <p>{t('contact.headquarter.hours.weekdays')}</p>
                <p>{t('contact.headquarter.hours.saturday')}</p>
              </div>
              <p className="text-orange-500 hover:text-orange-600 font-medium">
                {address}
              </p>
            </div>
          </div>

          {/* Right Side: Contact Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                  {t('contact.form.name')}
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full"
                  placeholder={t('contact.form.namePlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                  {t('contact.form.email')}
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full"
                  placeholder={t('contact.form.emailPlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-900 mb-2">
                  {t('contact.form.subject')}
                </label>
                <Input
                  id="subject"
                  name="subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full"
                  placeholder={t('contact.form.subjectPlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-900 mb-2">
                  {t('contact.form.message')}
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder={t('contact.form.messagePlaceholder')}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-md py-3 font-semibold uppercase tracking-wide"
              >
                {t('contact.form.submit')}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Section: Map */}
      <div className="w-full h-[500px] bg-gray-100">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3048.1234567890123!2d44.5150!3d40.1812!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x406aa2dab8fc8b5b%3A0x3d1479ab4e9b8c5e!2sAbovyan%20St%2C%20Yerevan%2C%20Armenia!5e0!3m2!1sen!2sam!4v1234567890123!5m2!1sen!2sam"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
