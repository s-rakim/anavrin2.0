# syntax=docker/dockerfile:1.7
# Anavrin: one image that serves the API, the live (Socket.IO) connection and the built storefront.
ARG NODE_VERSION=24.21.0
ARG ALPINE_VERSION=3.24

# ---- 1. Build the storefront (React + Vite) ----
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---- 2. Install the server's production dependencies only ----
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

# ---- 3. Runtime ----
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY server/scripts ./server/scripts
COPY --from=client-build /app/client/dist ./client/dist
# The database, uploaded product images and the generated session secret live in /data.
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
