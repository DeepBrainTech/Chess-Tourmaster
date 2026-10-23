FROM node:22-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS builder

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# Next.js embeds public configuration during the production build.
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_PORTAL_API_BASE=https://api.deepbraintechnology.com
ARG NEXT_PUBLIC_PORTAL_URL=https://deepbraintechnology.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PORTAL_API_BASE=$NEXT_PUBLIC_PORTAL_API_BASE \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL

RUN npm run build

FROM base AS production

ENV NODE_ENV=production \
    PORT=3000

# Keep Prisma CLI for the existing db:deploy startup command.
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

USER node

EXPOSE 3000

# db:deploy refuses schema changes that would lose data; do not force them here.
CMD ["sh", "-c", "npm run db:deploy && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port \"${PORT:-3000}\""]
