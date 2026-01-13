-- ============================================
-- SQL Script to Add colors and imageUrl Columns
-- ============================================
-- Run this SQL in your database (pgAdmin, DBeaver, psql, etc.)
-- After running this, uncomment the fields in schema.prisma and restart the server

-- Step 1: Add colors column (JSONB) if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'attribute_values' 
        AND column_name = 'colors'
    ) THEN
        ALTER TABLE "attribute_values" ADD COLUMN "colors" JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '✅ Column "colors" added to attribute_values table';
    ELSE
        RAISE NOTICE 'ℹ️ Column "colors" already exists in attribute_values table';
    END IF;
END $$;

-- Step 2: Add imageUrl column (TEXT) if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'attribute_values' 
        AND column_name = 'imageUrl'
    ) THEN
        ALTER TABLE "attribute_values" ADD COLUMN "imageUrl" TEXT;
        RAISE NOTICE '✅ Column "imageUrl" added to attribute_values table';
    ELSE
        RAISE NOTICE 'ℹ️ Column "imageUrl" already exists in attribute_values table';
    END IF;
END $$;

-- Step 3: Create index for better performance (optional, safe to run multiple times)
CREATE INDEX IF NOT EXISTS "attribute_values_colors_idx" ON "attribute_values" USING GIN ("colors");

-- Step 4: Verify columns were added
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'attribute_values' 
AND column_name IN ('colors', 'imageUrl')
ORDER BY column_name;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Uncomment colors and imageUrl fields in packages/db/prisma/schema.prisma';
    RAISE NOTICE '2. Run: cd packages/db && npx prisma generate';
    RAISE NOTICE '3. Restart your Next.js development server';
    RAISE NOTICE '';
END $$;


