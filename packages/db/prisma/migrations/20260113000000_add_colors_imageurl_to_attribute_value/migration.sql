-- AlterTable
ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "colors" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attribute_values_colors_idx" ON "attribute_values" USING GIN ("colors");


