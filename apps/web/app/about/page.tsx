export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">About Us</h1>
      
      <div className="prose prose-lg max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Story</h2>
          <p className="text-gray-600 mb-4">
            Welcome to Shop, your trusted destination for quality products and exceptional service. 
            We've been serving customers since 2020, providing a seamless shopping experience 
            that combines convenience, quality, and value.
          </p>
          <p className="text-gray-600">
            Our mission is to make shopping easy, enjoyable, and accessible for everyone. 
            We carefully curate our product selection to ensure you always find something 
            that meets your needs and exceeds your expectations.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Values</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Quality: We only sell products we believe in</li>
            <li>Customer Service: Your satisfaction is our priority</li>
            <li>Transparency: Honest pricing and clear policies</li>
            <li>Innovation: Constantly improving your shopping experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-gray-600">
            Have questions? We'd love to hear from you. 
            <a href="/contact" className="text-blue-600 hover:underline ml-1">
              Get in touch with our team
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

