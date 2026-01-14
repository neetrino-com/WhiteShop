import { NextRequest, NextResponse } from "next/server";
import { reviewsService } from "@/lib/services/reviews.service";
import { authenticateToken } from "@/lib/middleware/auth";

export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/reviews/[reviewId]
 * Update an existing review
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    // Authenticate user
    const user = await authenticateToken(req);
    if (!user) {
      return NextResponse.json(
        {
          type: "https://api.shop.am/problems/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Authentication required",
          instance: req.url,
        },
        { status: 401 }
      );
    }

    const { reviewId } = await params;
    const body = await req.json();

    console.log('📝 [REVIEWS API] PUT request:', { reviewId, userId: user.id, rating: body.rating });

    // Validate request body
    if (body.rating !== undefined && (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5)) {
      return NextResponse.json(
        {
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          status: 400,
          detail: "Rating must be between 1 and 5",
          instance: req.url,
        },
        { status: 400 }
      );
    }

    // Update review
    const review = await reviewsService.updateReview(reviewId, user.id, {
      rating: body.rating,
      comment: body.comment,
    });

    console.log('✅ [REVIEWS API] Review updated:', review.id);

    return NextResponse.json(review);
  } catch (error: any) {
    console.error("❌ [REVIEWS API] PUT Error:", error);
    return NextResponse.json(
      {
        type: error.type || "https://api.shop.am/problems/internal-error",
        title: error.title || "Internal Server Error",
        status: error.status || 500,
        detail: error.detail || error.message || "An error occurred",
        instance: req.url,
      },
      { status: error.status || 500 }
    );
  }
}

/**
 * DELETE /api/v1/reviews/[reviewId]
 * Delete a review
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    // Authenticate user
    const user = await authenticateToken(req);
    if (!user) {
      return NextResponse.json(
        {
          type: "https://api.shop.am/problems/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Authentication required",
          instance: req.url,
        },
        { status: 401 }
      );
    }

    const { reviewId } = await params;

    console.log('📝 [REVIEWS API] DELETE request:', { reviewId, userId: user.id });

    await reviewsService.deleteReview(reviewId, user.id);

    console.log('✅ [REVIEWS API] Review deleted:', reviewId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [REVIEWS API] DELETE Error:", error);
    return NextResponse.json(
      {
        type: error.type || "https://api.shop.am/problems/internal-error",
        title: error.title || "Internal Server Error",
        status: error.status || 500,
        detail: error.detail || error.message || "An error occurred",
        instance: req.url,
      },
      { status: error.status || 500 }
    );
  }
}

