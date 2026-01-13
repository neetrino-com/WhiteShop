# 🔧 Լուծում: colors և imageUrl սյունակների սխալ

## ❌ Խնդիր
```
The column `attribute_values.colors` does not exist in the current database.
```

## ✅ Լուծում

### Քայլ 1: Կանգնեցրեք Next.js dev server-ը
Եթե server-ը աշխատում է, կանգնեցրեք այն (Ctrl+C):

### Քայլ 2: Ավելացրեք սյունակները database-ում

**Տարբերակ A: SQL Script (Առաջարկվող)**
1. Բացեք ձեր PostgreSQL client-ը (pgAdmin, DBeaver, psql, և այլն)
2. Աշխատեցրեք `QUICK_FIX_COLORS.sql` ֆայլի բովանդակությունը
3. Ստուգեք, որ սյունակները ավելացվել են

**Տարբերակ B: Prisma db push**
```bash
cd packages/db
npx prisma db push
```
(Պահանջում է DATABASE_URL-ը .env ֆայլում)

### Քայլ 3: Վերագեներացրեք Prisma client-ը
```bash
cd packages/db
npx prisma generate
```

### Քայլ 4: Վերագործարկեք Next.js dev server-ը
```bash
npm run dev
```

## 📋 Ստուգում

SQL script-ը ավտոմատ կերպով կստուգի, որ սյունակները ավելացվել են:

Կամ կարող եք աշխատեցնել այս SQL query-ը:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attribute_values' 
AND column_name IN ('colors', 'imageUrl');
```

## ✅ Ակնկալվող արդյունք

Սյունակները պետք է լինեն:
- `colors` - JSONB տիպ, default: `[]`
- `imageUrl` - TEXT տիպ, nullable

Այնուհետև attributes-ում գույն և նկար ավելացնելիս error չպետք է լինի:


