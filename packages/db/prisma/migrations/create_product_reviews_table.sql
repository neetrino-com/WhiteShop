-- Create product_reviews table
-- This migration creates the product_reviews table for storing product reviews

CREATE TABLE IF NOT EXISTS "product_reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "product_reviews_productId_idx" ON "product_reviews"("productId");
CREATE INDEX IF NOT EXISTS "product_reviews_userId_idx" ON "product_reviews"("userId");
CREATE INDEX IF NOT EXISTS "product_reviews_published_createdAt_idx" ON "product_reviews"("published", "createdAt" DESC);

-- Create unique constraint (one review per user per product)
CREATE UNIQUE INDEX IF NOT EXISTS "product_reviews_productId_userId_key" ON "product_reviews"("productId", "userId");

-- Add foreign key constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'product_reviews_productId_fkey'
    ) THEN
        ALTER TABLE "product_reviews" 
        ADD CONSTRAINT "product_reviews_productId_fkey" 
        FOREIGN KEY ("productId") 
        REFERENCES "products"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'product_reviews_userId_fkey'
    ) THEN
        ALTER TABLE "product_reviews" 
        ADD CONSTRAINT "product_reviews_userId_fkey" 
        FOREIGN KEY ("userId") 
        REFERENCES "users"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

