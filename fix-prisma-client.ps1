# Script to regenerate Prisma client
# Run this after stopping your dev server

Write-Host "🔄 Regenerating Prisma Client..." -ForegroundColor Yellow

cd packages/db

Write-Host "📦 Running prisma generate..." -ForegroundColor Cyan
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma Client regenerated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Restart your Next.js development server" -ForegroundColor White
    Write-Host "2. Try saving attribute value again" -ForegroundColor White
} else {
    Write-Host "❌ Error regenerating Prisma Client" -ForegroundColor Red
    Write-Host "Make sure your dev server is stopped!" -ForegroundColor Yellow
}


