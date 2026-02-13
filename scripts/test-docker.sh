#!/bin/bash

# Chess Tourmaster Docker 测试脚本

echo "======================================"
echo "Chess Tourmaster - Docker 测试"
echo "======================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo "✅ Docker 和 Docker Compose 已安装"

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从 .env.example 复制..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件设置正确的配置"
fi

echo ""
echo "1. 构建 Docker 镜像..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 镜像构建成功"

echo ""
echo "2. 启动服务..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ 启动失败"
    exit 1
fi

echo "✅ 服务启动成功"

echo ""
echo "3. 等待服务就绪（30秒）..."
sleep 30

echo ""
echo "4. 检查服务状态..."
docker-compose ps

echo ""
echo "5. 测试数据库连接..."
docker-compose exec -T db pg_isready -U chess_user

if [ $? -eq 0 ]; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
fi

echo ""
echo "6. 测试应用健康检查..."
curl -f http://localhost:3000/ > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 应用响应正常"
else
    echo "❌ 应用无响应"
fi

echo ""
echo "7. 查看应用日志（最后 20 行）..."
docker-compose logs --tail=20 app

echo ""
echo "======================================"
echo "测试完成！"
echo ""
echo "访问应用: http://localhost:3000"
echo "查看日志: docker-compose logs -f app"
echo "停止服务: docker-compose down"
echo "======================================"
