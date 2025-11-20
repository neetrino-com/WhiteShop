import { Card } from '@shop/ui';
import Link from 'next/link';

/**
 * Returns page - displays return policy information
 */
export default function ReturnsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Returns & Refunds</h1>
      
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">30-Day Return Policy</h2>
          <p className="text-gray-600 mb-4">
            You have 30 days from the date of purchase to return items in their original condition with tags attached.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Return Conditions</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Items must be unworn, unwashed, and in original packaging</li>
            <li>All tags and labels must be attached</li>
            <li>Items must be in saleable condition</li>
            <li>Proof of purchase is required</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">How to Return</h2>
          <ol className="list-decimal list-inside text-gray-600 space-y-2">
            <li>Contact our customer service team to initiate a return</li>
            <li>Receive a return authorization number</li>
            <li>Package the items securely with the return form</li>
            <li>Ship the package to our return address</li>
            <li>Once received, we'll process your refund within 5-7 business days</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Refund Process</h2>
          <p className="text-gray-600 mb-4">
            Refunds will be processed to the original payment method. Please allow 5-7 business days for the refund to appear in your account.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Non-Returnable Items</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Personalized or customized items</li>
            <li>Items without original packaging</li>
            <li>Items damaged by misuse</li>
            <li>Sale items (unless defective)</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Need More Information?</h2>
          <p className="text-gray-600 mb-4">
            For detailed delivery and return information, visit our{' '}
            <Link href="/delivery" className="text-blue-600 hover:underline">
              Delivery & Return page
            </Link>
            .
          </p>
          <p className="text-gray-600">
            If you have questions, please{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">
              contact our support team
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}

