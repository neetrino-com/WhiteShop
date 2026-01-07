գիտe client';

import { useState, useEffect, useRef, type MouseEvent, type TouchEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api-client';
import { formatPrice, getStoredCurrency } from '../lib/currency';
import { getStoredLanguage } from '../lib/language';
import { useAuth } from '../lib/auth/AuthContext';
import { CartIcon as CartPngIcon } from './icons/CartIcon';

interface RelatedProduct {
  id: string;
  slug: string;
  title: string;
  price: number;
  originalPrice?: number | null;
  compareAtPrice: number | null;
  discountPercent?: number | null;
  image: string | null;
  inStock: boolean;
  brand?: {
    id: string;
    name: string;
  } | null;
  categories?: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  variants?: Array<{
    options?: Array<{
      key: string;
      value: string;
    }>;
  }>;
}

interface RelatedProductsProps {
  categorySlug?: string;
  currentProductId: string;
}

/**
 * RelatedProducts component - displays products from the same category in a carousel
 * Shown at the bottom of the single product page
 */
export function RelatedProducts({ categorySlug, currentProductId }: RelatedProductsProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState(4);
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      try {
        setLoading(true);
        const language = getStoredLanguage();
        
        // Build params - if no categorySlug, fetch all products
        const params: Record<string, string> = {
          limit: '30', // Fetch more to ensure we have 10 after filtering
          lang: language,
        };
        
        if (categorySlug) {
          params.category = categorySlug;
          console.log('[RelatedProducts] Fetching related products for category:', categorySlug);
        } else {
          console.log('[RelatedProducts] No categorySlug, fetching all products');
        }
        
        const response = await apiClient.get<{
          data: RelatedProduct[];
          meta: {
            total: number;
          };
        }>('/api/v1/products', {
          params,
        });

        console.log('[RelatedProducts] Received products:', response.data.length);
        // Filter out current product and take exactly 10
        const filtered = response.data.filter(p => p.id !== currentProductId);
        console.log('[RelatedProducts] After filtering current product:', filtered.length);
        const finalProducts = filtered.slice(0, 10);
        console.log('[RelatedProducts] Final products to display:', finalProducts.length);
        setProducts(finalProducts);
      } catch (error) {
        console.error('[RelatedProducts] Error fetching related products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedProducts();
  }, [categorySlug, currentProductId]);

  // Determine visible cards based on screen size
  useEffect(() => {
    const updateVisibleCards = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleCards(1); // mobile
      } else if (width < 1024) {
        setVisibleCards(2); // tablet
      } else if (width < 1280) {
        setVisibleCards(3); // desktop
      } else {
        setVisibleCards(4); // large desktop
      }
    };

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  // Auto-rotate carousel
  useEffect(() => {
    if (products.length <= visibleCards || isDragging) return; // Don't auto-rotate if all products are visible or if dragging
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const maxIndex = Math.max(0, products.length - visibleCards);
        return prevIndex >= maxIndex ? 0 : prevIndex + 1;
      });
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [products.length, visibleCards, isDragging]);

  // Adjust currentIndex when visibleCards changes
  useEffect(() => {
    const maxIndex = Math.max(0, products.length - visibleCards);
    setCurrentIndex((prevIndex) => {
      if (prevIndex > maxIndex) {
        return maxIndex;
      }
      return prevIndex;
    });
  }, [visibleCards, products.length]);

  const maxIndex = Math.max(0, products.length - visibleCards);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => {
      return prevIndex === 0 ? maxIndex : prevIndex - 1;
    });
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => {
      return prevIndex >= maxIndex ? 0 : prevIndex + 1;
    });
  };

  /**
   * Handle mouse down for dragging
   */
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return;
    setHasMoved(false);
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(currentIndex);
  };

  /**
   * Handle mouse move for dragging
   */
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !carouselRef.current) return;
    const x = e.pageX - carouselRef.current.offsetLeft;
    const deltaX = Math.abs(x - startX);
    
    // Only consider it dragging if mouse moved more than 5px
    if (deltaX > 5) {
      setHasMoved(true);
      e.preventDefault();
      const walk = (x - startX) * 2; // Scroll speed multiplier
      const cardWidth = 100 / visibleCards;
      const newIndex = Math.round((scrollLeft - walk / (carouselRef.current.offsetWidth / 100)) / cardWidth);
      const clampedIndex = Math.max(0, Math.min(maxIndex, newIndex));
      setCurrentIndex(clampedIndex);
    }
  };

  /**
   * Handle mouse up/leave to stop dragging
   */
  const handleMouseUp = () => {
    const wasDragging = isDragging;
    const didMove = hasMoved;
    setIsDragging(false);
    // Reset hasMoved after a short delay to allow click events to process
    // Only reset if we were actually dragging
    if (wasDragging && didMove) {
      setTimeout(() => setHasMoved(false), 150);
    } else {
      setHasMoved(false);
    }
  };

  /**
   * Handle touch start for mobile dragging
   */
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return;
    setHasMoved(false);
    setIsDragging(true);
    setStartX(e.touches[0].pageX - carouselRef.current.offsetLeft);
    setScrollLeft(currentIndex);
  };

  /**
   * Handle touch move for mobile dragging
   */
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !carouselRef.current) return;
    const x = e.touches[0].pageX - carouselRef.current.offsetLeft;
    const deltaX = Math.abs(x - startX);
    
    // Only consider it dragging if touch moved more than 5px
    if (deltaX > 5) {
      setHasMoved(true);
      const walk = (x - startX) * 2;
      const cardWidth = 100 / visibleCards;
      const newIndex = Math.round((scrollLeft - walk / (carouselRef.current.offsetWidth / 100)) / cardWidth);
      const clampedIndex = Math.max(0, Math.min(maxIndex, newIndex));
      setCurrentIndex(clampedIndex);
    }
  };

  /**
   * Handle touch end to stop dragging
   */
  const handleTouchEnd = () => {
    const wasDragging = isDragging;
    const didMove = hasMoved;
    setIsDragging(false);
    // Reset hasMoved after a short delay to allow click events to process
    // Only reset if we were actually dragging
    if (wasDragging && didMove) {
      setTimeout(() => setHasMoved(false), 150);
    } else {
      setHasMoved(false);
    }
  };

  /**
   * Handle wheel scroll for horizontal scrolling
   */
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setCurrentIndex((prevIndex) => {
      const newIndex = prevIndex + delta;
      return Math.max(0, Math.min(maxIndex, newIndex));
    });
  };

  /**
   * Handle adding product to cart
   */
  const handleAddToCart = async (e: MouseEvent, product: RelatedProduct) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product.inStock) {
      return;
    }

    if (!isLoggedIn) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }

    setAddingToCart(prev => new Set(prev).add(product.id));

    try {
      // Get product details to get variant ID
      interface ProductDetails {
        id: string;
        slug: string;
        variants?: Array<{
          id: string;
          sku: string;
          price: number;
          stock: number;
          available: boolean;
        }>;
      }

      const encodedSlug = encodeURIComponent(product.slug.trim());
      const productDetails = await apiClient.get<ProductDetails>(`/api/v1/products/${encodedSlug}`);

      if (!productDetails.variants || productDetails.variants.length === 0) {
        alert('No variants available');
        return;
      }

      const variantId = productDetails.variants[0].id;
      
      await apiClient.post(
        '/api/v1/cart/items',
        {
          productId: product.id,
          variantId: variantId,
          quantity: 1,
        }
      );

      // Trigger cart update event
      window.dispatchEvent(new Event('cart-updated'));
    } catch (error: any) {
      console.error('[RelatedProducts] Error adding to cart:', error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        router.push(`/login?redirect=/products/${product.slug}`);
      } else {
        alert('Failed to add product to cart. Please try again.');
      }
    } finally {
      setAddingToCart(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const currency = getStoredCurrency();

  // Always show the section, even if no products (will show loading or empty state)
  return (
    <section className="py-12 mt-20 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-10">Related products</h2>
        
        {loading ? (
          // Loading state
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No related products found</p>
          </div>
        ) : (
          // Products Carousel
          <div className="relative">
            {/* Carousel Container */}
            <div 
              ref={carouselRef}
              className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
            >
              <div
                className="flex items-stretch"
                style={{
                  transform: `translateX(-${currentIndex * (100 / visibleCards)}%)`,
                  transition: isDragging ? 'none' : 'transform 0.5s ease-in-out',
                }}
              >
                {products.map((product) => {
                  const imageUrl = product.image || 'https://via.placeholder.com/400/CCCCCC/FFFFFF?text=No+Image';
                  // Get category name from product categories
                  const categoryName = product.categories && product.categories.length > 0 
                    ? product.categories.map(c => c.title).join(', ')
                    : product.brand?.name || 'Product';
                  
                  return (
                    <div
                      key={product.id}
                      className="flex-shrink-0 px-3 h-full"
                      style={{ width: `${100 / visibleCards}%` }}
                    >
                      <div className="group relative h-full flex flex-col">
                        <Link
                          href={`/products/${product.slug}`}
                          className="block cursor-pointer flex-1 flex flex-col"
                          onClick={(e) => {
                            // Prevent navigation only if we actually dragged (moved more than threshold)
                            if (hasMoved) {
                              e.preventDefault();
                              e.stopPropagation();
                              return;
                            }
                            // Allow navigation - Link will handle it
                            console.log('[RelatedProducts] Navigating to product:', product.slug);
                          }}
                        >
                          <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                            {/* Product Image */}
                            <div className="relative aspect-square bg-gray-100 overflow-hidden flex-shrink-0">
                              <Image
                                src={imageUrl}
                                alt={product.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                unoptimized
                              />
                            </div>

                            {/* Product Info */}
                            <div className="p-4 flex flex-col flex-1">
                              {/* Title */}
                              <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-gray-600 transition-colors">
                                {product.title}
                              </h3>

                              {/* Category */}
                              <p className="text-xs text-gray-500 mb-3">
                                {categoryName}
                              </p>

                              {/* Price */}
                              <div className="flex items-center gap-2 flex-wrap mt-auto">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    {formatPrice(product.price, currency)}
                                  </span>
                                  {product.discountPercent && product.discountPercent > 0 && (
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                      -{product.discountPercent}%
                                    </span>
                                  )}
                                </div>
                                {(product.originalPrice && product.originalPrice > product.price) || 
                                 (product.compareAtPrice && product.compareAtPrice > product.price) ? (
                                  <span className="text-sm text-gray-500 line-through">
                                    {formatPrice(
                                      (product.originalPrice && product.originalPrice > product.price) 
                                        ? product.originalPrice 
                                        : (product.compareAtPrice || 0),
                                      currency
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </Link>

                        {/* Cart Icon Button */}
                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          disabled={!product.inStock || addingToCart.has(product.id)}
                          className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 bg-white/90 backdrop-blur-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-20 group/cart"
                          title={product.inStock ? 'Add to cart' : 'Out of stock'}
                          aria-label={product.inStock ? 'Add to cart' : 'Out of stock'}
                        >
                          {addingToCart.has(product.id) ? (
                            <svg className="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <div className={`transition-colors duration-200 ${product.inStock ? 'text-gray-600 group-hover/cart:text-green-600' : 'text-gray-400'}`}>
                              <CartPngIcon size={24} />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Arrows - Only show if there are more products than visible */}
            {products.length > visibleCards && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-12 bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-lg transition-all z-20 cursor-pointer hover:scale-110"
                  aria-label="Previous products"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <button
                  onClick={goToNext}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-12 bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-lg transition-all z-20 cursor-pointer hover:scale-110"
                  aria-label="Next products"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}

            {/* Dots Indicator - Only show if there are more products than visible */}
            {products.length > visibleCards && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: Math.ceil(products.length / visibleCards) }).map((_, index) => {
                  const startIndex = index * visibleCards;
                  const endIndex = Math.min(startIndex + visibleCards, products.length);
                  const isActive = currentIndex >= startIndex && currentIndex < endIndex;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(startIndex)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'bg-gray-900 w-8'
                          : 'bg-gray-300 hover:bg-gray-400 w-2'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

