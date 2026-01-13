# 🔧 Լուծում: attribute_values.colors column-ի error

## ❌ Error Message
```
The column `attribute_values.colors` does not exist in the current database.
```

## ✅ Լուծում

### Քայլ 1: Աշխատեցրեք Migration SQL-ը

1. Բացեք ձեր database tool-ը (pgAdmin, DBeaver, psql, կամ այլ)
2. Կապվեք ձեր PostgreSQL database-ին
3. Բացեք `MIGRATE_ATTRIBUTE_VALUES_COLORS.sql` file-ը
4. Copy-paste արեք SQL-ը և աշխատեցրեք
5. Ստուգեք, որ column-ները ստեղծվել են

### Քայլ 2: Restart Next.js Server

Migration-ից հետո **պարտադիր restart անեք** development server-ը:

```bash
# Stop server (Ctrl+C)
# Restart
npm run dev
```

## 🔍 Ստուգում

Migration-ից հետո ստուգեք database-ում:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attribute_values' 
AND column_name IN ('colors', 'imageUrl');
```

Եթե տեսնում եք երկու row (`colors` JSONB և `imageUrl` TEXT), migration-ը հաջող է եղել:

## 📝 Այլընտրանքային մեթոդներ

### Prisma db push (եթե DATABASE_URL-ը կարգավորված է)

```bash
cd packages/db
npx prisma db push
```

### Prisma migrate dev

```bash
cd packages/db
npx prisma migrate dev --name add_colors_and_image_to_attribute_value
```

## ⚠️ Կարևոր

- Migration-ից հետո **պարտադիր restart** անեք server-ը
- Եթե error-ը շարունակվում է, ստուգեք, որ migration-ը հաջող է ավարտվել
- Database connection-ը պետք է լինի ակտիվ

## 📞 Օգնություն

Եթե migration-ից հետո error-ը շարունակվում է, ստուգեք:
1. Database connection-ը
2. Migration-ի success message-ները
3. Server logs-ում error-ները


