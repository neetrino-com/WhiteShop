'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Button, Input } from '@shop/ui';
import { apiClient } from '../../lib/api-client';
import { formatPrice, getStoredCurrency } from '../../lib/currency';
import { getStoredLanguage } from '../../lib/language';
import { useAuth } from '../../lib/auth/AuthContext';

interface CartItem {
  id: string;
  variant: {
    id: string;
    sku: string;
    product: {
      id: string;
      title: string;
      slug: string;
      image?: string | null;
    };
  };
  quantity: number;
  price: number;
  total: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  itemsCount: number;
}

// Validation schema with conditional shipping address
const checkoutSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  phone: z.string().min(1, 'Phone is required').regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number'),
  shippingMethod: z.enum(['pickup', 'delivery'], {
    required_error: 'Please select a shipping method',
  }),
  paymentMethod: z.enum(['idram', 'arca'], {
    required_error: 'Please select a payment method',
  }),
  // Shipping address fields - required only for delivery
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  shippingPhone: z.string().optional(),
  // Payment details - optional, can be filled in modal
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardHolderName: z.string().optional(),
}).refine((data) => {
  // If delivery is selected, shipping address is required
  if (data.shippingMethod === 'delivery') {
    return data.shippingAddress && data.shippingAddress.trim().length > 0;
  }
  return true;
}, {
  message: 'Address is required for delivery',
  path: ['shippingAddress'],
}).refine((data) => {
  // If delivery is selected, shipping city is required
  if (data.shippingMethod === 'delivery') {
    return data.shippingCity && data.shippingCity.trim().length > 0;
  }
  return true;
}, {
  message: 'City is required for delivery',
  path: ['shippingCity'],
}).refine((data) => {
  // If delivery is selected, shipping postal code is required
  if (data.shippingMethod === 'delivery') {
    return data.shippingPostalCode && data.shippingPostalCode.trim().length > 0;
  }
  return true;
}, {
  message: 'Postal code is required for delivery',
  path: ['shippingPostalCode'],
}).refine((data) => {
  // If delivery is selected, shipping phone is required
  if (data.shippingMethod === 'delivery') {
    return data.shippingPhone && data.shippingPhone.trim().length > 0;
  }
  return true;
}, {
  message: 'Phone number is required for delivery',
  path: ['shippingPhone'],
}).refine((data) => {
  // Validate phone format if provided
  if (data.shippingPhone && data.shippingPhone.trim().length > 0) {
    return /^\+?[0-9]{8,15}$/.test(data.shippingPhone);
  }
  return true;
}, {
  message: 'Invalid phone number format',
  path: ['shippingPhone'],
}).refine((data) => {
  // If ArCa or Idram is selected, card number is required
  if (data.paymentMethod === 'arca' || data.paymentMethod === 'idram') {
    return data.cardNumber && data.cardNumber.replace(/\s/g, '').length >= 13;
  }
  return true;
}, {
  message: 'Card number is required',
  path: ['cardNumber'],
}).refine((data) => {
  // If ArCa or Idram is selected, card expiry is required
  if (data.paymentMethod === 'arca' || data.paymentMethod === 'idram') {
    return data.cardExpiry && /^\d{2}\/\d{2}$/.test(data.cardExpiry);
  }
  return true;
}, {
  message: 'Card expiry date is required',
  path: ['cardExpiry'],
}).refine((data) => {
  // If ArCa or Idram is selected, CVV is required
  if (data.paymentMethod === 'arca' || data.paymentMethod === 'idram') {
    return data.cardCvv && data.cardCvv.length >= 3;
  }
  return true;
}, {
  message: 'CVV is required',
  path: ['cardCvv'],
}).refine((data) => {
  // If ArCa or Idram is selected, cardholder name is required
  if (data.paymentMethod === 'arca' || data.paymentMethod === 'idram') {
    return data.cardHolderName && data.cardHolderName.trim().length > 0;
  }
  return true;
}, {
  message: 'Cardholder name is required',
  path: ['cardHolderName'],
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

// Payment methods configuration (only Idram and ArCa)
const paymentMethods = [
  {
    id: 'idram' as const,
    name: 'Idram',
    description: 'Pay with Idram wallet or card',
    logo: '/assets/payments/idram.svg',
  },
  {
    id: 'arca' as const,
    name: 'ArCa',
    description: 'Pay with ArCa card',
    logo: '/assets/payments/arca.svg',
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(getStoredCurrency());
  const [language, setLanguage] = useState(getStoredLanguage());
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('[Checkout] showShippingModal changed:', showShippingModal);
  }, [showShippingModal]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: '',
      phone: '',
      shippingMethod: 'pickup',
      paymentMethod: 'idram',
      shippingAddress: '',
      shippingCity: '',
      shippingPostalCode: '',
      shippingPhone: '',
      cardNumber: '',
      cardExpiry: '',
      cardCvv: '',
      cardHolderName: '',
    },
  });

  const paymentMethod = watch('paymentMethod');
  const shippingMethod = watch('shippingMethod');

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (isLoading) {
      return;
    }

    // Allow guest checkout - no redirect to login
    fetchCart();

    const handleCurrencyUpdate = () => {
      setCurrency(getStoredCurrency());
    };

    const handleLanguageUpdate = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('language-updated', handleLanguageUpdate);

    return () => {
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
      window.removeEventListener('language-updated', handleLanguageUpdate);
    };
  }, [isLoggedIn, isLoading, router]);

  useEffect(() => {
    async function loadUserProfile() {
      if (isLoggedIn) {
        try {
          const profile = await apiClient.get<{
            id: string;
            email?: string;
            phone?: string;
          }>('/api/v1/users/profile');
          
          if (profile.email) {
            setValue('email', profile.email);
          }
          if (profile.phone) {
            setValue('phone', profile.phone);
            // Also set shipping phone if available
            setValue('shippingPhone', profile.phone);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          // Error loading profile, user can still fill the form manually
        }
      }
    }
    
    loadUserProfile();
  }, [isLoggedIn, setValue]);

  async function fetchCart() {
    try {
      setLoading(true);
      
      // If user is logged in, fetch from API
      if (isLoggedIn) {
        const response = await apiClient.get<{ cart: Cart }>('/api/v1/cart');
        setCart(response.cart);
        return;
      }

      // If guest, load from localStorage
      if (typeof window === 'undefined') {
        setCart(null);
        setLoading(false);
        return;
      }

      const CART_KEY = 'shop_cart_guest';
      const stored = localStorage.getItem(CART_KEY);
      const guestCart: Array<{ productId: string; productSlug?: string; variantId: string; quantity: number }> = stored ? JSON.parse(stored) : [];

      if (guestCart.length === 0) {
        setCart(null);
        setLoading(false);
        return;
      }

      // Fetch product details for guest cart
      const itemsWithDetails: Array<{ item: CartItem | null; shouldRemove: boolean }> = await Promise.all(
        guestCart.map(async (item, index) => {
          try {
            if (!item.productSlug) {
              return { item: null, shouldRemove: true };
            }

            const productData = await apiClient.get<{
              id: string;
              slug: string;
              translations?: Array<{ title: string; locale: string }>;
              media?: Array<{ url?: string; src?: string } | string>;
              variants?: Array<{
                _id: string;
                id: string;
                sku: string;
                price: number;
              }>;
            }>(`/api/v1/products/${item.productSlug}`);

            const variant = productData.variants?.find(v => 
              (v._id?.toString() || v.id) === item.variantId
            ) || productData.variants?.[0];

            if (!variant) {
              return { item: null, shouldRemove: true };
            }

            const translation = productData.translations?.[0];
            const imageUrl = productData.media?.[0] 
              ? (typeof productData.media[0] === 'string' 
                  ? productData.media[0] 
                  : productData.media[0].url || productData.media[0].src)
              : null;

            return {
              item: {
                id: `${item.productId}-${item.variantId}-${index}`,
                variant: {
                  id: variant._id?.toString() || variant.id,
                  sku: variant.sku || '',
                  product: {
                    id: productData.id,
                    title: translation?.title || 'Product',
                    slug: productData.slug,
                    image: imageUrl,
                  },
                },
                quantity: item.quantity,
                price: variant.price,
                total: variant.price * item.quantity,
              },
              shouldRemove: false,
            };
          } catch (error: any) {
            if (error?.status === 404 || error?.statusCode === 404) {
              return { item: null, shouldRemove: true };
            }
            console.error(`Error fetching product ${item.productId}:`, error);
            return { item: null, shouldRemove: false };
          }
        })
      );

      // Remove items that were not found
      const itemsToRemove = itemsWithDetails
        .map((result, index) => result.shouldRemove ? index : -1)
        .filter(index => index !== -1);
      
      if (itemsToRemove.length > 0) {
        const updatedCart = guestCart.filter((_, index) => !itemsToRemove.includes(index));
        localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));
      }

      const validItems = itemsWithDetails
        .map(result => result.item)
        .filter((item): item is CartItem => item !== null);
      
      if (validItems.length === 0) {
        setCart(null);
        setLoading(false);
        return;
      }

      const subtotal = validItems.reduce((sum, item) => sum + item.total, 0);
      const itemsCount = validItems.reduce((sum, item) => sum + item.quantity, 0);

      setCart({
        id: 'guest-cart',
        items: validItems,
        totals: {
          subtotal,
          discount: 0,
          shipping: 0,
          tax: 0,
          total: subtotal,
          currency: 'AMD',
        },
        itemsCount,
      });
    } catch (error) {
      console.error('Error fetching cart:', error);
      setError('Failed to load cart');
    } finally {
      setLoading(false);
    }
  }

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Checkout] handlePlaceOrder called', { 
      isLoggedIn, 
      isLoading, 
      showShippingModal,
      paymentMethod,
      cart: cart ? 'exists' : 'null'
    });
    
    // If ArCa or Idram is selected, show card details modal first
    if (paymentMethod === 'arca' || paymentMethod === 'idram') {
      console.log('[Checkout] Opening card modal for payment:', paymentMethod);
      setShowCardModal(true);
      return;
    }
    
    // If guest checkout and not card payment, show modal to confirm/add shipping details
    if (!isLoggedIn) {
      console.log('[Checkout] Opening modal for guest checkout');
      setShowShippingModal(true);
      return;
    }
    
    // Otherwise submit directly (logged in user, not card payment)
    console.log('[Checkout] Submitting directly (logged in user)');
    handleSubmit(onSubmit)(e);
  };

  async function onSubmit(data: CheckoutFormData) {
    setError(null);

    try {
      if (!cart) {
        throw new Error('Cart is empty');
      }

      let cartId = cart.id;
      let items = undefined;

      // If guest checkout, send items directly
      if (!isLoggedIn && cart.id === 'guest-cart') {
        console.log('[Checkout] Guest checkout - sending items directly...');
        items = cart.items.map(item => ({
          productId: item.variant.product.id,
          variantId: item.variant.id,
          quantity: item.quantity,
        }));
        cartId = 'guest-cart'; // Keep as guest-cart for API to recognize
      }

      // Prepare shipping address only for delivery
      const shippingAddress = data.shippingMethod === 'delivery' && 
        data.shippingAddress && 
        data.shippingCity && 
        data.shippingPostalCode &&
        data.shippingPhone
        ? {
            address: data.shippingAddress,
            city: data.shippingCity,
            postalCode: data.shippingPostalCode,
            phone: data.shippingPhone,
          }
        : undefined;

      console.log('[Checkout] Submitting order:', {
        cartId: cartId,
        email: data.email,
        phone: data.phone,
        shippingMethod: data.shippingMethod,
        paymentMethod: data.paymentMethod,
        hasShippingAddress: !!shippingAddress,
        isGuest: !isLoggedIn,
      });

      const response = await apiClient.post<{
        order: {
          id: string;
          number: string;
          status: string;
          paymentStatus: string;
          total: number;
          currency: string;
        };
        payment: {
          provider: string;
          paymentUrl: string | null;
          expiresAt: string | null;
        };
        nextAction: string;
      }>('/api/v1/orders/checkout', {
        cartId: cartId,
        ...(items ? { items } : {}),
        email: data.email,
        phone: data.phone,
        shippingMethod: data.shippingMethod,
        ...(shippingAddress ? { shippingAddress } : {}),
        paymentMethod: data.paymentMethod,
      });

      console.log('[Checkout] Order created:', response.order.number);

      // Clear guest cart after successful checkout
      if (!isLoggedIn) {
        localStorage.removeItem('shop_cart_guest');
        window.dispatchEvent(new Event('cart-updated'));
      }

      // If payment URL is provided, redirect to payment gateway
      if (response.payment?.paymentUrl) {
        console.log('[Checkout] Redirecting to payment gateway:', response.payment.paymentUrl);
        window.location.href = response.payment.paymentUrl;
        return;
      }

      // Otherwise redirect to order success page
      router.push(`/orders/${response.order.number}`);
    } catch (err: any) {
      console.error('[Checkout] Error creating order:', err);
      setError(err.message || 'Failed to create order. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
        <Card className="p-6 text-center">
          <p className="text-gray-600 mb-4">Your cart is empty</p>
          <Button variant="primary" onClick={() => router.push('/products')}>
            Continue Shopping
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <form onSubmit={handlePlaceOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact Information</h2>
              <div className="space-y-4">
                <div>
                  <Input
                    label="Email"
                    type="email"
                    {...register('email')}
                    error={errors.email?.message}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+374XXXXXXXX"
                    {...register('phone')}
                    error={errors.phone?.message}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </Card>

            {/* Shipping Method */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Shipping Method</h2>
              {errors.shippingMethod && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.shippingMethod.message}</p>
                </div>
              )}
              <div className="space-y-3">
                <label
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    shippingMethod === 'pickup'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('shippingMethod')}
                    value="pickup"
                    checked={shippingMethod === 'pickup'}
                    onChange={(e) => setValue('shippingMethod', e.target.value as 'pickup' | 'delivery')}
                    className="mr-4"
                    disabled={isSubmitting}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Store Pickup</div>
                    <div className="text-sm text-gray-600">Pick up your order from our store (Free)</div>
                  </div>
                </label>
                <label
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    shippingMethod === 'delivery'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('shippingMethod')}
                    value="delivery"
                    checked={shippingMethod === 'delivery'}
                    onChange={(e) => setValue('shippingMethod', e.target.value as 'pickup' | 'delivery')}
                    className="mr-4"
                    disabled={isSubmitting}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Delivery</div>
                    <div className="text-sm text-gray-600">We'll deliver your order to your address</div>
                  </div>
                </label>
              </div>
            </Card>

            {/* Shipping Address - Only show for delivery */}
            {shippingMethod === 'delivery' && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Shipping Address</h2>
                {(errors.shippingAddress || errors.shippingCity || errors.shippingPostalCode || errors.shippingPhone) && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">
                      {errors.shippingAddress?.message || 
                       errors.shippingCity?.message || 
                       errors.shippingPostalCode?.message || 
                       errors.shippingPhone?.message}
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Address"
                      type="text"
                      placeholder="Street address, apartment, suite, etc."
                      {...register('shippingAddress')}
                      error={errors.shippingAddress?.message}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="City"
                        type="text"
                        placeholder="City"
                        {...register('shippingCity')}
                        error={errors.shippingCity?.message}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Input
                        label="Postal Code"
                        type="text"
                        placeholder="Postal code"
                        {...register('shippingPostalCode')}
                        error={errors.shippingPostalCode?.message}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div>
                    <Input
                      label="Phone Number"
                      type="tel"
                      placeholder="+374XXXXXXXX"
                      {...register('shippingPhone')}
                      error={errors.shippingPhone?.message}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Payment Method */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Method</h2>
              {errors.paymentMethod && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.paymentMethod.message}</p>
                </div>
              )}
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      paymentMethod === method.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      {...register('paymentMethod')}
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={(e) => setValue('paymentMethod', e.target.value as 'idram' | 'arca')}
                      className="mr-4"
                      disabled={isSubmitting}
                    />
                    <div className="flex items-center gap-4 flex-1">
                      <div className="relative w-20 h-12 flex-shrink-0 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                        {logoErrors[method.id] ? (
                          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        ) : (
                          <img
                            src={method.logo}
                            alt={method.name}
                            className="w-full h-full object-contain p-1.5"
                            loading="lazy"
                            onError={() => {
                              setLogoErrors((prev) => ({ ...prev, [method.id]: true }));
                            }}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{method.name}</div>
                        <div className="text-sm text-gray-600">{method.description}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart.totals.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>
                    {shippingMethod === 'pickup' 
                      ? 'Free (Pickup)' 
                      : formatPrice(2000, currency) + ' (Delivery)'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatPrice(cart.totals.tax, currency)}</span>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>
                      {formatPrice(
                        cart.totals.subtotal + 
                        cart.totals.tax + 
                        (shippingMethod === 'delivery' ? 2000 : 0),
                        currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </Button>
            </Card>
          </div>
        </div>
      </form>

      {/* Shipping Address Modal for Guest Checkout */}
      {showShippingModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => {
            console.log('[Checkout] Modal backdrop clicked, closing modal');
            setShowShippingModal(false);
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => {
              e.stopPropagation();
              console.log('[Checkout] Modal content clicked');
            }}
            style={{ zIndex: 10000 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {shippingMethod === 'delivery' ? 'Complete Your Order' : 'Confirm Order'}
              </h2>
              <button
                onClick={() => setShowShippingModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Contact Information */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
              <div>
                <Input
                  label="Email"
                  type="email"
                  {...register('email')}
                  error={errors.email?.message}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Input
                  label="Phone"
                  type="tel"
                  placeholder="+374XXXXXXXX"
                  {...register('phone')}
                  error={errors.phone?.message}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Error messages for contact info */}
            {(errors.email || errors.phone) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  {errors.email?.message || errors.phone?.message}
                </p>
              </div>
            )}

            {shippingMethod === 'delivery' ? (
              <>
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Shipping Address</h3>
                  <div>
                    <Input
                      label="Address"
                      type="text"
                      placeholder="Street address, apartment, suite, etc."
                      {...register('shippingAddress')}
                      error={errors.shippingAddress?.message}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="City"
                        type="text"
                        placeholder="City"
                        {...register('shippingCity')}
                        error={errors.shippingCity?.message}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Input
                        label="Postal Code"
                        type="text"
                        placeholder="Postal code"
                        {...register('shippingPostalCode')}
                        error={errors.shippingPostalCode?.message}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div>
                    <Input
                      label="Phone Number"
                      type="tel"
                      placeholder="+374XXXXXXXX"
                      {...register('shippingPhone')}
                      error={errors.shippingPhone?.message}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {(errors.shippingAddress || errors.shippingCity || errors.shippingPostalCode || errors.shippingPhone) && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">
                      {errors.shippingAddress?.message || 
                       errors.shippingCity?.message || 
                       errors.shippingPostalCode?.message || 
                       errors.shippingPhone?.message}
                    </p>
                  </div>
                )}

                {/* Payment Details */}
                <div className="space-y-4 mb-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Payment Details ({paymentMethod === 'idram' ? 'Idram' : 'ArCa'})
                  </h3>
                  <div>
                    <Input
                      label="Card Number"
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      {...register('cardNumber')}
                      error={errors.cardNumber?.message}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\s/g, '');
                        value = value.replace(/(.{4})/g, '$1 ').trim();
                        setValue('cardNumber', value);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Expiry Date"
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        {...register('cardExpiry')}
                        error={errors.cardExpiry?.message}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length >= 2) {
                            value = value.substring(0, 2) + '/' + value.substring(2, 4);
                          }
                          setValue('cardExpiry', value);
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        label="CVV"
                        type="text"
                        placeholder="123"
                        maxLength={4}
                        {...register('cardCvv')}
                        error={errors.cardCvv?.message}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setValue('cardCvv', value);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Input
                      label="Card Holder Name"
                      type="text"
                      placeholder="John Doe"
                      {...register('cardHolderName')}
                      error={errors.cardHolderName?.message}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {cart && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items:</span>
                      <span className="font-medium">{cart.itemsCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatPrice(cart.totals.subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping:</span>
                      <span className="font-medium">{formatPrice(2000, currency)} (Delivery)</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">Total:</span>
                        <span className="font-bold text-gray-900">
                          {formatPrice(cart.totals.subtotal + cart.totals.tax + 2000, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Store Pickup:</strong> You will pick up your order from our store. Shipping is free.
                  </p>
                </div>

                {/* Payment Details for Pickup */}
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Payment Details ({paymentMethod === 'idram' ? 'Idram' : 'ArCa'})
                  </h3>
                  <div>
                    <Input
                      label="Card Number"
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      {...register('cardNumber')}
                      error={errors.cardNumber?.message}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\s/g, '');
                        value = value.replace(/(.{4})/g, '$1 ').trim();
                        setValue('cardNumber', value);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Expiry Date"
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        {...register('cardExpiry')}
                        error={errors.cardExpiry?.message}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length >= 2) {
                            value = value.substring(0, 2) + '/' + value.substring(2, 4);
                          }
                          setValue('cardExpiry', value);
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        label="CVV"
                        type="text"
                        placeholder="123"
                        maxLength={4}
                        {...register('cardCvv')}
                        error={errors.cardCvv?.message}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setValue('cardCvv', value);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Input
                      label="Card Holder Name"
                      type="text"
                      placeholder="John Doe"
                      {...register('cardHolderName')}
                      error={errors.cardHolderName?.message}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {cart && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items:</span>
                      <span className="font-medium">{cart.itemsCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatPrice(cart.totals.subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping:</span>
                      <span className="font-medium">Free (Pickup)</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">Total:</span>
                        <span className="font-bold text-gray-900">
                          {formatPrice(cart.totals.subtotal + cart.totals.tax, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowShippingModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={handleSubmit(
                  (data) => {
                    setShowShippingModal(false);
                    onSubmit(data);
                  },
                  (errors) => {
                    console.log('[Checkout Modal] Validation errors:', errors);
                    // Keep modal open if there are errors - scroll to first error
                    const firstErrorField = Object.keys(errors)[0];
                    if (firstErrorField) {
                      const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
                      if (errorElement) {
                        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }
                  }
                )}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ArCa Card Details Modal */}
      {showCardModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => {
            console.log('[Checkout] Card modal backdrop clicked, closing modal');
            setShowCardModal(false);
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => {
              e.stopPropagation();
              console.log('[Checkout] Card modal content clicked');
            }}
            style={{ zIndex: 10000 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {paymentMethod === 'arca' ? 'ArCa' : 'Idram'} Card Details
              </h2>
              <button
                onClick={() => setShowCardModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Payment Details */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-16 h-10 flex-shrink-0 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                  {logoErrors[paymentMethod] ? (
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  ) : (
                    <img
                      src={paymentMethod === 'arca' ? '/assets/payments/arca.svg' : '/assets/payments/idram.svg'}
                      alt={paymentMethod === 'arca' ? 'ArCa' : 'Idram'}
                      className="w-full h-full object-contain p-1"
                      loading="lazy"
                      onError={() => {
                        setLogoErrors((prev) => ({ ...prev, [paymentMethod]: true }));
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {paymentMethod === 'arca' ? 'ArCa' : 'Idram'} Payment
                  </div>
                  <div className="text-sm text-gray-600">Enter your card details to complete the payment</div>
                </div>
              </div>

              <div>
                <Input
                  label="Card Number"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  {...register('cardNumber')}
                  error={errors.cardNumber?.message}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\s/g, '');
                    value = value.replace(/(.{4})/g, '$1 ').trim();
                    setValue('cardNumber', value);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Expiry Date"
                    type="text"
                    placeholder="MM/YY"
                    maxLength={5}
                    {...register('cardExpiry')}
                    error={errors.cardExpiry?.message}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.length >= 2) {
                        value = value.substring(0, 2) + '/' + value.substring(2, 4);
                      }
                      setValue('cardExpiry', value);
                    }}
                  />
                </div>
                <div>
                  <Input
                    label="CVV"
                    type="text"
                    placeholder="123"
                    maxLength={4}
                    {...register('cardCvv')}
                    error={errors.cardCvv?.message}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setValue('cardCvv', value);
                    }}
                  />
                </div>
              </div>
              <div>
                <Input
                  label="Card Holder Name"
                  type="text"
                  placeholder="John Doe"
                  {...register('cardHolderName')}
                  error={errors.cardHolderName?.message}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Error messages for card details */}
            {(errors.cardNumber || errors.cardExpiry || errors.cardCvv || errors.cardHolderName) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  {errors.cardNumber?.message || 
                   errors.cardExpiry?.message || 
                   errors.cardCvv?.message || 
                   errors.cardHolderName?.message}
                </p>
              </div>
            )}

            {/* Order Summary */}
            {cart && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium">{cart.itemsCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatPrice(cart.totals.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping:</span>
                  <span className="font-medium">
                    {shippingMethod === 'pickup' 
                      ? 'Free (Pickup)' 
                      : formatPrice(2000, currency) + ' (Delivery)'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{formatPrice(cart.totals.tax, currency)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total:</span>
                    <span className="font-bold text-gray-900">
                      {formatPrice(
                        cart.totals.subtotal + 
                        cart.totals.tax + 
                        (shippingMethod === 'delivery' ? 2000 : 0),
                        currency
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowCardModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={handleSubmit(
                  (data) => {
                    setShowCardModal(false);
                    // If guest checkout, show shipping modal first, otherwise submit
                    if (!isLoggedIn) {
                      setShowShippingModal(true);
                    } else {
                      onSubmit(data);
                    }
                  },
                  (errors) => {
                    console.log('[Checkout Card Modal] Validation errors:', errors);
                    // Keep modal open if there are errors - scroll to first error
                    const firstErrorField = Object.keys(errors)[0];
                    if (firstErrorField) {
                      const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
                      if (errorElement) {
                        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }
                  }
                )}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Continue to Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
