-- Add colors (JSON) column to attribute_values table
-- This migration adds support for multiple colors per attribute value

ALTER TABLE "attribute_values" 
ADD COLUMN IF NOT EXISTS "colors" JSONB DEFAULT '[]'::jsonb;

-- Note: If colorHex column exists, you may want to migrate data from colorHex to colors array
-- Example migration script (run separately if needed):
-- UPDATE "attribute_values" 
-- SET "colors" = CASE 
--   WHEN "colorHex" IS NOT NULL THEN jsonb_build_array("colorHex")
--   ELSE '[]'::jsonb
-- END
-- WHERE "colorHex" IS NOT NULL;


