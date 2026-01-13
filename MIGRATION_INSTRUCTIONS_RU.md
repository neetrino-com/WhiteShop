# 🔧 Լուծում: attribute_values.colors column-ի բացակայություն

## Խնդիր
Error: `The column attribute_values.colors does not exist in the current database.`

## Լուծում

### Տարբերակ 1: SQL Migration (Առաջարկվող)

1. Բացեք ձեր database tool-ը (pgAdmin, DBeaver, psql, կամ այլ)
2. Կապվեք ձեր database-ին
3. Բացեք `MIGRATE_ATTRIBUTE_VALUES_COLORS.sql` file-ը
4. Աշխատեցրեք SQL-ը ձեր database-ում
5. Restart անեք Next.js development server-ը

### Տարբերակ 2: Prisma db push (Եթե DATABASE_URL-ը կարգավորված է)

```bash
cd packages/db
npx prisma db push
```

### Տարբերակ 3: Prisma migrate dev

```bash
cd packages/db
npx prisma migrate dev --name add_colors_and_image_to_attribute_value
```

## Ստուգում

Migration-ից հետո ստուգեք, որ column-ները ստեղծվել են:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attribute_values' 
AND column_name IN ('colors', 'imageUrl');
```

Եթե տեսնում եք երկու row (`colors` և `imageUrl`), migration-ը հաջող է եղել:

## ⚠️ Կարևոր

Migration-ից հետո **պարտադիր restart անեք Next.js development server-ը** (Ctrl+C և հետո `npm run dev`):


