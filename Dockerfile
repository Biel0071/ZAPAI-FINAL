FROM node:20-slim AS base

# Install OS-level dependencies needed by canvas/sharp if present
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Backend dependencies ──
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# ── Frontend build ──
COPY frontend-official/package*.json ./frontend-official/
RUN cd frontend-official && npm ci

COPY frontend-official/ ./frontend-official/
RUN cd frontend-official && npm run build

# ── Backend source ──
COPY backend/ ./backend/

# ── Production stage (smaller) ──
FROM node:20-slim AS production

WORKDIR /app

# Copy backend with node_modules
COPY --from=base /app/backend ./backend

# Copy frontend production build
COPY --from=base /app/frontend-official/dist ./frontend-official/dist

# WhatsApp session persistence volume
VOLUME ["/app/backend/.sessions"]

# Health check via /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "const h=require('http');h.get('http://localhost:4025/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

EXPOSE 4025

ENV NODE_ENV=production
ENV PORT=4025

CMD ["node", "backend/server.js"]
