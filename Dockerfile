# syntax=docker/dockerfile:1
#
# saints-crm — image for a VPS.
#
# Three stages, one image. The runner keeps the production `node_modules` and the real
# `.next` build instead of Next's `standalone` trace, because the container has to do two
# things the traced output cannot: `prisma migrate deploy` (needs the CLI, the schema,
# `prisma7.config.ts` and the query engine) and `npm run db:seed` (needs `tsx`). The
# trade-off is size — roughly 600 MB against about 200 MB for standalone — and it is the
# right one here: an internal CRM that brings its own migrations is worth more than a
# slim image whose first boot cannot create its own tables.
#
# Build:  docker compose build        Run:  docker compose up -d   (see README)

### deps — one layer per lockfile, so a source edit does not reinstall anything
FROM node:24-slim AS deps
WORKDIR /app

# openssl is what Prisma's engine links against on Debian slim images.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# `npm ci` runs the install scripts here, which is what downloads the Prisma engines.
# On the developer machine those scripts are blocked by an npm allow-scripts policy;
# inside the image they are the point.
RUN npm ci --no-audit --no-fund

### builder — generate the client, type-check and build
FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The generated client is gitignored, so it is produced here rather than copied in.
# No .env: the build must not read a real database. `prisma generate` only parses the
# schema, and every query in the app is behind a route handler or a page.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

### runner
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/lib/generated/prisma ./lib/generated/prisma
COPY --from=builder --chown=node:node /app/package.json /app/tsconfig.json /app/next.config.ts /app/prisma7.config.ts ./
COPY --from=builder --chown=node:node /app/docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# Not root: nothing here needs to bind a privileged port, and a leaked secret in the app
# should not be able to write outside the work directory.
USER node

EXPOSE 3000

# The sign-in page is the cheapest route that answers 200 without a session: `/` redirects
# anonymous traffic, and a redirect would hide a broken page shell behind a green check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/auth/login" > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
