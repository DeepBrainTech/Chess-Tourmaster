# Chess Tourmaster Docker 测试脚本 (PowerShell)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Chess Tourmaster - Docker 测试" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# 检查 Docker 是否安装
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
    Write-Host "✅ Docker 和 Docker Compose 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker 或 Docker Compose 未安装" -ForegroundColor Red
    exit 1
}

# 检查环境变量文件
if (-not (Test-Path .env)) {
    Write-Host "⚠️  .env 文件不存在，从 .env.example 复制..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "⚠️  请编辑 .env 文件设置正确的配置" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "1. 构建 Docker 镜像..." -ForegroundColor Cyan
docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 镜像构建成功" -ForegroundColor Green

Write-Host ""
Write-Host "2. 启动服务..." -ForegroundColor Cyan
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 启动失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 服务启动成功" -ForegroundColor Green

Write-Host ""
Write-Host "3. 等待服务就绪（30秒）..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "4. 检查服务状态..." -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "5. 测试数据库连接..." -ForegroundColor Cyan
docker-compose exec -T db pg_isready -U chess_user

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 数据库连接正常" -ForegroundColor Green
} else {
    Write-Host "❌ 数据库连接失败" -ForegroundColor Red
}

Write-Host ""
Write-Host "6. 测试应用健康检查..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ 应用响应正常" -ForegroundColor Green
} catch {
    Write-Host "❌ 应用无响应" -ForegroundColor Red
}

Write-Host ""
Write-Host "7. 查看应用日志（最后 20 行）..." -ForegroundColor Cyan
docker-compose logs --tail=20 app

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Green
Write-Host ""
Write-Host "访问应用: http://localhost:3000" -ForegroundColor Yellow
Write-Host "查看日志: docker-compose logs -f app" -ForegroundColor Yellow
Write-Host "停止服务: docker-compose down" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan
