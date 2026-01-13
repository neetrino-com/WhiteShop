-- Migration: Add colors and imageUrl to attribute_values table
-- Date: 2025-01-XX
-- Description: Adds support for multiple colors (JSONB) and image URL for attribute values

-- Add colors column (JSONB) to store array of color hex codes
ALTER TABLE "attribute_values" 
ADD COLUMN IF NOT EXISTS "colors" JSONB;

-- Add imageUrl column (TEXT) to store image URL/path
ALTER TABLE "attribute_values" 
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Create index on colors for better query performance (optional)
CREATE INDEX IF NOT EXISTS "attribute_values_colors_idx" ON "attribute_values" USING GIN ("colors");

-- Note: Existing values will have NULL for colors and imageUrl
-- You can update them later if needed:
-- UPDATE "attribute_values" SET "colors" = '[]'::jsonb WHERE "colors" IS NULL;


