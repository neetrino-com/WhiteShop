import { Card } from '@shop/ui';
import Link from 'next/link';

/**
 * FAQ page - displays frequently asked questions
 */
export default function FAQPage() {
  const faqs = [
    {
      category: 'Orders & Shipping',
      questions: [
        {
          q: 'How long does shipping take?',
          a: 'Shipping times vary depending on your location and the shipping method selected. Standard shipping typically takes 5-7 business days, while express shipping takes 2-3 business days. You can find detailed shipping information on our Delivery page.',
        },
        {
          q: 'Do you ship internationally?',
          a: 'Yes, we ship to most countries worldwide. Shipping costs and delivery times vary by location. Please check our shipping page for more details.',
        },
        {
          q: 'Can I track my order?',
          a: 'Yes, once your order ships, you will receive a tracking number via email. You can use this number to track your package on the carrier\'s website.',
        },
        {
          q: 'What if my order is damaged or incorrect?',
          a: 'If you receive a damaged or incorrect item, please contact our customer service team immediately. We will arrange for a replacement or refund at no additional cost to you.',
        },
      ],
    },
    {
      category: 'Returns & Refunds',
      questions: [
        {
          q: 'What is your return policy?',
          a: 'We offer a 30-day return policy. Items must be in their original condition with tags attached. Please visit our Returns page for complete details.',
        },
        {
          q: 'How do I return an item?',
          a: 'To return an item, contact our customer service team to receive a return authorization number. Then package the item securely and ship it to our return address. Full instructions are available on our Returns page.',
        },
        {
          q: 'How long does it take to process a refund?',
          a: 'Once we receive your returned item, we process refunds within 5-7 business days. The refund will appear in your account shortly after processing.',
        },
        {
          q: 'Do I have to pay for return shipping?',
          a: 'Return shipping costs depend on the reason for return. If the item is defective or incorrect, we cover the return shipping. Otherwise, the customer is responsible for return shipping costs.',
        },
      ],
    },
    {
      category: 'Payment',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'We accept all major credit cards, debit cards, PayPal, and other secure payment methods. All payments are processed securely.',
        },
        {
          q: 'Is my payment information secure?',
          a: 'Yes, we use industry-standard encryption to protect your payment information. We never store your full credit card details on our servers.',
        },
        {
          q: 'Can I pay with multiple payment methods?',
          a: 'Currently, we only accept one payment method per order. If you need to split payment, please contact our customer service team.',
        },
      ],
    },
    {
      category: 'Account & Privacy',
      questions: [
        {
          q: 'How do I create an account?',
          a: 'You can create an account by clicking the "Register" link in the header or by registering during checkout. Having an account allows you to track orders and save your information for faster checkout.',
        },
        {
          q: 'How do I reset my password?',
          a: 'If you\'ve forgotten your password, click "Forgot Password" on the login page. You will receive an email with instructions to reset your password.',
        },
        {
          q: 'How do you protect my personal information?',
          a: 'We take your privacy seriously. We use secure encryption and never share your personal information with third parties. Please review our Privacy Policy for complete details.',
        },
      ],
    },
    {
      category: 'Products',
      questions: [
        {
          q: 'Are your products authentic?',
          a: 'Yes, we only sell authentic products from authorized dealers and manufacturers. We guarantee the authenticity of all items.',
        },
        {
          q: 'What if a product is out of stock?',
          a: 'If a product is out of stock, you can sign up for email notifications to be alerted when it becomes available again.',
        },
        {
          q: 'Do you offer product warranties?',
          a: 'Warranty information varies by product. Please check the product description for specific warranty details. Many products come with manufacturer warranties.',
        },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-8">
        Find answers to common questions about our products, shipping, returns, and more.
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Still have questions?</h2>
          <p className="text-gray-600 mb-4">
            Can't find what you're looking for? Our customer service team is here to help.
          </p>
          <div className="flex gap-4">
            <Link
              href="/contact"
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              Contact Us →
            </Link>
            <Link
              href="/support"
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              Get Support →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

