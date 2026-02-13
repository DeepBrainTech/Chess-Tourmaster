# Chess Tourmaster 开发环境 Docker 启动脚本 (PowerShell)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Chess Tourmaster - 开发环境启动" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# 检查 Docker
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
    Write-Host "✅ Docker 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker 未安装" -ForegroundColor Red
    exit 1
}

# 检查环境变量文件
if (-not (Test-Path .env.development)) {
    Write-Host "⚠️  .env.development 不存在，创建默认配置..." -ForegroundColor Yellow
    Copy-Item .env.development.example .env.development -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "🚀 启动开发环境..." -ForegroundColor Cyan

# 使用开发配置启动
docker-compose -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 开发环境启动成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📱 访问地址:" -ForegroundColor Yellow
    Write-Host "   应用: http://localhost:3000" -ForegroundColor White
    Write-Host "   Prisma Studio: http://localhost:5555" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 常用命令:" -ForegroundColor Yellow
    Write-Host "   查看日志: docker-compose -f docker-compose.dev.yml logs -f app" -ForegroundColor White
    Write-Host "   重启应用: docker-compose -f docker-compose.dev.yml restart app" -ForegroundColor White
    Write-Host "   停止服务: docker-compose -f docker-compose.dev.yml down" -ForegroundColor White
    Write-Host "   进入容器: docker-compose -f docker-compose.dev.yml exec app sh" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 提示: 代码修改会自动热重载！" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
} else {
    Write-Host "❌ 启动失败，查看错误信息" -ForegroundColor Red
    docker-compose -f docker-compose.dev.yml logs --tail=50
}
