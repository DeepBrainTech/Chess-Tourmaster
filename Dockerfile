# Chess Tourmaster Dockerfile
# 多阶段构建，优化镜像大小

# 阶段 1: 依赖安装
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci --only=production

# 阶段 2: 构建应用
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js 应用
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 阶段 3: 运行时
FROM node:18-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# 设置文件权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
