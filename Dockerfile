FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
COPY database ./database
COPY scripts ./scripts
COPY tsconfig.json tsconfig.base.json ./

RUN bun install --frozen-lockfile
RUN bun run typecheck
RUN bun run --cwd apps/api build

ENV NODE_ENV=production
ENV API_PORT=10000

EXPOSE 10000

CMD ["bun", "apps/api/src/server.ts"]

