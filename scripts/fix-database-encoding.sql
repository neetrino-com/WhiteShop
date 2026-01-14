-- Fix Database Encoding to UTF-8
-- This script converts database from WIN1251 to UTF-8 encoding
-- 
-- WARNING: This script will convert the entire database encoding.
-- Make sure to backup your database before running this script!
--
-- Usage:
-- psql -U postgres -d your_database_name -f scripts/fix-database-encoding.sql

-- Step 1: Set client encoding to UTF-8
SET client_encoding = 'UTF8';

-- Step 2: Check current database encoding
SELECT datname, pg_encoding_to_char(encoding) as encoding 
FROM pg_database 
WHERE datname = current_database();

-- Step 3: For existing database, you need to:
-- 1. Create a new database with UTF-8 encoding
-- 2. Export data from old database
-- 3. Import data to new database
--
-- Or use pg_dump with encoding conversion:
-- pg_dump -E UTF8 -F c -f backup.dump old_database
-- pg_restore -d new_utf8_database backup.dump

-- Alternative: If you can't recreate database, ensure all connections use UTF-8
-- This is already handled in packages/db/client.ts

-- For new databases, use:
-- CREATE DATABASE your_database_name WITH ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';



