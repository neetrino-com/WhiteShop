'use client';

import { Card } from '@shop/ui';
import { useEffect, useState } from 'react';
import shippingData from '../../../../config/shipping.json';
import { getStoredLanguage } from '../../lib/language';

export default function DeliveryPage() {
  const [lang, setLang] = useState<'en' | 'ru' | 'am'>('en');

  useEffect(() => {
    const language = getStoredLanguage();
    const mappedLang = language === 'hy' ? 'am' : (language === 'ka' ? 'en' : language); // Map 'hy' to 'am' for config
    setLang(mappedLang as 'en' | 'ru' | 'am');
  }, []);
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Delivery & Return</h1>
      
      <div className="space-y-6">
        {/* Delivery Information */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delivery Information</h2>
          <div className="space-y-4 text-gray-700">
            {shippingData.methods.map((method) => {
              if (!method.enabled) return null;
              const methodName = method.name[lang as keyof typeof method.name] || method.name.en;
              const freeAbove = method.freeAbove ? new Intl.NumberFormat('hy-AM', {
                style: 'currency',
                currency: 'AMD',
                minimumFractionDigits: 0,
              }).format(method.freeAbove) : null;
              
              return (
                <div key={method.id}>
                  <h3 className="font-semibold text-gray-900 mb-2">{methodName}</h3>
                  <p className="text-gray-600">
                    {method.price === 0 ? (
                      'Free delivery'
                    ) : (
                      <>
                        Delivery cost: {new Intl.NumberFormat('hy-AM', {
                          style: 'currency',
                          currency: 'AMD',
                          minimumFractionDigits: 0,
                        }).format(method.price)}
                        {freeAbove && ` (Free for orders above ${freeAbove})`}
                      </>
                    )}
                  </p>
                  {method.estimatedDays > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Estimated delivery: {method.estimatedDays} {method.estimatedDays === 1 ? 'day' : 'days'}
                    </p>
                  )}
                  {method.locations && method.locations.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p className="font-medium mb-1">Pickup locations:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {method.locations.map((location, idx) => (
                          <li key={idx}>
                            {location.name[lang as keyof typeof location.name] || location.name.en} - {location.address}
                            {location.workingHours && (
                              <span className="text-gray-500">
                                {' '}({location.workingHours[lang as keyof typeof location.workingHours] || location.workingHours.en})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Return Policy */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Return Policy</h2>
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">30-Day Return Policy</h3>
              <p className="text-gray-600">
                You have 30 days from the date of purchase to return items in their original condition with tags attached.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Return Conditions</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Items must be unworn, unwashed, and in original packaging</li>
                <li>All tags and labels must be attached</li>
                <li>Items must be in saleable condition</li>
                <li>Proof of purchase is required</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">How to Return</h3>
              <ol className="list-decimal list-inside text-gray-600 space-y-1">
                <li>Contact our customer service team to initiate a return</li>
                <li>Receive a return authorization number</li>
                <li>Package the items securely with the return form</li>
                <li>Ship the package to our return address</li>
                <li>Once received, we'll process your refund within 5-7 business days</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Refund Process</h3>
              <p className="text-gray-600">
                Refunds will be processed to the original payment method. Please allow 5-7 business days for the refund to appear in your account.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Non-Returnable Items</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Personalized or customized items</li>
                <li>Items without original packaging</li>
                <li>Items damaged by misuse</li>
                <li>Sale items (unless defective)</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Need Help?</h2>
          <p className="text-gray-600 mb-4">
            If you have any questions about delivery or returns, please don't hesitate to contact us.
          </p>
          <div className="space-y-2 text-gray-700">
            <p>
              <span className="font-semibold">Email:</span>{' '}
              <a href="mailto:support@whiteshop.com" className="text-blue-600 hover:underline">
                support@whiteshop.com
              </a>
            </p>
            <p>
              <span className="font-semibold">Phone:</span>{' '}
              <a href="tel:+1234567890" className="text-blue-600 hover:underline">
                +1 (234) 567-890
              </a>
            </p>
            <p>
              <span className="font-semibold">Hours:</span> Monday - Friday, 9 AM - 6 PM
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

