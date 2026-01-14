# Product Reviews Migration

## Նկարագրություն

Ավելացվել է Product Review functionality backend-ում: Review-ները այժմ պահվում են database-ում, ոչ թե localStorage-ում, ինչը թույլ է տալիս բոլոր օգտատերերին տեսնել review-ները:

## Ինչ է ավելացվել

1. **Prisma Schema** - `ProductReview` model
2. **Service Layer** - `reviews.service.ts`
3. **API Routes** - `/api/v1/products/[productId]/reviews`
4. **Frontend Updates** - `ProductReviews` component և product page

## Database Migration

### Քայլ 1: Prisma Schema-ի թարմացում

Schema-ն արդեն թարմացված է `packages/db/prisma/schema.prisma`-ում:

### Քայլ 2: Migration-ի աշխատեցում

Development-ի համար (արագ):
```bash
cd packages/db
npm run db:push
```

Production-ի համար (migration file-ով):
```bash
cd packages/db
npm run db:migrate
# Enter migration name: add_product_reviews
```

### Քայլ 3: Prisma Client-ի regenerate

Migration-ից հետո:
```bash
cd packages/db
npm run db:generate
```

### Քայլ 4: Server-ի restart

Restart անեք Next.js development server-ը:
```bash
# Stop server (Ctrl+C)
npm run dev
```

## API Endpoints

### GET /api/v1/products/[productId]/reviews
Ստանալ բոլոր review-ները product-ի համար:

**Response:**
```json
[
  {
    "id": "review_id",
    "userId": "user_id",
    "userName": "John Doe",
    "rating": 5,
    "comment": "Great product!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "published": true
  }
]
```

### POST /api/v1/products/[productId]/reviews
Ստեղծել նոր review:

**Request:**
```json
{
  "rating": 5,
  "comment": "Great product!"
}
```

**Response:**
```json
{
  "id": "review_id",
  "userId": "user_id",
  "userName": "John Doe",
  "rating": 5,
  "comment": "Great product!",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "published": true
}
```

**Authentication:** Required (Bearer token)

**Validation:**
- `rating` պետք է լինի 1-5 միջակայքում
- `comment` optional է
- Մեկ օգտատեր կարող է գրել միայն մեկ review մեկ product-ի համար

## Database Schema

```prisma
model ProductReview {
  id        String   @id @default(cuid())
  productId String
  userId    String
  rating    Int      // 1-5 stars
  comment   String?  @db.Text
  published Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([userId])
  @@index([published, createdAt(sort: Desc)])
  @@unique([productId, userId]) // One review per user per product
  @@map("product_reviews")
}
```

## Frontend Changes

1. **ProductReviews Component** - այժմ օգտագործում է API-ն localStorage-ի փոխարեն
2. **Product Page** - review-ները բեռնվում են backend-ից
3. **Translation Keys** - ավելացվել է `alreadyReviewed` key

## Testing

1. **Login** - մուտք գործեք որպես օգտատեր
2. **Navigate** - գնացեք product page
3. **Write Review** - գրեք review աստղերով և comment-ով
4. **Submit** - ուղարկեք review
5. **Verify** - ստուգեք, որ review-ը հայտնվում է բոլոր օգտատերերի համար

## Notes

- Review-ները պահվում են database-ում, ոչ localStorage-ում
- Մեկ օգտատեր կարող է գրել միայն մեկ review մեկ product-ի համար
- Review-ները ավտոմատ publish են լինում
- Review-ները ցուցադրվում են `createdAt` descending order-ով

