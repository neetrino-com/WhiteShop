-- ============================================
-- Quick Fix: Add colors and imageUrl Columns
-- ============================================
-- Run this SQL directly in your PostgreSQL database (pgAdmin, DBeaver, psql, etc.)
-- This will add the missing columns to fix the error

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

-- Step 3: Create index for better performance
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
    RAISE NOTICE '1. Run: cd packages/db && npx prisma generate';
    RAISE NOTICE '2. Restart your Next.js development server';
    RAISE NOTICE '';
END $$;


