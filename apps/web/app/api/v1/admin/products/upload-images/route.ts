import { NextRequest, NextResponse } from "next/server";
import { authenticateToken, requireAdmin } from "@/lib/middleware/auth";

/**
 * POST /api/v1/admin/products/upload-images
 * Upload images and return URLs
 * 
 * Request body should contain:
 * - images: string[] (array of base64 image strings)
 * 
 * Response:
 * - urls: string[] (array of image URLs)
 */
export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  console.log("📤 [ADMIN UPLOAD IMAGES API] POST request received", { url: req.url });
  
  try {
    // Аутентификация и проверка прав администратора
    const user = await authenticateToken(req);
    if (!user || !requireAdmin(user)) {
      console.warn("⚠️ [ADMIN UPLOAD IMAGES API] Unauthorized POST attempt", { userId: user?.id });
      return NextResponse.json(
        {
          type: "https://api.shop.am/problems/forbidden",
          title: "Forbidden",
          status: 403,
          detail: "Admin access required",
          instance: req.url,
        },
        { status: 403 }
      );
    }

    // Парсинг тела запроса
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("❌ [ADMIN UPLOAD IMAGES API] JSON parse error:", parseError);
      return NextResponse.json(
        {
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          status: 400,
          detail: "Invalid JSON in request body",
          instance: req.url,
        },
        { status: 400 }
      );
    }

    // Валидация
    if (!Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json(
        {
          type: "https://api.shop.am/problems/validation-error",
          title: "Validation Error",
          status: 400,
          detail: "Field 'images' is required and must be a non-empty array",
          instance: req.url,
        },
        { status: 400 }
      );
    }

    // Проверка, что все элементы - валидные base64 изображения
    const validImages: string[] = [];
    for (let i = 0; i < body.images.length; i++) {
      const image = body.images[i];
      if (typeof image !== 'string') {
        return NextResponse.json(
          {
            type: "https://api.shop.am/problems/validation-error",
            title: "Validation Error",
            status: 400,
            detail: `Image at index ${i} must be a string`,
            instance: req.url,
          },
          { status: 400 }
        );
      }

      // Проверка, что это base64 изображение
      if (!image.startsWith('data:image/')) {
        return NextResponse.json(
          {
            type: "https://api.shop.am/problems/validation-error",
            title: "Validation Error",
            status: 400,
            detail: `Image at index ${i} must be a valid base64 image (data:image/...)`,
            instance: req.url,
          },
          { status: 400 }
        );
      }

      validImages.push(image);
    }

    console.log("📤 [ADMIN UPLOAD IMAGES API] Processing images:", {
      count: validImages.length,
    });

    // Возвращаем те же base64 строки как URL
    // В будущем здесь можно добавить сохранение в cloud storage (S3, Cloudinary, etc.)
    // и возвращать реальные URL
    const urls = validImages.map((image, index) => {
      // Для оптимизации можно сжать изображение здесь
      // Пока возвращаем как есть, но в будущем можно оптимизировать
      return image;
    });

    const totalTime = Date.now() - requestStartTime;
    console.log(`✅ [ADMIN UPLOAD IMAGES API] Images processed in ${totalTime}ms`, {
      count: urls.length,
    });

    return NextResponse.json({ urls }, { status: 200 });
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime;
    console.error("❌ [ADMIN UPLOAD IMAGES API] POST Error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      type: error?.type,
      status: error?.status,
      time: `${totalTime}ms`,
    });
    
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

