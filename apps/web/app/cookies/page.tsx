'use client';

import { Card } from '@shop/ui';
import { useTranslation } from '../../lib/i18n-client';

/**
 * Cookie Policy page - displays cookie policy information
 */
export default function CookiesPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="p-6 sm:p-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">{t('cookies.title')}</h1>
          <p className="text-gray-600">
            {t('cookies.lastUpdated')} {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.whatAreCookies.title')}</h2>
          <p className="text-gray-600">
            {t('cookies.whatAreCookies.description1')}
          </p>
          <p className="text-gray-600">
            {t('cookies.whatAreCookies.description2')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.howWeUseCookies.title')}</h2>
          <p className="text-gray-600">{t('cookies.howWeUseCookies.description')}</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
            <li>
              <strong>{t('cookies.howWeUseCookies.types.essential.title')}</strong> {t('cookies.howWeUseCookies.types.essential.description')}
            </li>
            <li>
              <strong>{t('cookies.howWeUseCookies.types.performance.title')}</strong> {t('cookies.howWeUseCookies.types.performance.description')}
            </li>
            <li>
              <strong>{t('cookies.howWeUseCookies.types.functionality.title')}</strong> {t('cookies.howWeUseCookies.types.functionality.description')}
            </li>
            <li>
              <strong>{t('cookies.howWeUseCookies.types.targeting.title')}</strong> {t('cookies.howWeUseCookies.types.targeting.description')}
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.typesOfCookies.title')}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.typesOfCookies.sessionCookies.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.typesOfCookies.sessionCookies.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.typesOfCookies.persistentCookies.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.typesOfCookies.persistentCookies.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.typesOfCookies.thirdPartyCookies.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.typesOfCookies.thirdPartyCookies.description')}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.managingCookies.title')}</h2>
          <p className="text-gray-600">
            {t('cookies.managingCookies.description')}
          </p>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.managingCookies.browserSettings.title')}</h3>
              <p className="text-gray-600 mb-2">
                {t('cookies.managingCookies.browserSettings.description1')}
              </p>
              <p className="text-gray-600">
                {t('cookies.managingCookies.browserSettings.description2')}
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4 mt-2">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('cookies.managingCookies.browserSettings.browsers.chrome')}</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('cookies.managingCookies.browserSettings.browsers.firefox')}</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('cookies.managingCookies.browserSettings.browsers.safari')}</a></li>
                <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('cookies.managingCookies.browserSettings.browsers.edge')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.managingCookies.optOutTools.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.managingCookies.optOutTools.description')
                  .replace('{digitalAdvertisingAlliance}', `<a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">${t('cookies.managingCookies.optOutTools.digitalAdvertisingAlliance')}</a>`)
                  .replace('{yourOnlineChoices}', `<a href="http://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">${t('cookies.managingCookies.optOutTools.yourOnlineChoices')}</a>`)
                  .split(/(<a[^>]*>.*?<\/a>)/).map((part, idx) => {
                    if (part.startsWith('<a')) {
                      return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
                    }
                    return <span key={idx}>{part}</span>;
                  })}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.cookiesWeUse.title')}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.cookiesWeUse.essential.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.cookiesWeUse.essential.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.cookiesWeUse.analytics.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.cookiesWeUse.analytics.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('cookies.cookiesWeUse.preference.title')}</h3>
              <p className="text-gray-600">
                {t('cookies.cookiesWeUse.preference.description')}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.updates.title')}</h2>
          <p className="text-gray-600">
            {t('cookies.updates.description')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-gray-900">{t('cookies.contact.title')}</h2>
          <p className="text-gray-600">
            {t('cookies.contact.description')}{' '}
            <a href="mailto:privacy@whiteshop.com" className="text-blue-600 hover:underline">
              privacy@whiteshop.com
            </a>
          </p>
        </section>
      </Card>
    </div>
  );
}

