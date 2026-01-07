import { db } from "@white-shop/db";

// Cache to track if table check has been performed
let tableChecked = false;
let tableExists = false;

/**
 * Ensures the product_attributes table exists in the database
 * This is a fallback mechanism for Vercel deployments where migrations might not run automatically
 * Uses lazy initialization - checks only once per process
 * 
 * @returns Promise<boolean> - true if table exists or was created, false if creation failed
 */
export async function ensureProductAttributesTable(): Promise<boolean> {
  // If already checked and exists, return immediately
  if (tableChecked && tableExists) {
    return true;
  }
  try {
    // Try to query the table to check if it exists
    await db.$queryRaw`SELECT 1 FROM "product_attributes" LIMIT 1`;
    tableChecked = true;
    tableExists = true;
    return true;
  } catch (error: any) {
    // If table doesn't exist, create it
    if (
      error?.code === 'P2021' || 
      error?.message?.includes('does not exist') ||
      error?.message?.includes('product_attributes')
    ) {
      console.log('🔧 [DB UTILS] product_attributes table not found, creating...');
      
      try {
        // Create table if it doesn't exist
        await db.$executeRaw`
          CREATE TABLE IF NOT EXISTS "product_attributes" (
            "id" TEXT NOT NULL,
            "productId" TEXT NOT NULL,
            "attributeId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
          )
        `;

        // Create unique index if it doesn't exist
        await db.$executeRaw`
          CREATE UNIQUE INDEX IF NOT EXISTS "product_attributes_productId_attributeId_key" 
          ON "product_attributes"("productId", "attributeId")
        `;

        // Create indexes if they don't exist
        await db.$executeRaw`
          CREATE INDEX IF NOT EXISTS "product_attributes_productId_idx" 
          ON "product_attributes"("productId")
        `;

        await db.$executeRaw`
          CREATE INDEX IF NOT EXISTS "product_attributes_attributeId_idx" 
          ON "product_attributes"("attributeId")
        `;

        // Add foreign key constraints if they don't exist
        // Check and add productId foreign key
        const productFkExists = await db.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'product_attributes_productId_fkey'
          ) as exists
        `;

        if (!productFkExists[0]?.exists) {
          await db.$executeRaw`
            ALTER TABLE "product_attributes" 
            ADD CONSTRAINT "product_attributes_productId_fkey" 
            FOREIGN KEY ("productId") 
            REFERENCES "products"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE
          `;
        }

        // Check and add attributeId foreign key
        const attributeFkExists = await db.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'product_attributes_attributeId_fkey'
          ) as exists
        `;

        if (!attributeFkExists[0]?.exists) {
          await db.$executeRaw`
            ALTER TABLE "product_attributes" 
            ADD CONSTRAINT "product_attributes_attributeId_fkey" 
            FOREIGN KEY ("attributeId") 
            REFERENCES "attributes"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE
          `;
        }

        // Create trigger for updatedAt (if it doesn't exist)
        const triggerExists = await db.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'product_attributes_updated_at'
          ) as exists
        `;

        if (!triggerExists[0]?.exists) {
          await db.$executeRaw`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW."updatedAt" = CURRENT_TIMESTAMP;
              RETURN NEW;
            END;
            $$ language 'plpgsql';

            CREATE TRIGGER product_attributes_updated_at
            BEFORE UPDATE ON "product_attributes"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
          `;
        }

        console.log('✅ [DB UTILS] product_attributes table created successfully');
        tableChecked = true;
        tableExists = true;
        return true;
      } catch (createError: any) {
        console.error('❌ [DB UTILS] Failed to create product_attributes table:', {
          message: createError?.message,
          code: createError?.code,
        });
        tableChecked = true;
        tableExists = false;
        return false;
      }
    }
    
    // Other errors - log and return false
    console.error('❌ [DB UTILS] Unexpected error checking product_attributes table:', {
      message: error?.message,
      code: error?.code,
    });
    tableChecked = true;
    tableExists = false;
    return false;
  }
}

