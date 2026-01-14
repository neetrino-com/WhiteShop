// Currency utilities and exchange rates
export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  AMD: { code: 'AMD', symbol: '֏', name: 'Armenian Dram', rate: 400 }, // 1 USD = 400 AMD
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 }, // 1 USD = 0.92 EUR
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rate: 90 }, // 1 USD = 90 RUB
  GEL: { code: 'GEL', symbol: '₾', name: 'Georgian Lari', rate: 2.7 }, // 1 USD = 2.7 GEL
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

// Cache for currency rates from API
let currencyRatesCache: Record<string, number> | null = null;
let currencyRatesCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get currency rates from API with caching
 */
async function getCurrencyRates(): Promise<Record<string, number>> {
  // Return cached rates if still valid
  if (currencyRatesCache && Date.now() - currencyRatesCacheTime < CACHE_DURATION) {
    return currencyRatesCache;
  }

  try {
    const response = await fetch('/api/v1/currency-rates', {
      cache: 'no-store', // Always fetch fresh rates
    });
    if (response.ok) {
      const rates = await response.json();
      currencyRatesCache = rates;
      currencyRatesCacheTime = Date.now();
      console.log('✅ [CURRENCY] Currency rates loaded:', rates);
      return rates;
    } else {
      console.error('❌ [CURRENCY] API returned error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ [CURRENCY] Failed to fetch currency rates:', error);
  }

  // Return default rates on error
  return {
    USD: 1,
    AMD: 400,
    EUR: 0.92,
    RUB: 90,
    GEL: 2.7,
  };
}

/**
 * Clear currency rates cache (call this when rates are updated in admin)
 */
export function clearCurrencyRatesCache(): void {
  currencyRatesCache = null;
  currencyRatesCacheTime = 0;
  // Dispatch event to notify components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('currency-rates-updated'));
  }
}

const CURRENCY_STORAGE_KEY = 'shop_currency';

export function getStoredCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return 'USD';
  try {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && stored in CURRENCIES) {
      return stored as CurrencyCode;
    }
  } catch {
    // Ignore errors
  }
  return 'USD';
}

export function setStoredCurrency(currency: CurrencyCode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    window.dispatchEvent(new Event('currency-updated'));
  } catch (error) {
    console.error('Failed to save currency:', error);
  }
}

/**
 * Format price with currency conversion
 * Uses cached rates from API if available, otherwise falls back to default rates
 * Works both on client and server side
 */
export function formatPrice(price: number, currency: CurrencyCode = 'USD'): string {
  const currencyInfo = CURRENCIES[currency];
  
  // Use cached rates if available (client-side only), otherwise use default rates
  // On server-side, currencyRatesCache will be null, so it will use default rates
  let rate: number;
  if (typeof window !== 'undefined' && currencyRatesCache && currencyRatesCache[currency] !== undefined) {
    rate = currencyRatesCache[currency];
  } else {
    rate = currencyInfo.rate;
  }
  
  const convertedPrice = price * rate;
  
  // Show all currencies without decimals (remove .00)
  const minimumFractionDigits = 0;
  const maximumFractionDigits = 0;
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyInfo.code,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(convertedPrice);
  
  // Debug logging (only in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`💱 [formatPrice] ${price} ${currencyInfo.code} × ${rate} = ${formatted}`);
  }
  
  return formatted;
}

/**
 * Initialize currency rates on client side
 * Call this in a useEffect or component mount
 */
export async function initializeCurrencyRates(forceReload: boolean = false): Promise<void> {
  if (typeof window === 'undefined') return;
  
  if (forceReload) {
    currencyRatesCache = null;
    currencyRatesCacheTime = 0;
  }
  
  const rates = await getCurrencyRates();
  console.log('✅ [CURRENCY] Currency rates initialized:', rates);
}

export function convertPrice(price: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number {
  if (fromCurrency === toCurrency) return price;
  
  // Use cached rates if available, otherwise use default rates
  const fromRate = currencyRatesCache?.[fromCurrency] ?? CURRENCIES[fromCurrency].rate;
  const toRate = currencyRatesCache?.[toCurrency] ?? CURRENCIES[toCurrency].rate;
  
  // Convert to USD first, then to target currency
  const usdPrice = price / fromRate;
  return usdPrice * toRate;
}


