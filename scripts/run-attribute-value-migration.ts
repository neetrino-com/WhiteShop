/**
 * Script to add colors column to attribute_values table
 * Run this script after setting up DATABASE_URL in .env
 */

import { db } from '../packages/db';

async function runMigration() {
  try {
    console.log('🚀 Starting migration: Add colors column to attribute_values...\n');

    // Check if column already exists
    const result = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'attribute_values' AND column_name = 'colors';
    `;

    if (result.length > 0) {
      console.log('✅ Column "colors" already exists in attribute_values table');
      return;
    }

    // Add colors column
    console.log('📝 Adding colors column to attribute_values table...');
    await db.$executeRaw`
      ALTER TABLE "attribute_values" 
      ADD COLUMN IF NOT EXISTS "colors" JSONB DEFAULT '[]'::jsonb;
    `;

    console.log('✅ Migration completed successfully!');
    console.log('   Column "colors" has been added to attribute_values table');

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    if (error.message?.includes('DATABASE_URL')) {
      console.error('\n💡 Please make sure DATABASE_URL is set in .env file');
      console.error('   Format: DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"');
    }
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

runMigration();


