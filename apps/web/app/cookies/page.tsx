import { Card } from '@shop/ui';

/**
 * Cookie Policy page - displays cookie policy information
 */
export default function CookiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Cookie Policy</h1>
      <p className="text-gray-600 mb-2">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      
      <div className="space-y-6 mt-8">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Are Cookies?</h2>
          <p className="text-gray-600 mb-4">
            Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and provide information to the website owners.
          </p>
          <p className="text-gray-600">
            Cookies allow a website to recognize your device and store some information about your preferences or past actions.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Cookies</h2>
          <p className="text-gray-600 mb-4">We use cookies for several purposes:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
            <li>
              <strong>Essential Cookies:</strong> These cookies are necessary for the website to function properly. They enable basic functions like page navigation and access to secure areas of the website.
            </li>
            <li>
              <strong>Performance Cookies:</strong> These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve the way our website works.
            </li>
            <li>
              <strong>Functionality Cookies:</strong> These cookies allow the website to remember choices you make (such as your language preference or region) and provide enhanced, personalized features.
            </li>
            <li>
              <strong>Targeting/Advertising Cookies:</strong> These cookies may be set through our site by our advertising partners to build a profile of your interests and show you relevant content on other sites.
            </li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Types of Cookies We Use</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Cookies</h3>
              <p className="text-gray-600">
                These are temporary cookies that are deleted when you close your browser. They help us maintain your session while you browse our website.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Persistent Cookies</h3>
              <p className="text-gray-600">
                These cookies remain on your device for a set period or until you delete them. They help us remember your preferences and improve your experience on future visits.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Third-Party Cookies</h3>
              <p className="text-gray-600">
                These cookies are set by third-party services that appear on our pages. They may be used to track your browsing activity across different websites.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Managing Cookies</h2>
          <p className="text-gray-600 mb-4">
            You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting your preferences in your browser settings.
          </p>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Browser Settings</h3>
              <p className="text-gray-600 mb-2">
                Most web browsers allow you to control cookies through their settings preferences. However, limiting cookies may impact your experience on our website.
              </p>
              <p className="text-gray-600">
                Here are links to instructions for managing cookies in popular browsers:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4 mt-2">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Chrome</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mozilla Firefox</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Microsoft Edge</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Opt-Out Tools</h3>
              <p className="text-gray-600">
                You can also opt out of certain third-party cookies by visiting the{' '}
                <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Digital Advertising Alliance
                </a>{' '}
                or{' '}
                <a href="http://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Your Online Choices
                </a>.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookies We Use</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Essential Cookies</h3>
              <p className="text-gray-600">
                These cookies are strictly necessary to provide you with services available through our website and to use some of its features.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Cookies</h3>
              <p className="text-gray-600">
                These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Preference Cookies</h3>
              <p className="text-gray-600">
                These cookies allow our website to remember information that changes the way the website behaves or looks, such as your preferred language or region.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Updates to This Policy</h2>
          <p className="text-gray-600">
            We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed about our use of cookies.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-gray-600">
            If you have any questions about our use of cookies, please contact us at:{' '}
            <a href="mailto:privacy@whiteshop.com" className="text-blue-600 hover:underline">
              privacy@whiteshop.com
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}

