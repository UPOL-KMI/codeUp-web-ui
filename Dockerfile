# ReCodEx new frontend (Next.js, App Router). Self-contained Dockerfile in this
# repo's own root -- unlike the other ReCodEx components in the sibling compose
# repo, this app isn't one of the upstream ReCodEx/* repos pulled by
# pull-repos.sh, so it doesn't share their single-root-context/services/<name>
# pattern. The compose entry (ticket F-004) points its build context at this
# repo directly instead.

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.ts reads URL_PATH_PREFIX at build time (basePath is not
# runtime-configurable -- see docs/DECISIONS.md and DROPPED.md).
ARG URL_PATH_PREFIX=""
ENV URL_PATH_PREFIX=$URL_PATH_PREFIX
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN useradd --system --create-home --home-dir /app --shell /usr/sbin/nologin recodex

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=recodex:recodex /app/public ./public
COPY --from=builder --chown=recodex:recodex /app/.next/standalone ./
COPY --from=builder --chown=recodex:recodex /app/.next/static ./.next/static

USER recodex
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
