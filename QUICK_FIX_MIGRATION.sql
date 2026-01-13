-- QUICK FIX: Add colors and imageUrl to attribute_values table
-- Copy and paste this SQL into your database tool (pgAdmin, DBeaver, psql, etc.)

-- Step 1: Add colors column (JSONB)
ALTER TABLE "attribute_values" 
ADD COLUMN IF NOT EXISTS "colors" JSONB;

-- Step 2: Add imageUrl column (TEXT)
ALTER TABLE "attribute_values" 
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Step 3: Create index for better performance (optional)
CREATE INDEX IF NOT EXISTS "attribute_values_colors_idx" ON "attribute_values" USING GIN ("colors");

-- Step 4: Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attribute_values' 
AND column_name IN ('colors', 'imageUrl');

-- After running this, restart your Next.js development server!


