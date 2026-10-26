# Production image for Jara Finance. Built and run through docker-compose.prod.yml.
#
#   deps     pnpm install from the lockfile only, so the layer caches until it changes
#   build    nuxt build -> .output (Nitro bundles its own server node_modules)
#   migrate  one-off: Drizzle migrations, then the idempotent category seed
#   prod     .output alone, run as the unprivileged node user

FROM node:22.22.0-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
COPY package.json pnpm-lock.yaml ./
# `postinstall` runs `nuxt prepare`, which needs the source; `nuxt build` prepares anyway.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm build

# drizzle-kit and tsx are dev dependencies, so migrations run from the full tree.
# Both read DATABASE_URL straight from the environment.
FROM deps AS migrate
COPY . .
CMD ["sh", "-c", "pnpm exec drizzle-kit migrate && pnpm exec tsx server/database/seed.ts"]

FROM node:22.22.0-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD wget -q --spider http://127.0.0.1:3100/api/health || exit 1
CMD ["node", ".output/server/index.mjs"]
