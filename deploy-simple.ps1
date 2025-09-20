Write-Host "Deploying CCRB with geo endpoints fix..." -ForegroundColor Green

git add .
git commit -m "Fix: Geo endpoints for Vercel"
git push origin main

Write-Host "Waiting for deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "App: https://presence-ccrb-system.vercel.app" -ForegroundColor Cyan
Write-Host "API: https://presence-ccrb-system.vercel.app/api/health" -ForegroundColor Cyan