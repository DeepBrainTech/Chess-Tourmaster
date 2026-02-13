#!/bin/bash

# Chess Tourmaster 开发环境 Docker 启动脚本

echo "======================================"
echo "Chess Tourmaster - 开发环境启动"
echo "======================================"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo "✅ Docker 已安装"

# 检查环境变量文件
if [ ! -f .env.development ]; then
    echo "⚠️  .env.development 不存在，创建默认配置..."
    cp .env.development.example .env.development 2>/dev/null || true
fi

echo ""
echo "🚀 启动开发环境..."

# 使用开发配置启动
docker-compose -f docker-compose.dev.yml up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 开发环境启动成功！"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📱 访问地址:"
    echo "   应用: http://localhost:3000"
    echo "   Prisma Studio: http://localhost:5555"
    echo ""
    echo "🔧 常用命令:"
    echo "   查看日志: docker-compose -f docker-compose.dev.yml logs -f app"
    echo "   重启应用: docker-compose -f docker-compose.dev.yml restart app"
    echo "   停止服务: docker-compose -f docker-compose.dev.yml down"
    echo "   进入容器: docker-compose -f docker-compose.dev.yml exec app sh"
    echo ""
    echo "💡 提示: 代码修改会自动热重载！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ 启动失败，查看错误信息"
    docker-compose -f docker-compose.dev.yml logs --tail=50
fi
