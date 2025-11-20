import { Card } from '@shop/ui';

/**
 * Terms of Service page - displays terms and conditions
 */
export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
      <p className="text-gray-600 mb-2">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      
      <div className="space-y-6 mt-8">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Agreement to Terms</h2>
          <p className="text-gray-600 mb-4">
            By accessing or using our website, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
          </p>
          <p className="text-gray-600">
            The materials contained in this website are protected by applicable copyright and trademark law.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Use License</h2>
          <p className="text-gray-600 mb-4">
            Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose or for any public display</li>
            <li>Attempt to reverse engineer any software contained on the website</li>
            <li>Remove any copyright or other proprietary notations from the materials</li>
            <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Account Registration</h2>
          <p className="text-gray-600 mb-4">
            To access certain features of our website, you may be required to register for an account. When you register, you agree to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and update your information to keep it accurate</li>
            <li>Maintain the security of your password and identification</li>
            <li>Accept all responsibility for activities that occur under your account</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Product Information</h2>
          <p className="text-gray-600 mb-4">
            We strive to provide accurate product descriptions, images, and pricing. However, we do not warrant that product descriptions or other content on this site is accurate, complete, reliable, current, or error-free.
          </p>
          <p className="text-gray-600">
            If a product offered by us is not as described, your sole remedy is to return it in unused condition.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Pricing and Payment</h2>
          <p className="text-gray-600 mb-4">
            All prices are displayed in the currency selected and are subject to change without notice. We reserve the right to modify prices at any time.
          </p>
          <p className="text-gray-600 mb-4">
            Payment must be received before we ship your order. We accept various payment methods as indicated during checkout.
          </p>
          <p className="text-gray-600">
            All sales are final unless otherwise stated. Refunds are subject to our return policy.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Shipping and Delivery</h2>
          <p className="text-gray-600 mb-4">
            We will make every effort to ship your order within the timeframes specified. However, shipping times are estimates and not guaranteed.
          </p>
          <p className="text-gray-600">
            Risk of loss and title for products purchased from us pass to you upon delivery to the carrier. You are responsible for filing any claims with carriers for damaged or lost shipments.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Returns and Refunds</h2>
          <p className="text-gray-600 mb-4">
            Our return policy is detailed on our Returns page. By making a purchase, you agree to our return policy.
          </p>
          <p className="text-gray-600">
            We reserve the right to refuse returns that do not meet our return policy requirements.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Prohibited Uses</h2>
          <p className="text-gray-600 mb-2">You may not use our website:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
            <li>In any way that violates any applicable law or regulation</li>
            <li>To transmit any material that is abusive, harassing, or otherwise objectionable</li>
            <li>To impersonate or attempt to impersonate the company or any employee</li>
            <li>In any way that infringes upon the rights of others</li>
            <li>To engage in any automated use of the system</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
          <p className="text-gray-600">
            In no event shall White-Shop or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website, even if we or an authorized representative has been notified orally or in writing of the possibility of such damage.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Revisions and Errata</h2>
          <p className="text-gray-600">
            The materials appearing on our website could include technical, typographical, or photographic errors. We do not warrant that any of the materials on its website are accurate, complete, or current. We may make changes to the materials contained on its website at any time without notice.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
          <p className="text-gray-600">
            These terms and conditions are governed by and construed in accordance with applicable laws. Any disputes relating to these terms shall be subject to the exclusive jurisdiction of the courts in the jurisdiction where our business is located.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
          <p className="text-gray-600">
            If you have any questions about these Terms of Service, please contact us at:{' '}
            <a href="mailto:legal@whiteshop.com" className="text-blue-600 hover:underline">
              legal@whiteshop.com
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}

