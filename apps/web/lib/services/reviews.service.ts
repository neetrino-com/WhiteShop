import { db } from "@white-shop/db";
import { ensureProductReviewsTable } from "../utils/db-ensure";

class ReviewsService {
  /**
   * Get all reviews for a product
   * @param productId - Product ID
   * @param options - Query options (published only, sorting, etc.)
   */
  async getProductReviews(productId: string, options?: { publishedOnly?: boolean }) {
    // Ensure table exists before querying
    await ensureProductReviewsTable();
    
    console.log('📝 [REVIEWS SERVICE] Getting reviews for product:', productId);
    
    const where: any = {
      productId,
    };

    // Filter by published status if needed
    if (options?.publishedOnly !== false) {
      where.published = true;
    }

    const reviews = await db.productReview.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`✅ [REVIEWS SERVICE] Found ${reviews.length} reviews for product ${productId}`);

    // Format response to match frontend expectations
    return reviews.map((review) => ({
      id: review.id,
      userId: review.userId,
      userName: review.user.firstName && review.user.lastName
        ? `${review.user.firstName} ${review.user.lastName}`
        : review.user.firstName || review.user.lastName || review.user.email || 'Anonymous',
      rating: review.rating,
      comment: review.comment || '',
      createdAt: review.createdAt.toISOString(),
      published: review.published,
    }));
  }

  /**
   * Get user's review for a specific product
   * @param productId - Product ID
   * @param userId - User ID
   * @param includeUnpublished - Whether to include unpublished reviews (default: true)
   */
  async getUserReview(productId: string, userId: string, includeUnpublished: boolean = true) {
    // Ensure table exists before querying
    await ensureProductReviewsTable();
    
    console.log('📝 [REVIEWS SERVICE] Getting user review:', { productId, userId });

    const review = await db.productReview.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!review) {
      console.log('📝 [REVIEWS SERVICE] No review found for user');
      return null;
    }

    // If includeUnpublished is false, only return published reviews
    if (!includeUnpublished && !review.published) {
      console.log('📝 [REVIEWS SERVICE] Review exists but is not published');
      return null;
    }

    console.log('✅ [REVIEWS SERVICE] Found user review:', review.id);

    // Format response to match frontend expectations
    return {
      id: review.id,
      userId: review.userId,
      userName: review.user.firstName && review.user.lastName
        ? `${review.user.firstName} ${review.user.lastName}`
        : review.user.firstName || review.user.lastName || review.user.email || 'Anonymous',
      rating: review.rating,
      comment: review.comment || '',
      createdAt: review.createdAt.toISOString(),
      published: review.published,
    };
  }

  /**
   * Get review statistics for a product
   * @param productId - Product ID
   */
  async getProductReviewStats(productId: string) {
    // Ensure table exists before querying
    await ensureProductReviewsTable();
    
    const reviews = await db.productReview.findMany({
      where: {
        productId,
        published: true,
      },
      select: {
        rating: true,
      },
    });

    const total = reviews.length;
    const average = total > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
      percentage: total > 0
        ? (reviews.filter((r) => r.rating === star).length / total) * 100
        : 0,
    }));

    return {
      total,
      average: Number(average.toFixed(1)),
      distribution,
    };
  }

  /**
   * Create a new review for a product
   * @param productId - Product ID
   * @param userId - User ID
   * @param data - Review data (rating, comment)
   */
  async createReview(productId: string, userId: string, data: { rating: number; comment?: string }) {
    // Ensure table exists before creating review
    await ensureProductReviewsTable();
    
    console.log('📝 [REVIEWS SERVICE] Creating review:', { productId, userId, rating: data.rating });

    // Validate rating
    if (!data.rating || data.rating < 1 || data.rating > 5) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation Error",
        detail: "Rating must be between 1 and 5",
      };
    }

    // Check if product exists
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Product not found",
        detail: `Product with ID ${productId} does not exist`,
      };
    }

    // Check if user already reviewed this product
    const existingReview = await db.productReview.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (existingReview) {
      throw {
        status: 409,
        type: "https://api.shop.am/problems/conflict",
        title: "Review already exists",
        detail: "You have already reviewed this product. You can update your existing review.",
      };
    }

    // Create review
    const review = await db.productReview.create({
      data: {
        productId,
        userId,
        rating: data.rating,
        comment: data.comment?.trim() || null,
        published: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    console.log('✅ [REVIEWS SERVICE] Review created:', review.id);

    // Format response
    return {
      id: review.id,
      userId: review.userId,
      userName: review.user.firstName && review.user.lastName
        ? `${review.user.firstName} ${review.user.lastName}`
        : review.user.firstName || review.user.lastName || review.user.email || 'Anonymous',
      rating: review.rating,
      comment: review.comment || '',
      createdAt: review.createdAt.toISOString(),
      published: review.published,
    };
  }

  /**
   * Update an existing review
   * @param reviewId - Review ID
   * @param userId - User ID (to verify ownership)
   * @param data - Updated review data
   */
  async updateReview(reviewId: string, userId: string, data: { rating?: number; comment?: string }) {
    // Ensure table exists before updating
    await ensureProductReviewsTable();
    
    // Find review and verify ownership
    const review = await db.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Review not found",
      };
    }

    if (review.userId !== userId) {
      throw {
        status: 403,
        type: "https://api.shop.am/problems/forbidden",
        title: "Forbidden",
        detail: "You can only update your own reviews",
      };
    }

    // Validate rating if provided
    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation Error",
        detail: "Rating must be between 1 and 5",
      };
    }

    // Update review
    const updated = await db.productReview.update({
      where: { id: reviewId },
      data: {
        rating: data.rating,
        comment: data.comment?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      userName: updated.user.firstName && updated.user.lastName
        ? `${updated.user.firstName} ${updated.user.lastName}`
        : updated.user.firstName || updated.user.lastName || updated.user.email || 'Anonymous',
      rating: updated.rating,
      comment: updated.comment || '',
      createdAt: updated.createdAt.toISOString(),
      published: updated.published,
    };
  }

  /**
   * Delete a review
   * @param reviewId - Review ID
   * @param userId - User ID (to verify ownership)
   */
  async deleteReview(reviewId: string, userId: string) {
    // Ensure table exists before deleting
    await ensureProductReviewsTable();
    
    // Find review and verify ownership
    const review = await db.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Review not found",
      };
    }

    if (review.userId !== userId) {
      throw {
        status: 403,
        type: "https://api.shop.am/problems/forbidden",
        title: "Forbidden",
        detail: "You can only delete your own reviews",
      };
    }

    await db.productReview.delete({
      where: { id: reviewId },
    });

    return { success: true };
  }
}

export const reviewsService = new ReviewsService();

