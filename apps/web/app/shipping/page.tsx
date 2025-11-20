import { redirect } from 'next/navigation';

/**
 * Shipping page - redirects to delivery page
 * This page redirects users to the delivery page which contains shipping information
 */
export default function ShippingPage() {
  redirect('/delivery');
}

