# syntax=docker/dockerfile:1

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs server.js mock-backend.js ./
COPY --chown=nodejs:nodejs config ./config
COPY --chown=nodejs:nodejs core ./core
# core/ai included in core/
COPY --chown=nodejs:nodejs middleware ./middleware
COPY --chown=nodejs:nodejs models ./models
COPY --chown=nodejs:nodejs plugins ./plugins
COPY --chown=nodejs:nodejs routes ./routes
COPY --chown=nodejs:nodejs services ./services
COPY --chown=nodejs:nodejs utils ./utils
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs docker ./docker
RUN chmod +x /app/docker/entrypoint.sh

ENV NODE_ENV=production \
    PORT=3001

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/docker/entrypoint.sh"]
