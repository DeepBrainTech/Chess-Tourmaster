===========================================
Chess Tourmaster - Next.js 版本
===========================================

项目结构说明
-----------

/app                     - Next.js App Router 目录
  /api                   - API 路由
    /progress            - 游戏进度 API
    /leaderboard         - 排行榜 API
  page.tsx              - 首页
  layout.tsx            - 布局组件
  globals.css           - 全局样式

/components             - React 组件
  Game.tsx             - 游戏主组件
  GameState.tsx        - 游戏状态管理

/lib                    - 工具库
  prisma.ts            - Prisma 客户端
  auth.ts              - JWT 认证工具
  gameApi.ts           - 游戏 API 客户端

/prisma                 - 数据库配置
  schema.prisma        - 数据库模型定义

/public                 - 静态资源
  game.js              - 游戏逻辑（从原 HTML 提取）

安装步骤
--------

1. 安装依赖
   npm install

2. 配置环境变量
   复制 .env.example 到 .env
   修改数据库连接字符串和 JWT 密钥

3. 初始化数据库
   npx prisma generate
   npx prisma db push

4. 启动开发服务器
   npm run dev

5. 访问 http://localhost:3000

数据库配置
----------

确保你的 PostgreSQL 数据库已经创建：

CREATE DATABASE chess_tourmaster;

然后在 .env 文件中配置正确的连接字符串：

DATABASE_URL="postgresql://username:password@localhost:5432/chess_tourmaster?schema=public"

JWT 配置
--------

需要与主站保持一致的 JWT 密钥：

JWT_SECRET="your-main-site-jwt-secret"
TOURMASTER_JWT_SECRET="your-tourmaster-specific-secret"

API 端点
--------

POST /api/progress/save
- 保存游戏进度
- 需要 JWT 认证
- Body: { high_score: number, total_levels?: number }

GET /api/progress/load
- 加载游戏进度
- 需要 JWT 认证

GET /api/leaderboard?limit=10
- 获取排行榜
- 无需认证

用户认证流程
-----------

1. 用户在主站登录
2. 主站调用 /api/games/chess-tourmaster/token 获取游戏 token
3. 主站将用户重定向到: https://chess-tourmaster.com/#token=JWT_TOKEN
4. 游戏前端从 URL hash 中提取 token
5. 游戏使用 token 调用后端 API

部署
----

推荐使用 Vercel 部署：

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

数据库表结构
-----------

game_progress
- id: 主键
- portal_user_id: 主站用户 ID（唯一）
- username: 用户名
- high_score: 最高分数
- total_levels: 完成的关卡数
- created_at: 创建时间
- updated_at: 更新时间

leaderboard
- id: 主键
- portal_user_id: 主站用户 ID
- username: 用户名
- high_score: 分数
- rank: 排名
- created_at: 创建时间

注意事项
--------

1. 所有用户数据使用 portal_user_id 标识
2. 不使用 localStorage，全部数据存储在数据库
3. JWT token 需要与主站保持一致
4. API 路由自动验证 token 有效性

原始 HTML 文件
-------------

原始的 index.html 文件已备份为 index.html.bak
如需参考，可以查看备份文件
