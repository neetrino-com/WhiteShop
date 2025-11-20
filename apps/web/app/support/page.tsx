import { Card, Button, Input } from '@shop/ui';
import Link from 'next/link';

/**
 * Support page - provides customer support options and resources
 */
export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Customer Support</h1>
      <p className="text-gray-600 mb-8">
        We're here to help! Choose the best way to get in touch with us.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
              <a
                href="mailto:support@whiteshop.com"
                className="text-blue-600 hover:underline"
              >
                support@whiteshop.com
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Phone</p>
              <a
                href="tel:+1234567890"
                className="text-blue-600 hover:underline"
              >
                +1 (234) 567-890
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Business Hours</p>
              <p className="text-gray-600">
                Monday - Friday: 9:00 AM - 6:00 PM<br />
                Saturday: 10:00 AM - 4:00 PM<br />
                Sunday: Closed
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="space-y-3">
            <Link
              href="/faq"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              Frequently Asked Questions →
            </Link>
            <Link
              href="/delivery"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              Delivery & Return Information →
            </Link>
            <Link
              href="/returns"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              Return Policy →
            </Link>
            <Link
              href="/contact"
              className="block text-blue-600 hover:text-blue-700 hover:underline"
            >
              Contact Form →
            </Link>
          </div>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Send us a Message</h2>
        <form className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <Input
              id="subject"
              type="text"
              placeholder="What can we help you with?"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              id="message"
              rows={6}
              placeholder="Please describe your issue or question..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button variant="primary" className="w-full">
            Send Message
          </Button>
        </form>
      </Card>

      <Card className="p-6 bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Common Support Topics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Order Issues</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Order tracking</li>
              <li>• Order cancellation</li>
              <li>• Order modification</li>
              <li>• Missing items</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Account Help</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Password reset</li>
              <li>• Account settings</li>
              <li>• Order history</li>
              <li>• Profile updates</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Payment & Billing</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Payment methods</li>
              <li>• Refund status</li>
              <li>• Billing questions</li>
              <li>• Payment issues</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Product Questions</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Product availability</li>
              <li>• Product specifications</li>
              <li>• Size guides</li>
              <li>• Warranty information</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

